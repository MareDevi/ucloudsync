import { formatTickTickDate, TickTickClient } from "../adapters/ticktick";
import { KetangpaiClient } from "../clients/ketangpai";
import { UcloudClient } from "../clients/ucloud";
import type { TickTickTask } from "../types/ticktick";
import type { CryptoHelper } from "../utils/crypto";
import { parseKetangpaiDate, parseUcloudDate } from "../utils/date";

export interface UserRow {
	id: string;
	ucloud_account: string;
	ucloud_password: string;
	ucloud_access_token: string | null;
	ucloud_refresh_token: string | null;
	ucloud_user_id: string | null;
	ketangpai_token: string | null;
	ketangpai_uid: string | null;
	ticktick_access_token: string | null;
	ticktick_project_id: string | null;
	ucloud_enabled: number;
	ketangpai_enabled: number;
	ticktick_enabled: number;
	last_sync_time: number | null;
}

export interface SyncedTaskRow {
	source: "ucloud" | "ketangpai";
	activity_id: string;
	ticktick_task_id: string;
	user_id: string;
	projectId: string;
	title: string;
	due_date: string;
	source_status: number;
	ticktick_status: number;
}

/**
 * A simple regex-based HTML to Markdown converter for basic tags.
 */
function htmlToMarkdown(html: string): string {
	if (!html) return "";
	return html
		.replace(/<p[^>]*>/gi, "")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<strong[^>]*>/gi, "**")
		.replace(/<\/strong>/gi, "**")
		.replace(/<b[^>]*>/gi, "**")
		.replace(/<\/b>/gi, "**")
		.replace(/<em[^>]*>/gi, "_")
		.replace(/<\/em>/gi, "_")
		.replace(/<i[^>]*>/gi, "_")
		.replace(/<\/i>/gi, "_")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, "&")
		.trim();
}

export class SyncService {
	constructor(
		private readonly db: D1Database,
		private readonly crypto: CryptoHelper,
	) {}

	async syncAll(): Promise<void> {
		const { results: users } = await this.db
			.prepare(
				"SELECT * FROM users WHERE ticktick_access_token IS NOT NULL AND ticktick_enabled = 1 AND (ucloud_enabled = 1 OR ketangpai_enabled = 1)",
			)
			.all<UserRow>();

		await Promise.allSettled(
			users.map(async (user) => {
				try {
					await this.syncUser(user);
				} catch (error) {
					console.error(`Failed to sync user ${user.id}:`, error);
				}
			}),
		);
	}

	async syncUser(user: UserRow): Promise<{
		synced: number;
		updated: number;
		completed: number;
		skipped: number;
	}> {
		if (user.ticktick_enabled === 0 || !user.ticktick_access_token) {
			return { synced: 0, updated: 0, completed: 0, skipped: 0 };
		}

		const ticktickClient = new TickTickClient(user.ticktick_access_token);
		const targetProjectId = user.ticktick_project_id || "inbox";
		const results = { synced: 0, updated: 0, completed: 0, skipped: 0 };

		// Fetch all synced tasks for this user once
		const { results: localSyncedTasks } = await this.db
			.prepare("SELECT * FROM synced_tasks WHERE user_id = ?")
			.bind(user.id)
			.all<SyncedTaskRow>();

		const localSyncedMap = new Map(
			localSyncedTasks.map((t) => [`${t.source}:${t.activity_id}`, t]),
		);

		// Fetch current TickTick state (optional: might be large, but useful for orphan cleanup)
		const ticktickData =
			await ticktickClient.getProjectWithData(targetProjectId);
		const ticktickActiveMap = new Map(ticktickData.tasks.map((t) => [t.id, t]));

		// 1. Sync UCloud
		if (user.ucloud_enabled === 1) {
			try {
				const ucloudRes = await this.syncUcloud(
					user,
					ticktickClient,
					targetProjectId,
					localSyncedMap,
					ticktickActiveMap,
				);
				results.synced += ucloudRes.synced;
				results.updated += ucloudRes.updated;
				results.completed += ucloudRes.completed;
				results.skipped += ucloudRes.skipped;
			} catch (e) {
				console.error(`UCloud sync failed for ${user.id}:`, e);
			}
		}

		// 2. Sync Ketangpai
		if (user.ketangpai_enabled === 1 && user.ketangpai_token) {
			try {
				const ketangpaiRes = await this.syncKetangpai(
					user,
					ticktickClient,
					targetProjectId,
					localSyncedMap,
					ticktickActiveMap,
				);
				results.synced += ketangpaiRes.synced;
				results.updated += ketangpaiRes.updated;
				results.completed += ketangpaiRes.completed;
				results.skipped += ketangpaiRes.skipped;
			} catch (e) {
				console.error(`Ketangpai sync failed for ${user.id}:`, e);
			}
		}

		await this.db
			.prepare(
				"UPDATE users SET last_sync_time = (strftime('%s', 'now')), updated_at = (strftime('%s', 'now')) WHERE id = ?",
			)
			.bind(user.id)
			.run();

		return results;
	}

	private async syncUcloud(
		user: UserRow,
		ticktickClient: TickTickClient,
		targetProjectId: string,
		localSyncedMap: Map<string, SyncedTaskRow>,
		ticktickActiveMap: Map<string, TickTickTask>,
	) {
		const plainPassword = await this.crypto.decrypt(user.ucloud_password);
		const ucloudClient = new UcloudClient(
			user.ucloud_access_token || undefined,
		);
		let userId = user.ucloud_user_id;
		let ucloudAccessToken = user.ucloud_access_token;

		// Auth refresh logic
		try {
			let needsRefresh = !ucloudAccessToken || !userId;
			if (ucloudAccessToken && userId) {
				try {
					await ucloudClient.getUndoneList(userId);
				} catch (error) {
					if (error instanceof Error && error.message.includes("expired")) {
						needsRefresh = true;
					} else throw error;
				}
			}

			if (needsRefresh) {
				const userInfo = user.ucloud_refresh_token
					? await UcloudClient.refreshToken(user.ucloud_refresh_token).catch(
							() => UcloudClient.login(user.ucloud_account, plainPassword),
						)
					: await UcloudClient.login(user.ucloud_account, plainPassword);

				userId = userInfo.user_id;
				ucloudAccessToken = userInfo.access_token;
				await this.db
					.prepare(
						"UPDATE users SET ucloud_access_token = ?, ucloud_refresh_token = ?, ucloud_user_id = ?, updated_at = (strftime('%s', 'now')) WHERE id = ?",
					)
					.bind(ucloudAccessToken, userInfo.refresh_token, userId, user.id)
					.run();
				ucloudClient.setToken(ucloudAccessToken);
			}
		} catch (error) {
			throw new Error(`UCloud auth failed: ${error}`);
		}

		if (!userId) throw new Error("Could not determine UCloud user ID");

		const undoneData = await ucloudClient.getUndoneList(userId);
		const ucloudUndoneMap = new Map(
			undoneData.undoneList.map((t) => [t.activityId, t]),
		);

		let synced = 0,
			updated = 0,
			completed = 0,
			skipped = 0;

		for (const item of undoneData.undoneList) {
			try {
				const detail = await ucloudClient.getUndoneDetail(item.activityId);
				const key = `ucloud:${item.activityId}`;
				const syncedRecord = localSyncedMap.get(key);
				const ticktickTask = syncedRecord
					? ticktickActiveMap.get(syncedRecord.ticktick_task_id)
					: null;

				const taskTitle = `[UCloud][${detail.chapterName}] ${detail.assignmentTitle || item.activityName}`;
				const taskDueDate = formatTickTickDate(
					parseUcloudDate(detail.assignmentEndTime || item.endTime),
				);
				const markdownContent = htmlToMarkdown(detail.assignmentContent || "");

				if (!syncedRecord || !ticktickTask) {
					const newTask = await ticktickClient.createTask({
						title: taskTitle,
						projectId: targetProjectId,
						content: markdownContent,
						dueDate: taskDueDate,
						timeZone: "Asia/Shanghai",
						priority: 3,
					});

					await this.db
						.prepare(
							"INSERT INTO synced_tasks (source, activity_id, ticktick_task_id, user_id, projectId, title, due_date, source_status, ticktick_status) VALUES ('ucloud', ?, ?, ?, ?, ?, ?, 0, 0) ON CONFLICT(source, activity_id, user_id) DO UPDATE SET ticktick_task_id = EXCLUDED.ticktick_task_id, title = EXCLUDED.title, due_date = EXCLUDED.due_date, last_synced_at = (strftime('%s', 'now'))",
						)
						.bind(
							item.activityId,
							newTask.id,
							user.id,
							targetProjectId,
							taskTitle,
							taskDueDate,
						)
						.run();
					synced++;
				} else if (
					syncedRecord.title !== taskTitle ||
					syncedRecord.due_date !== taskDueDate
				) {
					await ticktickClient.updateTask({
						id: syncedRecord.ticktick_task_id,
						title: taskTitle,
						projectId: targetProjectId,
						dueDate: taskDueDate,
						timeZone: "Asia/Shanghai",
						content: markdownContent,
					});
					await this.db
						.prepare(
							"UPDATE synced_tasks SET title = ?, due_date = ?, last_synced_at = (strftime('%s', 'now')) WHERE source = 'ucloud' AND activity_id = ? AND user_id = ?",
						)
						.bind(taskTitle, taskDueDate, item.activityId, user.id)
						.run();
					updated++;
				} else skipped++;
			} catch (e) {
				console.error(`Failed to process UCloud item ${item.activityId}:`, e);
			}
		}

		// Completion check
		for (const [_key, record] of localSyncedMap) {
			if (
				record.source === "ucloud" &&
				!ucloudUndoneMap.has(record.activity_id) &&
				record.source_status === 0
			) {
				try {
					const detail = await ucloudClient.getUndoneDetail(record.activity_id);
					if (detail.status !== 0) {
						await ticktickClient
							.completeTask(record.projectId, record.ticktick_task_id)
							.catch(() => {});
						await this.db
							.prepare(
								"UPDATE synced_tasks SET source_status = ?, ticktick_status = 2, last_synced_at = (strftime('%s', 'now')) WHERE source = 'ucloud' AND activity_id = ? AND user_id = ?",
							)
							.bind(detail.status, record.activity_id, user.id)
							.run();
						completed++;
					}
				} catch (_e) {
					console.warn(`UCloud activity ${record.activity_id} check failed.`);
				}
			}
		}

		return { synced, updated, completed, skipped };
	}

	private async syncKetangpai(
		user: UserRow,
		ticktickClient: TickTickClient,
		targetProjectId: string,
		localSyncedMap: Map<string, SyncedTaskRow>,
		ticktickActiveMap: Map<string, TickTickTask>,
	) {
		if (!user.ketangpai_token)
			return { synced: 0, updated: 0, completed: 0, skipped: 0 };

		const kpClient = new KetangpaiClient(user.ketangpai_token);

		// Token check
		try {
			await kpClient.getUserInfo();
		} catch (_e) {
			console.error(`Ketangpai token expired for ${user.id}`);
			return { synced: 0, updated: 0, completed: 0, skipped: 0 };
		}

		const todoData = await kpClient.getTodoList(1, 50);
		// Only sync items where activitylabel is "作业" (contenttype "4")
		const workList = todoData.list.filter(
			(item) => item.activitylabel === "作业" || item.contenttype === "4",
		);
		const kpTodoMap = new Map(workList.map((t) => [t.id, t]));

		let synced = 0;
		let updated = 0;
		let completed = 0;
		let skipped = 0;

		for (const item of workList) {
			// In Ketangpai, list already contains enough info usually
			const key = `ketangpai:${item.id}`;

			const syncedRecord = localSyncedMap.get(key);
			const ticktickTask = syncedRecord
				? ticktickActiveMap.get(syncedRecord.ticktick_task_id)
				: null;

			const taskTitle = `[课堂派][${item.coursename}] ${item.contenttitle}`;
			const taskDueDate = formatTickTickDate(parseKetangpaiDate(item.endtime));
			const markdownContent = htmlToMarkdown(item.contentdescription || "");

			try {
				if (!syncedRecord || !ticktickTask) {
					const newTask = await ticktickClient.createTask({
						title: taskTitle,
						projectId: targetProjectId,
						content: markdownContent,
						dueDate: taskDueDate,
						timeZone: "Asia/Shanghai",
						priority: 3,
					});

					await this.db
						.prepare(
							"INSERT INTO synced_tasks (source, activity_id, ticktick_task_id, user_id, projectId, title, due_date, source_status, ticktick_status) VALUES ('ketangpai', ?, ?, ?, ?, ?, ?, 0, 0) ON CONFLICT(source, activity_id, user_id) DO UPDATE SET ticktick_task_id = EXCLUDED.ticktick_task_id, title = EXCLUDED.title, due_date = EXCLUDED.due_date, last_synced_at = (strftime('%s', 'now'))",
						)
						.bind(
							item.id,
							newTask.id,
							user.id,
							targetProjectId,
							taskTitle,
							taskDueDate,
						)
						.run();
					synced++;
				} else if (
					syncedRecord.title !== taskTitle ||
					syncedRecord.due_date !== taskDueDate
				) {
					await ticktickClient.updateTask({
						id: syncedRecord.ticktick_task_id,
						title: taskTitle,
						projectId: targetProjectId,
						dueDate: taskDueDate,
						timeZone: "Asia/Shanghai",
						content: markdownContent,
					});
					await this.db
						.prepare(
							"UPDATE synced_tasks SET title = ?, due_date = ?, last_synced_at = (strftime('%s', 'now')) WHERE source = 'ketangpai' AND activity_id = ? AND user_id = ?",
						)
						.bind(taskTitle, taskDueDate, item.id, user.id)
						.run();
					updated++;
				} else skipped++;
			} catch (e) {
				console.error(`Failed to process Ketangpai item ${item.id}:`, e);
			}
		}

		// Completion check
		for (const [_key, record] of localSyncedMap) {
			if (
				record.source === "ketangpai" &&
				!kpTodoMap.has(record.activity_id) &&
				record.source_status === 0
			) {
				try {
					await ticktickClient
						.completeTask(record.projectId, record.ticktick_task_id)
						.catch(() => {});
					await this.db
						.prepare(
							"UPDATE synced_tasks SET source_status = 2, ticktick_status = 2, last_synced_at = (strftime('%s', 'now')) WHERE source = 'ketangpai' AND activity_id = ? AND user_id = ?",
						)
						.bind(record.activity_id, user.id)
						.run();
					completed++;
				} catch (_e) {
					console.warn(
						`Ketangpai item ${record.activity_id} completion update failed.`,
					);
				}
			}
		}

		return { synced, updated, completed, skipped };
	}
}

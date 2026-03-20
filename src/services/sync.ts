import type { UserInfo } from "@byrdocs/bupt-auth";
import { formatTickTickDate, TickTickClient } from "../adapters/ticktick";
import { UcloudClient } from "../clients/ucloud";

export interface UserRow {
	id: string;
	ucloud_account: string;
	ucloud_password: string;
	ucloud_access_token: string | null;
	ucloud_refresh_token: string | null;
	ucloud_user_id: string | null;
	ticktick_access_token: string | null;
	ticktick_project_id: string | null;
	ucloud_enabled: number;
	ticktick_enabled: number;
	last_sync_time: number | null;
}

export interface SyncedTaskRow {
	ucloud_activity_id: string;
	ticktick_task_id: string;
	user_id: string;
	projectId: string;
	title: string;
	due_date: string;
	ucloud_status: number;
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
		.replace(/<[^>]+>/g, "") // Strip any remaining tags
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, "&")
		.trim();
}

export class SyncService {
	constructor(private readonly db: D1Database) {}

	async syncAll(): Promise<void> {
		const { results: users } = await this.db
			.prepare(
				"SELECT * FROM users WHERE ticktick_access_token IS NOT NULL AND ucloud_enabled = 1 AND ticktick_enabled = 1",
			)
			.all<UserRow>();

		for (const user of users) {
			try {
				await this.syncUser(user);
			} catch (error) {
				console.error(`Failed to sync user ${user.id}:`, error);
			}
		}
	}

	async syncUser(user: UserRow): Promise<{
		synced: number;
		updated: number;
		completed: number;
		skipped: number;
	}> {
		if (user.ucloud_enabled === 0 || user.ticktick_enabled === 0) {
			return { synced: 0, updated: 0, completed: 0, skipped: 0 };
		}

		if (!user.ticktick_access_token) {
			throw new Error("TickTick access token missing");
		}

		const ucloudClient = new UcloudClient(
			user.ucloud_access_token || undefined,
		);
		const ticktickClient = new TickTickClient(user.ticktick_access_token);

		let userId = user.ucloud_user_id;
		let ucloudAccessToken = user.ucloud_access_token;
		const ucloudRefreshToken = user.ucloud_refresh_token;

		// 1. Auth check and token management
		try {
			let needsRefresh = !ucloudAccessToken || !userId;
			if (ucloudAccessToken && userId) {
				try {
					await ucloudClient.getUndoneList(userId);
				} catch (error) {
					if (error instanceof Error && error.message.includes("expired")) {
						needsRefresh = true;
					} else {
						throw error;
					}
				}
			}

			if (needsRefresh) {
				let userInfo: UserInfo;
				if (ucloudRefreshToken) {
					try {
						userInfo = await UcloudClient.refreshToken(ucloudRefreshToken);
					} catch (_refreshError) {
						userInfo = await UcloudClient.login(
							user.ucloud_account,
							user.ucloud_password,
						);
					}
				} else {
					userInfo = await UcloudClient.login(
						user.ucloud_account,
						user.ucloud_password,
					);
				}
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
			console.error(`UCloud auth failed for user ${user.id}:`, error);
			throw error;
		}

		if (!userId) throw new Error("Could not determine UCloud user ID");

		const targetProjectId = user.ticktick_project_id || "inbox";

		// 2. Fetch data from both sides
		const undoneData = await ucloudClient.getUndoneList(userId);
		const ticktickData =
			await ticktickClient.getProjectWithData(targetProjectId);

		// Current synced records in DB
		const { results: localSyncedTasks } = await this.db
			.prepare("SELECT * FROM synced_tasks WHERE user_id = ?")
			.bind(user.id)
			.all<SyncedTaskRow>();

		const localSyncedMap = new Map(
			localSyncedTasks.map((t) => [t.ucloud_activity_id, t]),
		);
		const ticktickActiveMap = new Map(ticktickData.tasks.map((t) => [t.id, t]));
		const ucloudUndoneMap = new Map(
			undoneData.undoneList.map((t) => [t.activityId, t]),
		);

		let syncedCount = 0;
		let updatedCount = 0;
		let completedCount = 0;
		let skippedCount = 0;

		// 3. Process UCloud Undone List (New or Update)
		for (const item of undoneData.undoneList) {
			try {
				const detail = await ucloudClient.getUndoneDetail(item.activityId);
				const syncedRecord = localSyncedMap.get(item.activityId);
				const ticktickTask = syncedRecord
					? ticktickActiveMap.get(syncedRecord.ticktick_task_id)
					: null;

				const taskTitle = `[${item.siteName}] ${
					detail.assignmentTitle || item.activityName
				}`;
				const taskDueDate = formatTickTickDate(
					new Date(detail.assignmentEndTime || item.endTime),
				);
				const markdownContent = htmlToMarkdown(detail.assignmentContent || "");

				if (!syncedRecord || !ticktickTask) {
					const newTask = await ticktickClient.createTask({
						title: taskTitle,
						projectId: targetProjectId,
						content: markdownContent,
						dueDate: taskDueDate,
						priority: 3,
					});

					await this.db
						.prepare(
							"INSERT INTO synced_tasks (ucloud_activity_id, ticktick_task_id, user_id, projectId, title, due_date, ucloud_status, ticktick_status) VALUES (?, ?, ?, ?, ?, ?, 0, 0) ON CONFLICT(ucloud_activity_id, user_id) DO UPDATE SET ticktick_task_id = EXCLUDED.ticktick_task_id, title = EXCLUDED.title, due_date = EXCLUDED.due_date, last_synced_at = (strftime('%s', 'now'))",
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
					syncedCount++;
				} else {
					if (
						syncedRecord.title !== taskTitle ||
						syncedRecord.due_date !== taskDueDate
					) {
						await ticktickClient.updateTask({
							id: syncedRecord.ticktick_task_id,
							title: taskTitle,
							projectId: targetProjectId,
							dueDate: taskDueDate,
							content: markdownContent,
						});
						await this.db
							.prepare(
								"UPDATE synced_tasks SET title = ?, due_date = ?, last_synced_at = (strftime('%s', 'now')) WHERE ucloud_activity_id = ? AND user_id = ?",
							)
							.bind(taskTitle, taskDueDate, item.activityId, user.id)
							.run();
						updatedCount++;
					} else {
						skippedCount++;
					}
				}
			} catch (e) {
				console.error(`Failed to process item ${item.activityId}:`, e);
			}
		}

		// 4. Process Synced tasks that are NO LONGER in UCloud Undone List (Check for Completion)
		for (const [ucloudId, record] of localSyncedMap) {
			if (!ucloudUndoneMap.has(ucloudId) && record.ucloud_status === 0) {
				try {
					const detail = await ucloudClient.getUndoneDetail(ucloudId);
					if (detail.status !== 0) {
						try {
							await ticktickClient.completeTask(
								record.projectId,
								record.ticktick_task_id,
							);
							await this.db
								.prepare(
									"UPDATE synced_tasks SET ucloud_status = ?, ticktick_status = 2, last_synced_at = (strftime('%s', 'now')) WHERE ucloud_activity_id = ? AND user_id = ?",
								)
								.bind(detail.status, ucloudId, user.id)
								.run();
							completedCount++;
						} catch (_e) {
							await this.db
								.prepare(
									"UPDATE synced_tasks SET ucloud_status = ?, ticktick_status = 2 WHERE ucloud_activity_id = ? AND user_id = ?",
								)
								.bind(detail.status, ucloudId, user.id)
								.run();
						}
					}
				} catch (_e) {
					console.warn(`Activity ${ucloudId} seems gone from UCloud.`);
				}
			}
		}

		await this.db
			.prepare(
				"UPDATE users SET last_sync_time = (strftime('%s', 'now')), updated_at = (strftime('%s', 'now')) WHERE id = ?",
			)
			.bind(user.id)
			.run();

		return {
			synced: syncedCount,
			updated: updatedCount,
			completed: completedCount,
			skipped: skippedCount,
		};
	}
}

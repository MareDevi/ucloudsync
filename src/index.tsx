import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { TickTickClient } from "./adapters/ticktick";
import { KetangpaiClient } from "./clients/ketangpai";
import { UcloudClient } from "./clients/ucloud";
import type { SyncQueueMessage, UserRow } from "./services/sync";
import { SyncService } from "./services/sync";
import { CryptoHelper } from "./utils/crypto";
import {
	DashboardPage,
	ErrorPage,
	KetangpaiBindPage,
	LoginPage,
	ProjectSelectPage,
} from "./views/dashboard";

type Bindings = {
	DB: D1Database;
	SYNC_QUEUE: Queue<SyncQueueMessage>;
	TICKTICK_CLIENT_ID: string;
	TICKTICK_CLIENT_SECRET: string;
	TICKTICK_REDIRECT_URI: string;
	UCLOUD_SECRET?: string; // 用于加密存储密码的密钥
};

const app = new Hono<{ Bindings: Bindings }>();

// Helper to get CryptoHelper instance
const getCrypto = (env: Bindings) =>
	new CryptoHelper(env.UCLOUD_SECRET || env.TICKTICK_CLIENT_SECRET);

// --- Routes ---

app.get("/", async (c) => {
	const userId = getCookie(c, "userId");
	if (userId) return c.redirect("/dashboard");
	return c.render(<LoginPage />);
});

app.post("/login", async (c) => {
	const body = await c.req.parseBody();
	const userId = body.userId as string;
	const ucloudPassword = body.ucloudPassword as string;

	try {
		// 1. 验证登录
		await UcloudClient.login(userId, ucloudPassword);

		// 2. 加密密码后存储
		const crypto = getCrypto(c.env);
		const encryptedPassword = await crypto.encrypt(ucloudPassword);

		await c.env.DB.prepare(
			"INSERT INTO users (id, ucloud_account, ucloud_password) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET ucloud_password = EXCLUDED.ucloud_password",
		)
			.bind(userId, userId, encryptedPassword)
			.run();

		// 3. 设置安全 Cookie
		setCookie(c, "userId", userId, {
			maxAge: 60 * 60 * 24 * 30,
			path: "/",
			httpOnly: true,
			secure: true,
			sameSite: "Lax",
		});

		return c.redirect("/dashboard");
	} catch (error) {
		return c.render(
			<ErrorPage
				message={
					error instanceof Error ? error.message : "Invalid UCloud credentials."
				}
			/>,
		);
	}
});

app.get("/logout", (c) => {
	deleteCookie(c, "userId", { path: "/" });
	return c.redirect("/");
});

app.get("/dashboard", async (c) => {
	const userId = getCookie(c, "userId");
	if (!userId) return c.redirect("/");

	const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
		.bind(userId)
		.first<UserRow>();
	if (!user) return c.redirect("/logout");

	return c.render(<DashboardPage user={user} />);
});

app.get("/dashboard/reselect-project", async (c) => {
	const userId = getCookie(c, "userId");
	if (!userId) return c.redirect("/");

	const user = await c.env.DB.prepare(
		"SELECT ticktick_access_token FROM users WHERE id = ?",
	)
		.bind(userId)
		.first<{ ticktick_access_token: string }>();
	if (!user?.ticktick_access_token) return c.redirect("/oauth/ticktick/login");

	try {
		const client = new TickTickClient(user.ticktick_access_token);
		const projects = await client.getProjects();
		return c.render(<ProjectSelectPage userId={userId} projects={projects} />);
	} catch (_e) {
		return c.redirect("/oauth/ticktick/login");
	}
});

app.get("/dashboard/bind-ketangpai", async (c) => {
	const userId = getCookie(c, "userId");
	if (!userId) return c.redirect("/");

	try {
		const qrData = await KetangpaiClient.getLoginQRCode();
		return c.render(
			<KetangpaiBindPage qrUrl={qrData.url} codeKey={qrData.code_key} />,
		);
	} catch (e) {
		return c.render(
			<ErrorPage message={`Failed to get QR code: ${String(e)}`} />,
		);
	}
});

// --- Settings Toggles ---

app.post("/settings/toggle/ucloud", async (c) => {
	const userId = getCookie(c, "userId");
	if (!userId) return c.redirect("/");
	await c.env.DB.prepare(
		"UPDATE users SET ucloud_enabled = 1 - ucloud_enabled WHERE id = ?",
	)
		.bind(userId)
		.run();
	return c.redirect("/dashboard");
});

app.post("/settings/toggle/ketangpai", async (c) => {
	const userId = getCookie(c, "userId");
	if (!userId) return c.redirect("/");
	await c.env.DB.prepare(
		"UPDATE users SET ketangpai_enabled = 1 - ketangpai_enabled WHERE id = ?",
	)
		.bind(userId)
		.run();
	return c.redirect("/dashboard");
});

app.post("/settings/toggle/ticktick", async (c) => {
	const userId = getCookie(c, "userId");
	if (!userId) return c.redirect("/");
	await c.env.DB.prepare(
		"UPDATE users SET ticktick_enabled = 1 - ticktick_enabled WHERE id = ?",
	)
		.bind(userId)
		.run();
	return c.redirect("/dashboard");
});

// --- OAuth Handlers ---

app.get("/oauth/ticktick/login", (c) => {
	const userId = getCookie(c, "userId");
	if (!userId) return c.redirect("/");

	// TODO: 使用随机 state 并存入 KV/Session 以防 CSRF
	const url = `https://dida365.com/oauth/authorize?client_id=${c.env.TICKTICK_CLIENT_ID}&redirect_uri=${encodeURIComponent(c.env.TICKTICK_REDIRECT_URI)}&response_type=code&scope=tasks:write%20tasks:read&state=${userId}`;
	return c.redirect(url);
});

app.get("/oauth/ticktick/callback", async (c) => {
	const code = c.req.query("code");
	const state = c.req.query("state"); // userId
	if (!code || !state) return c.json({ error: "Invalid callback" }, 400);

	try {
		const { access_token } = await TickTickClient.getAccessToken(
			c.env.TICKTICK_CLIENT_ID,
			c.env.TICKTICK_CLIENT_SECRET,
			code,
			c.env.TICKTICK_REDIRECT_URI,
		);
		const client = new TickTickClient(access_token);
		const projects = await client.getProjects();

		await c.env.DB.prepare(
			"UPDATE users SET ticktick_access_token = ? WHERE id = ?",
		)
			.bind(access_token, state)
			.run();
		return c.render(<ProjectSelectPage userId={state} projects={projects} />);
	} catch (e) {
		return c.text(`Binding failed: ${String(e)}`);
	}
});

app.post("/oauth/ticktick/select-project", async (c) => {
	const body = await c.req.parseBody();
	await c.env.DB.prepare(
		"UPDATE users SET ticktick_project_id = ?, updated_at = (strftime('%s', 'now')) WHERE id = ?",
	)
		.bind(body.projectId, body.userId)
		.run();
	return c.redirect("/dashboard");
});

// --- API ---

app.get("/api/ketangpai/check-status", async (c) => {
	const userId = getCookie(c, "userId");
	const codeKey = c.req.query("code_key");
	if (!userId || !codeKey)
		return c.json({ status: "error", message: "Missing params" }, 400);

	try {
		const result = await KetangpaiClient.checkWechatCode(codeKey);
		if (result.token) {
			await c.env.DB.prepare(
				"UPDATE users SET ketangpai_token = ?, ketangpai_uid = ?, ketangpai_enabled = 1 WHERE id = ?",
			)
				.bind(result.token, result.uid, userId)
				.run();
			return c.json({ status: "success" });
		}
		return c.json({ status: "pending" });
	} catch (e) {
		return c.json({ status: "error", message: String(e) });
	}
});

app.get("/sync", async (c) => {
	const userId = getCookie(c, "userId");
	const crypto = getCrypto(c.env);
	const syncService = new SyncService(c.env.DB, crypto);

	if (userId) {
		const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
			.bind(userId)
			.first<UserRow>();
		if (user) await syncService.syncUser(user);
		return c.redirect("/dashboard");
	}

	await syncService.syncAll();
	return c.json({ ok: true });
});

export default {
	fetch: app.fetch,
	async scheduled(
		_controller: ScheduledController,
		env: Bindings,
		ctx: ExecutionContext,
	) {
		const crypto = getCrypto(env);
		const syncService = new SyncService(env.DB, crypto);

		const userIds = await syncService.listSyncUserIds();
		if (userIds.length === 0) return;

		const BATCH_SIZE = 100;
		const enqueuePromises: Promise<void>[] = [];

		for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
			const batchMessages = userIds
				.slice(i, i + BATCH_SIZE)
				.map((userId) => ({ body: { userId } }));
			enqueuePromises.push(
				env.SYNC_QUEUE.sendBatch(batchMessages, { contentType: "json" }),
			);
		}

		ctx.waitUntil(
			Promise.all(enqueuePromises).catch((error) => {
				console.error("Failed to enqueue scheduled sync batch:", error);
				throw error;
			}),
		);
	},
	async queue(
		batch: MessageBatch<SyncQueueMessage>,
		env: Bindings,
		_ctx: ExecutionContext,
	) {
		const crypto = getCrypto(env);
		const syncService = new SyncService(env.DB, crypto);

		for (const message of batch.messages) {
			try {
				const { userId } = message.body;
				const user = await syncService.getUserById(userId);

				if (!user) {
					console.warn(
						`Queue sync skipped: user ${userId} not found (message ${message.id}).`,
					);
					message.ack();
					continue;
				}

				await syncService.syncUser(user);
				message.ack();
			} catch (error) {
				console.error("Queue sync failed for message:", {
					messageId: message.id,
					attempts: message.attempts,
					userId: message.body.userId,
					error,
				});
				message.retry();
			}
		}
	},
} satisfies ExportedHandler<Bindings, SyncQueueMessage>;

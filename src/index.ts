import { Hono } from "hono";
import { html } from "hono/html";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import type { HtmlEscapedString } from "hono/utils/html";
import { TickTickClient } from "./adapters/ticktick";
import { SyncService } from "./services/sync";
import { UcloudClient } from "./clients/ucloud";
import type { UserRow } from "./services/sync";
import type { TickTickProject } from "./types/ticktick";

type Bindings = {
	DB: D1Database;
	TICKTICK_CLIENT_ID: string;
	TICKTICK_CLIENT_SECRET: string;
	TICKTICK_REDIRECT_URI: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// --- UI Layout & Components ---
const Layout = (
	title: string,
	content: HtmlEscapedString | Promise<HtmlEscapedString>,
) => html`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | UCloud Sync</title>
    <style>
      :root {
        --bg: #0f1115; --fg: #e1e4e8; --accent: #ff6b6b; --muted: #4b5563;
        --card-bg: #1a1d23; --success: #4ade80; --font: 'JetBrains Mono', monospace;
      }
      * { box-sizing: border-box; }
      body {
        background: var(--bg); color: var(--fg); font-family: var(--font);
        display: flex; flex-direction: column; align-items: center; min-height: 100vh; margin: 0; padding: 20px;
      }
      .container { width: 100%; max-width: 500px; margin-top: 60px; }
      .card {
        background: var(--card-bg); border: 1px solid var(--muted); padding: 30px;
        box-shadow: 10px 10px 0px var(--muted); margin-bottom: 30px;
      }
      h1, h2 { text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid var(--accent); padding-bottom: 10px; margin-top: 0; }
      .input-group { margin-bottom: 20px; }
      input {
        background: transparent; border: 1px solid var(--muted); color: var(--fg); padding: 12px;
        width: 100%; box-sizing: border-box; font-family: var(--font); outline: none;
      }
      input:focus { border-color: var(--accent); }
      .btn {
        background: transparent; color: var(--fg); border: 1px solid var(--fg); padding: 12px 24px;
        cursor: pointer; text-transform: uppercase; font-family: var(--font);
        letter-spacing: 1px; transition: all 0.2s; text-decoration: none; display: inline-block; text-align: center;
      }
      .btn:hover { background: var(--fg); color: var(--bg); }
      .btn.accent { border-color: var(--accent); color: var(--accent); }
      .btn.accent:hover { background: var(--accent); color: white; }
      .btn.full { width: 100%; }
      .status-row { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 15px; border: 1px dashed var(--muted); }
      .desc { font-size: 0.8rem; color: var(--muted); margin-bottom: 5px; }
    </style>
  </head>
  <body>
    <div class="container">${content}</div>
  </body>
  </html>
`;

const ProjectSelectForm = (userId: string, projects: TickTickProject[]) => html`
  <div class="card">
    <h1>[ TARGET PROJECT ]</h1>
    <p class="desc">Select which Dida365 project should receive UCloud assignments.</p>
    <form action="/oauth/ticktick/select-project" method="POST" style="margin-top: 20px;">
      <input type="hidden" name="userId" value="${userId}">
      <div style="max-height: 250px; overflow-y: auto; margin-bottom: 20px;">
        ${projects.map(
					(p) => html`
          <label style="display: flex; align-items: center; padding: 12px; border: 1px solid var(--muted); margin-bottom: 8px; cursor: pointer;">
            <input type="radio" name="projectId" value="${p.id}" required style="width: auto; margin-right: 15px;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${p.color || "#ccc"}; margin-right: 10px;"></span>
            <span style="font-size: 0.9rem;">${p.name}</span>
          </label>
        `,
				)}
      </div>
      <button type="submit" class="btn accent full">Confirm & Start Sync</button>
    </form>
  </div>
`;

// --- Routes ---

app.get("/", async (c) => {
	const userId = getCookie(c, "userId");
	if (userId) return c.redirect("/dashboard");

	return c.html(
		Layout(
			"Connect",
			html`
    <div class="card">
      <h1>[ UCLOUD SYNC ]</h1>
      <p class="desc">Enter your BUPT UCloud credentials to manage task synchronization.</p>
      <form action="/login" method="POST" style="margin-top: 30px;">
        <div class="input-group">
          <input type="text" name="userId" placeholder="STUDENT ID" required>
        </div>
        <div class="input-group">
          <input type="password" name="ucloudPassword" placeholder="PASSWORD" required>
        </div>
        <button type="submit" class="btn accent full">Enter Dashboard</button>
      </form>
    </div>
  `,
		),
	);
});

app.post("/login", async (c) => {
	const body = await c.req.parseBody();
	const userId = body.userId as string;
	const ucloudPassword = body.ucloudPassword as string;

	try {
		await UcloudClient.login(userId, ucloudPassword);
		await c.env.DB.prepare(
			"INSERT INTO users (id, ucloud_account, ucloud_password) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET ucloud_password = EXCLUDED.ucloud_password",
		)
			.bind(userId, userId, ucloudPassword)
			.run();
		setCookie(c, "userId", userId, { maxAge: 60 * 60 * 24 * 30, path: "/" });
		return c.redirect("/dashboard");
	} catch (error) {
		return c.html(
			Layout(
				"Error",
				html`
      <div class="card">
        <h1 style="color: var(--accent);">AUTH FAILED</h1>
        <p class="desc">${error instanceof Error ? error.message : "Invalid UCloud credentials."}</p>
        <a href="/" class="btn full">Try Again</a>
      </div>
    `,
			),
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

	return c.html(
		Layout(
			"Dashboard",
			html`
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="border: none; padding: 0; margin: 0;">[ CONFIG ]</h2>
        <a href="/logout" style="font-size: 0.7rem; color: var(--accent);">[ DISCONNECT ]</a>
      </div>
      
      <div class="status-row">
        <div>
          <div style="font-size: 0.9rem;">UCloud Account</div>
          <div class="desc">${userId}</div>
        </div>
        <form action="/settings/toggle/ucloud" method="POST">
          <button type="submit" class="btn" style="padding: 4px 12px; font-size: 0.8rem; min-width: 80px;">
            ${user.ucloud_enabled ? "ENABLED" : "DISABLED"}
          </button>
        </form>
      </div>

      <div style="margin-top: 30px;">
        <h2>[ SYNC TARGET ]</h2>
        ${
					user.ticktick_access_token
						? html`
            <div class="status-row">
              <div>
                <div style="font-size: 0.9rem;">Dida365 / TickTick</div>
                <div class="desc">Project: ${user.ticktick_project_id || "Inbox"}</div>
              </div>
              <form action="/settings/toggle/ticktick" method="POST">
                <button type="submit" class="btn" style="padding: 4px 12px; font-size: 0.8rem; min-width: 80px;">
                  ${user.ticktick_enabled ? "ENABLED" : "DISABLED"}
                </button>
              </form>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
               <a href="/dashboard/reselect-project" class="btn" style="flex: 1; font-size: 0.8rem; padding: 12px 10px;">Change Target Project</a>
               <a href="/oauth/ticktick/login" class="btn" style="flex: 0 0 50px; font-size: 1rem; padding: 10px 0;" title="Re-bind Account">⟳</a>
            </div>
          `
						: html`
            <p class="desc" style="margin: 20px 0;">No sync target connected. Tasks will not be exported.</p>
            <a href="/oauth/ticktick/login" class="btn accent full">Connect Dida365</a>
          `
				}
      </div>

      <div style="margin-top: 40px; border-top: 1px solid var(--muted); padding-top: 20px;">
        <div class="desc">Last synchronized: ${user.last_sync_time ? new Date(user.last_sync_time * 1000).toLocaleString() : "Never"}</div>
        <a href="/sync" class="btn full" style="margin-top: 10px; font-size: 0.8rem;">Force Manual Sync</a>
      </div>
    </div>
  `,
		),
	);
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
		return c.html(
			Layout("Select Project", ProjectSelectForm(userId, projects)),
		);
	} catch (_e) {
		return c.redirect("/oauth/ticktick/login");
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
		return c.html(Layout("Select Project", ProjectSelectForm(state, projects)));
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

app.get("/sync", async (c) => {
	const userId = getCookie(c, "userId");
	const syncService = new SyncService(c.env.DB);
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
		const syncService = new SyncService(env.DB);
		ctx.waitUntil(syncService.syncAll());
	},
} satisfies ExportedHandler<Bindings>;

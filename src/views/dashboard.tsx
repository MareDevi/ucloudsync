/** @jsxImportSource hono/jsx */
import type { UserRow } from "../services/sync";
import type { TickTickProject } from "../types/ticktick";
import { Layout } from "./layout";

export const LoginPage = () => (
	<Layout title="Connect">
		<div className="card">
			<h1>[ UCLOUD SYNC ]</h1>
			<p className="desc">
				Enter your BUPT UCloud credentials to manage task synchronization.
			</p>
			<form action="/login" method="POST" style={{ marginTop: "30px" }}>
				<div className="input-group">
					<input type="text" name="userId" placeholder="STUDENT ID" required />
				</div>
				<div className="input-group">
					<input
						type="password"
						name="ucloudPassword"
						placeholder="PASSWORD"
						required
					/>
				</div>
				<button type="submit" className="btn accent full">
					Enter Dashboard
				</button>
			</form>
		</div>
	</Layout>
);

export const DashboardPage = ({ user }: { user: UserRow }) => (
	<Layout title="Dashboard">
		<div className="card">
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "20px",
				}}
			>
				<h2 style={{ border: "none", padding: 0, margin: 0 }}>[ CONFIG ]</h2>
				<a
					href="/logout"
					style={{ fontSize: "0.7rem", color: "var(--accent)" }}
				>
					[ DISCONNECT ]
				</a>
			</div>

			<div className="status-row">
				<div>
					<div style={{ fontSize: "0.9rem" }}>UCloud Account</div>
					<div className="desc">{user.id}</div>
				</div>
				<form action="/settings/toggle/ucloud" method="POST">
					<button
						type="submit"
						className="btn"
						style={{
							padding: "4px 12px",
							fontSize: "0.8rem",
							minWidth: "80px",
						}}
					>
						{user.ucloud_enabled ? "ENABLED" : "DISABLED"}
					</button>
				</form>
			</div>

			<div style={{ marginTop: "30px" }}>
				<h2>[ SYNC TARGET ]</h2>
				{user.ticktick_access_token ? (
					<>
						<div className="status-row">
							<div>
								<div style={{ fontSize: "0.9rem" }}>Dida365 / TickTick</div>
								<div className="desc">
									Project: {user.ticktick_project_id || "Inbox"}
								</div>
							</div>
							<form action="/settings/toggle/ticktick" method="POST">
								<button
									type="submit"
									className="btn"
									style={{
										padding: "4px 12px",
										fontSize: "0.8rem",
										minWidth: "80px",
									}}
								>
									{user.ticktick_enabled ? "ENABLED" : "DISABLED"}
								</button>
							</form>
						</div>
						<div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
							<a
								href="/dashboard/reselect-project"
								className="btn"
								style={{ flex: 1, fontSize: "0.8rem", padding: "12px 10px" }}
							>
								Change Target Project
							</a>
							<a
								href="/oauth/ticktick/login"
								className="btn"
								style={{
									flex: "0 0 50px",
									fontSize: "1rem",
									padding: "10px 0",
								}}
								title="Re-bind Account"
							>
								⟳
							</a>
						</div>
					</>
				) : (
					<>
						<p className="desc" style={{ margin: "20px 0" }}>
							No sync target connected. Tasks will not be exported.
						</p>
						<a href="/oauth/ticktick/login" className="btn accent full">
							Connect Dida365
						</a>
					</>
				)}
			</div>

			<div
				style={{
					marginTop: "40px",
					borderTop: "1px solid var(--muted)",
					paddingTop: "20px",
				}}
			>
				<div className="desc">
					Last synchronized:{" "}
					{user.last_sync_time
						? new Date(user.last_sync_time * 1000).toLocaleString("zh-CN", {
								timeZone: "Asia/Shanghai",
							})
						: "Never"}
				</div>
				<a
					href="/sync"
					className="btn full"
					style={{ marginTop: "10px", fontSize: "0.8rem" }}
				>
					Force Manual Sync
				</a>
			</div>
		</div>
	</Layout>
);

export const ProjectSelectPage = ({
	userId,
	projects,
}: {
	userId: string;
	projects: TickTickProject[];
}) => (
	<Layout title="Select Project">
		<div className="card">
			<h1>[ TARGET PROJECT ]</h1>
			<p className="desc">
				Select which Dida365 project should receive UCloud assignments.
			</p>
			<form
				action="/oauth/ticktick/select-project"
				method="POST"
				style={{ marginTop: "20px" }}
			>
				<input type="hidden" name="userId" value={userId} />
				<div
					style={{
						maxHeight: "250px",
						overflowY: "auto",
						marginBottom: "20px",
					}}
				>
					{projects.map((p) => (
						<label
							key={p.id}
							style={{
								display: "flex",
								alignItems: "center",
								padding: "12px",
								border: "1px solid var(--muted)",
								marginBottom: "8px",
								cursor: "pointer",
							}}
						>
							<input
								type="radio"
								name="projectId"
								value={p.id}
								required
								style={{ width: "auto", marginRight: "15px" }}
							/>
							<span
								style={{
									width: "10px",
									height: "10px",
									borderRadius: "50%",
									background: p.color || "#ccc",
									marginRight: "10px",
								}}
							/>
							<span style={{ fontSize: "0.9rem" }}>{p.name}</span>
						</label>
					))}
				</div>
				<button type="submit" className="btn accent full">
					Confirm & Start Sync
				</button>
			</form>
		</div>
	</Layout>
);

export const ErrorPage = ({ message }: { message: string }) => (
	<Layout title="Error">
		<div className="card">
			<h1 style={{ color: "var(--accent)" }}>AUTH FAILED</h1>
			<p className="desc">{message}</p>
			<a href="/" className="btn full">
				Try Again
			</a>
		</div>
	</Layout>
);

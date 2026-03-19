import { addUser, getUcloudUndoneList } from "./clients/ucloud";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);

		if (
			url.pathname === "/undoenlist" ||
			url.pathname === "/ucloud/undoenlist"
		) {
			if (req.method !== "GET" && req.method !== "POST") {
				return jsonResponse({ error: "Method not allowed" }, 405);
			}

			const ucloudAccount = env.UCLOUD_ACCOUNT;
			const ucloudPassword = env.UCLOUD_PASSWORD;

			if (!ucloudAccount || !ucloudPassword) {
				return jsonResponse(
					{
						error:
							"Missing environment variables. Please set UCLOUD_ACCOUNT and UCLOUD_PASSWORD.",
					},
					500,
				);
			}

			try {
				const user = await addUser(ucloudAccount, ucloudPassword);
				const upstreamData = await getUcloudUndoneList(user);

				return jsonResponse(
					{
						ok: true,
						status: 200,
						data: upstreamData,
					},
					200,
				);
			} catch (error) {
				return jsonResponse(
					{
						error: "Failed to get UCloud undone list",
						detail: error instanceof Error ? error.message : String(error),
					},
					500,
				);
			}
		}

		if (url.pathname === "/") {
			return new Response(
				"Use /undoenlist to test UCloud request with UCLOUD_ACCOUNT and UCLOUD_PASSWORD from env.",
			);
		}

		return new Response("Not Found", { status: 404 });
	},

	async scheduled(event, _env, _ctx): Promise<void> {
		const resp = await fetch("https://api.cloudflare.com/client/v4/ips");
		const wasSuccessful = resp.ok ? "success" : "fail";
		console.log(`trigger fired at ${event.cron}: ${wasSuccessful}`);
	},
} satisfies ExportedHandler<Env>;

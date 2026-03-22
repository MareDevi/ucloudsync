import type {
	TickTickCreateTaskRequest,
	TickTickDateTime,
	TickTickProject,
	TickTickProjectData,
	TickTickTask,
	TickTickUpdateTaskRequest,
} from "../types/ticktick";

export class TickTickClient {
	private readonly baseURL = "https://api.dida365.com/open/v1";
	private accessToken: string | null = null;

	constructor(accessToken?: string) {
		if (accessToken) {
			this.accessToken = accessToken;
		}
	}

	setAccessToken(token: string): void {
		this.accessToken = token;
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<T> {
		if (!this.accessToken) {
			throw new Error("Access token not set");
		}

		const url = `${this.baseURL}${endpoint}`;
		const headers = new Headers(options.headers || {});
		headers.set("Authorization", `Bearer ${this.accessToken}`);
		if (options.body && !headers.has("Content-Type")) {
			headers.set("Content-Type", "application/json");
		}

		const response = await fetch(url, {
			...options,
			headers,
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(
				`TickTick API error: ${response.status} ${response.statusText} - ${text}`,
			);
		}

		if (
			response.status === 204 ||
			response.headers.get("Content-Length") === "0"
		) {
			return {} as T;
		}

		return response.json() as Promise<T>;
	}

	async getProjects(): Promise<TickTickProject[]> {
		return this.request<TickTickProject[]>("/project");
	}

	async getProject(projectId: string): Promise<TickTickProject> {
		return this.request<TickTickProject>(`/project/${projectId}`);
	}

	async getProjectWithData(projectId: string): Promise<TickTickProjectData> {
		return this.request<TickTickProjectData>(`/project/${projectId}/data`);
	}

	async createTask(task: TickTickCreateTaskRequest): Promise<TickTickTask> {
		return this.request<TickTickTask>("/task", {
			method: "POST",
			body: JSON.stringify(task),
		});
	}

	async updateTask(task: TickTickUpdateTaskRequest): Promise<TickTickTask> {
		return this.request<TickTickTask>(`/task/${task.id}`, {
			method: "POST",
			body: JSON.stringify(task),
		});
	}

	async completeTask(projectId: string, taskId: string): Promise<void> {
		await this.request<void>(`/project/${projectId}/task/${taskId}/complete`, {
			method: "POST",
		});
	}

	async deleteTask(projectId: string, taskId: string): Promise<void> {
		await this.request<void>(`/project/${projectId}/task/${taskId}`, {
			method: "DELETE",
		});
	}

	static async getAccessToken(
		clientId: string,
		clientSecret: string,
		code: string,
		redirectUri: string,
	): Promise<{ access_token: string }> {
		const auth = btoa(`${clientId}:${clientSecret}`);
		const response = await fetch("https://dida365.com/oauth/token", {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				code,
				grant_type: "authorization_code",
				scope: "tasks:write tasks:read",
				redirect_uri: redirectUri,
			}),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(
				`TickTick OAuth error: ${response.status} ${response.statusText} - ${text}`,
			);
		}

		return response.json();
	}
}

/**
 * Format a Date to TickTick's expected format using Beijing Time (UTC+8).
 * yyyy-MM-dd'T'HH:mm:ssZ
 */
export function formatTickTickDate(date: Date): TickTickDateTime {
	const pad = (n: number) => n.toString().padStart(2, "0");

	// Since Cloudflare Workers environment is UTC, we add 8 hours to get Beijing Time.
	const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);

	const yyyy = beijingDate.getUTCFullYear();
	const MM = pad(beijingDate.getUTCMonth() + 1);
	const dd = pad(beijingDate.getUTCDate());
	const HH = pad(beijingDate.getUTCHours());
	const mm = pad(beijingDate.getUTCMinutes());
	const ss = pad(beijingDate.getUTCSeconds());

	return `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}+0800`;
}

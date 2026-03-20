import type { UserInfo } from "@byrdocs/bupt-auth";
import { login, refresh } from "@byrdocs/bupt-auth";
import type {
	UcloudUndoneData,
	UcloudUndoneDetailData,
	UcloudUndoneDetailResponse,
	UcloudUndoneResponse,
} from "../types/ucloud";

export interface RequestOptions extends RequestInit {
	headers?: HeadersInit;
}

export class UcloudClient {
	private readonly baseURL = "https://apiucloud.bupt.edu.cn/ykt-site";
	private bladeAuth: string | null = null;

	constructor(bladeAuth?: string) {
		if (bladeAuth) {
			this.bladeAuth = bladeAuth;
		}
	}

	setToken(token: string): void {
		this.bladeAuth = token;
	}

	async request(
		endpoint: string,
		options: RequestOptions = {},
	): Promise<Response> {
		const headers = new Headers(options.headers || {});
		headers.set("origin", "https://ucloud.bupt.edu.cn");
		headers.set("referer", "https://ucloud.bupt.edu.cn/");
		headers.set("tenant-id", "000000");
		headers.set(
			"user-agent",
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.3",
		);
		headers.set("Authorization", "Basic cG9ydGFsOnBvcnRhbF9zZWNyZXQ=");

		if (this.bladeAuth) {
			headers.set("Blade-Auth", this.bladeAuth);
		}

		const config = {
			...options,
			headers,
		};

		const response = await fetch(`${this.baseURL}${endpoint}`, config);

		if (response.status === 401) {
			throw new Error("UCloud token expired or unauthorized");
		}

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`UCloud API error: ${response.status} - ${text}`);
		}

		return response;
	}

	async getUndoneList(userId: string): Promise<UcloudUndoneData> {
		const response = await this.request(
			`/site/student/undone?userId=${userId}`,
		);
		const data = (await response.json()) as UcloudUndoneResponse;
		return data.data;
	}

	async getUndoneDetail(activityId: string): Promise<UcloudUndoneDetailData> {
		const response = await this.request(
			`/work/detail?assignmentId=${activityId}`,
		);
		const data = (await response.json()) as UcloudUndoneDetailResponse;
		return data.data;
	}

	static async login(account: string, password: string): Promise<UserInfo> {
		return login(account, password, {
			onCaptcha: () => {
				throw new Error(
					"Captcha required for UCloud login, which is not supported in this environment.",
				);
			},
		});
	}

	static async refreshToken(refreshToken: string): Promise<UserInfo> {
		return refresh(refreshToken);
	}
}

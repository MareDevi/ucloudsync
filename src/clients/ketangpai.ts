import type {
	KetangpaiApiResponse,
	KetangpaiCheckCodeData,
	KetangpaiLoginData,
	KetangpaiTodoList,
	KetangpaiUserInfo,
} from "../types/ketangpai";

export class KetangpaiClient {
	private readonly baseURL = "https://openapiv5.ketangpai.com";
	private token: string | null = null;

	constructor(token?: string) {
		if (token) {
			this.token = token;
		}
	}

	setToken(token: string): void {
		this.token = token;
	}

	private getCommonHeaders() {
		return {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
			Origin: "https://www.ketangpai.com",
			Referer: "https://www.ketangpai.com/",
		};
	}

	async request<T>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<KetangpaiApiResponse<T>> {
		const headers = new Headers(options.headers || {});
		const common = this.getCommonHeaders();
		for (const [k, v] of Object.entries(common)) {
			if (!headers.has(k)) headers.set(k, v);
		}

		if (this.token) {
			headers.set("token", this.token);
		}
		if (!headers.has("Content-Type") && options.method === "POST") {
			headers.set("Content-Type", "application/json");
		}

		const url = endpoint.startsWith("http")
			? endpoint
			: `${this.baseURL}${endpoint}`;
		const response = await fetch(url, {
			...options,
			headers,
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Ketangpai API error: ${response.status} - ${text}`);
		}

		const data = (await response.json()) as KetangpaiApiResponse<T>;
		return data;
	}

	async getUserInfo(): Promise<KetangpaiUserInfo> {
		const res = await this.request<KetangpaiUserInfo>(
			"/UserApi/getUserBasinInfo",
			{
				method: "POST",
			},
		);
		if (res.status === 0) throw new Error(res.message);
		return res.data;
	}

	async getTodoList(page = 1, limit = 10): Promise<KetangpaiTodoList> {
		const res = await this.request<KetangpaiTodoList>(
			"/Futurev2/Todo/getTodoList",
			{
				method: "POST",
				body: JSON.stringify({ page, limit }),
			},
		);
		if (res.status === 0) throw new Error(res.message);
		return res.data;
	}

	static async getLoginQRCode(): Promise<KetangpaiLoginData> {
		const client = new KetangpaiClient();
		const res = await client.request<KetangpaiLoginData>("/wechat/login", {
			method: "POST",
		});
		return res.data;
	}

	static async checkWechatCode(
		codeKey: string,
	): Promise<KetangpaiCheckCodeData> {
		const client = new KetangpaiClient();
		// 使用表单数据发送 code_key，并尝试使用双斜杠路径
		const res = await client.request<KetangpaiCheckCodeData>(
			"//UserApi/checkWechatCode",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({ code_key: codeKey }).toString(),
			},
		);

		return res.data;
	}
}

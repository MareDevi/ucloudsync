interface RequestOptions extends RequestInit {
	headers?: HeadersInit;
}

export class UcloudClient {
	baseURL: string;
	authorization: string | null;
	bladeAuth: string | null;
	constructor(baseURL = "https://apiucloud.bupt.edu.cn/ykt-site") {
		this.baseURL = baseURL;
		this.authorization = null;
		this.bladeAuth = null;
	}

	setCredentials(blade: string): void {
		this.bladeAuth = blade;
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
		headers.set("Authorization", `Basic cG9ydGFsOnBvcnRhbF9zZWNyZXQ=`);

		if (this.bladeAuth) {
			headers.set("Blade-Auth", this.bladeAuth);
		}

		const config = {
			...options,
			headers,
		};

		try {
			const response = await fetch(`${this.baseURL}${endpoint}`, config);

			if (response.status === 401) {
				console.error("Token 失效，请重新登录");
			}

			return response;
		} catch (error) {
			console.error("请求失败:", error);
			throw error;
		}
	}

	get(endpoint: string, options?: RequestOptions): Promise<Response> {
		return this.request(endpoint, { ...options, method: "GET" });
	}

	post(
		endpoint: string,
		body: unknown,
		options?: RequestOptions,
	): Promise<Response> {
		return this.request(endpoint, {
			...options,
			method: "POST",
			body: JSON.stringify(body),
			headers: {
				"Content-Type": "application/json",
				...(options?.headers || {}),
			},
		});
	}
}

export interface UndoneListItem  {
	siteId: number;
	siteName: string;
	activityName: string;
	activityId: string;
	type: number;
	endTime: string;
	assignmentType: number;
	evaluationStatus: number;
	isOpenEvaluation: number;
};

export interface UcloudUndoneData {
	siteNum: number;
	undoneNum: number;
	undoneList: UndoneListItem[];
};

export interface UcloudApiResponse<T> {
	code: number;
	success: boolean;
	data: T;
	msg: string;
};

export interface UcloudUndoneResponse extends UcloudApiResponse<UcloudUndoneData> {}

export interface AssignmentResourceItem {
	resourceId: string;
	resourceName: string;
	resourceType: string;
};

export interface UcloudUndoneDetailData {
	id: string;
	assignmentTitle: string;
	assignmentContent: string;
	assignmentComment: string;
	className: string;
	chapterName: string;
	assignmentType: number;
	noSubmitNum: number;
	totalNum: number;
	stayReadNum: number;
	alreadyReadNum: number;
	isGroupExcellent: number;
	assignmentBeginTime: string;
	assignmentEndTime: string;
	isOvertimeCommit: number;
	assignmentStatus: number;
	teamId: number;
	isOpenEvaluation: number;
	status: number;
	groupScore: number;
	assignmentScore: number;
	fullMark: number;
	assignmentResource: AssignmentResourceItem[];
	assignmentMutualEvaluation: Record<string, never>;
};

export interface UcloudUndoneDetailResponse
	extends UcloudApiResponse<UcloudUndoneDetailData> {}

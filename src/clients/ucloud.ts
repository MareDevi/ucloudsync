import { login } from "@byrdocs/bupt-auth";
import { UcloudClient } from "../types/ucloud";
import type { UserInfo } from "@byrdocs/bupt-auth";
import type { UcloudUndoneData, UcloudUndoneDetailData, UcloudUndoneDetailResponse, UcloudUndoneResponse } from "../types/ucloud";

export async function addUser(
	account: string,
	password: string,
): Promise<UserInfo> {
	const ucloudUser = await login(account, password, {
		onCaptcha: (url, cookie) => {
			console.log("需要验证码, URL:", url, "Cookie:", cookie);
			throw new Error("需要验证码，无法继续登录");
		},
	});
	console.log(ucloudUser);
	return ucloudUser;
}

export async function getUcloudUndoneList(
	user: UserInfo,
): Promise<UcloudUndoneData> {
	const client = new UcloudClient();
	client.setCredentials(user.access_token);
	const response = await client.get(`/site/student/undone?userId=${user.user_id}`);
	const data = (await response.json()) as UcloudUndoneResponse;
	console.log(data);
	return data.data;
}

export async function getUndoneDetail(activityId:string): Promise<UcloudUndoneDetailData> {
	const client = new UcloudClient();
	const response = await client.get(`/site/student/undone/${activityId}`);
	const data = await response.json() as UcloudUndoneDetailResponse;
	console.log(data);
	return data.data;
}
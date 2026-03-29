export interface KetangpaiApiResponse<T> {
	status: number;
	code: number;
	message: string;
	data: T;
}

export interface KetangpaiUserInfo {
	usertype: string;
	username: string;
	account: string;
	avatar: string;
	stno: string;
	school: string;
	email: string;
	token: string;
	uid: string;
}

export interface KetangpaiTodoItem {
	id: string;
	courseid: string;
	contentid: string;
	contenttype: string;
	msgtype: string;
	number: string;
	starttime: string;
	endtime: string | number;
	uid: string;
	contenttypename: string;
	contenttitle: string;
	contentdescription: string;
	coursename: string;
	classname: string;
	activitylabel: string;
	timestate: number; // 2: active, 0: ?
}

export interface KetangpaiTodoList {
	currentPage: number;
	list: KetangpaiTodoItem[];
	pageSize: number;
	pageTotal: number;
	listTotal: string;
}

export interface KetangpaiLoginData {
	time: number;
	url: string;
	code_key: string;
}

export interface KetangpaiCheckCodeData {
	otherType: number;
	token: string;
	isenterprise: number;
	uid: string;
}

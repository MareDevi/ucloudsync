export interface UndoneListItem {
	siteId: number;
	siteName: string;
	activityName: string;
	activityId: string;
	type: number;
	endTime: string;
	assignmentType: number;
	evaluationStatus: number;
	isOpenEvaluation: number;
}

export interface UcloudUndoneData {
	siteNum: number;
	undoneNum: number;
	undoneList: UndoneListItem[];
}

export interface UcloudApiResponse<T> {
	code: number;
	success: boolean;
	data: T;
	msg: string;
}

export interface UcloudUndoneResponse
	extends UcloudApiResponse<UcloudUndoneData> {}

export interface AssignmentResourceItem {
	resourceId: string;
	resourceName: string;
	resourceType: string;
}

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
}

export interface UcloudUndoneDetailResponse
	extends UcloudApiResponse<UcloudUndoneDetailData> {}

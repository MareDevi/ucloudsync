// OpenAPI date-time string: yyyy-MM-dd'T'HH:mm:ssZ (e.g. 2019-11-13T03:00:00+0000)
export type TickTickDateTime = string;

// Subtask status: normal=0, completed=1
export type ChecklistItemStatus = 0 | 1;
// Task status: normal=0, completed=2
export type TaskStatus = 0 | 2;
// Priority: none=0, low=1, medium=3, high=5
export type TaskPriority = 0 | 1 | 3 | 5;
export type TaskKind = "TEXT" | "NOTE" | "CHECKLIST";

export type ProjectViewMode = "list" | "kanban" | "timeline";
export type ProjectPermission = "read" | "write" | "comment";
export type ProjectKind = "TASK" | "NOTE";

export interface TickTickChecklistItem {
	id: string;
	title: string;
	status: ChecklistItemStatus;
	completedTime?: TickTickDateTime;
	isAllDay?: boolean;
	sortOrder?: number;
	startDate?: TickTickDateTime;
	timeZone?: string;
}

export interface TickTickTask {
	id: string;
	projectId: string;
	title: string;
	isAllDay?: boolean;
	completedTime?: TickTickDateTime;
	content?: string;
	desc?: string;
	dueDate?: TickTickDateTime;
	items?: TickTickChecklistItem[];
	priority?: TaskPriority;
	// RFC5545-style triggers, e.g. TRIGGER:P0DT9H0M0S
	reminders?: string[];
	// RFC5545 RRULE, e.g. RRULE:FREQ=DAILY;INTERVAL=1
	repeatFlag?: string;
	sortOrder?: number;
	startDate?: TickTickDateTime;
	status?: TaskStatus;
	timeZone?: string;
	tags?: string[];
	etag?: string;
	kind?: TaskKind;
}

export interface TickTickProject {
	id: string;
	name: string;
	color?: string;
	sortOrder?: number;
	closed?: boolean;
	groupId?: string;
	viewMode?: ProjectViewMode;
	permission?: ProjectPermission;
	kind?: ProjectKind;
}

export interface TickTickColumn {
	id: string;
	projectId: string;
	name: string;
	sortOrder?: number;
}

export interface TickTickProjectData {
	project: TickTickProject;
	tasks: TickTickTask[];
	columns: TickTickColumn[];
}

export interface TickTickTaskMoveRequestItem {
	// Source project ID
	fromProjectId: string;
	// Destination project ID
	toProjectId: string;
	taskId: string;
}

export interface TickTickTaskMoveResult {
	id: string;
	etag: string;
}

export interface TickTickListCompletedTasksRequest {
	projectIds?: string[];
	startDate?: TickTickDateTime;
	endDate?: TickTickDateTime;
}

export interface TickTickFilterTasksRequest {
	projectIds?: string[];
	startDate?: TickTickDateTime;
	endDate?: TickTickDateTime;
	// Docs use priority levels [0,1,3,5]
	priority?: TaskPriority[];
	// API field name is singular: tag
	tag?: string[];
	status?: TaskStatus[];
}

export interface TickTickCreateTaskRequest {
	title: string;
	projectId: string;
	content?: string;
	desc?: string;
	isAllDay?: boolean;
	startDate?: TickTickDateTime;
	dueDate?: TickTickDateTime;
	timeZone?: string;
	reminders?: string[];
	repeatFlag?: string;
	priority?: TaskPriority;
	sortOrder?: number;
	// New subtasks should not carry an id
	items?: Omit<TickTickChecklistItem, "id">[];
}

export interface TickTickUpdateTaskRequest extends TickTickCreateTaskRequest {
	// Must match path parameter taskId
	id: string;
	projectId: string;
}

export interface TickTickCreateProjectRequest {
	name: string;
	color?: string;
	sortOrder?: number;
	viewMode?: ProjectViewMode;
	kind?: ProjectKind;
}

export interface TickTickUpdateProjectRequest {
	name?: string;
	color?: string;
	sortOrder?: number;
	viewMode?: ProjectViewMode;
	kind?: ProjectKind;
}

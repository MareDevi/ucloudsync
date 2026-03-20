-- Add status and metadata to synced_tasks for robust tracking
DROP TABLE IF EXISTS synced_tasks;
CREATE TABLE synced_tasks (
    ucloud_activity_id TEXT NOT NULL,
    ticktick_task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    projectId TEXT NOT NULL,
    title TEXT,
    due_date TEXT,
    ucloud_status INTEGER DEFAULT 0, -- 0: undone, 2: completed (match UCloud status)
    ticktick_status INTEGER DEFAULT 0, -- 0: normal, 2: completed (match TickTick status)
    last_synced_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (ucloud_activity_id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

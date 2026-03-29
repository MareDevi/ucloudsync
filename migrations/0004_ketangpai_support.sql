-- Add Ketangpai support to users table
ALTER TABLE users ADD COLUMN ketangpai_token TEXT;
ALTER TABLE users ADD COLUMN ketangpai_uid TEXT;
ALTER TABLE users ADD COLUMN ketangpai_enabled INTEGER DEFAULT 0;

-- Recreate synced_tasks to support multiple sources
CREATE TABLE synced_tasks_new (
    source TEXT NOT NULL, -- 'ucloud' or 'ketangpai'
    activity_id TEXT NOT NULL,
    ticktick_task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    projectId TEXT NOT NULL,
    title TEXT,
    due_date TEXT,
    source_status INTEGER DEFAULT 0,
    ticktick_status INTEGER DEFAULT 0,
    last_synced_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (source, activity_id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Migrate existing UCloud tasks
INSERT INTO synced_tasks_new (
    source, activity_id, ticktick_task_id, user_id, projectId, title, due_date, source_status, ticktick_status, last_synced_at
)
SELECT 
    'ucloud', ucloud_activity_id, ticktick_task_id, user_id, projectId, title, due_date, ucloud_status, ticktick_status, last_synced_at
FROM synced_tasks;

DROP TABLE synced_tasks;
ALTER TABLE synced_tasks_new RENAME TO synced_tasks;

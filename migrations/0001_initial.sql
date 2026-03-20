CREATE TABLE users (
    id TEXT PRIMARY KEY,
    ucloud_account TEXT NOT NULL,
    ucloud_password TEXT NOT NULL,
    ucloud_access_token TEXT,
    ucloud_refresh_token TEXT,
    ucloud_user_id TEXT,
    ticktick_access_token TEXT,
    ticktick_project_id TEXT,
    last_sync_time INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE synced_tasks (
    ucloud_activity_id TEXT NOT NULL,
    ticktick_task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    synced_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (ucloud_activity_id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

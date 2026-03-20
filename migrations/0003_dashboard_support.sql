-- Upgrade users table with sync toggles and session support
ALTER TABLE users ADD COLUMN ucloud_enabled INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN ticktick_enabled INTEGER DEFAULT 1;
-- For a simple "Login" we might want to store a hash or just use the ucloud_password as the key for now
-- In a real app, we'd add a dedicated password_hash column.

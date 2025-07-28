-- Script to create demo user accounts for testing
-- Run this against your gendb database

-- Create demo admin user
INSERT INTO users (user_name, email, password_hash, roles, created_at)
VALUES (
    'Admin Demo',
    'admin@demo.com',
    '$2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO', -- hashed 'demo123'
    'admin',
    GETDATE()
);

-- Create demo user
INSERT INTO users (user_name, email, password_hash, roles, created_at)
VALUES (
    'User Demo',
    'user@demo.com',
    '$2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO', -- hashed 'demo123'
    'user',
    GETDATE()
);

-- Create demo viewer
INSERT INTO users (user_name, email, password_hash, roles, created_at)
VALUES (
    'Viewer Demo',
    'viewer@demo.com',
    '$2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO', -- hashed 'demo123'
    'viewer',
    GETDATE()
);

-- Verify the users were created
SELECT user_name, email, roles, created_at FROM users WHERE email LIKE '%demo.com';
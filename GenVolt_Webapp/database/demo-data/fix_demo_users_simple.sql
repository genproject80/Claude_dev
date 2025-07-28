-- Simple script to fix demo user roles and client assignments
USE gendb;

-- Show current state
SELECT 'Current demo users:' as section, user_name, email, roles, client_id
FROM users 
WHERE email LIKE '%demo.com'
ORDER BY email;

-- Fix the role assignments
UPDATE users SET roles = 'admin' WHERE email = 'admin@demo.com';
UPDATE users SET roles = 'user' WHERE email = 'user@demo.com';  
UPDATE users SET roles = 'viewer' WHERE email = 'viewer@demo.com';

-- Get first available client ID
DECLARE @demo_client_id INT;
SELECT TOP 1 @demo_client_id = id FROM client WHERE id IS NOT NULL;

-- Assign client IDs
UPDATE users SET client_id = NULL WHERE email = 'admin@demo.com';
UPDATE users SET client_id = @demo_client_id WHERE email IN ('user@demo.com', 'viewer@demo.com');

-- Show final state
SELECT 'Fixed demo users:' as section, user_name, email, roles, client_id
FROM users 
WHERE email LIKE '%demo.com'
ORDER BY email;
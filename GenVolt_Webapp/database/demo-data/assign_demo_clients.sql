-- Quick script to assign client IDs to existing demo users
-- Run this if demo users exist but need client assignments

USE gendb;
GO

PRINT 'Assigning client IDs to demo users...';

-- Create demo client if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM clients WHERE display_name = 'Demo Corporation')
BEGIN
    INSERT INTO clients (client_name, display_name, is_active, created_at)
    VALUES ('demo_corp', 'Demo Corporation', 1, GETDATE());
    PRINT 'Created Demo Corporation client';
END

-- Get the demo client ID
DECLARE @demo_client_id INT;
SELECT @demo_client_id = id FROM clients WHERE display_name = 'Demo Corporation' OR client_name = 'demo_corp';

IF @demo_client_id IS NULL
BEGIN
    PRINT 'ERROR: Could not find or create demo client';
    RETURN;
END

PRINT 'Using Demo Corporation client ID: ' + CAST(@demo_client_id AS VARCHAR(10));

-- Assign demo users to the demo client (except admin)
UPDATE users 
SET client_id = @demo_client_id 
WHERE email IN ('user@demo.com', 'viewer@demo.com')
AND roles != 'admin';

UPDATE users 
SET client_id = NULL 
WHERE email = 'admin@demo.com'
AND roles = 'admin';

-- Verify assignments
SELECT 'Updated user assignments:' as result;
SELECT user_name, email, roles, client_id, 
    CASE 
        WHEN roles = 'admin' AND client_id IS NULL THEN 'Admin (All Access)'
        WHEN client_id = @demo_client_id THEN 'Demo Corporation Access'
        WHEN client_id IS NULL THEN 'No Client Assignment'
        ELSE 'Other Client Assignment'
    END as access_level
FROM users 
WHERE email LIKE '%demo.com'
ORDER BY roles;

PRINT 'Client assignment completed!';
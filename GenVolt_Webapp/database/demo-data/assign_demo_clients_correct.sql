-- Correct script to assign client IDs to existing demo users
-- Works with the actual database structure found

USE gendb;
GO

PRINT 'Assigning client IDs to demo users...';

-- Check what clients exist in the client table
SELECT 'Existing clients:' as section;
SELECT * FROM client;

-- Get the first available client ID, or create a demo client
DECLARE @demo_client_id INT;

-- Try to get an existing client first
SELECT TOP 1 @demo_client_id = id FROM client WHERE id IS NOT NULL;

-- If no clients exist, we need to create one
IF @demo_client_id IS NULL
BEGIN
    PRINT 'No clients found. Creating demo client...';
    
    -- Check the structure of client table first
    SELECT 'Client table structure:' as info;
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'client'
    ORDER BY ORDINAL_POSITION;
    
    PRINT 'ERROR: Cannot create client without knowing the table structure.';
    PRINT 'Please create a client manually or provide the client table structure.';
    RETURN;
END

PRINT 'Using client ID: ' + CAST(@demo_client_id AS VARCHAR(10));

-- Show current demo user assignments
SELECT 'Demo users before assignment:' as section;
SELECT id, user_name, email, roles, client_id
FROM users 
WHERE email LIKE '%demo.com'
ORDER BY roles;

-- Assign demo users to the client (except admin)
UPDATE users 
SET client_id = @demo_client_id 
WHERE email IN ('user@demo.com', 'viewer@demo.com')
AND roles != 'admin';

-- Ensure admin has no client assignment (sees all data)
UPDATE users 
SET client_id = NULL 
WHERE email = 'admin@demo.com'
AND roles = 'admin';

-- Verify assignments
SELECT 'Demo users after assignment:' as section;
SELECT id, user_name, email, roles, client_id, 
    CASE 
        WHEN roles = 'admin' AND client_id IS NULL THEN 'Admin (All Access)'
        WHEN client_id = @demo_client_id THEN 'Client Access (ID: ' + CAST(client_id AS VARCHAR(10)) + ')'
        WHEN client_id IS NULL THEN 'No Client Assignment'
        ELSE 'Other Client Assignment (ID: ' + CAST(client_id AS VARCHAR(10)) + ')'
    END as access_level
FROM users 
WHERE email LIKE '%demo.com'
ORDER BY roles;

-- Show some sample devices for this client if they exist
SELECT 'Sample devices for assigned client:' as section;
SELECT TOP 5 id, Device_ID, client_id
FROM device 
WHERE client_id = @demo_client_id;

-- Show device count by client
SELECT 'Device count by client:' as section;
SELECT client_id, COUNT(*) as device_count
FROM device 
WHERE client_id IS NOT NULL
GROUP BY client_id
ORDER BY device_count DESC;

PRINT 'Client assignment completed!';
PRINT 'Note: Admin users have no client restriction and can see all data.';
PRINT 'Non-admin users are restricted to their assigned client data.';
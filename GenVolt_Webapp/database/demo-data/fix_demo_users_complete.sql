-- Complete fix for demo users - correct roles and client assignments
-- Works with the actual database structure

USE gendb;
GO

PRINT 'Fixing demo user roles and client assignments...';

-- Show current state
SELECT 'Current demo users (before fix):' as section;
SELECT id, user_name, email, roles, client_id
FROM users 
WHERE email LIKE '%demo.com'
ORDER BY email;

-- Fix the role assignments to match the intended test setup
UPDATE users SET roles = 'admin' WHERE email = 'admin@demo.com';
UPDATE users SET roles = 'user' WHERE email = 'user@demo.com';
UPDATE users SET roles = 'viewer' WHERE email = 'viewer@demo.com';

PRINT 'Fixed role assignments';

-- Get the first available client ID for assignment
DECLARE @demo_client_id INT;
SELECT TOP 1 @demo_client_id = id FROM client WHERE id IS NOT NULL;

IF @demo_client_id IS NULL
BEGIN
    PRINT 'WARNING: No clients found in client table.';
    PRINT 'Creating a simple demo client entry...';
    
    -- Try to insert a basic client (we need to know the required columns)
    -- This might fail if there are required columns we don't know about
    BEGIN TRY
        INSERT INTO client (id) VALUES (999);
        SET @demo_client_id = 999;
        PRINT 'Created demo client with ID 999';
    END TRY
    BEGIN CATCH
        PRINT 'Could not create demo client. Error: ' + ERROR_MESSAGE();
        PRINT 'Please create a client manually in the client table first.';
        PRINT 'Then re-run this script.';
        RETURN;
    END CATCH
END

PRINT 'Using client ID: ' + CAST(@demo_client_id AS VARCHAR(10));

-- Assign client IDs (admin gets NULL for all access, others get specific client)
UPDATE users SET client_id = NULL WHERE email = 'admin@demo.com';
UPDATE users SET client_id = @demo_client_id WHERE email IN ('user@demo.com', 'viewer@demo.com');

-- Verify the fix
SELECT 'Fixed demo users:' as section;
SELECT id, user_name, email, roles, client_id,
    CASE 
        WHEN roles = 'admin' AND client_id IS NULL THEN 'Admin (All Data Access)'
        WHEN client_id = @demo_client_id THEN 'Client ' + CAST(client_id AS VARCHAR(10)) + ' Data Only'
        WHEN client_id IS NULL THEN 'No Data Access'
        ELSE 'Other Client Data'
    END as data_access
FROM users 
WHERE email LIKE '%demo.com'
ORDER BY 
    CASE roles 
        WHEN 'admin' THEN 1 
        WHEN 'user' THEN 2 
        WHEN 'viewer' THEN 3 
        ELSE 4 
    END;

-- Show available devices for the assigned client
SELECT 'Devices available to non-admin users:' as section;
SELECT COUNT(*) as device_count, client_id
FROM device 
WHERE client_id = @demo_client_id
GROUP BY client_id;

-- Show total device distribution
SELECT 'All device distribution by client:' as section;
SELECT client_id, COUNT(*) as device_count
FROM device 
WHERE client_id IS NOT NULL
GROUP BY client_id
ORDER BY device_count DESC;

PRINT '';
PRINT 'Demo user fix completed!';
PRINT 'Credentials for testing:';
PRINT '  admin@demo.com / demo123 - Admin role, sees all data';
PRINT '  user@demo.com / demo123 - User role, sees client ' + CAST(@demo_client_id AS VARCHAR(10)) + ' data only';
PRINT '  viewer@demo.com / demo123 - Viewer role, sees client ' + CAST(@demo_client_id AS VARCHAR(10)) + ' data only';
PRINT '';
PRINT 'You can now run: node test_api_builtin.js';
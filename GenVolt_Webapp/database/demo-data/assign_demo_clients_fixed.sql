-- Fixed script to assign client IDs to existing demo users
-- Run this if demo users exist but need client assignments
-- Works with the actual Clients table structure

USE gendb;
GO

PRINT 'Assigning client IDs to demo users...';

-- Create demo client if it doesn't exist (using actual table structure)
IF NOT EXISTS (SELECT 1 FROM Clients WHERE client_name = 'Demo Corporation')
BEGIN
    INSERT INTO Clients (client_name, contact_email, created_at, status)
    VALUES ('Demo Corporation', 'contact@democorp.com', GETDATE(), 'active');
    PRINT 'Created Demo Corporation client';
END

-- Get the demo client ID  
DECLARE @demo_client_id INT;
SELECT @demo_client_id = client_id FROM Clients WHERE client_name = 'Demo Corporation';

IF @demo_client_id IS NULL
BEGIN
    PRINT 'ERROR: Could not find or create demo client';
    RETURN;
END

PRINT 'Using Demo Corporation client ID: ' + CAST(@demo_client_id AS VARCHAR(10));

-- Check if users table has client_id column
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'client_id')
BEGIN
    PRINT 'Adding client_id column to users table...';
    ALTER TABLE users ADD client_id INT;
    
    -- Add foreign key constraint if Clients table exists
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Clients')
    BEGIN
        ALTER TABLE users ADD CONSTRAINT FK_users_client_id 
        FOREIGN KEY (client_id) REFERENCES Clients(client_id);
        PRINT 'Added foreign key constraint to Clients table';
    END
END

-- Assign demo users to the demo client (except admin)
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

-- Show the client details
SELECT 'Demo client details:' as result;
SELECT client_id, client_name, contact_email, status, created_at
FROM Clients 
WHERE client_id = @demo_client_id;

PRINT 'Client assignment completed!';
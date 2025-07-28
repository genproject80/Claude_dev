-- Complete Demo Data Setup Script
-- This script creates demo users with proper client assignments
-- Run this against your gendb database

USE gendb;
GO

PRINT '=== SETTING UP COMPLETE DEMO DATA ===';

-- Step 1: Create sample clients if they don't exist
PRINT 'Creating sample clients...';

IF NOT EXISTS (SELECT 1 FROM clients WHERE client_name = 'Demo Corporation')
BEGIN
    INSERT INTO clients (client_name, display_name, is_active, created_at)
    VALUES ('demo_corp', 'Demo Corporation', 1, GETDATE());
    PRINT 'Created Demo Corporation client';
END

IF NOT EXISTS (SELECT 1 FROM clients WHERE client_name = 'Test Industries')
BEGIN
    INSERT INTO clients (client_name, display_name, is_active, created_at)
    VALUES ('test_industries', 'Test Industries', 1, GETDATE());
    PRINT 'Created Test Industries client';
END

-- Get client IDs for assignments
DECLARE @demo_client_id INT, @test_client_id INT;
SELECT @demo_client_id = id FROM clients WHERE client_name = 'demo_corp' OR display_name = 'Demo Corporation';
SELECT @test_client_id = id FROM clients WHERE client_name = 'test_industries' OR display_name = 'Test Industries';

-- If still no clients, create with known IDs
IF @demo_client_id IS NULL
BEGIN
    INSERT INTO clients (id, client_name, display_name, is_active, created_at)
    VALUES (100, 'demo_corp', 'Demo Corporation', 1, GETDATE());
    SET @demo_client_id = 100;
END

IF @test_client_id IS NULL
BEGIN
    INSERT INTO clients (id, client_name, display_name, is_active, created_at)
    VALUES (101, 'test_industries', 'Test Industries', 1, GETDATE());
    SET @test_client_id = 101;
END

PRINT 'Demo client ID: ' + CAST(@demo_client_id AS VARCHAR(10));
PRINT 'Test client ID: ' + CAST(@test_client_id AS VARCHAR(10));

-- Step 2: Delete existing demo users if they exist
PRINT 'Cleaning up existing demo users...';
DELETE FROM users WHERE email IN ('admin@demo.com', 'user@demo.com', 'viewer@demo.com');

-- Step 3: Create demo users with client assignments
PRINT 'Creating demo users with client assignments...';

-- Create demo admin user (no client assignment - admin sees all)
INSERT INTO users (user_name, email, password_hash, roles, client_id, created_at)
VALUES (
    'Admin Demo',
    'admin@demo.com',
    '$2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO', -- hashed 'demo123'
    'admin',
    NULL, -- Admin users don't need client assignment
    GETDATE()
);

-- Create demo user assigned to Demo Corporation
INSERT INTO users (user_name, email, password_hash, roles, client_id, created_at)
VALUES (
    'User Demo',
    'user@demo.com',
    '$2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO', -- hashed 'demo123'
    'user',
    @demo_client_id,
    GETDATE()
);

-- Create demo viewer assigned to Demo Corporation  
INSERT INTO users (user_name, email, password_hash, roles, client_id, created_at)
VALUES (
    'Viewer Demo',
    'viewer@demo.com',
    '$2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO', -- hashed 'demo123'
    'viewer',
    @demo_client_id,
    GETDATE()
);

-- Step 4: Add some sample device data for the demo client
PRINT 'Creating sample device data...';

-- Check if device table exists and has client_id column
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'device' AND COLUMN_NAME = 'client_id')
BEGIN
    -- Add sample devices for demo client
    IF NOT EXISTS (SELECT 1 FROM device WHERE client_id = @demo_client_id)
    BEGIN
        INSERT INTO device (Device_ID, Device_Name, Device_Type, client_id, created_at)
        VALUES 
            ('DEMO_DEV_001', 'Demo Sensor 1', 'Temperature Sensor', @demo_client_id, GETDATE()),
            ('DEMO_DEV_002', 'Demo Motor 1', 'AC Motor', @demo_client_id, GETDATE()),
            ('DEMO_DEV_003', 'Demo Gateway', 'IoT Gateway', @demo_client_id, GETDATE());
        PRINT 'Created sample devices for Demo Corporation';
    END
END
ELSE
BEGIN
    PRINT 'Device table missing client_id column - skipping device creation';
END

-- Step 5: Verify the setup
PRINT '';
PRINT '=== VERIFICATION ===';

SELECT 'Created users:' as section;
SELECT user_name, email, roles, client_id, created_at 
FROM users 
WHERE email LIKE '%demo.com'
ORDER BY roles;

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'device' AND COLUMN_NAME = 'client_id')
BEGIN
    SELECT 'Sample devices:' as section;
    SELECT Device_ID, Device_Name, Device_Type, client_id
    FROM device 
    WHERE client_id = @demo_client_id;
END

SELECT 'Demo clients:' as section;
SELECT id, client_name, display_name, is_active
FROM clients 
WHERE id IN (@demo_client_id, @test_client_id);

PRINT '';
PRINT '=== SETUP COMPLETED ===';
PRINT 'Demo users created with credentials:';
PRINT '  Admin: admin@demo.com / demo123 (access to all data)';
PRINT '  User:  user@demo.com / demo123 (access to Demo Corporation data)';
PRINT '  Viewer: viewer@demo.com / demo123 (read-only Demo Corporation data)';
PRINT '';
PRINT 'You can now run API tests with these credentials!';
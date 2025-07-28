-- Create demo device data for testing data isolation
-- Run after assign_demo_clients_fixed.sql

USE gendb;
GO

PRINT 'Creating demo device data...';

-- Get demo client ID
DECLARE @demo_client_id INT;
SELECT @demo_client_id = client_id FROM Clients WHERE client_name = 'Demo Corporation';

IF @demo_client_id IS NULL
BEGIN
    PRINT 'ERROR: Demo Corporation client not found. Run assign_demo_clients_fixed.sql first.';
    RETURN;
END

PRINT 'Demo client ID: ' + CAST(@demo_client_id AS VARCHAR(10));

-- Check if Device table has Client_ID column and add demo devices
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Device' AND COLUMN_NAME = 'Client_ID')
BEGIN
    -- Delete existing demo devices to avoid duplicates
    DELETE FROM Device WHERE Device_ID LIKE 'DEMO_%';
    
    -- Insert demo devices for Demo Corporation
    INSERT INTO Device (Device_ID, Device_Name, Device_Type, Client_ID, Status, Location)
    VALUES 
        ('DEMO_TEMP_001', 'Demo Temperature Sensor 1', 'Temperature Sensor', @demo_client_id, 'Active', 'Building A - Floor 1'),
        ('DEMO_TEMP_002', 'Demo Temperature Sensor 2', 'Temperature Sensor', @demo_client_id, 'Active', 'Building A - Floor 2'),
        ('DEMO_MOTOR_001', 'Demo AC Motor 1', 'AC Motor', @demo_client_id, 'Active', 'Production Line 1'),
        ('DEMO_MOTOR_002', 'Demo Conveyor Motor', 'Conveyor Motor', @demo_client_id, 'Active', 'Production Line 2'),
        ('DEMO_GATEWAY_001', 'Demo IoT Gateway', 'IoT Gateway', @demo_client_id, 'Active', 'Main Server Room');
    
    PRINT 'Created 5 demo devices for Demo Corporation';
END
ELSE IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'device' AND COLUMN_NAME = 'client_id')
BEGIN
    -- Try lowercase table name
    DELETE FROM device WHERE Device_ID LIKE 'DEMO_%';
    
    INSERT INTO device (Device_ID, Device_Name, Device_Type, client_id)
    VALUES 
        ('DEMO_TEMP_001', 'Demo Temperature Sensor 1', 'Temperature Sensor', @demo_client_id),
        ('DEMO_TEMP_002', 'Demo Temperature Sensor 2', 'Temperature Sensor', @demo_client_id),
        ('DEMO_MOTOR_001', 'Demo AC Motor 1', 'AC Motor', @demo_client_id),
        ('DEMO_MOTOR_002', 'Demo Conveyor Motor', 'Conveyor Motor', @demo_client_id),
        ('DEMO_GATEWAY_001', 'Demo IoT Gateway', 'IoT Gateway', @demo_client_id);
    
    PRINT 'Created 5 demo devices for Demo Corporation (lowercase table)';
END
ELSE
BEGIN
    PRINT 'Device table does not have client_id/Client_ID column - skipping device creation';
    PRINT 'Data isolation testing will be limited without client-specific device data';
END

-- Create some devices for a different client to test isolation
IF NOT EXISTS (SELECT 1 FROM Clients WHERE client_name = 'Test Industries')
BEGIN
    INSERT INTO Clients (client_name, contact_email, created_at, status)
    VALUES ('Test Industries', 'contact@testind.com', GETDATE(), 'active');
    PRINT 'Created Test Industries client for isolation testing';
END

DECLARE @test_client_id INT;
SELECT @test_client_id = client_id FROM Clients WHERE client_name = 'Test Industries';

-- Add devices for test client to verify isolation
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Device' AND COLUMN_NAME = 'Client_ID')
BEGIN
    INSERT INTO Device (Device_ID, Device_Name, Device_Type, Client_ID, Status, Location)
    VALUES 
        ('TEST_TEMP_001', 'Test Temperature Sensor', 'Temperature Sensor', @test_client_id, 'Active', 'Test Facility'),
        ('TEST_MOTOR_001', 'Test Motor', 'AC Motor', @test_client_id, 'Active', 'Test Lab');
    
    PRINT 'Created test devices for Test Industries (for isolation verification)';
END
ELSE IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'device' AND COLUMN_NAME = 'client_id')
BEGIN
    INSERT INTO device (Device_ID, Device_Name, Device_Type, client_id)
    VALUES 
        ('TEST_TEMP_001', 'Test Temperature Sensor', 'Temperature Sensor', @test_client_id),
        ('TEST_MOTOR_001', 'Test Motor', 'AC Motor', @test_client_id);
    
    PRINT 'Created test devices for Test Industries (lowercase table)';
END

-- Verify the data
PRINT '';
PRINT '=== VERIFICATION ===';

SELECT 'Demo devices created:' as section;
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Device' AND COLUMN_NAME = 'Client_ID')
BEGIN
    SELECT Device_ID, Device_Name, Device_Type, Client_ID, Status
    FROM Device 
    WHERE Client_ID = @demo_client_id;
END
ELSE IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'device' AND COLUMN_NAME = 'client_id')
BEGIN
    SELECT Device_ID, Device_Name, Device_Type, client_id
    FROM device 
    WHERE client_id = @demo_client_id;
END

SELECT 'Client assignments verified:' as section;
SELECT u.user_name, u.email, u.roles, u.client_id, c.client_name
FROM users u
LEFT JOIN Clients c ON u.client_id = c.client_id
WHERE u.email LIKE '%demo.com'
ORDER BY u.roles;

PRINT 'Demo device data creation completed!';
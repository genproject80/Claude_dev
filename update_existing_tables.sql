-- Update existing tables for IoT Dashboard compatibility
USE gendb;
GO

-- Check existing table structures first
SELECT 'Device table columns:' as info;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'device'
ORDER BY ORDINAL_POSITION;

SELECT 'Client table columns:' as info;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'client'
ORDER BY ORDINAL_POSITION;

SELECT 'Users table columns:' as info;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users'
ORDER BY ORDINAL_POSITION;

-- Create additional tables needed for dashboard
-- Device Alerts table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Device_Alerts')
BEGIN
    CREATE TABLE Device_Alerts (
        alert_id INT PRIMARY KEY IDENTITY(1,1),
        device_id NVARCHAR(255) NOT NULL,
        alert_type NVARCHAR(100) NOT NULL,
        severity NVARCHAR(50) CHECK (severity IN ('high', 'medium', 'low')) NOT NULL,
        message NVARCHAR(500) NOT NULL,
        is_acknowledged BIT NOT NULL DEFAULT 0,
        acknowledged_by NVARCHAR(255),
        acknowledged_at DATETIME2,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        resolved_at DATETIME2
    );
    PRINT 'Device_Alerts table created';
END
ELSE
    PRINT 'Device_Alerts table already exists';

-- Dashboard Views table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Dashboard_Views')
BEGIN
    CREATE TABLE Dashboard_Views (
        view_id INT PRIMARY KEY IDENTITY(1,1),
        user_id NVARCHAR(255) NOT NULL,
        client_id INT,
        view_name NVARCHAR(255) NOT NULL,
        view_config NVARCHAR(MAX),
        is_default BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Dashboard_Views table created';
END
ELSE
    PRINT 'Dashboard_Views table already exists';

-- User Sessions table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'User_Sessions')
BEGIN
    CREATE TABLE User_Sessions (
        session_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(255) NOT NULL,
        session_token NVARCHAR(255) UNIQUE NOT NULL,
        expires_at DATETIME2 NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        last_activity DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT 'User_Sessions table created';
END
ELSE
    PRINT 'User_Sessions table already exists';

-- Create indexes for performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceAlerts_DeviceID')
    CREATE INDEX IX_DeviceAlerts_DeviceID ON Device_Alerts(device_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceAlerts_Severity')
    CREATE INDEX IX_DeviceAlerts_Severity ON Device_Alerts(severity);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserSessions_Token')
    CREATE INDEX IX_UserSessions_Token ON User_Sessions(session_token);

PRINT 'Database schema updated successfully!';
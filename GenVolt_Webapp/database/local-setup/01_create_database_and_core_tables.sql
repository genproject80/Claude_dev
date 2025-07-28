-- ========================================
-- GenVolt Web Application - Core Database Setup
-- ========================================
-- This script creates the complete database schema for local development
-- Run this script first to set up all core tables, constraints, and indexes

USE master;
GO

-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM master.dbo.sysdatabases WHERE name = N'gendb')
BEGIN
    CREATE DATABASE gendb;
    PRINT '✅ Database [gendb] created successfully';
END
ELSE
BEGIN
    PRINT '✅ Database [gendb] already exists';
END
GO

USE gendb;
GO

PRINT '🔧 Creating core database tables...';
PRINT '';

-- ========================================
-- CORE USERS TABLE
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
BEGIN
    CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) UNIQUE NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        roles NVARCHAR(50) NOT NULL DEFAULT 'user',
        client_id INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        last_login DATETIME2 NULL,
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        is_active BIT NOT NULL DEFAULT 1,
        
        -- Add constraint for valid roles (including custom roles)
        CONSTRAINT CK_Users_Roles_Complete CHECK (roles IN (
            'admin', 
            'user', 
            'viewer', 
            'dashboard_viewer',
            'tk_iot_access',
            'aj_motor_access'
        ))
    );
    
    -- Indexes for performance
    CREATE INDEX IX_Users_Email ON users(email);
    CREATE INDEX IX_Users_Roles ON users(roles);
    CREATE INDEX IX_Users_ClientId ON users(client_id);
    CREATE INDEX IX_Users_IsActive ON users(is_active);
    
    PRINT '✅ Users table created with role constraints and indexes';
END
ELSE
BEGIN
    PRINT '✅ Users table already exists';
END

-- ========================================
-- CLIENTS TABLE (Multi-tenant support)
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Clients' AND xtype='U')
BEGIN
    CREATE TABLE Clients (
        client_id INT IDENTITY(1,1) PRIMARY KEY,
        client_name NVARCHAR(255) NOT NULL UNIQUE,
        contact_email NVARCHAR(255) NULL,
        contact_phone NVARCHAR(50) NULL,
        address NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        is_active BIT NOT NULL DEFAULT 1
    );
    
    -- Indexes
    CREATE INDEX IX_Clients_Name ON Clients(client_name);
    CREATE INDEX IX_Clients_IsActive ON Clients(is_active);
    
    PRINT '✅ Clients table created';
END
ELSE
BEGIN
    PRINT '✅ Clients table already exists';
END

-- ========================================
-- DEVICE TABLE (Enhanced existing or create new)
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='device' AND xtype='U')
BEGIN
    CREATE TABLE device (
        id INT IDENTITY(1,1) PRIMARY KEY,
        Channel_ID INT NULL,
        Device_ID NVARCHAR(255) NOT NULL UNIQUE,
        Field_ID INT NULL,
        APIKey NVARCHAR(255) NULL,
        ConversionLogicID INT NULL,
        TransactionTableID INT NULL,
        TransactionTableConnectionString NVARCHAR(MAX) NULL,
        TransactionTableName NVARCHAR(255) NULL,
        client_id INT NULL,
        device_name NVARCHAR(255) NULL,
        device_type NVARCHAR(100) NULL,
        location NVARCHAR(255) NULL,
        status NVARCHAR(50) DEFAULT 'active',
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        
        -- Foreign key to clients
        CONSTRAINT FK_Device_Client FOREIGN KEY (client_id) REFERENCES Clients(client_id)
    );
    
    -- Indexes for performance
    CREATE INDEX IX_Device_DeviceID ON device(Device_ID);
    CREATE INDEX IX_Device_ClientID ON device(client_id);
    CREATE INDEX IX_Device_Status ON device(status);
    CREATE INDEX IX_Device_Type ON device(device_type);
    
    PRINT '✅ Device table created with client relationship';
END
ELSE
BEGIN
    -- Enhance existing device table if needed
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'device' AND COLUMN_NAME = 'client_id')
    BEGIN
        ALTER TABLE device ADD client_id INT NULL;
        ALTER TABLE device ADD CONSTRAINT FK_Device_Client FOREIGN KEY (client_id) REFERENCES Clients(client_id);
        PRINT '✅ Device table enhanced with client_id';
    END
    
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'device' AND COLUMN_NAME = 'device_name')
        ALTER TABLE device ADD device_name NVARCHAR(255) NULL;
    
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'device' AND COLUMN_NAME = 'device_type')
        ALTER TABLE device ADD device_type NVARCHAR(100) NULL;
    
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'device' AND COLUMN_NAME = 'location')
        ALTER TABLE device ADD location NVARCHAR(255) NULL;
    
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'device' AND COLUMN_NAME = 'status')
        ALTER TABLE device ADD status NVARCHAR(50) DEFAULT 'active';
    
    PRINT '✅ Device table enhanced with additional columns';
END

-- ========================================
-- IOT DATA TABLES (Core data storage)
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='IoT_Data_New' AND xtype='U')
BEGIN
    CREATE TABLE IoT_Data_New (
        Entry_ID INT IDENTITY(1,1) PRIMARY KEY,
        RuntimeMin INT NULL,
        FaultCodes NVARCHAR(50) NULL,
        FaultDescriptions NVARCHAR(MAX) NULL,
        LeadingFaultCode INT NULL,
        LeadingFaultTimeHr FLOAT NULL,
        GensetSignal NVARCHAR(50) NULL,
        ThermostatStatus NVARCHAR(50) NULL,
        HVOutputVoltage_kV FLOAT NULL,
        HVSourceNo INT NULL,
        HVOutputCurrent_mA FLOAT NULL,
        HexField NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        Device_ID NVARCHAR(255) NOT NULL,
        
        -- Foreign key to device
        CONSTRAINT FK_IoTDataNew_Device FOREIGN KEY (Device_ID) REFERENCES device(Device_ID)
    );
    
    -- Indexes for performance
    CREATE INDEX IX_IoTDataNew_DeviceID ON IoT_Data_New(Device_ID);
    CREATE INDEX IX_IoTDataNew_CreatedAt ON IoT_Data_New(CreatedAt);
    CREATE INDEX IX_IoTDataNew_FaultCodes ON IoT_Data_New(FaultCodes);
    
    PRINT '✅ IoT_Data_New table created';
END
ELSE
BEGIN
    PRINT '✅ IoT_Data_New table already exists';
END

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='IoT_Data_Sick' AND xtype='U')
BEGIN
    CREATE TABLE IoT_Data_Sick (
        Entry_ID INT IDENTITY(1,1) PRIMARY KEY,
        RuntimeMin INT NULL,
        Fault_Code INT NULL,
        Fault_Description NVARCHAR(MAX) NULL,
        GSM_Signal_Strength INT NULL,
        Motor_Current_mA FLOAT NULL,
        Motor_Voltage_V FLOAT NULL,
        Temperature_C FLOAT NULL,
        Vibration_Level FLOAT NULL,
        HexField NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        Device_ID NVARCHAR(255) NOT NULL,
        
        -- Foreign key to device
        CONSTRAINT FK_IoTDataSick_Device FOREIGN KEY (Device_ID) REFERENCES device(Device_ID)
    );
    
    -- Indexes for performance
    CREATE INDEX IX_IoTDataSick_DeviceID ON IoT_Data_Sick(Device_ID);
    CREATE INDEX IX_IoTDataSick_CreatedAt ON IoT_Data_Sick(CreatedAt);
    CREATE INDEX IX_IoTDataSick_FaultCode ON IoT_Data_Sick(Fault_Code);
    
    PRINT '✅ IoT_Data_Sick table created';
END
ELSE
BEGIN
    PRINT '✅ IoT_Data_Sick table already exists';
END

-- ========================================
-- USER SESSIONS TABLE
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_sessions' AND xtype='U')
BEGIN
    CREATE TABLE user_sessions (
        id NVARCHAR(255) PRIMARY KEY,
        user_id INT NOT NULL,
        ip_address NVARCHAR(45) NULL,
        user_agent NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        last_activity DATETIME2 NOT NULL DEFAULT GETDATE(),
        expires_at DATETIME2 NOT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        
        -- Foreign key to users
        CONSTRAINT FK_UserSessions_Users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    -- Indexes
    CREATE INDEX IX_UserSessions_UserID ON user_sessions(user_id);
    CREATE INDEX IX_UserSessions_ExpiresAt ON user_sessions(expires_at);
    CREATE INDEX IX_UserSessions_IsActive ON user_sessions(is_active);
    
    PRINT '✅ User_sessions table created';
END
ELSE
BEGIN
    PRINT '✅ User_sessions table already exists';
END

-- ========================================
-- DEVICE ALERTS TABLE
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='device_alerts' AND xtype='U')
BEGIN
    CREATE TABLE device_alerts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        device_id NVARCHAR(255) NOT NULL,
        alert_type NVARCHAR(100) NOT NULL,
        severity NVARCHAR(20) CHECK (severity IN ('high', 'medium', 'low')) NOT NULL,
        message NVARCHAR(500) NOT NULL,
        is_acknowledged BIT NOT NULL DEFAULT 0,
        acknowledged_by INT NULL,
        acknowledged_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        resolved_at DATETIME2 NULL,
        
        -- Foreign keys
        CONSTRAINT FK_DeviceAlerts_Device FOREIGN KEY (device_id) REFERENCES device(Device_ID),
        CONSTRAINT FK_DeviceAlerts_User FOREIGN KEY (acknowledged_by) REFERENCES users(id)
    );
    
    -- Indexes
    CREATE INDEX IX_DeviceAlerts_DeviceID ON device_alerts(device_id);
    CREATE INDEX IX_DeviceAlerts_Severity ON device_alerts(severity);
    CREATE INDEX IX_DeviceAlerts_CreatedAt ON device_alerts(created_at);
    CREATE INDEX IX_DeviceAlerts_IsAcknowledged ON device_alerts(is_acknowledged);
    
    PRINT '✅ Device_alerts table created';
END
ELSE
BEGIN
    PRINT '✅ Device_alerts table already exists';
END

-- ========================================
-- DASHBOARD VIEWS TABLE
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='dashboard_views' AND xtype='U')
BEGIN
    CREATE TABLE dashboard_views (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        view_name NVARCHAR(255) NOT NULL,
        view_config NVARCHAR(MAX) NULL, -- JSON configuration
        is_default BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Foreign key to users
        CONSTRAINT FK_DashboardViews_Users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        
        -- Unique constraint for user + view name
        CONSTRAINT UQ_DashboardViews_UserViewName UNIQUE (user_id, view_name)
    );
    
    -- Indexes
    CREATE INDEX IX_DashboardViews_UserID ON dashboard_views(user_id);
    CREATE INDEX IX_DashboardViews_IsDefault ON dashboard_views(is_default);
    
    PRINT '✅ Dashboard_views table created';
END
ELSE
BEGIN
    PRINT '✅ Dashboard_views table already exists';
END

-- ========================================
-- ADD FOREIGN KEY CONSTRAINT FOR USERS -> CLIENTS
-- ========================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'FK_Users_Client')
BEGIN
    ALTER TABLE users ADD CONSTRAINT FK_Users_Client 
        FOREIGN KEY (client_id) REFERENCES Clients(client_id);
    PRINT '✅ Foreign key constraint added: users -> clients';
END

PRINT '';
PRINT '🎉 Core database tables setup completed successfully!';
PRINT '';
PRINT 'Tables created:';
PRINT '  ✅ users (with role constraints for custom roles)';
PRINT '  ✅ Clients (multi-tenant support)';
PRINT '  ✅ device (enhanced with client relationships)';
PRINT '  ✅ IoT_Data_New (IoT device data)';
PRINT '  ✅ IoT_Data_Sick (motor device data)';
PRINT '  ✅ user_sessions (session management)';
PRINT '  ✅ device_alerts (alert management)';
PRINT '  ✅ dashboard_views (user dashboard configs)';
PRINT '';
PRINT 'Foreign key relationships established for data integrity';
PRINT 'Indexes created for optimal performance';
PRINT 'Ready for role system setup (run script 02)';
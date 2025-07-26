-- IoT Pulse Dashboard Database Setup Script
-- This script creates the necessary tables for the IoT dashboard application

USE gendb;
GO

-- Create Users table for authentication and user management
CREATE TABLE Users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    email NVARCHAR(255) UNIQUE NOT NULL,
    role NVARCHAR(50) CHECK (role IN ('admin', 'user', 'viewer')) NOT NULL DEFAULT 'user',
    status NVARCHAR(50) CHECK (status IN ('active', 'inactive')) NOT NULL DEFAULT 'active',
    password_hash NVARCHAR(255) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    last_login DATETIME2,
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

-- Create Clients table for client management
CREATE TABLE Clients (
    client_id INT PRIMARY KEY IDENTITY(1,1),
    client_name NVARCHAR(255) NOT NULL,
    contact_email NVARCHAR(255),
    contact_phone NVARCHAR(50),
    address NVARCHAR(500),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    status NVARCHAR(50) NOT NULL DEFAULT 'active'
);

-- Enhance existing Device table with additional columns needed by frontend
-- Check if columns exist before adding them
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Device' AND COLUMN_NAME = 'device_name')
    ALTER TABLE Device ADD device_name NVARCHAR(255);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Device' AND COLUMN_NAME = 'device_type')
    ALTER TABLE Device ADD device_type NVARCHAR(100);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Device' AND COLUMN_NAME = 'location')
    ALTER TABLE Device ADD location NVARCHAR(255);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Device' AND COLUMN_NAME = 'status')
    ALTER TABLE Device ADD status NVARCHAR(50) DEFAULT 'active';

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Device' AND COLUMN_NAME = 'created_at')
    ALTER TABLE Device ADD created_at DATETIME2 DEFAULT GETDATE();

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Device' AND COLUMN_NAME = 'updated_at')
    ALTER TABLE Device ADD updated_at DATETIME2 DEFAULT GETDATE();

-- Create Dashboard Views table for storing user dashboard configurations
CREATE TABLE Dashboard_Views (
    view_id INT PRIMARY KEY IDENTITY(1,1),
    user_id UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Users(id),
    client_id INT FOREIGN KEY REFERENCES Clients(client_id),
    view_name NVARCHAR(255) NOT NULL,
    view_config NVARCHAR(MAX), -- JSON configuration for dashboard layout
    is_default BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

-- Create Device Alerts table for managing alerts and notifications
CREATE TABLE Device_Alerts (
    alert_id INT PRIMARY KEY IDENTITY(1,1),
    device_id NVARCHAR(255) NOT NULL,
    alert_type NVARCHAR(100) NOT NULL,
    severity NVARCHAR(50) CHECK (severity IN ('high', 'medium', 'low')) NOT NULL,
    message NVARCHAR(500) NOT NULL,
    is_acknowledged BIT NOT NULL DEFAULT 0,
    acknowledged_by UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Users(id),
    acknowledged_at DATETIME2,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    resolved_at DATETIME2,
    -- Add foreign key constraint to Device table
    CONSTRAINT FK_DeviceAlerts_Device FOREIGN KEY (device_id) REFERENCES Device(Device_ID)
);

-- Create User Sessions table for session management
CREATE TABLE User_Sessions (
    session_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES Users(id),
    session_token NVARCHAR(255) UNIQUE NOT NULL,
    expires_at DATETIME2 NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    last_activity DATETIME2 NOT NULL DEFAULT GETDATE()
);

-- Create indexes for better performance
CREATE INDEX IX_Users_Email ON Users(email);
CREATE INDEX IX_Users_Status ON Users(status);
CREATE INDEX IX_Device_Status ON Device(status);
CREATE INDEX IX_Device_ClientID ON Device(Client_ID);
CREATE INDEX IX_DeviceAlerts_DeviceID ON Device_Alerts(device_id);
CREATE INDEX IX_DeviceAlerts_Severity ON Device_Alerts(severity);
CREATE INDEX IX_DeviceAlerts_CreatedAt ON Device_Alerts(created_at);
CREATE INDEX IX_UserSessions_Token ON User_Sessions(session_token);
CREATE INDEX IX_UserSessions_UserID ON User_Sessions(user_id);
CREATE INDEX IX_DashboardViews_UserID ON Dashboard_Views(user_id);

-- Insert default admin user (password: admin123 - should be changed in production)
INSERT INTO Users (name, email, role, password_hash) 
VALUES ('Admin User', 'admin@iotdashboard.com', 'admin', '$2b$10$rQZ1VqJ3xRVy/rQZ1VqJ3xRVy/rQZ1VqJ3xRVy/rQZ1VqJ3xRVy');

-- Insert sample client data
INSERT INTO Clients (client_name, contact_email, contact_phone, address)
VALUES 
    ('GenVolt Industries', 'contact@genvolt.com', '+1-234-567-8900', '123 Industrial Drive, Tech City, TC 12345'),
    ('TechCorp Solutions', 'info@techcorp.com', '+1-234-567-8901', '456 Innovation Blvd, Innovation Park, IP 67890');

-- Update existing Device records with additional information (if data exists)
UPDATE Device 
SET 
    device_name = 'Device ' + Device_ID,
    device_type = CASE 
        WHEN ConversionLogicID = 1 THEN 'Fault Monitor'
        WHEN ConversionLogicID = 2 THEN 'Motor Controller'
        ELSE 'IoT Device'
    END,
    location = 'Field Location',
    status = 'active',
    created_at = GETDATE(),
    updated_at = GETDATE()
WHERE device_name IS NULL;

-- Create a view for dashboard device summary
CREATE VIEW v_DeviceSummary AS
SELECT 
    d.Device_ID,
    d.device_name,
    d.device_type,
    d.location,
    d.status,
    c.client_name,
    CASE 
        WHEN d.ConversionLogicID = 1 THEN (
            SELECT COUNT(*) FROM IoT_Data_New idn 
            WHERE idn.Device_ID = d.Device_ID 
            AND idn.CreatedAt >= DATEADD(day, -7, GETDATE())
        )
        WHEN d.ConversionLogicID = 2 THEN (
            SELECT COUNT(*) FROM IoT_Data_Sick ids 
            WHERE ids.Device_ID = d.Device_ID 
            AND ids.CreatedAt >= DATEADD(day, -7, GETDATE())
        )
        ELSE 0
    END as recent_data_count,
    CASE 
        WHEN d.ConversionLogicID = 1 THEN (
            SELECT MAX(idn.CreatedAt) FROM IoT_Data_New idn 
            WHERE idn.Device_ID = d.Device_ID
        )
        WHEN d.ConversionLogicID = 2 THEN (
            SELECT MAX(ids.CreatedAt) FROM IoT_Data_Sick ids 
            WHERE ids.Device_ID = d.Device_ID
        )
        ELSE NULL
    END as last_data_received
FROM Device d
LEFT JOIN Clients c ON d.Client_ID = c.client_id;

-- Create a view for fault analysis
CREATE VIEW v_FaultAnalysis AS
SELECT 
    Device_ID,
    COUNT(*) as total_faults,
    COUNT(CASE WHEN FaultCodes != '' AND FaultCodes IS NOT NULL THEN 1 END) as active_faults,
    MAX(CreatedAt) as last_fault_time,
    STRING_AGG(CAST(FaultDescriptions AS NVARCHAR(MAX)), '; ') as fault_summary
FROM IoT_Data_New
WHERE CreatedAt >= DATEADD(day, -30, GETDATE())
GROUP BY Device_ID;

-- Create a view for motor device analysis
CREATE VIEW v_MotorAnalysis AS
SELECT 
    Device_ID,
    COUNT(*) as total_readings,
    AVG(CAST(GSM_Signal_Strength AS FLOAT)) as avg_gsm_signal,
    AVG(CAST(Motor_Current_mA AS FLOAT)) as avg_motor_current,
    COUNT(CASE WHEN Fault_Code > 0 THEN 1 END) as fault_count,
    MAX(CreatedAt) as last_reading_time
FROM IoT_Data_Sick
WHERE CreatedAt >= DATEADD(day, -30, GETDATE())
GROUP BY Device_ID;

PRINT 'Database tables created successfully!';
PRINT 'Frontend is running on: http://localhost:8080';
PRINT 'Default admin credentials: admin@iotdashboard.com / admin123';
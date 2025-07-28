-- ========================================
-- GenVolt Web Application - Views and Functions Setup
-- ========================================
-- This script creates dashboard views and utility functions for data analysis
-- Run this after 03_insert_demo_data.sql

USE gendb;
GO

PRINT '📊 Creating dashboard views and utility functions...';
PRINT '';

-- ========================================
-- DEVICE SUMMARY VIEW
-- ========================================
PRINT '🔍 Creating device summary view...';

IF OBJECT_ID('v_DeviceSummary', 'V') IS NOT NULL
    DROP VIEW v_DeviceSummary;
GO

CREATE VIEW v_DeviceSummary AS
SELECT 
    d.Device_ID,
    d.device_name,
    d.device_type,
    d.location,
    d.status,
    d.client_id,
    c.client_name,
    d.ConversionLogicID,
    
    -- Determine device category
    CASE 
        WHEN d.ConversionLogicID = 1 THEN 'IoT Device'
        WHEN d.ConversionLogicID = 2 THEN 'Motor Device'
        ELSE 'Unknown'
    END as device_category,
    
    -- Recent data count (last 7 days)
    CASE 
        WHEN d.ConversionLogicID = 1 THEN (
            SELECT COUNT(*) 
            FROM IoT_Data_New idn 
            WHERE idn.Device_ID = d.Device_ID 
            AND idn.CreatedAt >= DATEADD(day, -7, GETDATE())
        )
        WHEN d.ConversionLogicID = 2 THEN (
            SELECT COUNT(*) 
            FROM IoT_Data_Sick ids 
            WHERE ids.Device_ID = d.Device_ID 
            AND ids.CreatedAt >= DATEADD(day, -7, GETDATE())
        )
        ELSE 0
    END as recent_data_count,
    
    -- Last data received timestamp
    CASE 
        WHEN d.ConversionLogicID = 1 THEN (
            SELECT MAX(idn.CreatedAt) 
            FROM IoT_Data_New idn 
            WHERE idn.Device_ID = d.Device_ID
        )
        WHEN d.ConversionLogicID = 2 THEN (
            SELECT MAX(ids.CreatedAt) 
            FROM IoT_Data_Sick ids 
            WHERE ids.Device_ID = d.Device_ID
        )
        ELSE NULL
    END as last_data_received,
    
    -- Device health status
    CASE 
        WHEN d.status != 'active' THEN 'Inactive'
        WHEN d.ConversionLogicID = 1 THEN
            CASE 
                WHEN (SELECT MAX(idn.CreatedAt) FROM IoT_Data_New idn WHERE idn.Device_ID = d.Device_ID) >= DATEADD(hour, -1, GETDATE()) THEN 'Online'
                WHEN (SELECT MAX(idn.CreatedAt) FROM IoT_Data_New idn WHERE idn.Device_ID = d.Device_ID) >= DATEADD(hour, -24, GETDATE()) THEN 'Warning'
                ELSE 'Offline'
            END
        WHEN d.ConversionLogicID = 2 THEN
            CASE 
                WHEN (SELECT MAX(ids.CreatedAt) FROM IoT_Data_Sick ids WHERE ids.Device_ID = d.Device_ID) >= DATEADD(hour, -1, GETDATE()) THEN 'Online'
                WHEN (SELECT MAX(ids.CreatedAt) FROM IoT_Data_Sick ids WHERE ids.Device_ID = d.Device_ID) >= DATEADD(hour, -24, GETDATE()) THEN 'Warning'
                ELSE 'Offline'
            END
        ELSE 'Unknown'
    END as health_status,
    
    -- Active alert count
    (SELECT COUNT(*) 
     FROM device_alerts da 
     WHERE da.device_id = d.Device_ID 
     AND da.is_acknowledged = 0 
     AND da.resolved_at IS NULL) as active_alerts,
     
    d.created_at,
    d.updated_at
    
FROM device d
LEFT JOIN Clients c ON d.client_id = c.client_id
WHERE d.status = 'active';
GO

PRINT '✅ Device summary view created';

-- ========================================
-- FAULT ANALYSIS VIEW
-- ========================================
PRINT '🚨 Creating fault analysis view...';

IF OBJECT_ID('v_FaultAnalysis', 'V') IS NOT NULL
    DROP VIEW v_FaultAnalysis;
GO

CREATE VIEW v_FaultAnalysis AS
SELECT 
    Device_ID,
    COUNT(*) as total_entries,
    COUNT(CASE WHEN FaultCodes IS NOT NULL AND FaultCodes != '' THEN 1 END) as fault_entries,
    COUNT(CASE WHEN FaultCodes IS NULL OR FaultCodes = '' THEN 1 END) as normal_entries,
    
    -- Fault percentage
    CASE 
        WHEN COUNT(*) > 0 THEN 
            CAST(COUNT(CASE WHEN FaultCodes IS NOT NULL AND FaultCodes != '' THEN 1 END) * 100.0 / COUNT(*) AS DECIMAL(5,2))
        ELSE 0 
    END as fault_percentage,
    
    -- Most recent fault
    (SELECT TOP 1 FaultDescriptions 
     FROM IoT_Data_New idn2 
     WHERE idn2.Device_ID = idn.Device_ID 
     AND idn2.FaultCodes IS NOT NULL 
     AND idn2.FaultCodes != '' 
     ORDER BY idn2.CreatedAt DESC) as latest_fault_description,
    
    -- Latest fault time
    (SELECT MAX(CreatedAt) 
     FROM IoT_Data_New idn3 
     WHERE idn3.Device_ID = idn.Device_ID 
     AND idn3.FaultCodes IS NOT NULL 
     AND idn3.FaultCodes != '') as latest_fault_time,
    
    -- Most common fault
    (SELECT TOP 1 FaultDescriptions 
     FROM IoT_Data_New idn4 
     WHERE idn4.Device_ID = idn.Device_ID 
     AND idn4.FaultCodes IS NOT NULL 
     AND idn4.FaultCodes != '' 
     GROUP BY FaultDescriptions 
     ORDER BY COUNT(*) DESC) as most_common_fault,
     
    MIN(CreatedAt) as first_reading,
    MAX(CreatedAt) as last_reading
    
FROM IoT_Data_New idn
WHERE CreatedAt >= DATEADD(day, -30, GETDATE())
GROUP BY Device_ID
HAVING COUNT(*) > 0;
GO

PRINT '✅ Fault analysis view created';

-- ========================================
-- MOTOR ANALYSIS VIEW
-- ========================================
PRINT '⚡ Creating motor analysis view...';

IF OBJECT_ID('v_MotorAnalysis', 'V') IS NOT NULL
    DROP VIEW v_MotorAnalysis;
GO

CREATE VIEW v_MotorAnalysis AS
SELECT 
    Device_ID,
    COUNT(*) as total_readings,
    
    -- Signal strength statistics
    AVG(CAST(GSM_Signal_Strength AS FLOAT)) as avg_gsm_signal,
    MIN(GSM_Signal_Strength) as min_gsm_signal,
    MAX(GSM_Signal_Strength) as max_gsm_signal,
    
    -- Motor current statistics
    AVG(CAST(Motor_Current_mA AS FLOAT)) as avg_motor_current,
    MIN(CAST(Motor_Current_mA AS FLOAT)) as min_motor_current,
    MAX(CAST(Motor_Current_mA AS FLOAT)) as max_motor_current,
    
    -- Motor voltage statistics
    AVG(CAST(Motor_Voltage_V AS FLOAT)) as avg_motor_voltage,
    MIN(CAST(Motor_Voltage_V AS FLOAT)) as min_motor_voltage,
    MAX(CAST(Motor_Voltage_V AS FLOAT)) as max_motor_voltage,
    
    -- Temperature statistics
    AVG(CAST(Temperature_C AS FLOAT)) as avg_temperature,
    MIN(CAST(Temperature_C AS FLOAT)) as min_temperature,
    MAX(CAST(Temperature_C AS FLOAT)) as max_temperature,
    
    -- Vibration statistics
    AVG(CAST(Vibration_Level AS FLOAT)) as avg_vibration,
    MIN(CAST(Vibration_Level AS FLOAT)) as min_vibration,
    MAX(CAST(Vibration_Level AS FLOAT)) as max_vibration,
    
    -- Fault analysis
    COUNT(CASE WHEN Fault_Code > 0 THEN 1 END) as fault_count,
    COUNT(CASE WHEN Fault_Code = 0 OR Fault_Code IS NULL THEN 1 END) as normal_count,
    
    -- Fault percentage
    CASE 
        WHEN COUNT(*) > 0 THEN 
            CAST(COUNT(CASE WHEN Fault_Code > 0 THEN 1 END) * 100.0 / COUNT(*) AS DECIMAL(5,2))
        ELSE 0 
    END as fault_percentage,
    
    -- Latest fault
    (SELECT TOP 1 Fault_Description 
     FROM IoT_Data_Sick ids2 
     WHERE ids2.Device_ID = ids.Device_ID 
     AND ids2.Fault_Code > 0 
     ORDER BY ids2.CreatedAt DESC) as latest_fault_description,
    
    -- Performance indicators
    CASE 
        WHEN AVG(CAST(Motor_Current_mA AS FLOAT)) > 1300 THEN 'High Load'
        WHEN AVG(CAST(Motor_Current_mA AS FLOAT)) > 1000 THEN 'Normal Load'
        ELSE 'Light Load'
    END as load_status,
    
    CASE 
        WHEN AVG(CAST(Temperature_C AS FLOAT)) > 50 THEN 'Hot'
        WHEN AVG(CAST(Temperature_C AS FLOAT)) > 40 THEN 'Warm'
        ELSE 'Normal'
    END as temperature_status,
    
    CASE 
        WHEN AVG(CAST(Vibration_Level AS FLOAT)) > 3.0 THEN 'High'
        WHEN AVG(CAST(Vibration_Level AS FLOAT)) > 2.0 THEN 'Moderate'
        ELSE 'Normal'
    END as vibration_status,
    
    MIN(CreatedAt) as first_reading,
    MAX(CreatedAt) as last_reading
    
FROM IoT_Data_Sick ids
WHERE CreatedAt >= DATEADD(day, -30, GETDATE())
GROUP BY Device_ID
HAVING COUNT(*) > 0;
GO

PRINT '✅ Motor analysis view created';

-- ========================================
-- DASHBOARD DATA VIEW (Combined)
-- ========================================
PRINT '📈 Creating combined dashboard data view...';

IF OBJECT_ID('v_DashboardData', 'V') IS NOT NULL
    DROP VIEW v_DashboardData;
GO

CREATE VIEW v_DashboardData AS
SELECT 
    ds.Device_ID,
    ds.device_name,
    ds.device_type,
    ds.device_category,
    ds.location,
    ds.client_id,
    ds.client_name,
    ds.health_status,
    ds.last_data_received,
    ds.recent_data_count,
    ds.active_alerts,
    
    -- Fault data (for IoT devices)
    fa.fault_percentage,
    fa.latest_fault_description as iot_latest_fault,
    fa.latest_fault_time,
    
    -- Motor data (for motor devices)
    ma.avg_motor_current,
    ma.avg_temperature,
    ma.avg_vibration,
    ma.load_status,
    ma.temperature_status,
    ma.vibration_status,
    ma.latest_fault_description as motor_latest_fault,
    
    ds.created_at,
    ds.updated_at
    
FROM v_DeviceSummary ds
LEFT JOIN v_FaultAnalysis fa ON ds.Device_ID = fa.Device_ID
LEFT JOIN v_MotorAnalysis ma ON ds.Device_ID = ma.Device_ID;
GO

PRINT '✅ Combined dashboard data view created';

-- ========================================
-- UTILITY FUNCTIONS
-- ========================================
PRINT '🔧 Creating utility functions...';

-- Function to get device count by client
IF OBJECT_ID('fn_GetDeviceCountByClient', 'FN') IS NOT NULL
    DROP FUNCTION fn_GetDeviceCountByClient;
GO

CREATE FUNCTION fn_GetDeviceCountByClient(@client_id INT, @device_category NVARCHAR(50) = NULL)
RETURNS INT
AS
BEGIN
    DECLARE @count INT;
    
    IF @device_category IS NULL
    BEGIN
        SELECT @count = COUNT(*)
        FROM device
        WHERE client_id = @client_id AND status = 'active';
    END
    ELSE
    BEGIN
        SELECT @count = COUNT(*)
        FROM device d
        WHERE d.client_id = @client_id 
          AND d.status = 'active'
          AND (
              (@device_category = 'IoT Device' AND d.ConversionLogicID = 1) OR
              (@device_category = 'Motor Device' AND d.ConversionLogicID = 2)
          );
    END
    
    RETURN ISNULL(@count, 0);
END
GO

-- Function to get latest data timestamp for a device
IF OBJECT_ID('fn_GetLatestDataTimestamp', 'FN') IS NOT NULL
    DROP FUNCTION fn_GetLatestDataTimestamp;
GO

CREATE FUNCTION fn_GetLatestDataTimestamp(@device_id NVARCHAR(255))
RETURNS DATETIME2
AS
BEGIN
    DECLARE @latest_timestamp DATETIME2;
    DECLARE @conversion_logic INT;
    
    -- Get device type
    SELECT @conversion_logic = ConversionLogicID FROM device WHERE Device_ID = @device_id;
    
    IF @conversion_logic = 1
    BEGIN
        SELECT @latest_timestamp = MAX(CreatedAt) FROM IoT_Data_New WHERE Device_ID = @device_id;
    END
    ELSE IF @conversion_logic = 2
    BEGIN
        SELECT @latest_timestamp = MAX(CreatedAt) FROM IoT_Data_Sick WHERE Device_ID = @device_id;
    END
    
    RETURN @latest_timestamp;
END
GO

-- Function to check if device is online
IF OBJECT_ID('fn_IsDeviceOnline', 'FN') IS NOT NULL
    DROP FUNCTION fn_IsDeviceOnline;
GO

CREATE FUNCTION fn_IsDeviceOnline(@device_id NVARCHAR(255), @threshold_hours INT = 1)
RETURNS BIT
AS
BEGIN
    DECLARE @is_online BIT = 0;
    DECLARE @latest_timestamp DATETIME2;
    
    SET @latest_timestamp = dbo.fn_GetLatestDataTimestamp(@device_id);
    
    IF @latest_timestamp IS NOT NULL AND @latest_timestamp >= DATEADD(hour, -@threshold_hours, GETDATE())
        SET @is_online = 1;
    
    RETURN @is_online;
END
GO

PRINT '✅ Utility functions created';

-- ========================================
-- CLIENT DASHBOARD STATISTICS VIEW
-- ========================================
PRINT '📊 Creating client dashboard statistics view...';

IF OBJECT_ID('v_ClientDashboardStats', 'V') IS NOT NULL
    DROP VIEW v_ClientDashboardStats;
GO

CREATE VIEW v_ClientDashboardStats AS
SELECT 
    c.client_id,
    c.client_name,
    
    -- Device counts
    dbo.fn_GetDeviceCountByClient(c.client_id, NULL) as total_devices,
    dbo.fn_GetDeviceCountByClient(c.client_id, 'IoT Device') as iot_devices,
    dbo.fn_GetDeviceCountByClient(c.client_id, 'Motor Device') as motor_devices,
    
    -- Online device counts
    (SELECT COUNT(*) 
     FROM device d 
     WHERE d.client_id = c.client_id 
     AND d.status = 'active'
     AND dbo.fn_IsDeviceOnline(d.Device_ID, 1) = 1) as online_devices,
    
    -- Active alerts count
    (SELECT COUNT(*) 
     FROM device_alerts da
     JOIN device d ON da.device_id = d.Device_ID
     WHERE d.client_id = c.client_id 
     AND da.is_acknowledged = 0 
     AND da.resolved_at IS NULL) as active_alerts,
    
    -- Recent data points (last 24 hours)
    (SELECT COUNT(*) 
     FROM IoT_Data_New idn
     JOIN device d ON idn.Device_ID = d.Device_ID
     WHERE d.client_id = c.client_id 
     AND idn.CreatedAt >= DATEADD(hour, -24, GETDATE())) as iot_data_points_24h,
    
    (SELECT COUNT(*) 
     FROM IoT_Data_Sick ids
     JOIN device d ON ids.Device_ID = d.Device_ID
     WHERE d.client_id = c.client_id 
     AND ids.CreatedAt >= DATEADD(hour, -24, GETDATE())) as motor_data_points_24h,
     
    c.created_at,
    c.updated_at
    
FROM Clients c
WHERE c.is_active = 1;
GO

PRINT '✅ Client dashboard statistics view created';

-- ========================================
-- VERIFICATION AND TESTING
-- ========================================
PRINT '';
PRINT '🔍 Testing views and functions...';

PRINT 'Device Summary (first 5):';
SELECT TOP 5 Device_ID, device_name, device_category, health_status, active_alerts 
FROM v_DeviceSummary 
ORDER BY Device_ID;

PRINT '';
PRINT 'Fault Analysis:';
SELECT Device_ID, fault_percentage, latest_fault_description 
FROM v_FaultAnalysis 
ORDER BY fault_percentage DESC;

PRINT '';
PRINT 'Motor Analysis:';
SELECT Device_ID, avg_motor_current, temperature_status, vibration_status 
FROM v_MotorAnalysis 
ORDER BY Device_ID;

PRINT '';
PRINT 'Client Statistics:';
SELECT client_name, total_devices, online_devices, active_alerts 
FROM v_ClientDashboardStats 
ORDER BY client_name;

PRINT '';
PRINT 'Testing utility functions:';
SELECT 
    'Demo Corporation IoT devices' as test,
    dbo.fn_GetDeviceCountByClient(1, 'IoT Device') as result;

SELECT 
    'Device P123 online status' as test,
    dbo.fn_IsDeviceOnline('P123', 1) as result;

PRINT '';
PRINT '🎉 Views and functions setup completed successfully!';
PRINT '';
PRINT 'Created Views:';
PRINT '  📊 v_DeviceSummary - Complete device overview with health status';
PRINT '  🚨 v_FaultAnalysis - IoT device fault analysis and trends';
PRINT '  ⚡ v_MotorAnalysis - Motor device performance analysis';
PRINT '  📈 v_DashboardData - Combined view for dashboard queries';
PRINT '  📊 v_ClientDashboardStats - Client-level statistics';
PRINT '';
PRINT 'Created Functions:';
PRINT '  🔧 fn_GetDeviceCountByClient - Count devices by client and type';
PRINT '  🔧 fn_GetLatestDataTimestamp - Get latest data timestamp for device';
PRINT '  🔧 fn_IsDeviceOnline - Check if device is online';
PRINT '';
PRINT 'Ready for master build script creation!';
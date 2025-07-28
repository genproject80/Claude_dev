-- Create views for IoT Dashboard
USE gendb;
GO

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
GO

-- Create a view for fault analysis
CREATE VIEW v_FaultAnalysis AS
SELECT 
    Device_ID,
    COUNT(*) as total_faults,
    COUNT(CASE WHEN FaultCodes != '' AND FaultCodes IS NOT NULL THEN 1 END) as active_faults,
    MAX(CreatedAt) as last_fault_time
FROM IoT_Data_New
WHERE CreatedAt >= DATEADD(day, -30, GETDATE())
GROUP BY Device_ID;
GO

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
GO
-- ========================================
-- GenVolt Web Application - Demo Data and Users Setup
-- ========================================
-- This script creates demo users, clients, and sample data for testing
-- Run this after 02_setup_role_system.sql

USE gendb;
GO

PRINT '👥 Setting up demo users and test data...';
PRINT '';

-- ========================================
-- DEMO CLIENTS
-- ========================================
PRINT '🏢 Creating demo clients...';

-- Clear existing demo data to avoid conflicts
DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%demo.com' OR email LIKE '%zxc.com');
DELETE FROM users WHERE email LIKE '%demo.com' OR email LIKE '%zxc.com';
DELETE FROM device WHERE client_id IN (SELECT client_id FROM Clients WHERE client_name LIKE '%Demo%' OR client_name LIKE '%Test%');
DELETE FROM Clients WHERE client_name LIKE '%Demo%' OR client_name LIKE '%Test%';

-- Insert demo clients
INSERT INTO Clients (client_name, contact_email, contact_phone, address, is_active) VALUES
('Demo Corporation', 'contact@democorp.com', '+1-555-0101', '123 Demo Street, Test City, TC 12345', 1),
('GenVolt Industries', 'info@genvolt.com', '+1-555-0102', '456 Industrial Ave, Tech Park, TP 67890', 1),
('Test Industries', 'admin@testind.com', '+1-555-0103', '789 Testing Blvd, Quality City, QC 54321', 1);

PRINT '✅ Demo clients created:';
SELECT client_id, client_name, contact_email FROM Clients ORDER BY client_id;

-- Get client IDs for device assignment
DECLARE @demo_corp_id INT = (SELECT client_id FROM Clients WHERE client_name = 'Demo Corporation');
DECLARE @genvolt_id INT = (SELECT client_id FROM Clients WHERE client_name = 'GenVolt Industries');
DECLARE @test_ind_id INT = (SELECT client_id FROM Clients WHERE client_name = 'Test Industries');

-- ========================================
-- DEMO USERS
-- ========================================
PRINT '';
PRINT '👤 Creating demo users...';

-- Note: All demo passwords are 'demo123' hashed with bcrypt
-- Hash: $2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO

-- Admin Demo User
INSERT INTO users (user_name, email, password_hash, roles, client_id, is_active) VALUES
('Admin Demo', 'admin@demo.com', '$2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO', 'admin', NULL, 1);

-- User Demo (regular user)
INSERT INTO users (user_name, email, password_hash, roles, client_id, is_active) VALUES
('User Demo', 'user@demo.com', '$2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO', 'user', @demo_corp_id, 1);

-- Viewer Demo (dashboard viewer)
INSERT INTO users (user_name, email, password_hash, roles, client_id, is_active) VALUES
('Viewer Demo', 'viewer@demo.com', '$2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO', 'dashboard_viewer', @demo_corp_id, 1);

-- ========================================
-- CUSTOM ROLE USERS (TK and AJ)
-- ========================================
PRINT '🎯 Creating custom role users (TK and AJ)...';

-- TK User - IoT Dashboard Access Only (assigned to client 1)
INSERT INTO users (user_name, email, password_hash, roles, client_id, is_active) VALUES
('TK', 'tk@zxc.com', '$2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO', 'tk_iot_access', @demo_corp_id, 1);

-- AJ User - Motor Dashboard Access Only (assigned to client 789 - will update after device creation)
INSERT INTO users (user_name, email, password_hash, roles, client_id, is_active) VALUES
('AJ', 'aj@zxc.com', '$2a$12$LQv3c1yqBnCHk.zU.oBdj.PkKy3Q7BmT4KyBKNKcIB1x5yJP0ZfgO', 'aj_motor_access', @genvolt_id, 1);

PRINT '✅ Demo users created:';
SELECT id, user_name, email, roles, client_id FROM users ORDER BY roles, user_name;

-- ========================================
-- DEMO DEVICES
-- ========================================
PRINT '';
PRINT '📱 Creating demo devices...';

-- IoT Devices for Demo Corporation (client_id matches TK's assignment)
INSERT INTO device (Device_ID, Channel_ID, Field_ID, APIKey, ConversionLogicID, TransactionTableID, TransactionTableName, client_id, device_name, device_type, location, status) VALUES
('P123', 2878685, 1, 'E8R10NT7APAB7BYT', 1, 1, 'IoT_Data_New', @demo_corp_id, 'IoT Sensor P123', 'Fault Monitor', 'Building A - Floor 1', 'active'),
('R146', 2878685, 2, 'E8R10NT7APAB7BYT', 1, 1, 'IoT_Data_New', @demo_corp_id, 'IoT Sensor R146', 'Fault Monitor', 'Building A - Floor 2', 'active'),
('Q123', 2878685, 4, 'E8R10NT7APAB7BYT', 1, 1, 'IoT_Data_New', @demo_corp_id, 'IoT Sensor Q123', 'Fault Monitor', 'Building B - Floor 1', 'active');

-- Motor Devices for GenVolt Industries (client_id matches AJ's assignment)
INSERT INTO device (Device_ID, Channel_ID, Field_ID, APIKey, ConversionLogicID, TransactionTableID, TransactionTableName, client_id, device_name, device_type, location, status) VALUES
('185071', 3010815, 1, '08R6MH0E01LO0F6L', 2, 2, 'IoT_Data_Sick', @genvolt_id, 'Motor Controller 185071', 'Motor Controller', 'Production Line 1', 'active'),
('185072', 3010815, 2, '08R6MH0E01LO0F6L', 2, 2, 'IoT_Data_Sick', @genvolt_id, 'Motor Controller 185072', 'Motor Controller', 'Production Line 2', 'active'),
('185073', 3010815, 3, '08R6MH0E01LO0F6L', 2, 2, 'IoT_Data_Sick', @genvolt_id, 'Motor Controller 185073', 'Motor Controller', 'Production Line 3', 'active'),
('185074', 3010815, 4, '08R6MH0E01LO0F6L', 2, 2, 'IoT_Data_Sick', @genvolt_id, 'Motor Controller 185074', 'Motor Controller', 'Production Line 4', 'active'),
('185075', 3010815, 5, '08R6MH0E01LO0F6L', 2, 2, 'IoT_Data_Sick', @genvolt_id, 'Motor Controller 185075', 'Motor Controller', 'Production Line 5', 'active');

-- Test devices for data isolation verification
INSERT INTO device (Device_ID, Channel_ID, Field_ID, APIKey, ConversionLogicID, TransactionTableID, TransactionTableName, client_id, device_name, device_type, location, status) VALUES
('TEST001', 1111111, 1, 'TEST_API_KEY', 1, 1, 'IoT_Data_New', @test_ind_id, 'Test IoT Device', 'Test Device', 'Test Lab', 'active'),
('TEST002', 2222222, 1, 'TEST_API_KEY', 2, 2, 'IoT_Data_Sick', @test_ind_id, 'Test Motor Device', 'Test Motor', 'Test Lab', 'active');

PRINT '✅ Demo devices created:';
SELECT Device_ID, device_name, device_type, client_id, location FROM device ORDER BY client_id, Device_ID;

-- ========================================
-- SAMPLE IOT DATA
-- ========================================
PRINT '';
PRINT '📊 Creating sample IoT data...';

-- Sample IoT data for P123, R146, Q123 (Demo Corporation devices)
INSERT INTO IoT_Data_New (RuntimeMin, FaultCodes, FaultDescriptions, LeadingFaultCode, LeadingFaultTimeHr, GensetSignal, ThermostatStatus, HVOutputVoltage_kV, HVSourceNo, HVOutputCurrent_mA, HexField, Device_ID, CreatedAt) VALUES
(120, '13', 'FAULT_SHAKER_MOTOR_CURRENT_TOO_LOW', 13, 0, 'Off', 'On', 0, 0, 0, '18015292399550466', 'P123', DATEADD(MINUTE, -30, GETDATE())),
(125, '', '', 0, 0, 'On', 'On', 12.5, 1, 850, '18015292399550467', 'P123', DATEADD(MINUTE, -25, GETDATE())),
(130, '7', 'FAULT_HIGH_VOLTAGE_WARNING', 7, 2.5, 'On', 'On', 13.2, 1, 920, '18015292399550468', 'P123', DATEADD(MINUTE, -20, GETDATE())),
(135, '', '', 0, 0, 'On', 'On', 12.8, 1, 875, '18015292399550469', 'P123', DATEADD(MINUTE, -15, GETDATE())),
(140, '', '', 0, 0, 'On', 'On', 12.3, 1, 840, '18015292399550470', 'P123', DATEADD(MINUTE, -10, GETDATE()));

INSERT INTO IoT_Data_New (RuntimeMin, FaultCodes, FaultDescriptions, LeadingFaultCode, LeadingFaultTimeHr, GensetSignal, ThermostatStatus, HVOutputVoltage_kV, HVSourceNo, HVOutputCurrent_mA, HexField, Device_ID, CreatedAt) VALUES
(200, '', '', 0, 0, 'On', 'On', 11.8, 1, 780, '18015292399550480', 'R146', DATEADD(MINUTE, -35, GETDATE())),
(205, '5', 'FAULT_TEMPERATURE_HIGH', 5, 1.2, 'On', 'Off', 11.9, 1, 790, '18015292399550481', 'R146', DATEADD(MINUTE, -30, GETDATE())),
(210, '', '', 0, 0, 'On', 'On', 12.1, 1, 810, '18015292399550482', 'R146', DATEADD(MINUTE, -25, GETDATE()));

INSERT INTO IoT_Data_New (RuntimeMin, FaultCodes, FaultDescriptions, LeadingFaultCode, LeadingFaultTimeHr, GensetSignal, ThermostatStatus, HVOutputVoltage_kV, HVSourceNo, HVOutputCurrent_mA, HexField, Device_ID, CreatedAt) VALUES
(300, '', '', 0, 0, 'On', 'On', 13.1, 1, 900, '18015292399550490', 'Q123', DATEADD(MINUTE, -40, GETDATE())),
(305, '', '', 0, 0, 'On', 'On', 12.9, 1, 890, '18015292399550491', 'Q123', DATEADD(MINUTE, -35, GETDATE()));

-- ========================================
-- SAMPLE MOTOR DATA
-- ========================================
PRINT '⚡ Creating sample motor data...';

-- Sample motor data for 185071, 185072, etc. (GenVolt Industries devices)
INSERT INTO IoT_Data_Sick (RuntimeMin, Fault_Code, Fault_Description, GSM_Signal_Strength, Motor_Current_mA, Motor_Voltage_V, Temperature_C, Vibration_Level, HexField, Device_ID, CreatedAt) VALUES
(480, 0, '', 85, 1250, 230, 45.2, 2.1, 'MOTOR_DATA_001', '185071', DATEADD(MINUTE, -45, GETDATE())),
(485, 0, '', 87, 1230, 232, 46.1, 2.0, 'MOTOR_DATA_002', '185071', DATEADD(MINUTE, -40, GETDATE())),
(490, 3, 'MOTOR_OVERLOAD_WARNING', 89, 1350, 235, 52.3, 3.2, 'MOTOR_DATA_003', '185071', DATEADD(MINUTE, -35, GETDATE())),
(495, 0, '', 91, 1200, 230, 47.8, 2.1, 'MOTOR_DATA_004', '185071', DATEADD(MINUTE, -30, GETDATE()));

INSERT INTO IoT_Data_Sick (RuntimeMin, Fault_Code, Fault_Description, GSM_Signal_Strength, Motor_Current_mA, Motor_Voltage_V, Temperature_C, Vibration_Level, HexField, Device_ID, CreatedAt) VALUES
(600, 0, '', 82, 1100, 228, 42.5, 1.8, 'MOTOR_DATA_011', '185072', DATEADD(MINUTE, -50, GETDATE())),
(605, 0, '', 84, 1120, 230, 43.1, 1.9, 'MOTOR_DATA_012', '185072', DATEADD(MINUTE, -45, GETDATE())),
(610, 0, '', 86, 1095, 229, 42.8, 1.7, 'MOTOR_DATA_013', '185072', DATEADD(MINUTE, -40, GETDATE()));

INSERT INTO IoT_Data_Sick (RuntimeMin, Fault_Code, Fault_Description, GSM_Signal_Strength, Motor_Current_mA, Motor_Voltage_V, Temperature_C, Vibration_Level, HexField, Device_ID, CreatedAt) VALUES
(720, 0, '', 88, 980, 227, 41.2, 1.5, 'MOTOR_DATA_021', '185073', DATEADD(MINUTE, -55, GETDATE())),
(725, 1, 'MOTOR_VIBRATION_HIGH', 90, 1050, 229, 44.5, 4.2, 'MOTOR_DATA_022', '185073', DATEADD(MINUTE, -50, GETDATE()));

-- ========================================
-- SAMPLE ALERTS
-- ========================================
PRINT '🚨 Creating sample device alerts...';

INSERT INTO device_alerts (device_id, alert_type, severity, message, is_acknowledged) VALUES
('P123', 'FAULT', 'medium', 'Shaker motor current too low detected', 0),
('R146', 'TEMPERATURE', 'high', 'Temperature threshold exceeded', 0),
('185071', 'OVERLOAD', 'high', 'Motor overload warning - current exceeds normal range', 0),
('185073', 'VIBRATION', 'medium', 'High vibration levels detected', 0);

-- ========================================
-- CLIENT ID ADJUSTMENTS FOR DATA ISOLATION
-- ========================================
PRINT '';
PRINT '🔧 Finalizing client assignments for data isolation...';

-- Ensure TK sees client 1 data (Demo Corporation) 
-- Ensure AJ sees client 2 data (GenVolt Industries)
UPDATE users SET client_id = @demo_corp_id WHERE email = 'tk@zxc.com';
UPDATE users SET client_id = @genvolt_id WHERE email = 'aj@zxc.com';

PRINT '✅ User-client assignments finalized for data isolation';

-- ========================================
-- VERIFICATION
-- ========================================
PRINT '';
PRINT '🔍 Verifying demo data setup...';

PRINT 'User-Client Assignments:';
SELECT 
    u.user_name,
    u.email,
    u.roles,
    u.client_id,
    c.client_name
FROM users u
LEFT JOIN Clients c ON u.client_id = c.client_id
ORDER BY u.roles, u.user_name;

PRINT '';
PRINT 'Device Distribution by Client:';
SELECT 
    c.client_name,
    COUNT(*) as device_count,
    STRING_AGG(d.Device_ID, ', ') as device_ids
FROM device d
JOIN Clients c ON d.client_id = c.client_id
GROUP BY c.client_id, c.client_name
ORDER BY c.client_name;

PRINT '';
PRINT 'Data Isolation Verification:';
PRINT 'TK (tk_iot_access) should see:';
SELECT 'IoT Devices for Demo Corporation:' as context, Device_ID, device_name 
FROM device 
WHERE client_id = @demo_corp_id AND ConversionLogicID = 1;

PRINT '';
PRINT 'AJ (aj_motor_access) should see:';
SELECT 'Motor Devices for GenVolt Industries:' as context, Device_ID, device_name 
FROM device 
WHERE client_id = @genvolt_id AND ConversionLogicID = 2;

PRINT '';
PRINT '🎉 Demo data setup completed successfully!';
PRINT '';
PRINT 'Test Users Created (password: demo123):';
PRINT '  👤 admin@demo.com (admin) - Full access';
PRINT '  👤 user@demo.com (user) - IoT dashboard only';
PRINT '  👤 viewer@demo.com (dashboard_viewer) - Both dashboards view-only';
PRINT '  🎯 tk@zxc.com (tk_iot_access) - IoT dashboard only + client isolation';
PRINT '  🎯 aj@zxc.com (aj_motor_access) - Motor dashboard only + client isolation';
PRINT '';
PRINT 'Data Isolation:';
PRINT '  📊 TK sees Demo Corporation data (IoT devices: P123, R146, Q123)';
PRINT '  ⚡ AJ sees GenVolt Industries data (Motor devices: 185071-185075)';
PRINT '';
PRINT 'Ready for views and functions setup (run script 04)';
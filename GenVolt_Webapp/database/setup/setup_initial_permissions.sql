-- Setup Initial Dashboard Permissions
-- This script ensures the dashboards and role_permissions tables have the required initial data

-- Check if dashboards table exists and has data
IF NOT EXISTS (SELECT * FROM dashboards WHERE name = 'iot_dashboard')
BEGIN
    -- Insert dashboard definitions if they don't exist
    INSERT INTO dashboards (name, display_name, description, route_path) VALUES
    ('iot_dashboard', 'IoT Device Dashboard', 'Monitor and manage IoT devices', '/dashboard?tab=iot'),
    ('motor_dashboard', 'Motor Device Dashboard', 'Monitor and manage motor devices', '/dashboard?tab=motor');
    
    PRINT 'Dashboard definitions inserted';
END
ELSE
BEGIN
    PRINT 'Dashboard definitions already exist';
END

-- Check current role permissions
SELECT 'Current role permissions:' as status;
SELECT 
    rp.role_name,
    d.display_name as dashboard_name,
    rp.can_access
FROM role_permissions rp
JOIN dashboards d ON rp.dashboard_id = d.id
ORDER BY rp.role_name, d.name;

-- Insert role permissions if they don't exist
-- Admin role - full access
IF NOT EXISTS (SELECT * FROM role_permissions rp JOIN dashboards d ON rp.dashboard_id = d.id WHERE rp.role_name = 'admin' AND d.name = 'iot_dashboard')
BEGIN
    INSERT INTO role_permissions (role_name, dashboard_id, can_access) VALUES
    ('admin', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1);
    PRINT 'Admin IoT permission added';
END

IF NOT EXISTS (SELECT * FROM role_permissions rp JOIN dashboards d ON rp.dashboard_id = d.id WHERE rp.role_name = 'admin' AND d.name = 'motor_dashboard')
BEGIN
    INSERT INTO role_permissions (role_name, dashboard_id, can_access) VALUES
    ('admin', (SELECT id FROM dashboards WHERE name = 'motor_dashboard'), 1);
    PRINT 'Admin Motor permission added';
END

-- Dashboard viewer role - access to both dashboards
IF NOT EXISTS (SELECT * FROM role_permissions rp JOIN dashboards d ON rp.dashboard_id = d.id WHERE rp.role_name = 'dashboard_viewer' AND d.name = 'iot_dashboard')
BEGIN
    INSERT INTO role_permissions (role_name, dashboard_id, can_access) VALUES
    ('dashboard_viewer', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1);
    PRINT 'Dashboard viewer IoT permission added';
END

IF NOT EXISTS (SELECT * FROM role_permissions rp JOIN dashboards d ON rp.dashboard_id = d.id WHERE rp.role_name = 'dashboard_viewer' AND d.name = 'motor_dashboard')
BEGIN
    INSERT INTO role_permissions (role_name, dashboard_id, can_access) VALUES
    ('dashboard_viewer', (SELECT id FROM dashboards WHERE name = 'motor_dashboard'), 1);
    PRINT 'Dashboard viewer Motor permission added';
END

-- User role - IoT dashboard only by default
IF NOT EXISTS (SELECT * FROM role_permissions rp JOIN dashboards d ON rp.dashboard_id = d.id WHERE rp.role_name = 'user' AND d.name = 'iot_dashboard')
BEGIN
    INSERT INTO role_permissions (role_name, dashboard_id, can_access) VALUES
    ('user', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1);
    PRINT 'User IoT permission added';
END

-- Viewer role - IoT dashboard only by default
IF NOT EXISTS (SELECT * FROM role_permissions rp JOIN dashboards d ON rp.dashboard_id = d.id WHERE rp.role_name = 'viewer' AND d.name = 'iot_dashboard')
BEGIN
    INSERT INTO role_permissions (role_name, dashboard_id, can_access) VALUES
    ('viewer', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1);
    PRINT 'Viewer IoT permission added';
END

-- Verify final setup
SELECT 'Final role permissions:' as status;
SELECT 
    rp.role_name,
    d.display_name as dashboard_name,
    rp.can_access
FROM role_permissions rp
JOIN dashboards d ON rp.dashboard_id = d.id
ORDER BY rp.role_name, d.name;

PRINT 'Initial permissions setup completed!';
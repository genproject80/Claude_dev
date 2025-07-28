-- Role Management System Schema
-- This script creates the database tables needed for dynamic role and permission management

-- Create Dashboards table to define available dashboards
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='dashboards' AND xtype='U')
BEGIN
    CREATE TABLE dashboards (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(50) NOT NULL UNIQUE,
        display_name NVARCHAR(100) NOT NULL,
        description NVARCHAR(255),
        route_path NVARCHAR(100),
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    PRINT 'Dashboards table created successfully';
END
ELSE
BEGIN
    PRINT 'Dashboards table already exists';
END

-- Create Role Permissions table to map roles to dashboards
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_permissions' AND xtype='U')
BEGIN
    CREATE TABLE role_permissions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        role_name NVARCHAR(50) NOT NULL,
        dashboard_id INT NOT NULL,
        can_access BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Foreign key constraint
        CONSTRAINT FK_RolePermissions_Dashboards FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
        
        -- Unique constraint to prevent duplicate role-dashboard combinations
        CONSTRAINT UQ_RolePermissions_RoleDashboard UNIQUE (role_name, dashboard_id)
    );
    
    -- Indexes for better performance
    CREATE INDEX IX_RolePermissions_RoleName ON role_permissions(role_name);
    CREATE INDEX IX_RolePermissions_DashboardId ON role_permissions(dashboard_id);
    CREATE INDEX IX_RolePermissions_CanAccess ON role_permissions(can_access);
    
    PRINT 'Role_permissions table created successfully';
END
ELSE
BEGIN
    PRINT 'Role_permissions table already exists';
END

-- Insert initial dashboard definitions
INSERT INTO dashboards (name, display_name, description, route_path) VALUES
('iot_dashboard', 'IoT Device Dashboard', 'Monitor and manage IoT devices', '/dashboard?tab=iot'),
('motor_dashboard', 'Motor Device Dashboard', 'Monitor and manage motor devices', '/dashboard?tab=motor');

PRINT 'Initial dashboard definitions inserted';

-- Insert initial role permissions based on current system
-- Admin role - full access
INSERT INTO role_permissions (role_name, dashboard_id, can_access) VALUES
('admin', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1),
('admin', (SELECT id FROM dashboards WHERE name = 'motor_dashboard'), 1);

-- Dashboard viewer role - access to both dashboards
INSERT INTO role_permissions (role_name, dashboard_id, can_access) VALUES
('dashboard_viewer', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1),
('dashboard_viewer', (SELECT id FROM dashboards WHERE name = 'motor_dashboard'), 1);

-- User role - IoT dashboard only by default
INSERT INTO role_permissions (role_name, dashboard_id, can_access) VALUES
('user', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1);

-- Viewer role - IoT dashboard only by default
INSERT INTO role_permissions (role_name, dashboard_id, can_access) VALUES
('viewer', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1);

PRINT 'Initial role permissions inserted';

-- Verify the setup
PRINT 'Verifying dashboard setup...';
SELECT 
    d.id,
    d.name,
    d.display_name,
    d.description,
    d.is_active
FROM dashboards d
ORDER BY d.id;

PRINT 'Verifying role permissions setup...';
SELECT 
    rp.role_name,
    d.display_name as dashboard_name,
    rp.can_access
FROM role_permissions rp
JOIN dashboards d ON rp.dashboard_id = d.id
ORDER BY rp.role_name, d.name;

-- Update demo viewer user to dashboard_viewer role while we're at it
UPDATE users 
SET roles = 'dashboard_viewer'
WHERE email = 'viewer@demo.com';

-- Verify the user update
SELECT id, user_name, email, roles, client_id 
FROM users 
WHERE email = 'viewer@demo.com';

PRINT 'Role management schema setup completed successfully!';
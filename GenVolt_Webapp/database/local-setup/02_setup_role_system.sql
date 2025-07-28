-- ========================================
-- GenVolt Web Application - Role and Permission System Setup
-- ========================================
-- This script creates the role-based permission system for dashboard access
-- Run this after 01_create_database_and_core_tables.sql

USE gendb;
GO

PRINT '🔐 Setting up role-based permission system...';
PRINT '';

-- ========================================
-- DASHBOARDS TABLE
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='dashboards' AND xtype='U')
BEGIN
    CREATE TABLE dashboards (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(50) NOT NULL UNIQUE,
        display_name NVARCHAR(100) NOT NULL,
        description NVARCHAR(255) NULL,
        route_path NVARCHAR(100) NULL,
        icon NVARCHAR(50) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    -- Indexes for performance
    CREATE INDEX IX_Dashboards_Name ON dashboards(name);
    CREATE INDEX IX_Dashboards_IsActive ON dashboards(is_active);
    CREATE INDEX IX_Dashboards_SortOrder ON dashboards(sort_order);
    
    PRINT '✅ Dashboards table created';
END
ELSE
BEGIN
    PRINT '✅ Dashboards table already exists';
END

-- ========================================
-- ROLE PERMISSIONS TABLE
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_permissions' AND xtype='U')
BEGIN
    CREATE TABLE role_permissions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        role_name NVARCHAR(50) NOT NULL,
        dashboard_id INT NOT NULL,
        can_access BIT NOT NULL DEFAULT 1,
        can_edit BIT NOT NULL DEFAULT 0,
        can_delete BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Foreign key constraint
        CONSTRAINT FK_RolePermissions_Dashboards FOREIGN KEY (dashboard_id) 
            REFERENCES dashboards(id) ON DELETE CASCADE,
        
        -- Unique constraint to prevent duplicate role-dashboard combinations
        CONSTRAINT UQ_RolePermissions_RoleDashboard UNIQUE (role_name, dashboard_id),
        
        -- Check constraint for valid roles
        CONSTRAINT CK_RolePermissions_ValidRole CHECK (role_name IN (
            'admin', 
            'user', 
            'viewer', 
            'dashboard_viewer',
            'tk_iot_access',
            'aj_motor_access'
        ))
    );
    
    -- Indexes for better performance
    CREATE INDEX IX_RolePermissions_RoleName ON role_permissions(role_name);
    CREATE INDEX IX_RolePermissions_DashboardId ON role_permissions(dashboard_id);
    CREATE INDEX IX_RolePermissions_CanAccess ON role_permissions(can_access);
    
    PRINT '✅ Role_permissions table created with constraints';
END
ELSE
BEGIN
    PRINT '✅ Role_permissions table already exists';
END

-- ========================================
-- INSERT DASHBOARD DEFINITIONS
-- ========================================
PRINT '📊 Setting up dashboard definitions...';

-- Clear existing dashboard data to avoid conflicts
DELETE FROM role_permissions;
DELETE FROM dashboards;

-- Insert dashboard definitions
INSERT INTO dashboards (name, display_name, description, route_path, icon, sort_order) VALUES
('iot_dashboard', 'IoT Device Dashboard', 'Monitor and manage IoT devices with real-time data', '/dashboard?tab=iot', 'Activity', 1),
('motor_dashboard', 'Motor Device Dashboard', 'Monitor and manage motor devices and performance', '/dashboard?tab=motor', 'Zap', 2);

PRINT '✅ Dashboard definitions created:';
SELECT id, name, display_name, description FROM dashboards ORDER BY sort_order;

-- ========================================
-- INSERT ROLE PERMISSIONS
-- ========================================
PRINT '';
PRINT '🔑 Setting up role permissions...';

-- Admin role - full access to everything
INSERT INTO role_permissions (role_name, dashboard_id, can_access, can_edit, can_delete) VALUES
('admin', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1, 1, 1),
('admin', (SELECT id FROM dashboards WHERE name = 'motor_dashboard'), 1, 1, 1);

-- Dashboard viewer role - access to both dashboards (view only)
INSERT INTO role_permissions (role_name, dashboard_id, can_access, can_edit, can_delete) VALUES
('dashboard_viewer', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1, 0, 0),
('dashboard_viewer', (SELECT id FROM dashboards WHERE name = 'motor_dashboard'), 1, 0, 0);

-- User role - IoT dashboard access only (view only)
INSERT INTO role_permissions (role_name, dashboard_id, can_access, can_edit, can_delete) VALUES
('user', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1, 0, 0);

-- Viewer role - IoT dashboard access only (view only)
INSERT INTO role_permissions (role_name, dashboard_id, can_access, can_edit, can_delete) VALUES
('viewer', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1, 0, 0);

-- ========================================
-- CUSTOM ROLE PERMISSIONS
-- ========================================
PRINT '🎯 Setting up custom role permissions...';

-- TK IoT Access - only IoT dashboard
INSERT INTO role_permissions (role_name, dashboard_id, can_access, can_edit, can_delete) VALUES
('tk_iot_access', (SELECT id FROM dashboards WHERE name = 'iot_dashboard'), 1, 0, 0);

-- AJ Motor Access - only Motor dashboard  
INSERT INTO role_permissions (role_name, dashboard_id, can_access, can_edit, can_delete) VALUES
('aj_motor_access', (SELECT id FROM dashboards WHERE name = 'motor_dashboard'), 1, 0, 0);

PRINT '✅ Custom role permissions created for TK and AJ';

-- ========================================
-- VERIFICATION
-- ========================================
PRINT '';
PRINT '🔍 Verifying role permission setup...';

-- Show all role permissions
SELECT 
    rp.role_name,
    d.display_name as dashboard_name,
    rp.can_access,
    rp.can_edit,
    rp.can_delete
FROM role_permissions rp
JOIN dashboards d ON rp.dashboard_id = d.id
ORDER BY rp.role_name, d.sort_order;

-- ========================================
-- PERMISSION HELPER FUNCTIONS
-- ========================================
PRINT '';
PRINT '⚙️ Creating permission helper functions...';

-- Function to check if a role has access to a dashboard
IF OBJECT_ID('fn_HasDashboardAccess', 'FN') IS NOT NULL
    DROP FUNCTION fn_HasDashboardAccess;
GO

CREATE FUNCTION fn_HasDashboardAccess(@role_name NVARCHAR(50), @dashboard_name NVARCHAR(50))
RETURNS BIT
AS
BEGIN
    DECLARE @has_access BIT = 0;
    
    -- Admin always has access
    IF @role_name = 'admin'
        SET @has_access = 1;
    ELSE
    BEGIN
        -- Check role permissions table
        SELECT @has_access = ISNULL(rp.can_access, 0)
        FROM role_permissions rp
        JOIN dashboards d ON rp.dashboard_id = d.id
        WHERE rp.role_name = @role_name 
          AND d.name = @dashboard_name
          AND d.is_active = 1;
    END
    
    RETURN @has_access;
END
GO

PRINT '✅ Permission helper function created';

-- ========================================
-- ROLE STATISTICS VIEW
-- ========================================
IF OBJECT_ID('v_RoleStatistics', 'V') IS NOT NULL
    DROP VIEW v_RoleStatistics;
GO

CREATE VIEW v_RoleStatistics AS
SELECT 
    rp.role_name,
    COUNT(*) as total_dashboards,
    SUM(CAST(rp.can_access AS INT)) as accessible_dashboards,
    SUM(CAST(rp.can_edit AS INT)) as editable_dashboards,
    SUM(CAST(rp.can_delete AS INT)) as deletable_dashboards
FROM role_permissions rp
GROUP BY rp.role_name;
GO

PRINT '✅ Role statistics view created';

-- Show role statistics
PRINT '';
PRINT '📈 Role permission statistics:';
SELECT * FROM v_RoleStatistics ORDER BY role_name;

PRINT '';
PRINT '🎉 Role and permission system setup completed successfully!';
PRINT '';
PRINT 'System Features:';
PRINT '  ✅ Dashboard definitions (IoT, Motor)';
PRINT '  ✅ Role-based access control';
PRINT '  ✅ Custom roles (tk_iot_access, aj_motor_access)';
PRINT '  ✅ Permission levels (access, edit, delete)';
PRINT '  ✅ Helper functions for permission checking';
PRINT '  ✅ Role statistics view';
PRINT '';
PRINT 'Custom Role Access:';
PRINT '  🎯 tk_iot_access → IoT Device Dashboard only';
PRINT '  🎯 aj_motor_access → Motor Device Dashboard only';
PRINT '';
PRINT 'Ready for demo data setup (run script 03)';
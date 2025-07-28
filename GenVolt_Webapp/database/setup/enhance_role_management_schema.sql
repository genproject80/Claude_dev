-- Enhanced Role Management System Schema
-- This script enhances the existing role management system with dedicated role creation and editing capabilities

-- Create dedicated Roles table to store role metadata
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
BEGIN
    CREATE TABLE roles (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(50) NOT NULL UNIQUE,
        display_name NVARCHAR(100) NOT NULL,
        description NVARCHAR(255),
        is_active BIT NOT NULL DEFAULT 1,
        is_system_role BIT NOT NULL DEFAULT 0, -- System roles cannot be deleted
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Indexes for better performance
        INDEX IX_Roles_Name (name),
        INDEX IX_Roles_IsActive (is_active),
        INDEX IX_Roles_IsSystemRole (is_system_role)
    );
    
    PRINT 'Roles table created successfully';
END
ELSE
BEGIN
    PRINT 'Roles table already exists';
END

-- Migrate existing roles from users table to roles table
DECLARE @existing_roles TABLE (role_name NVARCHAR(50));

INSERT INTO @existing_roles (role_name)
SELECT DISTINCT roles 
FROM users 
WHERE roles IS NOT NULL AND roles != '';

-- Insert system roles first
IF NOT EXISTS (SELECT * FROM roles WHERE name = 'admin')
BEGIN
    INSERT INTO roles (name, display_name, description, is_system_role) 
    VALUES ('admin', 'Administrator', 'Full system access with all permissions', 1);
    PRINT 'Admin role created';
END

IF NOT EXISTS (SELECT * FROM roles WHERE name = 'user')
BEGIN
    INSERT INTO roles (name, display_name, description, is_system_role) 
    VALUES ('user', 'Standard User', 'Regular user with limited dashboard access', 1);
    PRINT 'User role created';
END

IF NOT EXISTS (SELECT * FROM roles WHERE name = 'viewer')
BEGIN
    INSERT INTO roles (name, display_name, description, is_system_role) 
    VALUES ('viewer', 'Read-only Viewer', 'View-only access to designated dashboards', 1);
    PRINT 'Viewer role created';
END

-- Insert custom roles
IF NOT EXISTS (SELECT * FROM roles WHERE name = 'dashboard_viewer')
BEGIN
    INSERT INTO roles (name, display_name, description, is_system_role) 
    VALUES ('dashboard_viewer', 'Dashboard Viewer', 'Access to both IoT and Motor dashboards without admin privileges', 0);
    PRINT 'Dashboard viewer role created';
END

-- Insert any other roles found in users table that aren't already in roles table
DECLARE @role_name NVARCHAR(50);
DECLARE role_cursor CURSOR FOR 
SELECT role_name FROM @existing_roles 
WHERE role_name NOT IN (SELECT name FROM roles);

OPEN role_cursor;
FETCH NEXT FROM role_cursor INTO @role_name;

WHILE @@FETCH_STATUS = 0
BEGIN
    INSERT INTO roles (name, display_name, description, is_system_role) 
    VALUES (@role_name, @role_name, 'Migrated role from existing system', 0);
    
    PRINT 'Migrated role: ' + @role_name;
    FETCH NEXT FROM role_cursor INTO @role_name;
END

CLOSE role_cursor;
DEALLOCATE role_cursor;

-- Add foreign key constraint to role_permissions table
-- First, clean up any orphaned role_permissions records
DELETE FROM role_permissions 
WHERE role_name NOT IN (SELECT name FROM roles);

-- Add the foreign key constraint if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_RolePermissions_Roles')
BEGIN
    ALTER TABLE role_permissions
    ADD CONSTRAINT FK_RolePermissions_Roles 
    FOREIGN KEY (role_name) REFERENCES roles(name) 
    ON UPDATE CASCADE ON DELETE CASCADE;
    
    PRINT 'Foreign key constraint added to role_permissions table';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint already exists on role_permissions table';
END

-- Create trigger to update updated_at timestamp on roles table
IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_Roles_UpdateTimestamp')
BEGIN
    EXEC('
    CREATE TRIGGER TR_Roles_UpdateTimestamp
    ON roles
    AFTER UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        UPDATE roles 
        SET updated_at = GETDATE()
        WHERE id IN (SELECT DISTINCT id FROM inserted);
    END
    ');
    
    PRINT 'Update timestamp trigger created for roles table';
END

-- Verify the setup
PRINT 'Verifying roles setup...';
SELECT 
    r.id,
    r.name,
    r.display_name,
    r.description,
    r.is_active,
    r.is_system_role,
    r.created_at,
    COUNT(u.id) as user_count,
    COUNT(rp.id) as permission_count
FROM roles r
LEFT JOIN users u ON r.name = u.roles
LEFT JOIN role_permissions rp ON r.name = rp.role_name
GROUP BY r.id, r.name, r.display_name, r.description, r.is_active, r.is_system_role, r.created_at
ORDER BY r.is_system_role DESC, r.name;

PRINT 'Role management schema enhancement completed successfully!';
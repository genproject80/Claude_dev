-- Fix Database Schema Inconsistencies
-- This script standardizes the user role system and fixes column naming inconsistencies

USE gendb;
GO

-- First, let's see what we're working with
PRINT 'Checking current schema state...';

-- Check if the users table exists and what columns it has
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users')
BEGIN
    PRINT 'Users table exists';
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Users'
    ORDER BY ORDINAL_POSITION;
END

-- Step 1: Standardize the role column name from 'role' to 'roles' if needed
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'role')
BEGIN
    PRINT 'Found old "role" column, standardizing to "roles"...';
    
    -- Add new roles column if it doesn't exist
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'roles')
    BEGIN
        ALTER TABLE Users ADD roles NVARCHAR(50);
        PRINT 'Added roles column';
    END
    
    -- Copy data from role to roles
    UPDATE Users SET roles = role WHERE roles IS NULL;
    PRINT 'Copied role data to roles column';
    
    -- Drop the old role column
    ALTER TABLE Users DROP CONSTRAINT IF EXISTS [CK__Users__role__*]; -- Drop any existing check constraint
    ALTER TABLE Users DROP COLUMN role;
    PRINT 'Dropped old role column';
END

-- Step 2: Update the roles column constraint to include all valid roles
PRINT 'Updating role constraints...';

-- Drop existing constraint if it exists
DECLARE @ConstraintName NVARCHAR(255);
SELECT @ConstraintName = CONSTRAINT_NAME 
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
WHERE CONSTRAINT_NAME LIKE '%roles%' OR CONSTRAINT_NAME LIKE '%role%';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE Users DROP CONSTRAINT [' + @ConstraintName + ']');
    PRINT 'Dropped existing role constraint: ' + @ConstraintName;
END

-- Add new comprehensive role constraint
ALTER TABLE Users ADD CONSTRAINT CK_Users_Roles 
CHECK (roles IN ('admin', 'user', 'viewer', 'dashboard_viewer'));
PRINT 'Added new role constraint with all valid roles';

-- Step 3: Ensure all existing users have valid roles
PRINT 'Validating existing user roles...';

-- Update any invalid roles to 'user' as default
UPDATE Users 
SET roles = 'user' 
WHERE roles NOT IN ('admin', 'user', 'viewer', 'dashboard_viewer') 
   OR roles IS NULL;

-- Show the count of users updated
PRINT 'Updated invalid roles to default "user" role';

-- Step 4: Ensure the enhanced role management tables are consistent
PRINT 'Checking role management tables...';

-- Make sure the roles table has all the standard roles
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'roles')
BEGIN
    -- Insert missing standard roles
    IF NOT EXISTS (SELECT * FROM roles WHERE name = 'admin')
    BEGIN
        INSERT INTO roles (name, display_name, description, is_system_role) 
        VALUES ('admin', 'Administrator', 'Full system access with all permissions', 1);
        PRINT 'Added admin role to roles table';
    END

    IF NOT EXISTS (SELECT * FROM roles WHERE name = 'user')
    BEGIN
        INSERT INTO roles (name, display_name, description, is_system_role) 
        VALUES ('user', 'Standard User', 'Regular user with limited dashboard access', 1);
        PRINT 'Added user role to roles table';
    END

    IF NOT EXISTS (SELECT * FROM roles WHERE name = 'viewer')
    BEGIN
        INSERT INTO roles (name, display_name, description, is_system_role) 
        VALUES ('viewer', 'Read-only Viewer', 'View-only access to designated dashboards', 1);
        PRINT 'Added viewer role to roles table';
    END

    IF NOT EXISTS (SELECT * FROM roles WHERE name = 'dashboard_viewer')
    BEGIN
        INSERT INTO roles (name, display_name, description, is_system_role) 
        VALUES ('dashboard_viewer', 'Dashboard Viewer', 'Access to both IoT and Motor dashboards without admin privileges', 0);
        PRINT 'Added dashboard_viewer role to roles table';
    END
END

-- Step 5: Clean up role_permissions table to ensure referential integrity
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'role_permissions')
BEGIN
    PRINT 'Cleaning up role_permissions table...';
    
    -- Remove any orphaned permissions for roles that don't exist in users table
    DELETE FROM role_permissions 
    WHERE role_name NOT IN (SELECT DISTINCT roles FROM Users WHERE roles IS NOT NULL);
    
    PRINT 'Removed orphaned role permissions';
END

-- Step 6: Set default role for new users if not specified
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'roles' AND COLUMN_DEFAULT IS NOT NULL)
BEGIN
    ALTER TABLE Users ADD CONSTRAINT DF_Users_Roles DEFAULT 'user' FOR roles;
    PRINT 'Added default role constraint for new users';
END

-- Step 7: Final validation - show current state
PRINT 'Schema fix completed. Current state:';

SELECT 
    'User Role Distribution' as Summary,
    roles,
    COUNT(*) as user_count
FROM Users 
GROUP BY roles
ORDER BY user_count DESC;

-- Show roles table if it exists
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'roles')
BEGIN
    SELECT 
        'Roles Table State' as Summary,
        name,
        display_name,
        is_system_role,
        is_active
    FROM roles
    ORDER BY is_system_role DESC, name;
END

PRINT 'Database schema inconsistencies have been fixed!';
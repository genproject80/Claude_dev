-- Quick Permission System Validation
-- Run this for a fast health check

USE gendb;
GO

PRINT '=== QUICK PERMISSION SYSTEM VALIDATION ===';

-- 1. Check schema consistency
SELECT 'Schema Check:' as test, 
    CASE 
        WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'roles') 
        THEN 'PASS - roles column exists'
        ELSE 'FAIL - roles column missing'
    END as result;

-- 2. Check role constraints (improved detection)
DECLARE @TableName NVARCHAR(50) = CASE 
    WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users') THEN 'Users'
    WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users') THEN 'users'
    ELSE NULL
END;

DECLARE @RoleColumn NVARCHAR(50) = CASE 
    WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @TableName AND COLUMN_NAME = 'roles') THEN 'roles'
    WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @TableName AND COLUMN_NAME = 'role') THEN 'role'
    ELSE NULL
END;

SELECT 'Role Constraints:' as test,
    CASE 
        WHEN @TableName IS NULL THEN 'FAIL - users table not found'
        WHEN @RoleColumn IS NULL THEN 'FAIL - role column not found'
        WHEN EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
            JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
            WHERE ccu.TABLE_NAME = @TableName AND ccu.COLUMN_NAME = @RoleColumn
            AND cc.CHECK_CLAUSE LIKE '%dashboard_viewer%'
        ) THEN 'PASS - dashboard_viewer role allowed'
        WHEN EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
            WHERE CHECK_CLAUSE LIKE '%dashboard_viewer%'
        ) THEN 'PARTIAL - constraint exists but may not be linked correctly'
        ELSE 'FAIL - role constraints not updated'
    END as result;

-- Show actual constraints for debugging
SELECT 'Current Role Constraints:' as info, cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
WHERE ccu.TABLE_NAME = @TableName AND ccu.COLUMN_NAME = @RoleColumn;

-- 3. Check essential tables exist
SELECT 'Essential Tables:' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'roles')
        AND EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'dashboards') 
        AND EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'role_permissions')
        THEN 'PASS - all tables exist'
        ELSE 'FAIL - missing permission tables'
    END as result;

-- 4. Check basic data
SELECT 'Basic Data:' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM roles WHERE name = 'admin')
        AND EXISTS (SELECT 1 FROM dashboards WHERE name = 'iot_dashboard')
        AND EXISTS (SELECT 1 FROM role_permissions)
        THEN 'PASS - basic data exists'
        ELSE 'FAIL - missing basic permission data'
    END as result;

-- 5. Check admin user exists
SELECT 'Admin User:' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE roles = 'admin')
        THEN 'PASS - admin user exists'
        ELSE 'FAIL - no admin users found'
    END as result;

-- Summary counts
SELECT 
    'System Summary:' as info,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM roles WHERE is_active = 1) as active_roles,
    (SELECT COUNT(*) FROM dashboards WHERE is_active = 1) as active_dashboards,
    (SELECT COUNT(*) FROM role_permissions) as total_permissions;

-- Show any issues
IF NOT EXISTS (SELECT 1 FROM users WHERE roles = 'admin')
    PRINT 'WARNING: No admin users - create one immediately!';

IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_name = 'user')
    PRINT 'WARNING: Regular users have no dashboard permissions!';

PRINT 'Quick validation completed. Run full test for detailed analysis.';
-- Test Script for Complete Permission System
-- Run this script to test all the permission system changes

USE gendb;
GO

PRINT '=== TESTING PERMISSION SYSTEM ===';
PRINT 'Testing database schema and permission system implementation';
PRINT '';

-- Test 1: Check schema consistency
PRINT '1. Testing Schema Consistency...';

-- Check users table structure
SELECT 'Users table structure:' as test_section;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users'
ORDER BY ORDINAL_POSITION;

-- Check role constraints
SELECT 'Role constraints:' as test_section;
SELECT CONSTRAINT_NAME, CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
WHERE CONSTRAINT_NAME LIKE '%role%';

-- Test 2: Check roles table
PRINT '2. Testing Roles Table...';
SELECT 'Available roles:' as test_section;
SELECT 
    name,
    display_name,
    is_active,
    is_system_role,
    (SELECT COUNT(*) FROM users WHERE roles = r.name) as user_count
FROM roles r
ORDER BY is_system_role DESC, name;

-- Test 3: Check dashboards and permissions
PRINT '3. Testing Dashboard Permissions...';
SELECT 'Available dashboards:' as test_section;
SELECT id, name, display_name, is_active
FROM dashboards
ORDER BY display_name;

SELECT 'Role permissions matrix:' as test_section;
SELECT 
    rp.role_name,
    d.display_name as dashboard_name,
    rp.can_access
FROM role_permissions rp
JOIN dashboards d ON rp.dashboard_id = d.id
ORDER BY rp.role_name, d.display_name;

-- Test 4: Test user role distribution
PRINT '4. Testing User Role Distribution...';
SELECT 
    'User role distribution:' as test_section,
    roles,
    COUNT(*) as user_count
FROM users 
GROUP BY roles
ORDER BY user_count DESC;

-- Test 5: Test data integrity
PRINT '5. Testing Data Integrity...';

-- Check for orphaned permissions
SELECT 'Orphaned role permissions (should be empty):' as test_section;
SELECT rp.role_name, COUNT(*) as orphaned_permissions
FROM role_permissions rp
LEFT JOIN roles r ON rp.role_name = r.name
WHERE r.name IS NULL
GROUP BY rp.role_name;

-- Check for users with invalid roles
SELECT 'Users with invalid roles (should be empty):' as test_section;
SELECT u.user_name, u.email, u.roles
FROM users u
LEFT JOIN roles r ON u.roles = r.name
WHERE r.name IS NULL AND u.roles IS NOT NULL;

-- Test 6: Verify client data isolation setup
PRINT '6. Testing Client Data Isolation...';
SELECT 'Client distribution in device table:' as test_section;
SELECT 
    client_id,
    COUNT(DISTINCT Device_ID) as device_count
FROM device
WHERE client_id IS NOT NULL
GROUP BY client_id
ORDER BY device_count DESC;

SELECT 'Users with client assignments:' as test_section;
SELECT 
    u.user_name,
    u.email,
    u.roles,
    u.client_id,
    CASE 
        WHEN u.client_id IS NOT NULL THEN 'Assigned'
        WHEN u.roles = 'admin' THEN 'Admin (All Access)'
        ELSE 'No Assignment'
    END as access_level
FROM users u
ORDER BY u.roles, u.client_id;

-- Test 7: Test permission inheritance and hierarchy
PRINT '7. Testing Permission Hierarchy...';
CREATE TABLE #role_hierarchy_test (
    role_name NVARCHAR(50),
    hierarchy_level INT,
    expected_permissions NVARCHAR(MAX)
);

INSERT INTO #role_hierarchy_test VALUES
('viewer', 1, 'Limited dashboard access'),
('dashboard_viewer', 2, 'IoT and Motor dashboards'),
('user', 3, 'Standard user permissions + dashboard_viewer'),
('admin', 4, 'All permissions');

SELECT 
    'Role hierarchy test:' as test_section,
    rht.role_name,
    rht.hierarchy_level,
    rht.expected_permissions,
    COUNT(rp.id) as actual_permissions,
    CASE 
        WHEN r.name IS NULL THEN 'ROLE MISSING'
        WHEN COUNT(rp.id) = 0 AND rht.role_name != 'admin' THEN 'NO PERMISSIONS'
        WHEN rht.role_name = 'admin' THEN 'ADMIN (Should have implicit access)'
        ELSE 'HAS PERMISSIONS'
    END as status
FROM #role_hierarchy_test rht
LEFT JOIN roles r ON rht.role_name = r.name
LEFT JOIN role_permissions rp ON r.name = rp.role_name
GROUP BY rht.role_name, rht.hierarchy_level, rht.expected_permissions, r.name
ORDER BY rht.hierarchy_level;

DROP TABLE #role_hierarchy_test;

-- Test 8: Security validation
PRINT '8. Testing Security Configuration...';

-- Check for default passwords or weak security
SELECT 'Security check - users without proper password hashes:' as test_section;
SELECT user_name, email, 
    CASE 
        WHEN LEN(password) < 50 THEN 'WEAK HASH'
        WHEN password LIKE '%admin%' THEN 'CONTAINS ADMIN'
        WHEN password LIKE '%password%' THEN 'CONTAINS PASSWORD'
        ELSE 'OK'
    END as password_security_status
FROM users
WHERE password IS NOT NULL;

-- Test 9: Generate test scenarios
PRINT '9. Generating Test Scenarios...';

SELECT 'Test scenario recommendations:' as test_section;

SELECT '1. Admin User Test' as scenario, 'Login as admin and verify access to all dashboards and admin panel' as test_description
UNION ALL
SELECT '2. Regular User Test', 'Login as regular user and verify limited dashboard access based on role permissions'
UNION ALL
SELECT '3. Client Isolation Test', 'Verify users only see data for their assigned client_id'
UNION ALL
SELECT '4. Permission Management Test', 'Use admin panel to modify role permissions and verify changes take effect'
UNION ALL
SELECT '5. Role Hierarchy Test', 'Test that dashboard_viewer has more access than viewer but less than admin'
UNION ALL
SELECT '6. Invalid Access Test', 'Attempt to access restricted endpoints and verify proper 403/401 responses'
UNION ALL
SELECT '7. Data Filtering Test', 'Verify device and dashboard data is filtered by client assignment';

-- Final summary
PRINT '';
PRINT '=== PERMISSION SYSTEM TEST SUMMARY ===';

DECLARE @total_roles INT, @total_dashboards INT, @total_permissions INT, @total_users INT;
DECLARE @users_with_access INT, @admin_users INT;

SELECT @total_roles = COUNT(*) FROM roles WHERE is_active = 1;
SELECT @total_dashboards = COUNT(*) FROM dashboards WHERE is_active = 1;
SELECT @total_permissions = COUNT(*) FROM role_permissions;
SELECT @total_users = COUNT(*) FROM users;
SELECT @users_with_access = COUNT(*) FROM users WHERE roles IS NOT NULL;
SELECT @admin_users = COUNT(*) FROM users WHERE roles = 'admin';

PRINT 'Active Roles: ' + CAST(@total_roles AS VARCHAR(10));
PRINT 'Active Dashboards: ' + CAST(@total_dashboards AS VARCHAR(10));
PRINT 'Total Role Permissions: ' + CAST(@total_permissions AS VARCHAR(10));
PRINT 'Total Users: ' + CAST(@total_users AS VARCHAR(10));
PRINT 'Users with Role Assignment: ' + CAST(@users_with_access AS VARCHAR(10));
PRINT 'Admin Users: ' + CAST(@admin_users AS VARCHAR(10));
PRINT '';

-- Recommendations
PRINT '=== RECOMMENDATIONS ===';

IF @admin_users = 0
    PRINT 'WARNING: No admin users found. Create at least one admin user.';

IF @total_permissions = 0
    PRINT 'WARNING: No role permissions configured. Run setup_initial_permissions.sql';

IF EXISTS (SELECT 1 FROM users WHERE roles IS NULL)
    PRINT 'INFO: Some users have no role assignment. Consider assigning default "user" role.';

IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_name = 'user')
    PRINT 'WARNING: "user" role has no dashboard permissions. Users may not be able to access any dashboards.';

PRINT '';
PRINT 'Permission system test completed!';
PRINT 'Review the output above for any issues before deploying to production.';
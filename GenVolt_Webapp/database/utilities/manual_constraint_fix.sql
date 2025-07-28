-- Manual Role Constraint Fix
-- Use this if the automated fix doesn't work
-- Run each section step by step

USE gendb;
GO

PRINT '=== MANUAL ROLE CONSTRAINT FIX ===';
PRINT 'Follow each step carefully and check results';
PRINT '';

-- STEP 1: Identify your table structure
PRINT 'STEP 1: Check your table structure';
PRINT 'Run this query and note the results:';
PRINT '';

SELECT 
    'Table Check' as info,
    CASE 
        WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users') THEN 'Users table found'
        WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users') THEN 'users table found'
        ELSE 'NO USERS TABLE FOUND!'
    END as table_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'roles') THEN 'Users.roles'
        WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'role') THEN 'Users.role'
        WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'roles') THEN 'users.roles'
        WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'role') THEN 'users.role'
        ELSE 'NO ROLE COLUMN FOUND!'
    END as column_status;

-- STEP 2: Show current constraints
PRINT '';
PRINT 'STEP 2: Current constraints on your table';
PRINT 'This shows what constraints currently exist:';
PRINT '';

-- For Users table with role column
SELECT 'Users.role constraints:' as type, CONSTRAINT_NAME, CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
WHERE ccu.TABLE_NAME = 'Users' AND ccu.COLUMN_NAME = 'role'
UNION ALL
-- For Users table with roles column  
SELECT 'Users.roles constraints:' as type, CONSTRAINT_NAME, CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
WHERE ccu.TABLE_NAME = 'Users' AND ccu.COLUMN_NAME = 'roles'
UNION ALL
-- For users table with role column
SELECT 'users.role constraints:' as type, CONSTRAINT_NAME, CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
WHERE ccu.TABLE_NAME = 'users' AND ccu.COLUMN_NAME = 'role'
UNION ALL
-- For users table with roles column
SELECT 'users.roles constraints:' as type, CONSTRAINT_NAME, CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
WHERE ccu.TABLE_NAME = 'users' AND ccu.COLUMN_NAME = 'roles';

PRINT '';
PRINT 'STEP 3: Manual fix commands';
PRINT 'Based on the results above, run the appropriate commands below:';
PRINT '';

-- Option A: If you have Users table with role column
PRINT '-- OPTION A: For Users table with role column';
PRINT '-- 1. Drop the existing constraint (replace CONSTRAINT_NAME with actual name from above):';
PRINT '-- ALTER TABLE Users DROP CONSTRAINT [your_constraint_name_here];';
PRINT '';
PRINT '-- 2. Add the new constraint:';
PRINT '-- ALTER TABLE Users ADD CONSTRAINT CK_Users_Role_Complete CHECK (role IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer''));';
PRINT '';

-- Option B: If you have Users table with roles column
PRINT '-- OPTION B: For Users table with roles column';
PRINT '-- 1. Drop the existing constraint (replace CONSTRAINT_NAME with actual name from above):';
PRINT '-- ALTER TABLE Users DROP CONSTRAINT [your_constraint_name_here];';
PRINT '';
PRINT '-- 2. Add the new constraint:';
PRINT '-- ALTER TABLE Users ADD CONSTRAINT CK_Users_Roles_Complete CHECK (roles IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer''));';
PRINT '';

-- Option C: If you have users table with role column
PRINT '-- OPTION C: For users table with role column';
PRINT '-- 1. Drop the existing constraint (replace CONSTRAINT_NAME with actual name from above):';
PRINT '-- ALTER TABLE users DROP CONSTRAINT [your_constraint_name_here];';
PRINT '';
PRINT '-- 2. Add the new constraint:';
PRINT '-- ALTER TABLE users ADD CONSTRAINT CK_users_role_complete CHECK (role IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer''));';
PRINT '';

-- Option D: If you have users table with roles column
PRINT '-- OPTION D: For users table with roles column';
PRINT '-- 1. Drop the existing constraint (replace CONSTRAINT_NAME with actual name from above):';
PRINT '-- ALTER TABLE users DROP CONSTRAINT [your_constraint_name_here];';
PRINT '';
PRINT '-- 2. Add the new constraint:';
PRINT '-- ALTER TABLE users ADD CONSTRAINT CK_users_roles_complete CHECK (roles IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer''));';
PRINT '';

PRINT '';
PRINT 'STEP 4: After running the appropriate commands above, test with:';
PRINT '';

-- Test commands for each scenario
PRINT '-- Test the constraint works (should succeed):';
PRINT '-- INSERT INTO Users (name, email, role, password_hash) VALUES (''Test'', ''test@test.com'', ''dashboard_viewer'', ''hash'');';
PRINT '-- DELETE FROM Users WHERE email = ''test@test.com''; -- Clean up';
PRINT '';
PRINT '-- Test the constraint blocks invalid roles (should fail):';
PRINT '-- INSERT INTO Users (name, email, role, password_hash) VALUES (''Test'', ''test@test.com'', ''invalid_role'', ''hash'');';
PRINT '';

PRINT 'STEP 5: Run quick_validation.sql again to confirm the fix worked.';

PRINT '';
PRINT '=== COMMON CONSTRAINT NAMES TO LOOK FOR ===';
PRINT 'Look for constraints with names like:';
PRINT '- CK__Users__role__[random_chars]';
PRINT '- CK_Users_role';  
PRINT '- CHK_Users_role';
PRINT '- Any constraint with CHECK_CLAUSE containing role values';
PRINT '';
PRINT 'Copy the exact CONSTRAINT_NAME from Step 2 results above!';
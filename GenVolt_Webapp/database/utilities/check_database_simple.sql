-- Simple script to check database structure without assuming column names
-- Run this to see the actual table structure

USE gendb;
GO

PRINT '=== CHECKING DATABASE STRUCTURE ===';

-- List all tables
SELECT 'All tables in database:' as section;
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Check users table structure
SELECT 'Users table columns:' as section;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users'
ORDER BY ORDINAL_POSITION;

-- Show current demo users (without assuming column names)
SELECT 'Demo users found:' as section;
SELECT *
FROM users 
WHERE email LIKE '%demo.com';

-- Check for any client-related tables
SELECT 'Tables with "client" in name:' as section;
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME LIKE '%client%' OR TABLE_NAME LIKE '%Client%';

-- Check device table columns if it exists
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Device')
BEGIN
    SELECT 'Device table columns:' as section;
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Device'
    ORDER BY ORDINAL_POSITION;
END
ELSE IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'device')
BEGIN
    SELECT 'device table columns:' as section;
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'device'
    ORDER BY ORDINAL_POSITION;
END
ELSE
BEGIN
    PRINT 'No Device/device table found';
END

PRINT 'Database structure check completed!';
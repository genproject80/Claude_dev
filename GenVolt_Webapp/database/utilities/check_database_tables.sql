-- Script to check what tables exist in the database
-- Run this to see the actual table structure

USE gendb;
GO

PRINT '=== CHECKING DATABASE STRUCTURE ===';

-- List all tables
SELECT 'All tables in database:' as section;
SELECT TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Check for client-related tables
SELECT 'Client-related tables:' as section;
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME LIKE '%client%' OR TABLE_NAME LIKE '%Client%'
ORDER BY TABLE_NAME;

-- Check users table structure
SELECT 'Users table structure:' as section;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users'
ORDER BY ORDINAL_POSITION;

-- Check if users table has client_id column
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'client_id')
BEGIN
    PRINT 'Users table HAS client_id column';
    
    SELECT 'Current user client assignments:' as section;
    SELECT user_name, email, roles, client_id
    FROM users 
    WHERE email LIKE '%demo.com'
    ORDER BY roles;
END
ELSE
BEGIN
    PRINT 'Users table does NOT have client_id column';
    
    SELECT 'Current demo users (no client info):' as section;
    SELECT user_name, email, roles, created_at
    FROM users 
    WHERE email LIKE '%demo.com'
    ORDER BY roles;
END

-- Check device table structure for client columns
SELECT 'Device table client columns:' as section;
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME IN ('Device', 'device') 
AND (COLUMN_NAME LIKE '%client%' OR COLUMN_NAME LIKE '%Client%')
ORDER BY TABLE_NAME, COLUMN_NAME;

PRINT 'Database structure check completed!';
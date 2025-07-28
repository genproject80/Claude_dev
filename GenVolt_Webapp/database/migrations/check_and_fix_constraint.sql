-- Check and Fix Role Constraint Issue
-- This script will check what constraints exist and fix them properly

USE gendb;
GO

PRINT '=== CHECKING CURRENT CONSTRAINTS ===';

-- Check all CHECK constraints on the users table
SELECT 
    CONSTRAINT_NAME, 
    CHECK_CLAUSE,
    TABLE_NAME
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
WHERE TABLE_NAME = 'users'
ORDER BY CONSTRAINT_NAME;

PRINT '';
PRINT '=== ATTEMPTING TO FIX CONSTRAINTS ===';

-- Drop any existing role constraints (there might be multiple)
DECLARE @sql NVARCHAR(MAX) = '';
DECLARE @constraintName NVARCHAR(128);

DECLARE constraint_cursor CURSOR FOR
SELECT CONSTRAINT_NAME 
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
WHERE TABLE_NAME = 'users' 
AND (CONSTRAINT_NAME LIKE '%role%' OR CHECK_CLAUSE LIKE '%roles%');

OPEN constraint_cursor;
FETCH NEXT FROM constraint_cursor INTO @constraintName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = 'ALTER TABLE users DROP CONSTRAINT ' + @constraintName;
    PRINT 'Dropping constraint: ' + @constraintName;
    EXEC sp_executesql @sql;
    FETCH NEXT FROM constraint_cursor INTO @constraintName;
END

CLOSE constraint_cursor;
DEALLOCATE constraint_cursor;

-- Create the new constraint with custom roles
ALTER TABLE users ADD CONSTRAINT CK_Users_Roles_Updated 
CHECK (roles IN (
    'admin', 
    'user', 
    'viewer', 
    'dashboard_viewer',
    'aj_motor_access',
    'tk_iot_access'
));

PRINT 'New constraint CK_Users_Roles_Updated created successfully';

PRINT '';
PRINT '=== VERIFICATION ===';

-- Verify the new constraint
SELECT 
    CONSTRAINT_NAME, 
    CHECK_CLAUSE,
    TABLE_NAME
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
WHERE TABLE_NAME = 'users'
ORDER BY CONSTRAINT_NAME;

PRINT '';
PRINT 'Role constraint fix completed!';
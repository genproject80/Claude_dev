-- Improved Role Constraints Fix
-- This script specifically fixes the role constraint issue

USE gendb;
GO

PRINT '=== FIXING ROLE CONSTRAINTS ===';
PRINT 'Addressing case sensitivity and constraint detection issues';
PRINT '';

-- Step 1: Identify the actual table name and constraints
PRINT '1. Identifying existing table structure...';

-- Check both Users and users table names
DECLARE @TableName NVARCHAR(50);
DECLARE @RoleColumnName NVARCHAR(50);

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users')
BEGIN
    SET @TableName = 'Users';
    PRINT 'Found table: Users (capital U)';
END
ELSE IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users')
BEGIN
    SET @TableName = 'users';
    PRINT 'Found table: users (lowercase u)';
END
ELSE
BEGIN
    PRINT 'ERROR: No users table found!';
    RETURN;
END

-- Check column name (role vs roles)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @TableName AND COLUMN_NAME = 'roles')
BEGIN
    SET @RoleColumnName = 'roles';
    PRINT 'Found column: roles';
END
ELSE IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @TableName AND COLUMN_NAME = 'role')
BEGIN
    SET @RoleColumnName = 'role';
    PRINT 'Found column: role';
END
ELSE
BEGIN
    PRINT 'ERROR: No role/roles column found!';
    RETURN;
END

PRINT 'Using table: ' + @TableName + ', column: ' + @RoleColumnName;
PRINT '';

-- Step 2: Find and display all existing constraints
PRINT '2. Finding all existing role-related constraints...';

DECLARE @constraints TABLE (
    constraint_name NVARCHAR(255),
    check_clause NVARCHAR(MAX)
);

INSERT INTO @constraints
SELECT cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu 
    ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
WHERE ccu.TABLE_NAME = @TableName
    AND ccu.COLUMN_NAME = @RoleColumnName;

-- Also look for constraints that mention role values
INSERT INTO @constraints
SELECT cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
WHERE cc.CHECK_CLAUSE LIKE '%admin%' 
    OR cc.CHECK_CLAUSE LIKE '%user%' 
    OR cc.CHECK_CLAUSE LIKE '%viewer%'
    OR cc.CONSTRAINT_NAME LIKE '%role%'
    OR cc.CONSTRAINT_NAME LIKE '%Role%';

-- Display found constraints
IF EXISTS (SELECT 1 FROM @constraints)
BEGIN
    PRINT 'Found existing constraints:';
    SELECT constraint_name, check_clause FROM @constraints;
END
ELSE
BEGIN
    PRINT 'No existing role constraints found.';
END

-- Step 3: Drop all role-related constraints
PRINT '';
PRINT '3. Dropping existing role constraints...';

DECLARE @constraint_name NVARCHAR(255);
DECLARE @sql NVARCHAR(MAX);

DECLARE constraint_cursor CURSOR FOR 
SELECT DISTINCT constraint_name FROM @constraints;

OPEN constraint_cursor;
FETCH NEXT FROM constraint_cursor INTO @constraint_name;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = 'ALTER TABLE [' + @TableName + '] DROP CONSTRAINT [' + @constraint_name + ']';
    
    BEGIN TRY
        EXEC sp_executesql @sql;
        PRINT 'Dropped constraint: ' + @constraint_name;
    END TRY
    BEGIN CATCH
        PRINT 'Failed to drop constraint: ' + @constraint_name + ' - ' + ERROR_MESSAGE();
    END CATCH
    
    FETCH NEXT FROM constraint_cursor INTO @constraint_name;
END

CLOSE constraint_cursor;
DEALLOCATE constraint_cursor;

-- Step 4: Standardize column name to 'roles' if needed
PRINT '';
PRINT '4. Standardizing column name...';

IF @RoleColumnName = 'role'
BEGIN
    PRINT 'Converting "role" column to "roles"...';
    
    -- Add new roles column if it doesn't exist
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @TableName AND COLUMN_NAME = 'roles')
    BEGIN
        SET @sql = 'ALTER TABLE [' + @TableName + '] ADD roles NVARCHAR(50)';
        EXEC sp_executesql @sql;
        PRINT 'Added roles column';
    END
    
    -- Copy data from role to roles
    SET @sql = 'UPDATE [' + @TableName + '] SET roles = [role] WHERE roles IS NULL';
    EXEC sp_executesql @sql;
    PRINT 'Copied data from role to roles column';
    
    -- Drop the old role column
    SET @sql = 'ALTER TABLE [' + @TableName + '] DROP COLUMN [role]';
    EXEC sp_executesql @sql;
    PRINT 'Dropped old role column';
    
    SET @RoleColumnName = 'roles';
END
ELSE
BEGIN
    PRINT 'Column name already correct: ' + @RoleColumnName;
END

-- Step 5: Add the new comprehensive constraint
PRINT '';
PRINT '5. Adding new role constraint...';

SET @sql = 'ALTER TABLE [' + @TableName + '] ADD CONSTRAINT CK_' + @TableName + '_Roles_Complete 
CHECK ([' + @RoleColumnName + '] IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer''))';

BEGIN TRY
    EXEC sp_executesql @sql;
    PRINT 'Successfully added new role constraint: CK_' + @TableName + '_Roles_Complete';
END TRY
BEGIN CATCH
    PRINT 'Failed to add new constraint: ' + ERROR_MESSAGE();
    
    -- Try to diagnose the issue
    PRINT 'Checking for invalid role values...';
    SET @sql = 'SELECT DISTINCT [' + @RoleColumnName + '] as invalid_role 
                FROM [' + @TableName + '] 
                WHERE [' + @RoleColumnName + '] NOT IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer'')
                OR [' + @RoleColumnName + '] IS NULL';
    EXEC sp_executesql @sql;
END CATCH

-- Step 6: Fix any invalid role values
PRINT '';
PRINT '6. Fixing invalid role values...';

SET @sql = 'UPDATE [' + @TableName + '] 
SET [' + @RoleColumnName + '] = ''user'' 
WHERE [' + @RoleColumnName + '] NOT IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer'') 
   OR [' + @RoleColumnName + '] IS NULL';

EXEC sp_executesql @sql;
PRINT 'Updated invalid roles to default "user" role';

-- Step 7: Try adding the constraint again if it failed
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
               WHERE CONSTRAINT_NAME = 'CK_' + @TableName + '_Roles_Complete')
BEGIN
    PRINT 'Retrying constraint creation...';
    
    SET @sql = 'ALTER TABLE [' + @TableName + '] ADD CONSTRAINT CK_' + @TableName + '_Roles_Complete 
    CHECK ([' + @RoleColumnName + '] IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer''))';
    
    BEGIN TRY
        EXEC sp_executesql @sql;
        PRINT 'Successfully added new role constraint on retry';
    END TRY
    BEGIN CATCH
        PRINT 'Failed again: ' + ERROR_MESSAGE();
    END CATCH
END

-- Step 8: Add default constraint if missing
PRINT '';
PRINT '7. Adding default role constraint...';

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = @TableName AND COLUMN_NAME = @RoleColumnName 
               AND COLUMN_DEFAULT IS NOT NULL)
BEGIN
    SET @sql = 'ALTER TABLE [' + @TableName + '] ADD CONSTRAINT DF_' + @TableName + '_Roles_Default DEFAULT ''user'' FOR [' + @RoleColumnName + ']';
    
    BEGIN TRY
        EXEC sp_executesql @sql;
        PRINT 'Added default role constraint';
    END TRY
    BEGIN CATCH
        PRINT 'Default constraint already exists or failed: ' + ERROR_MESSAGE();
    END CATCH
END

-- Step 9: Final verification
PRINT '';
PRINT '8. Final verification...';

-- Check the new constraint exists
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
           WHERE CONSTRAINT_NAME = 'CK_' + @TableName + '_Roles_Complete')
BEGIN
    PRINT '✅ SUCCESS: New role constraint exists';
    
    -- Test the constraint by checking if all values are valid
    SET @sql = 'SELECT COUNT(*) as invalid_count FROM [' + @TableName + '] 
                WHERE [' + @RoleColumnName + '] NOT IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer'')';
    
    DECLARE @invalid_count INT;
    CREATE TABLE #temp_count (invalid_count INT);
    INSERT INTO #temp_count EXEC sp_executesql @sql;
    SELECT @invalid_count = invalid_count FROM #temp_count;
    DROP TABLE #temp_count;
    
    IF @invalid_count = 0
    BEGIN
        PRINT '✅ SUCCESS: All role values are valid';
    END
    ELSE
    BEGIN
        PRINT '⚠️  WARNING: ' + CAST(@invalid_count AS VARCHAR(10)) + ' users have invalid roles';
    END
END
ELSE
BEGIN
    PRINT '❌ FAILED: New role constraint was not created';
END

-- Show final constraint state
PRINT '';
PRINT 'Final constraint state:';
SELECT 
    cc.CONSTRAINT_NAME,
    cc.CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu 
    ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
WHERE ccu.TABLE_NAME = @TableName
    AND ccu.COLUMN_NAME = @RoleColumnName;

-- Show role distribution
PRINT '';
PRINT 'Current role distribution:';
SET @sql = 'SELECT [' + @RoleColumnName + '] as role, COUNT(*) as user_count 
            FROM [' + @TableName + '] 
            GROUP BY [' + @RoleColumnName + '] 
            ORDER BY user_count DESC';
EXEC sp_executesql @sql;

PRINT '';
PRINT 'Role constraint fix completed!';
PRINT 'Run quick_validation.sql to verify the fix worked.';
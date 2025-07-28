-- Simple Role Constraint Fix
-- This version avoids complex queries that might cause ambiguity errors

USE gendb;
GO

PRINT '=== SIMPLE ROLE CONSTRAINT FIX ===';
PRINT 'Step-by-step approach to avoid SQL ambiguity issues';
PRINT '';

-- Step 1: Identify table and column
DECLARE @TableName NVARCHAR(50);
DECLARE @RoleColumnName NVARCHAR(50);

PRINT '1. Identifying table structure...';

-- Check table name
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users')
BEGIN
    SET @TableName = 'Users';
    PRINT 'Found table: Users';
END
ELSE IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users')
BEGIN
    SET @TableName = 'users';
    PRINT 'Found table: users';
END
ELSE
BEGIN
    PRINT 'ERROR: No users table found!';
    RETURN;
END

-- Check column name
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @TableName AND COLUMN_NAME = 'roles')
BEGIN
    SET @RoleColumnName = 'roles';
    PRINT 'Found column: roles';
END
ELSE IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @TableName AND COLUMN_NAME = 'role')
BEGIN
    SET @RoleColumnName = 'role';
    PRINT 'Found column: role';
END
ELSE
BEGIN
    PRINT 'ERROR: No role column found!';
    RETURN;
END

PRINT 'Using: ' + @TableName + '.' + @RoleColumnName;
PRINT '';

-- Step 2: Show current constraints (simple approach)
PRINT '2. Finding current constraints...';

-- Create a simple temp table for results
CREATE TABLE #current_constraints (
    constraint_name NVARCHAR(255),
    check_clause NVARCHAR(MAX)
);

-- Get constraints using separate queries to avoid ambiguity
INSERT INTO #current_constraints
SELECT CONSTRAINT_NAME, CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
WHERE CONSTRAINT_NAME IN (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE
    WHERE TABLE_NAME = @TableName AND COLUMN_NAME = @RoleColumnName
);

-- Also get constraints that look like role constraints
INSERT INTO #current_constraints
SELECT CONSTRAINT_NAME, CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
WHERE (CHECK_CLAUSE LIKE '%admin%' OR CHECK_CLAUSE LIKE '%user%' OR CHECK_CLAUSE LIKE '%viewer%')
  AND CONSTRAINT_NAME NOT IN (SELECT constraint_name FROM #current_constraints);

-- Show what we found
IF EXISTS (SELECT 1 FROM #current_constraints)
BEGIN
    PRINT 'Found constraints:';
    SELECT constraint_name, check_clause FROM #current_constraints;
END
ELSE
BEGIN
    PRINT 'No constraints found.';
END

-- Step 3: Drop constraints one by one
PRINT '';
PRINT '3. Removing old constraints...';

DECLARE @constraint_name NVARCHAR(255);
DECLARE @sql NVARCHAR(MAX);

DECLARE constraint_cursor CURSOR FOR 
SELECT constraint_name FROM #current_constraints;

OPEN constraint_cursor;
FETCH NEXT FROM constraint_cursor INTO @constraint_name;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = 'ALTER TABLE [' + @TableName + '] DROP CONSTRAINT [' + @constraint_name + ']';
    
    PRINT 'Dropping: ' + @constraint_name;
    
    BEGIN TRY
        EXEC sp_executesql @sql;
        PRINT '  SUCCESS';
    END TRY
    BEGIN CATCH
        PRINT '  FAILED: ' + ERROR_MESSAGE();
    END CATCH
    
    FETCH NEXT FROM constraint_cursor INTO @constraint_name;
END

CLOSE constraint_cursor;
DEALLOCATE constraint_cursor;

-- Clean up temp table
DROP TABLE #current_constraints;

-- Step 4: Handle role vs roles column conversion
PRINT '';
PRINT '4. Standardizing column name...';

IF @RoleColumnName = 'role'
BEGIN
    PRINT 'Converting "role" to "roles" column...';
    
    -- Check if roles column already exists
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @TableName AND COLUMN_NAME = 'roles')
    BEGIN
        -- Add roles column
        SET @sql = 'ALTER TABLE [' + @TableName + '] ADD roles NVARCHAR(50)';
        EXEC sp_executesql @sql;
        PRINT 'Added roles column';
        
        -- Copy data
        SET @sql = 'UPDATE [' + @TableName + '] SET roles = [role]';
        EXEC sp_executesql @sql;
        PRINT 'Copied data from role to roles';
        
        -- Drop old column
        SET @sql = 'ALTER TABLE [' + @TableName + '] DROP COLUMN [role]';
        EXEC sp_executesql @sql;
        PRINT 'Dropped old role column';
        
        SET @RoleColumnName = 'roles';
    END
    ELSE
    BEGIN
        PRINT 'Roles column already exists, just copying data';
        SET @sql = 'UPDATE [' + @TableName + '] SET roles = [role] WHERE roles IS NULL';
        EXEC sp_executesql @sql;
        SET @RoleColumnName = 'roles';
    END
END
ELSE
BEGIN
    PRINT 'Column name already correct: ' + @RoleColumnName;
END

-- Step 5: Fix any invalid role values first
PRINT '';
PRINT '5. Fixing invalid role values...';

SET @sql = 'UPDATE [' + @TableName + '] 
SET [' + @RoleColumnName + '] = ''user'' 
WHERE [' + @RoleColumnName + '] NOT IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer'') 
   OR [' + @RoleColumnName + '] IS NULL';

EXEC sp_executesql @sql;
PRINT 'Fixed invalid role values';

-- Step 6: Add the new constraint
PRINT '';
PRINT '6. Adding new role constraint...';

SET @sql = 'ALTER TABLE [' + @TableName + '] ADD CONSTRAINT CK_' + @TableName + '_Roles_Fixed 
CHECK ([' + @RoleColumnName + '] IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer''))';

BEGIN TRY
    EXEC sp_executesql @sql;
    PRINT 'SUCCESS: Added new constraint CK_' + @TableName + '_Roles_Fixed';
END TRY
BEGIN CATCH
    PRINT 'FAILED to add constraint: ' + ERROR_MESSAGE();
    
    -- Show problematic data
    PRINT 'Checking for problematic data...';
    SET @sql = 'SELECT [' + @RoleColumnName + '] as problematic_role, COUNT(*) as count
                FROM [' + @TableName + '] 
                WHERE [' + @RoleColumnName + '] NOT IN (''admin'', ''user'', ''viewer'', ''dashboard_viewer'')
                   OR [' + @RoleColumnName + '] IS NULL
                GROUP BY [' + @RoleColumnName + ']';
    EXEC sp_executesql @sql;
END CATCH

-- Step 7: Add default constraint if needed
PRINT '';
PRINT '7. Adding default value constraint...';

BEGIN TRY
    SET @sql = 'ALTER TABLE [' + @TableName + '] ADD CONSTRAINT DF_' + @TableName + '_Roles_Default DEFAULT ''user'' FOR [' + @RoleColumnName + ']';
    EXEC sp_executesql @sql;
    PRINT 'Added default constraint';
END TRY
BEGIN CATCH
    PRINT 'Default constraint not added (may already exist): ' + ERROR_MESSAGE();
END CATCH

-- Step 8: Final verification
PRINT '';
PRINT '8. Final verification...';

-- Check if our new constraint exists
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS WHERE CONSTRAINT_NAME = 'CK_' + @TableName + '_Roles_Fixed')
BEGIN
    PRINT '✅ SUCCESS: New constraint exists';
    
    -- Test with a sample insert (and immediate rollback)
    BEGIN TRANSACTION;
    BEGIN TRY
        SET @sql = 'INSERT INTO [' + @TableName + '] (user_name, email, ' + @RoleColumnName + ', password) VALUES (''TEST'', ''test@test.com'', ''dashboard_viewer'', ''test'')';
        EXEC sp_executesql @sql;
        PRINT '✅ SUCCESS: dashboard_viewer role accepted';
        ROLLBACK TRANSACTION; -- Don't keep the test record
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        PRINT '❌ FAILED: dashboard_viewer role rejected: ' + ERROR_MESSAGE();
    END CATCH
END
ELSE
BEGIN
    PRINT '❌ FAILED: New constraint was not created';
END

-- Show final constraint state
PRINT '';
PRINT 'Final constraints:';
SELECT CONSTRAINT_NAME, CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
WHERE CONSTRAINT_NAME IN (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE
    WHERE TABLE_NAME = @TableName AND COLUMN_NAME = @RoleColumnName
);

-- Show role distribution
PRINT '';
PRINT 'Current role distribution:';
SET @sql = 'SELECT [' + @RoleColumnName + '] as role, COUNT(*) as user_count 
            FROM [' + @TableName + '] 
            GROUP BY [' + @RoleColumnName + '] 
            ORDER BY user_count DESC';
EXEC sp_executesql @sql;

PRINT '';
PRINT 'Simple constraint fix completed!';
PRINT 'Run quick_validation.sql to verify the fix worked.';
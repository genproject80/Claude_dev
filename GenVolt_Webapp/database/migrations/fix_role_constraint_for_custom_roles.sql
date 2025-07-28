-- Fix Role Constraint to Allow Custom Roles
-- This script updates the CHECK constraint to allow custom roles for AJ and TK
-- Run this against your gendb database

USE gendb;
GO

PRINT 'Updating role constraints to allow custom roles...';

-- Drop the existing constraint
ALTER TABLE users DROP CONSTRAINT CK_Users_Roles_Complete;
PRINT 'Old constraint dropped';

-- Create new constraint with custom roles
ALTER TABLE users ADD CONSTRAINT CK_Users_Roles_Complete 
CHECK (roles IN (
    'admin', 
    'user', 
    'viewer', 
    'dashboard_viewer',
    'aj_motor_access',
    'tk_iot_access'
));
PRINT 'New constraint created with custom roles';

-- Verify the update
SELECT CONSTRAINT_NAME, CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
WHERE CONSTRAINT_NAME = 'CK_Users_Roles_Complete';

PRINT 'Constraint update completed!';
PRINT 'You can now assign custom roles to users in the admin panel.';
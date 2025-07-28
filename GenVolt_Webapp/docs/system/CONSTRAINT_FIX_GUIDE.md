# Role Constraint Fix Guide

## Problem
The quick validation shows: **"Role Constraints: FAIL - role constraints not updated"**

This means the database CHECK constraint on the users table doesn't allow the `dashboard_viewer` role.

## Root Cause
The original `database_setup.sql` created a constraint like:
```sql
CHECK (role IN ('admin', 'user', 'viewer'))  -- Missing 'dashboard_viewer'
```

## Solutions (Try in Order)

### Option 1: Automated Fix (Recommended)
```bash
sqlcmd -S your_server -d gendb -i "D:\Claude-code\fix_role_constraints.sql"
```

This script:
- ✅ Handles table name case issues (Users vs users)
- ✅ Finds and removes old constraints automatically  
- ✅ Standardizes to `roles` column name
- ✅ Adds comprehensive constraint with all 4 roles
- ✅ Provides detailed feedback

### Option 2: Manual Fix (If Option 1 Fails)

1. **First, identify your table structure:**
```bash
sqlcmd -S your_server -d gendb -i "D:\Claude-code\manual_constraint_fix.sql"
```

2. **Look at the output and note:**
   - Table name: `Users` or `users`?
   - Column name: `role` or `roles`?
   - Existing constraint name(s)

3. **Run the appropriate fix commands:**

**For Users.role:**
```sql
-- Replace [constraint_name] with actual name from step 1
ALTER TABLE Users DROP CONSTRAINT [constraint_name];
ALTER TABLE Users ADD CONSTRAINT CK_Users_Role_Complete 
CHECK (role IN ('admin', 'user', 'viewer', 'dashboard_viewer'));
```

**For Users.roles:**
```sql
ALTER TABLE Users DROP CONSTRAINT [constraint_name];
ALTER TABLE Users ADD CONSTRAINT CK_Users_Roles_Complete 
CHECK (roles IN ('admin', 'user', 'viewer', 'dashboard_viewer'));
```

### Option 3: Emergency Fix (If Constraints Are Stuck)

If you can't find or drop the constraint:

```sql
-- Create new table with correct structure
CREATE TABLE Users_New (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_name NVARCHAR(255) NOT NULL,
    email NVARCHAR(255) UNIQUE NOT NULL,
    roles NVARCHAR(50) CHECK (roles IN ('admin', 'user', 'viewer', 'dashboard_viewer')) NOT NULL DEFAULT 'user',
    password NVARCHAR(255) NOT NULL,
    client_id NVARCHAR(50),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

-- Copy data
INSERT INTO Users_New (id, user_name, email, roles, password, client_id, created_at)
SELECT id, user_name, email, 
    CASE 
        WHEN roles IS NOT NULL THEN roles 
        WHEN role IS NOT NULL THEN role 
        ELSE 'user' 
    END,
    password, client_id, created_at
FROM Users;

-- Backup old table and rename new one
EXEC sp_rename 'Users', 'Users_Backup';
EXEC sp_rename 'Users_New', 'Users';
```

## Verification

After any fix, run:
```bash
sqlcmd -S your_server -d gendb -i "D:\Claude-code\quick_validation.sql"
```

You should see:
- ✅ `Role Constraints: PASS - dashboard_viewer role allowed`
- ✅ List of current constraints showing the new one

## Test the Fix

Try inserting a user with `dashboard_viewer` role:
```sql
-- This should work now
INSERT INTO Users (user_name, email, roles, password) 
VALUES ('Test User', 'test@example.com', 'dashboard_viewer', 'test_hash');

-- Clean up
DELETE FROM Users WHERE email = 'test@example.com';
```

## Common Issues

### "Constraint name not found"
- The constraint might be auto-generated with a random name
- Look for constraints with `CHECK_CLAUSE` containing role values
- Use the manual fix script to see all constraints

### "Cannot drop constraint"
- There might be multiple constraints on the column
- Drop them one by one using exact names
- Use Option 3 (table recreation) if stuck

### "Users table not found" 
- Check if it's named `users` (lowercase)
- Check if it's in the correct database
- Verify you're connected to the right server

### "Still shows FAIL after fix"
- Clear SQL cache: `DBCC FREEPROCCACHE`
- Wait a few seconds and try again
- Check if multiple databases exist

## Next Steps

Once the constraint fix is working:

1. ✅ **Run full database test:**
   ```bash
   sqlcmd -S your_server -d gendb -i "D:\Claude-code\test_permission_system.sql"
   ```

2. ✅ **Start backend and test APIs:**
   ```bash
   cd D:\Claude-code\backend && npm start
   node D:\Claude-code\test_api_permissions.js
   ```

3. ✅ **Test frontend permission system** using the manual guide

The role constraint is the foundation - everything else depends on it working correctly!
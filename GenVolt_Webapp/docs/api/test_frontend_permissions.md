# Frontend Permission Testing Guide

## Manual Testing Steps

### 1. Role-Based Route Protection

**Test Different User Roles:**

1. **Admin User Test:**
   ```
   Login with admin credentials
   ✅ Should see: Dashboard, Reports, Admin Panel
   ✅ Should access: All dashboard tabs (IoT + Motor)
   ✅ Should access: User management, Role management
   ```

2. **Dashboard Viewer Test:**
   ```
   Login with dashboard_viewer credentials  
   ✅ Should see: Dashboard, Reports
   ❌ Should NOT see: Admin Panel
   ✅ Should access: Both IoT and Motor dashboard tabs
   ```

3. **Regular User Test:**
   ```
   Login with user credentials
   ✅ Should see: Dashboard, Reports  
   ❌ Should NOT see: Admin Panel
   ✅ Should access: Limited dashboard tabs based on permissions
   ```

4. **Viewer Test:**
   ```
   Login with viewer credentials
   ✅ Should see: Dashboard, Reports
   ❌ Should NOT see: Admin Panel  
   ✅ Should access: Read-only dashboard view
   ```

### 2. Permission Service Testing

**Browser Console Tests:**

Open browser dev tools and test the permission service:

```javascript
// Test permission checking
import FrontendPermissionService from './src/services/permissionService';

// Test IoT dashboard access
const canAccessIoT = await FrontendPermissionService.canAccessIoTDashboard('user');
console.log('User can access IoT:', canAccessIoT);

// Test Motor dashboard access  
const canAccessMotor = await FrontendPermissionService.canAccessMotorDashboard('user');
console.log('User can access Motor:', canAccessMotor);

// Test accessible dashboards
const dashboards = await FrontendPermissionService.getAccessibleDashboards('dashboard_viewer');
console.log('Accessible dashboards:', dashboards);

// Test admin access
const adminIoT = await FrontendPermissionService.canAccessIoTDashboard('admin');
console.log('Admin can access IoT:', adminIoT); // Should be true

// Test should show both dashboards
const showBoth = await FrontendPermissionService.shouldShowBothDashboards('admin');
console.log('Should show both dashboards:', showBoth); // Should be true
```

### 3. Admin Panel Testing

**Role Management Interface:**

1. **Access Admin Panel:**
   ```
   Login as admin → Navigate to Admin tab → Role Management
   ✅ Should see: Permission matrix with roles and dashboards
   ✅ Should see: Create Role, Create Dashboard buttons
   ```

2. **Permission Matrix Test:**
   ```
   ✅ Toggle permissions for non-system roles
   ✅ Save changes and verify they persist
   ✅ System roles should show as non-editable
   ✅ Pending changes should be highlighted
   ```

3. **Role CRUD Operations:**
   ```
   ✅ Create new custom role
   ✅ Edit role display name and description  
   ✅ Cannot delete system roles
   ✅ Cannot delete roles with active users
   ```

### 4. Data Isolation Testing

**Client-Based Data Filtering:**

1. **Admin User (All Data):**
   ```
   Login as admin
   ✅ Should see: All devices from all clients
   ✅ Dashboard stats: Include all client data
   ```

2. **Client-Assigned User:**
   ```
   Login as user with specific client_id
   ✅ Should see: Only devices from assigned client
   ✅ Dashboard stats: Only assigned client data
   ❌ Should NOT see: Other clients' devices
   ```

3. **Unassigned User:**
   ```
   Login as user without client assignment
   ❌ Should see: "No data access" message
   ❌ Should NOT see: Any device data
   ```

### 5. Error Handling Testing

**Access Denied Scenarios:**

1. **Insufficient Permissions:**
   ```
   Try accessing /admin as non-admin user
   ✅ Should show: "Access Denied" page with role info
   ```

2. **Invalid Routes:**
   ```
   Navigate to non-existent route
   ✅ Should show: 404 Not Found page
   ```

3. **Expired Session:**
   ```
   Let session expire, try accessing protected route
   ✅ Should redirect: To login page
   ```

## Expected Behaviors

### Role Hierarchy (from lowest to highest access):
1. **viewer** (1) - Limited read-only access
2. **dashboard_viewer** (2) - Both dashboard access
3. **user** (3) - Standard user access  
4. **admin** (4) - Full system access

### Dashboard Access Matrix:
| Role | IoT Dashboard | Motor Dashboard | Admin Panel |
|------|---------------|-----------------|-------------|
| viewer | ✅ (if assigned) | ❌ | ❌ |
| dashboard_viewer | ✅ | ✅ | ❌ |
| user | ✅ (if assigned) | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ |

### Data Visibility:
- **Admin**: All client data
- **Assigned Users**: Only their client's data  
- **Unassigned Users**: No data access

## Automated Testing

Run the API test script:
```bash
cd D:\Claude-code
node test_api_permissions.js
```

Or use manual curl commands if Node.js/axios not available.

## Troubleshooting

### Common Issues:

1. **"No permissions found" error:**
   - Run `setup_initial_permissions.sql`
   - Check role_permissions table has data

2. **Users can't access any dashboards:**
   - Verify user has valid role assignment
   - Check role has dashboard permissions

3. **Admin can't access admin panel:**
   - Verify user role is exactly 'admin'
   - Check role hierarchy in ProtectedRoute

4. **Data filtering not working:**
   - Check user has client_id assignment
   - Verify dataFilter middleware is applied

5. **Permission changes not taking effect:**
   - Clear browser cache/localStorage
   - Check permission cache timeout (5 minutes)
   - Restart backend if needed

## Success Criteria

✅ **All tests pass** - No unexpected access or denials
✅ **Data isolation works** - Users only see assigned client data
✅ **Admin interface functional** - Can manage roles and permissions
✅ **Security hardened** - No fallback access mechanisms
✅ **Consistent behavior** - Frontend matches backend permissions

Report any failures with specific error messages and user roles involved.
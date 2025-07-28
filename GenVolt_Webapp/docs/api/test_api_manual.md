# Manual API Permission Testing

Use these curl commands to test the permission system without needing Node.js dependencies.

## Prerequisites
- Backend server running on `http://localhost:3003` (or adjust URL below)
- curl installed (comes with Windows 10/11, Git Bash, or WSL)

## Test Steps

### 1. Test Authentication

**Login as Admin:**
```bash
curl -X POST http://localhost:3003/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"admin123"}'
```

Expected: `{"message":"Login successful","token":"...","user":{...}}`

**Save the token from the response for next steps**

### 2. Test Admin Access

Replace `YOUR_ADMIN_TOKEN` with the actual token from step 1:

```bash
# Test admin users endpoint
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3003/api/v1/admin/users

# Test role management
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3003/api/v1/admin/roles

# Test permissions endpoint
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3003/api/v1/users/permissions
```

Expected: All should return successful responses with data

### 3. Test Regular User Access

**Login as Regular User:**
```bash
curl -X POST http://localhost:3003/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@demo.com","password":"user123"}'
```

**Test limited access (replace USER_TOKEN):**
```bash
# This should work
curl -H "Authorization: Bearer USER_TOKEN" \
  http://localhost:3003/api/v1/dashboard/overview

# This should fail with 403
curl -H "Authorization: Bearer USER_TOKEN" \
  http://localhost:3003/api/v1/admin/users
```

Expected: Dashboard access works, admin access returns 403

### 4. Test Dashboard Viewer

**Login as Dashboard Viewer:**
```bash
curl -X POST http://localhost:3003/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@demo.com","password":"viewer123"}'
```

**Test dashboard access:**
```bash
# Should work for both dashboards
curl -H "Authorization: Bearer VIEWER_TOKEN" \
  http://localhost:3003/api/v1/dashboard/overview

curl -H "Authorization: Bearer VIEWER_TOKEN" \
  http://localhost:3003/api/v1/devices

# Should fail for admin
curl -H "Authorization: Bearer VIEWER_TOKEN" \
  http://localhost:3003/api/v1/admin/users
```

### 5. Test Data Isolation

**Test device filtering (with user token):**
```bash
# Should only show devices from user's assigned client
curl -H "Authorization: Bearer USER_TOKEN" \
  http://localhost:3003/api/v1/devices

# Compare with admin token (should show all devices)
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3003/api/v1/devices
```

### 6. Test Permission API

**Check user permissions:**
```bash
# Admin permissions (should show all dashboards)
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3003/api/v1/users/permissions

# User permissions (should show limited dashboards)
curl -H "Authorization: Bearer USER_TOKEN" \
  http://localhost:3003/api/v1/users/permissions

# Viewer permissions
curl -H "Authorization: Bearer VIEWER_TOKEN" \
  http://localhost:3003/api/v1/users/permissions
```

## Quick Test Script

Save this as `quick_test.sh` or `quick_test.bat`:

```bash
#!/bin/bash
# Quick API permission test

BASE_URL="http://localhost:3003"

echo "=== Testing Admin Login ==="
ADMIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"admin123"}')

echo $ADMIN_RESPONSE

# Extract token (requires jq - install with: apt install jq or brew install jq)
if command -v jq &> /dev/null; then
    ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.token')
    echo "Admin token: ${ADMIN_TOKEN:0:20}..."
    
    echo -e "\n=== Testing Admin Access ==="
    curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
      $BASE_URL/api/v1/admin/users | jq '.success'
    
    echo -e "\n=== Testing Permissions ==="
    curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
      $BASE_URL/api/v1/users/permissions | jq '.data.permissions'
else
    echo "Install jq for automated token extraction, or copy token manually"
fi
```

## Expected Results

✅ **Admin users:**
- Can login successfully
- Can access `/api/admin/*` endpoints
- Can see all dashboard permissions
- Can see data from all clients

✅ **Regular users:**
- Can login successfully
- Cannot access `/api/admin/*` (403 Forbidden)
- Can see limited dashboard permissions
- Can only see data from assigned client

✅ **Viewers:**
- Can login successfully
- Cannot access `/api/admin/*` (403 Forbidden)
- Can see read-only dashboard permissions
- Data visibility based on role permissions

## Troubleshooting

**"Connection refused":**
- Start the backend server: `cd D:\Claude-code\backend && npm start`

**"Invalid credentials":**
- Check if demo users exist in database
- Run `create_demo_users.sql` if needed

**"403 Forbidden" for expected access:**
- Check role permissions in database
- Run `test_permission_system.sql` to verify setup

**"Empty responses":**
- Check database connection in backend
- Verify permission tables have data

This manual testing approach doesn't require any additional Node.js modules!
# GenVolt Database Local Setup Guide

This directory contains all the scripts needed to build the complete GenVolt database locally for development and testing.

## 📋 Prerequisites

### Required Software
- **SQL Server** (2019 or later) or **SQL Server Express**
- **SQL Server Management Studio (SSMS)** or **Azure Data Studio**
- **Node.js** (18+ for the application)

### Required Permissions
- Database creation permissions on your SQL Server instance
- Ability to create tables, views, functions, and indexes

## 🚀 Quick Start

### Option 1: Run Individual Scripts (Recommended)

Execute the scripts in this exact order:

```sql
-- 1. Create database and core tables
:r 01_create_database_and_core_tables.sql

-- 2. Setup role and permission system  
:r 02_setup_role_system.sql

-- 3. Insert demo data and users
:r 03_insert_demo_data.sql

-- 4. Create views and functions
:r 04_create_views_and_functions.sql
```

### Option 2: Verification Script

Run the master verification script to check your setup:

```sql
:r build_database_complete.sql
```

This script will verify what's installed and guide you through any missing steps.

## 📝 Script Details

### 01_create_database_and_core_tables.sql
**Purpose**: Creates the foundation database and core tables

**What it creates**:
- `gendb` database
- `users` table with role constraints
- `Clients` table for multi-tenant support
- `device` table with client relationships
- `IoT_Data_New` and `IoT_Data_Sick` data tables
- `user_sessions`, `device_alerts`, `dashboard_views` tables
- All foreign key relationships and performance indexes

**Dependencies**: None (run first)

### 02_setup_role_system.sql
**Purpose**: Sets up the role-based permission system

**What it creates**:
- `dashboards` table with IoT and Motor dashboard definitions
- `role_permissions` table with role-dashboard mappings
- Permission mappings for all roles including custom roles
- Helper functions for permission checking
- Role statistics view

**Dependencies**: Must run after script 01

**Key Features**:
- Custom roles: `tk_iot_access`, `aj_motor_access`
- Permission levels: access, edit, delete
- Built-in roles: admin, user, viewer, dashboard_viewer

### 03_insert_demo_data.sql
**Purpose**: Creates demo users, clients, and sample data

**What it creates**:
- Demo clients (Demo Corporation, GenVolt Industries, Test Industries)
- Demo users with proper password hashes
- TK and AJ users with custom roles and client assignments
- Sample devices with proper client distribution
- Sample IoT and motor data for testing
- Sample device alerts

**Dependencies**: Must run after script 02

**Test Users Created**:
- `admin@demo.com` (admin role) - Full access
- `user@demo.com` (user role) - IoT dashboard only
- `viewer@demo.com` (dashboard_viewer role) - Both dashboards view-only
- `tk@zxc.com` (tk_iot_access role) - IoT dashboard + client isolation
- `aj@zxc.com` (aj_motor_access role) - Motor dashboard + client isolation

**All demo passwords**: `demo123`

### 04_create_views_and_functions.sql
**Purpose**: Creates dashboard views and utility functions

**What it creates**:
- `v_DeviceSummary` - Complete device overview with health status
- `v_FaultAnalysis` - IoT device fault analysis and trends  
- `v_MotorAnalysis` - Motor device performance analysis
- `v_DashboardData` - Combined view for dashboard queries
- `v_ClientDashboardStats` - Client-level statistics
- Utility functions for device counts, online status, timestamps

**Dependencies**: Must run after script 03

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in your backend directory with:

```env
# Database Configuration
DB_SERVER=localhost
DB_DATABASE=gendb
DB_USERNAME=your_username
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Server Configuration
PORT=3003
NODE_ENV=development
```

### SQL Server Connection Strings

For different SQL Server setups:

**Local SQL Server**:
```
Server=localhost;Database=gendb;Trusted_Connection=true;
```

**SQL Server Express**:
```
Server=localhost\\SQLEXPRESS;Database=gendb;Trusted_Connection=true;
```

**SQL Server with Authentication**:
```
Server=localhost;Database=gendb;User Id=your_user;Password=your_password;
```

## 🧪 Testing the Setup

### 1. Verify Database Structure

```sql
USE gendb;

-- Check tables
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';

-- Check views  
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS;

-- Check demo users
SELECT user_name, email, roles, client_id FROM users;

-- Check role permissions
SELECT rp.role_name, d.display_name, rp.can_access 
FROM role_permissions rp 
JOIN dashboards d ON rp.dashboard_id = d.id;
```

### 2. Test Application Connection

Start the backend server and verify connection:

```bash
cd backend
npm install
npm run dev
```

You should see:
```
✅ Database connected successfully
🚀 IoT Dashboard API Server running on port 3003
```

### 3. Test User Authentication

Try logging in with demo credentials:
- Email: `tk@zxc.com`
- Password: `demo123`

TK should only see the IoT Device Dashboard with Demo Corporation devices.

### 4. Test Data Isolation

- **TK user** should see devices: P123, R146, Q123 (Demo Corporation)
- **AJ user** should see devices: 185071-185075 (GenVolt Industries)

## 🔧 Troubleshooting

### Common Issues

**Database Connection Failed**
```
❌ Database connection failed: Login failed for user
```
*Solution*: Check username/password in environment variables

**Permission Denied**
```
❌ CREATE DATABASE permission denied
```
*Solution*: Run SQL Server Management Studio as Administrator or use sa account

**Table Already Exists**
```
❌ There is already an object named 'users' in the database
```
*Solution*: Scripts are designed to handle existing objects gracefully

**Custom Roles Not Working**
```
❌ CHECK constraint 'CK_Users_Roles_Complete' 
```
*Solution*: Ensure script 01 ran completely to create updated role constraints

### Verification Queries

**Check role constraints**:
```sql
SELECT CONSTRAINT_NAME, CHECK_CLAUSE 
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
WHERE TABLE_NAME = 'users';
```

**Check user-client assignments**:
```sql
SELECT u.user_name, u.roles, u.client_id, c.client_name
FROM users u
LEFT JOIN Clients c ON u.client_id = c.client_id
WHERE u.email IN ('tk@zxc.com', 'aj@zxc.com');
```

**Check device distribution**:
```sql
SELECT client_id, COUNT(*) as device_count, 
       STRING_AGG(Device_ID, ', ') as devices
FROM device 
GROUP BY client_id;
```

### Reset Database

To completely reset and rebuild:

```sql
USE master;
DROP DATABASE gendb;
-- Then run all scripts again from script 01
```

## 📚 Database Schema Overview

### Core Entities
- **Users**: Authentication and role assignment
- **Clients**: Multi-tenant client management
- **Devices**: IoT and Motor device definitions
- **Data Tables**: IoT_Data_New (IoT) and IoT_Data_Sick (Motor)

### Permission System
- **Dashboards**: Available dashboard definitions
- **Role_Permissions**: Role-to-dashboard access mapping
- **Custom Roles**: tk_iot_access, aj_motor_access

### Data Views
- **Device Summary**: Real-time device status and health
- **Fault Analysis**: IoT device fault trends and analysis
- **Motor Analysis**: Motor performance metrics and statistics

## 🎯 Data Isolation Testing

The setup creates a complete data isolation test scenario:

1. **TK User** (`tk_iot_access` role)
   - Assigned to Demo Corporation (client_id: varies)
   - Can only access IoT Device Dashboard  
   - Sees only Demo Corporation's IoT devices
   - Cannot see motor devices or other clients' data

2. **AJ User** (`aj_motor_access` role)
   - Assigned to GenVolt Industries (client_id: varies)
   - Can only access Motor Device Dashboard
   - Sees only GenVolt Industries' motor devices  
   - Cannot see IoT devices or other clients' data

This setup validates both role-based access control and client-based data isolation.

## 🔗 Next Steps

1. **Complete Database Setup**: Run all 4 scripts in order
2. **Configure Backend**: Update `.env` file with database credentials
3. **Start Services**: Launch backend (`npm run dev`) and frontend
4. **Test Authentication**: Login with demo users to verify access control
5. **Verify Data Isolation**: Confirm TK and AJ see only their assigned data

For additional help, refer to the main project README or create an issue in the repository.
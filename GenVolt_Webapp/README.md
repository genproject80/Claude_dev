# GenVolt Web Application

A comprehensive IoT dashboard and device management system for GenVolt industrial equipment monitoring.

## Project Structure

```
GenVolt_Webapp/
├── frontend/                    # React/TypeScript frontend application
│   ├── src/                     # Source code
│   ├── public/                  # Static assets
│   ├── package.json             # Frontend dependencies
│   └── vite.config.ts           # Vite configuration
├── backend/                     # Node.js/Express API server
│   ├── src/                     # Source code
│   │   ├── routes/              # API route handlers
│   │   ├── middleware/          # Authentication & data filtering
│   │   ├── services/            # Business logic services
│   │   └── config/              # Database configuration
│   ├── package.json             # Backend dependencies
│   └── server.js                # Application entry point
├── database/                    # Database-related files
│   ├── setup/                   # Initial schema and setup scripts
│   ├── migrations/              # Schema changes and updates
│   ├── demo-data/               # Demo data and test fixtures
│   └── utilities/               # Database helper scripts
├── iot-processors/              # Python IoT data processing
│   ├── src/                     # Python source files
│   ├── logs/                    # Processing logs
│   ├── requirements.txt         # Python dependencies
│   └── config/                  # IoT processor configurations
├── docs/                        # Documentation
│   ├── setup/                   # Setup and installation guides
│   ├── api/                     # API documentation
│   └── system/                  # System architecture docs
├── scripts/                     # Utility scripts and tools
├── config/                      # Shared configuration files
└── README.md                    # This file
```

## Features

### Dashboard & Monitoring
- **Unified Dashboard**: Real-time monitoring of IoT devices and motor systems
- **Role-Based Access**: Custom roles for different user types (IoT access, Motor access)
- **Data Visualization**: Interactive charts and device status monitoring
- **Fault Management**: Real-time fault detection and alerting

### Device Management
- **Device Configuration**: Admin interface for device settings
- **Client Assignment**: Multi-tenant device assignment and access control
- **Real-time Status**: Live device health and connectivity monitoring
- **Historical Data**: Access to device performance history

### User & Permission Management
- **Custom Roles**: Flexible role system (admin, user, viewer, custom roles)
- **Client Isolation**: Users only see data from their assigned clients
- **Session Management**: Secure JWT-based authentication
- **Admin Panel**: Comprehensive user and role management

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **React Router** for navigation
- **Recharts** for data visualization

### Backend
- **Node.js** with Express.js
- **JWT** authentication
- **SQL Server** database
- **Role-based** access control
- **Session management**

### IoT Processing
- **Python** data processors
- **Real-time** data ingestion
- **Configurable** processing logic
- **Comprehensive** logging

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- SQL Server database
- Git

### Installation

1. **Clone and navigate to project**
   ```bash
   cd GenVolt_Webapp
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   ```

3. **Setup Frontend**
   ```bash
   cd frontend
   npm install
   ```

4. **Setup IoT Processors**
   ```bash
   cd iot-processors
   pip install -r requirements.txt
   ```

5. **Database Setup**
   - Run scripts in `database/setup/` to create initial schema
   - Run scripts in `database/demo-data/` for demo data
   - Update database connection settings in `backend/src/config/database.js`

### Development

1. **Start Backend**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Start IoT Processor**
   ```bash
   cd iot-processors/src
   python iot_data_processor.py
   ```

### Default Access
- **Admin**: Full system access
- **Demo Users**: Pre-configured with different access levels
- **Custom Roles**: TK (IoT access), AJ (Motor access)

## Project History

This project was developed to provide a comprehensive IoT monitoring solution with:
- Multi-tenant device management
- Role-based dashboard access
- Real-time data processing
- Secure authentication system

## Support

For technical support or questions, refer to the documentation in the `docs/` directory or contact the development team.
# Azure Deployment Guide for GenVolt IoT Dashboard

## Prerequisites
- Azure subscription with appropriate permissions
- Azure CLI installed and configured
- Git repository (GitHub recommended for Static Web Apps)

## Step 1: Deploy Frontend (Azure Static Web Apps)

### Using Azure Portal
1. Navigate to Azure Portal → Create Resource → Static Web Apps
2. Configure:
   - **Subscription**: Your subscription
   - **Resource Group**: Create new or use existing
   - **Name**: `genvolt-frontend`
   - **Plan Type**: Standard (for custom domains and advanced features)
   - **Region**: Choose closest to your users
   - **Source**: GitHub (connect your repository)
   - **Build Presets**: React
   - **App Location**: `/frontend`
   - **Build Location**: `/frontend/dist`

### Using Azure CLI
```bash
az staticwebapp create \
  --name genvolt-frontend \
  --resource-group your-resource-group \
  --source https://github.com/your-username/your-repo \
  --location "West US 2" \
  --branch main \
  --app-location "/frontend" \
  --output-location "dist"
```

## Step 2: Deploy Backend (Azure App Service)

### Using Azure Portal
1. Navigate to Azure Portal → Create Resource → App Service
2. Configure:
   - **Subscription**: Your subscription
   - **Resource Group**: Same as frontend
   - **Name**: `genvolt-backend`
   - **Runtime Stack**: Node 18 LTS
   - **Operating System**: Linux
   - **Region**: Same as frontend
   - **Plan**: Basic B1 (minimum for production)

### Using Azure CLI
```bash
# Create App Service Plan
az appservice plan create \
  --name genvolt-plan \
  --resource-group your-resource-group \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --resource-group your-resource-group \
  --plan genvolt-plan \
  --name genvolt-backend \
  --runtime "NODE|18-lts"
```

### Deploy Backend Code
```bash
# Navigate to backend directory
cd backend

# Create deployment package
zip -r ../backend-deploy.zip . -x "node_modules/*" ".env*"

# Deploy using Azure CLI
az webapp deployment source config-zip \
  --resource-group your-resource-group \
  --name genvolt-backend \
  --src ../backend-deploy.zip
```

## Step 3: Configure Environment Variables

### Backend App Service Configuration
```bash
# Set application settings
az webapp config appsettings set \
  --resource-group your-resource-group \
  --name genvolt-backend \
  --settings \
    DB_SERVER="your-azure-sql-server.database.windows.net" \
    DB_NAME="your-database-name" \
    DB_USER="your-username" \
    NODE_ENV="production" \
    PORT="8080" \
    FRONTEND_URL="https://your-static-web-app.azurestaticapps.net"
```

### Key Vault Integration
```bash
# Reference Key Vault secrets in app settings
az webapp config appsettings set \
  --resource-group your-resource-group \
  --name genvolt-backend \
  --settings \
    DB_PASSWORD="@Microsoft.KeyVault(SecretUri=https://your-keyvault.vault.azure.net/secrets/db-password/)" \
    JWT_SECRET="@Microsoft.KeyVault(SecretUri=https://your-keyvault.vault.azure.net/secrets/jwt-secret/)"

# Enable managed identity for Key Vault access
az webapp identity assign \
  --resource-group your-resource-group \
  --name genvolt-backend
```

## Step 4: Set Up Azure CDN

### Create CDN Profile
```bash
az cdn profile create \
  --resource-group your-resource-group \
  --name genvolt-cdn-profile \
  --sku Standard_Microsoft
```

### Create CDN Endpoints
```bash
# Frontend CDN endpoint
az cdn endpoint create \
  --resource-group your-resource-group \
  --name genvolt-frontend-cdn \
  --profile-name genvolt-cdn-profile \
  --origin your-static-web-app.azurestaticapps.net \
  --origin-host-header your-static-web-app.azurestaticapps.net

# Backend CDN endpoint (optional, for API caching)
az cdn endpoint create \
  --resource-group your-resource-group \
  --name genvolt-api-cdn \
  --profile-name genvolt-cdn-profile \
  --origin genvolt-backend.azurewebsites.net \
  --origin-host-header genvolt-backend.azurewebsites.net
```

## Step 5: Configure CORS and Security

### Backend CORS Configuration
Update your backend to include the Static Web App URL in CORS origins:
```javascript
// In your Express app
app.use(cors({
  origin: [
    'https://your-static-web-app.azurestaticapps.net',
    'https://your-custom-domain.com' // if using custom domain
  ],
  credentials: true
}));
```

### Static Web App API Integration
Update `frontend/staticwebapp.config.json` with your backend URL:
```json
{
  "routes": [
    {
      "route": "/api/*",
      "rewrite": "https://genvolt-backend.azurewebsites.net/api/v1/*"
    }
  ]
}
```

## Step 6: Database Migration

Ensure your Azure SQL Database has the latest schema:
```bash
# Connect to Azure SQL Database and run migration scripts
sqlcmd -S your-server.database.windows.net -d your-database -U your-username -P your-password -i database/migrations/00_run_all_migrations.sql
```

## Step 7: IoT Function Integration

Since you already have Azure Functions for IoT processing, update the backend configuration:
```bash
az webapp config appsettings set \
  --resource-group your-resource-group \
  --name genvolt-backend \
  --settings \
    IOT_FUNCTION_URL="https://your-function-app.azurewebsites.net/api/iot-processor"
```

## Step 8: Monitoring and Logging

### Application Insights Integration
```bash
# Set Application Insights for backend
az webapp config appsettings set \
  --resource-group your-resource-group \
  --name genvolt-backend \
  --settings \
    APPINSIGHTS_INSTRUMENTATIONKEY="your-instrumentation-key"

# Enable Application Insights for Static Web App
# This is configured through the Azure Portal
```

## Step 9: Custom Domain (Optional)

### For Static Web App
1. In Azure Portal, navigate to your Static Web App
2. Go to Custom domains → Add
3. Follow the DNS verification process

### For App Service
```bash
az webapp config hostname add \
  --webapp-name genvolt-backend \
  --resource-group your-resource-group \
  --hostname api.yourdomain.com
```

## Step 10: SSL Certificate

Azure provides free SSL certificates for both Static Web Apps and App Service custom domains.

## Post-Deployment Checklist

- [ ] Frontend accessible via Static Web App URL
- [ ] Backend API responding via App Service URL
- [ ] Database connections working
- [ ] Authentication flow functional
- [ ] IoT data processing active
- [ ] Application Insights receiving telemetry
- [ ] CDN endpoints serving content
- [ ] CORS configured correctly
- [ ] Environment variables set properly
- [ ] SSL certificates active

## Troubleshooting

### Common Issues
1. **CORS Errors**: Ensure frontend URL is in backend CORS configuration
2. **Database Connection**: Verify connection string and firewall rules
3. **Static Web App Routing**: Check `staticwebapp.config.json` routing rules
4. **Environment Variables**: Ensure all required variables are set in App Service

### Useful Commands
```bash
# View App Service logs
az webapp log tail --resource-group your-resource-group --name genvolt-backend

# Check deployment status
az webapp deployment source show --resource-group your-resource-group --name genvolt-backend

# Test endpoints
curl https://genvolt-backend.azurewebsites.net/api/v1/health
```

## Cost Optimization

- Use Basic tier App Service for development
- Enable auto-scaling for production
- Configure CDN caching rules
- Monitor usage with Application Insights
- Set up budget alerts
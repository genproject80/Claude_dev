// API Permission Test Script
// Run this to test the backend permission system
// Usage: node test_api_permissions.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3003'; // Adjust to your backend URL

// Test configuration
const testUsers = {
  admin: {
    email: 'admin@example.com',
    password: 'admin123',
    expectedRole: 'admin'
  },
  user: {
    email: 'user@example.com', 
    password: 'user123',
    expectedRole: 'user'
  },
  viewer: {
    email: 'viewer@example.com',
    password: 'viewer123', 
    expectedRole: 'viewer'
  }
};

// Test endpoints
const testEndpoints = [
  { path: '/api/v1/dashboard/overview', method: 'GET', minRole: 'viewer' },
  { path: '/api/v1/devices', method: 'GET', minRole: 'viewer' },
  { path: '/api/v1/admin/users', method: 'GET', minRole: 'admin' },
  { path: '/api/v1/admin/roles', method: 'GET', minRole: 'admin' },
  { path: '/api/v1/users/permissions', method: 'GET', minRole: 'viewer' }
];

// Role hierarchy for testing
const roleHierarchy = {
  'viewer': 1,
  'dashboard_viewer': 2,
  'user': 3,
  'admin': 4
};

class PermissionTester {
  constructor() {
    this.tokens = {};
    this.results = [];
  }

  async login(userType) {
    try {
      const user = testUsers[userType];
      if (!user) {
        throw new Error(`User type ${userType} not configured`);
      }

      console.log(`🔐 Logging in as ${userType}...`);
      
      const response = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
        email: user.email,
        password: user.password
      });

      if (response.data.token) {
        this.tokens[userType] = response.data.token;
        console.log(`✅ Login successful for ${userType}`);
        return response.data.token;
      } else {
        throw new Error('No token received');
      }
    } catch (error) {
      console.log(`❌ Login failed for ${userType}:`, error.response?.data?.error || error.message);
      return null;
    }
  }

  async testEndpoint(endpoint, userType, token) {
    try {
      console.log(`🧪 Testing ${endpoint.path} as ${userType}...`);
      
      const config = {
        method: endpoint.method,
        url: `${BASE_URL}${endpoint.path}`,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };

      const response = await axios(config);
      
      const user = testUsers[userType];
      const userRoleLevel = roleHierarchy[user.expectedRole] || 0;
      const requiredRoleLevel = roleHierarchy[endpoint.minRole] || 0;
      
      const shouldHaveAccess = userRoleLevel >= requiredRoleLevel;
      
      if (shouldHaveAccess) {
        console.log(`✅ ${userType} correctly has access to ${endpoint.path}`);
        return { success: true, expected: true, endpoint: endpoint.path, user: userType };
      } else {
        console.log(`⚠️  ${userType} has unexpected access to ${endpoint.path}`);
        return { success: true, expected: false, endpoint: endpoint.path, user: userType };
      }
      
    } catch (error) {
      const user = testUsers[userType];
      const userRoleLevel = roleHierarchy[user.expectedRole] || 0;
      const requiredRoleLevel = roleHierarchy[endpoint.minRole] || 0;
      
      const shouldHaveAccess = userRoleLevel >= requiredRoleLevel;
      
      if (!shouldHaveAccess && (error.response?.status === 403 || error.response?.status === 401)) {
        console.log(`✅ ${userType} correctly denied access to ${endpoint.path}`);
        return { success: false, expected: true, endpoint: endpoint.path, user: userType };
      } else {
        console.log(`❌ ${userType} unexpected error for ${endpoint.path}:`, error.response?.status, error.response?.data?.error || error.message);
        return { success: false, expected: false, endpoint: endpoint.path, user: userType, error: error.message };
      }
    }
  }

  async testPermissionAPI(userType, token) {
    try {
      console.log(`🔍 Testing permissions API for ${userType}...`);
      
      const response = await axios.get(`${BASE_URL}/api/v1/users/permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const permissions = response.data.data.permissions;
      console.log(`📋 ${userType} permissions:`, permissions.map(p => p.dashboard_display_name));
      
      return { user: userType, permissions: permissions.length, dashboards: permissions };
    } catch (error) {
      console.log(`❌ Failed to get permissions for ${userType}:`, error.response?.data?.error || error.message);
      return { user: userType, error: error.message };
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Permission System Tests...\n');

    // Step 1: Login all users
    console.log('=== STEP 1: User Authentication ===');
    for (const userType of Object.keys(testUsers)) {
      await this.login(userType);
    }
    console.log();

    // Step 2: Test permissions API
    console.log('=== STEP 2: Permission API Tests ===');
    for (const userType of Object.keys(testUsers)) {
      if (this.tokens[userType]) {
        const result = await this.testPermissionAPI(userType, this.tokens[userType]);
        this.results.push(result);
      }
    }
    console.log();

    // Step 3: Test endpoint access
    console.log('=== STEP 3: Endpoint Access Tests ===');
    for (const endpoint of testEndpoints) {
      console.log(`\n--- Testing ${endpoint.path} (requires ${endpoint.minRole}) ---`);
      
      for (const userType of Object.keys(testUsers)) {
        if (this.tokens[userType]) {
          const result = await this.testEndpoint(endpoint, userType, this.tokens[userType]);
          this.results.push(result);
        }
      }
    }

    // Step 4: Generate report
    this.generateReport();
  }

  generateReport() {
    console.log('\n=== PERMISSION SYSTEM TEST REPORT ===');
    
    const successful = this.results.filter(r => r.expected === true).length;
    const failed = this.results.filter(r => r.expected === false).length;
    const total = this.results.length;
    
    console.log(`\n📊 Test Results: ${successful}/${total} passed (${failed} failed)`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.expected === false)
        .forEach(r => {
          console.log(`  - ${r.user} -> ${r.endpoint}: ${r.error || 'Unexpected access'}`);
        });
    }
    
    console.log('\n📋 Permission Summary:');
    this.results
      .filter(r => r.permissions !== undefined)
      .forEach(r => {
        console.log(`  - ${r.user}: ${r.permissions} dashboard permissions`);
        if (r.dashboards) {
          r.dashboards.forEach(d => {
            console.log(`    * ${d.dashboard_display_name}`);
          });
        }
      });

    console.log('\n✅ Permission system test completed!');
    
    if (failed === 0) {
      console.log('🎉 All tests passed! The permission system is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Review the configuration and database setup.');
    }
  }
}

// Run the tests
async function main() {
  const tester = new PermissionTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Check if axios is available
try {
  require.resolve('axios');
  main();
} catch (e) {
  console.log('❌ axios package not found. Install it with: npm install axios');
  console.log('💡 Or test manually using curl commands:');
  console.log();
  console.log('# Login as admin:');
  console.log('curl -X POST http://localhost:3003/api/v1/auth/login -H "Content-Type: application/json" -d \'{"email":"admin@demo.com","password":"admin123"}\'');
  console.log();
  console.log('# Test admin access (replace TOKEN with actual token):');
  console.log('curl -H "Authorization: Bearer TOKEN" http://localhost:3003/api/v1/admin/users');
  console.log();
  console.log('# Test user permissions:');
  console.log('curl -H "Authorization: Bearer TOKEN" http://localhost:3003/api/v1/users/permissions');
}
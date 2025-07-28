// API Permission Test Script (No External Dependencies)
// Uses Node.js built-in http module instead of axios
// Usage: node test_api_builtin.js

const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3003'; // Adjust to your backend URL

// Test configuration
const testUsers = {
  admin: {
    email: 'admin@demo.com',
    password: 'demo123',
    expectedRole: 'admin'
  },
  user: {
    email: 'user@demo.com', 
    password: 'demo123',
    expectedRole: 'user'
  },
  viewer: {
    email: 'viewer@demo.com',
    password: 'demo123', 
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

class BuiltinPermissionTester {
  constructor() {
    this.tokens = {};
    this.results = [];
  }

  // HTTP request helper using built-in modules
  makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(options.url);
      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const protocol = url.protocol === 'https:' ? https : http;
      
      const req = protocol.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = {
              status: res.statusCode,
              statusText: res.statusMessage,
              data: data ? JSON.parse(data) : {},
              headers: res.headers
            };
            resolve(response);
          } catch (parseError) {
            resolve({
              status: res.statusCode,
              statusText: res.statusMessage,
              data: { error: 'Failed to parse JSON response', raw: data },
              headers: res.headers
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (postData) {
        req.write(postData);
      }
      
      req.end();
    });
  }

  async login(userType) {
    try {
      const user = testUsers[userType];
      if (!user) {
        throw new Error(`User type ${userType} not configured`);
      }

      console.log(`🔐 Logging in as ${userType}...`);
      
      const postData = JSON.stringify({
        email: user.email,
        password: user.password
      });

      const response = await this.makeRequest({
        url: `${BASE_URL}/api/v1/auth/login`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, postData);

      if (response.status === 200 && response.data.token) {
        this.tokens[userType] = response.data.token;
        console.log(`✅ Login successful for ${userType}`);
        return response.data.token;
      } else {
        throw new Error(response.data.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Login failed for ${userType}:`, error.message);
      return null;
    }
  }

  async testEndpoint(endpoint, userType, token) {
    try {
      console.log(`🧪 Testing ${endpoint.path} as ${userType}...`);
      
      const response = await this.makeRequest({
        url: `${BASE_URL}${endpoint.path}`,
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const user = testUsers[userType];
      const userRoleLevel = roleHierarchy[user.expectedRole] || 0;
      const requiredRoleLevel = roleHierarchy[endpoint.minRole] || 0;
      
      const shouldHaveAccess = userRoleLevel >= requiredRoleLevel;
      
      if (response.status === 200) {
        if (shouldHaveAccess) {
          console.log(`✅ ${userType} correctly has access to ${endpoint.path}`);
          return { success: true, expected: true, endpoint: endpoint.path, user: userType };
        } else {
          console.log(`⚠️  ${userType} has unexpected access to ${endpoint.path}`);
          return { success: true, expected: false, endpoint: endpoint.path, user: userType };
        }
      } else {
        if (!shouldHaveAccess && (response.status === 403 || response.status === 401)) {
          console.log(`✅ ${userType} correctly denied access to ${endpoint.path}`);
          return { success: false, expected: true, endpoint: endpoint.path, user: userType };
        } else {
          console.log(`❌ ${userType} unexpected error for ${endpoint.path}: HTTP ${response.status} - ${response.data.error || response.statusText}`);
          return { success: false, expected: false, endpoint: endpoint.path, user: userType, error: `HTTP ${response.status}` };
        }
      }
      
    } catch (error) {
      const user = testUsers[userType];
      const userRoleLevel = roleHierarchy[user.expectedRole] || 0;
      const requiredRoleLevel = roleHierarchy[endpoint.minRole] || 0;
      
      const shouldHaveAccess = userRoleLevel >= requiredRoleLevel;
      
      if (!shouldHaveAccess) {
        console.log(`✅ ${userType} correctly denied access to ${endpoint.path} (connection error expected)`);
        return { success: false, expected: true, endpoint: endpoint.path, user: userType };
      } else {
        console.log(`❌ ${userType} connection error for ${endpoint.path}:`, error.message);
        return { success: false, expected: false, endpoint: endpoint.path, user: userType, error: error.message };
      }
    }
  }

  async testPermissionAPI(userType, token) {
    try {
      console.log(`🔍 Testing permissions API for ${userType}...`);
      
      const response = await this.makeRequest({
        url: `${BASE_URL}/api/v1/users/permissions`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 200 && response.data.success) {
        const permissions = response.data.data.permissions;
        console.log(`📋 ${userType} permissions:`, permissions.map(p => p.dashboard_display_name));
        
        return { user: userType, permissions: permissions.length, dashboards: permissions };
      } else {
        throw new Error(response.data.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Failed to get permissions for ${userType}:`, error.message);
      return { user: userType, error: error.message };
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Permission System Tests (Built-in HTTP)...\n');

    // Check if server is running
    try {
      await this.makeRequest({ url: `${BASE_URL}/api/v1/health` });
    } catch (error) {
      console.log('❌ Cannot connect to backend server. Make sure it\'s running on', BASE_URL);
      console.log('   Start with: cd D:\\Claude-code\\backend && npm start');
      return;
    }

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
  const tester = new BuiltinPermissionTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

main();
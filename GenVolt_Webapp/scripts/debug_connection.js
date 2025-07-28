// Debug Connection to Backend
// Quick script to test what endpoints are available

const http = require('http');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3003';

function makeRequest(url, method = 'GET', headers = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            data: data ? JSON.parse(data) : {},
            rawData: data,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            data: { error: 'Parse error', raw: data },
            rawData: data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', (error) => reject(error));
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function debugBackend() {
  console.log('🔍 Debugging Backend Connection...\n');
  
  const testEndpoints = [
    { name: 'Root', url: `${BASE_URL}/`, method: 'GET' },
    { name: 'API Root', url: `${BASE_URL}/api`, method: 'GET' },
    { name: 'Health Check v1', url: `${BASE_URL}/api/v1/health`, method: 'GET' },
    { name: 'Auth Login v1', url: `${BASE_URL}/api/v1/auth/login`, method: 'POST' },
    { name: 'Admin Users v1', url: `${BASE_URL}/api/v1/admin/users`, method: 'GET' },
  ];

  for (const endpoint of testEndpoints) {
    try {
      console.log(`Testing ${endpoint.name}: ${endpoint.url}`);
      
      let postData = null;
      let headers = {};
      
      if (endpoint.method === 'POST' && endpoint.url.includes('login')) {
        postData = JSON.stringify({ email: 'test', password: 'test' });
        headers = {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        };
      }
      
      const response = await makeRequest(endpoint.url, endpoint.method, headers, postData);
      
      console.log(`  Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 200) {
        console.log(`  ✅ SUCCESS`);
        if (response.data && typeof response.data === 'object') {
          console.log(`  Response:`, Object.keys(response.data));
        }
      } else if (response.status === 404) {
        console.log(`  ❌ NOT FOUND - Route doesn't exist`);
      } else if (response.status === 401) {
        console.log(`  🔒 UNAUTHORIZED - Route exists but needs auth`);
      } else if (response.status === 400) {
        console.log(`  ⚠️  BAD REQUEST - Route exists but invalid data`);
        if (response.data.error) {
          console.log(`  Error: ${response.data.error}`);
        }
      } else {
        console.log(`  ❓ OTHER: ${response.status}`);
        if (response.rawData && response.rawData.length < 200) {
          console.log(`  Response: ${response.rawData}`);
        }
      }
      
    } catch (error) {
      console.log(`  ❌ CONNECTION ERROR: ${error.message}`);
    }
    
    console.log('');
  }

  // Try a simple login test
  console.log('🔐 Testing Login with Demo Credentials...');
  
  const loginCredentials = [
    { email: 'admin@demo.com', password: 'demo123' },
    { email: 'user@demo.com', password: 'demo123' },
    { email: 'viewer@demo.com', password: 'demo123' }
  ];

  for (const creds of loginCredentials) {
    try {
      const postData = JSON.stringify(creds);
      const response = await makeRequest(
        `${BASE_URL}/api/v1/auth/login`, 
        'POST',
        {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        postData
      );
      
      console.log(`Testing ${creds.email}:`);
      console.log(`  Status: ${response.status}`);
      
      if (response.status === 200 && response.data.token) {
        console.log(`  ✅ LOGIN SUCCESS! Token: ${response.data.token.substring(0, 20)}...`);
        console.log(`  User: ${response.data.user.name} (${response.data.user.role})`);
        break;
      } else if (response.status === 401) {
        console.log(`  ❌ Invalid credentials`);
      } else {
        console.log(`  ❓ Unexpected response:`, response.data);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n🏁 Debug completed!');
  console.log('\nNext steps:');
  console.log('1. If no routes work, check if backend is really running on port 3003');
  console.log('2. If routes work but login fails, check demo users exist in database');
  console.log('3. If login works, the permission tests should work too');
}

debugBackend().catch(console.error);
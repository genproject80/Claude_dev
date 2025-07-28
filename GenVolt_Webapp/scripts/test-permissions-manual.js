// Manual test of the permissions endpoint to see exact error messages
const http = require('http');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3003';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url);
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
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
            headers: res.headers,
            rawData: data
          };
          resolve(response);
        } catch (parseError) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            data: { error: 'Failed to parse JSON response', raw: data },
            headers: res.headers,
            rawData: data
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

async function testPermissionsEndpoint() {
  try {
    console.log('🔐 Logging in as admin...');
    
    const loginData = JSON.stringify({
      email: 'admin@demo.com',
      password: 'demo123'
    });

    const loginResponse = await makeRequest({
      url: `${BASE_URL}/api/v1/auth/login`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);

    if (loginResponse.status !== 200) {
      console.error('❌ Login failed:', loginResponse.data);
      return;
    }

    const token = loginResponse.data.token;
    console.log('✅ Login successful, token:', token.substring(0, 20) + '...');

    console.log('🔍 Testing permissions endpoint...');
    
    const permissionsResponse = await makeRequest({
      url: `${BASE_URL}/api/v1/users/permissions`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('📊 Permissions endpoint response:');
    console.log(`Status: ${permissionsResponse.status} ${permissionsResponse.statusText}`);
    console.log('Raw response:', permissionsResponse.rawData);
    
    if (permissionsResponse.data) {
      console.log('Parsed data:', JSON.stringify(permissionsResponse.data, null, 2));
    }

    // Test with viewer as well
    console.log('\\n🔐 Testing with viewer account...');
    
    const viewerLoginData = JSON.stringify({
      email: 'viewer@demo.com',
      password: 'demo123'
    });

    const viewerLoginResponse = await makeRequest({
      url: `${BASE_URL}/api/v1/auth/login`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(viewerLoginData)
      }
    }, viewerLoginData);

    if (viewerLoginResponse.status === 200) {
      const viewerToken = viewerLoginResponse.data.token;
      console.log('✅ Viewer login successful');

      const viewerPermissionsResponse = await makeRequest({
        url: `${BASE_URL}/api/v1/users/permissions`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${viewerToken}`
        }
      });

      console.log('📊 Viewer permissions endpoint response:');
      console.log(`Status: ${viewerPermissionsResponse.status} ${viewerPermissionsResponse.statusText}`);
      console.log('Raw response:', viewerPermissionsResponse.rawData);
    }

  } catch (error) {
    console.error('❌ Error testing permissions:', error.message);
  }
}

testPermissionsEndpoint().catch(console.error);
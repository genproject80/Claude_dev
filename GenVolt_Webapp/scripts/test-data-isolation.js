// Test data isolation - verify users only see their assigned client data
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

async function login(email, password) {
  const loginData = JSON.stringify({ email, password });
  
  const response = await makeRequest({
    url: `${BASE_URL}/api/v1/auth/login`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, loginData);

  if (response.status === 200) {
    return response.data.token;
  } else {
    throw new Error(`Login failed: ${response.data.error}`);
  }
}

async function getDevices(token, userType) {
  const response = await makeRequest({
    url: `${BASE_URL}/api/v1/devices`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log(`\\n📱 Devices for ${userType}:`);
  console.log(`Status: ${response.status}`);
  
  if (response.status === 200 && response.data.data) {
    const devices = response.data.data;
    console.log(`Found: ${devices.length} devices`);
    
    if (devices.length > 0) {
      console.log('Device details:');
      devices.forEach(device => {
        console.log(`  - ${device.id || device.Device_ID} (Client: ${device.clientId || device.client_id || 'N/A'})`);
      });
      
      // Check if all devices belong to the same client (for non-admin users)
      const clientIds = [...new Set(devices.map(d => d.clientId || d.client_id).filter(id => id !== null))];
      if (clientIds.length === 1) {
        console.log(`✅ All devices belong to client ${clientIds[0]} (data isolation working)`);
      } else if (clientIds.length > 1) {
        console.log(`⚠️  Multiple clients found: ${clientIds.join(', ')} (admin or data isolation issue)`);
      } else {
        console.log(`⚠️  No client IDs found in device data`);
      }
    }
  } else {
    console.log(`❌ Error: ${response.data.error || 'Unknown error'}`);
  }
  
  return response;
}

async function testDataIsolation() {
  try {
    console.log('🔒 Testing Data Isolation...');
    console.log('=====================================');

    // Test admin (should see all data)
    console.log('\\n👑 Testing Admin Access:');
    const adminToken = await login('admin@demo.com', 'demo123');
    const adminDevices = await getDevices(adminToken, 'admin');

    // Test user (should see only client 1 data)
    console.log('\\n👤 Testing User Access:');
    const userToken = await login('user@demo.com', 'demo123');
    const userDevices = await getDevices(userToken, 'user');

    // Test viewer (should see only client 1 data)
    console.log('\\n👁️  Testing Viewer Access:');
    const viewerToken = await login('viewer@demo.com', 'demo123');
    const viewerDevices = await getDevices(viewerToken, 'viewer');

    // Analyze results
    console.log('\\n📊 Data Isolation Analysis:');
    console.log('=====================================');

    const adminDeviceCount = adminDevices.data.data?.length || 0;
    const userDeviceCount = userDevices.data.data?.length || 0;
    const viewerDeviceCount = viewerDevices.data.data?.length || 0;

    console.log(`Admin sees: ${adminDeviceCount} devices`);
    console.log(`User sees: ${userDeviceCount} devices`);
    console.log(`Viewer sees: ${viewerDeviceCount} devices`);

    if (adminDeviceCount > userDeviceCount && adminDeviceCount > viewerDeviceCount) {
      console.log('✅ Data isolation working: Admin sees more data than regular users');
    } else if (adminDeviceCount === userDeviceCount && adminDeviceCount === viewerDeviceCount) {
      console.log('⚠️  Possible issue: All users see the same amount of data');
    }

    if (userDeviceCount === viewerDeviceCount) {
      console.log('✅ User and viewer see same data (both assigned to client 1)');
    } else {
      console.log('⚠️  User and viewer see different amounts of data');
    }

    console.log('\\n✅ Data isolation test completed!');

  } catch (error) {
    console.error('❌ Error testing data isolation:', error.message);
  }
}

testDataIsolation().catch(console.error);
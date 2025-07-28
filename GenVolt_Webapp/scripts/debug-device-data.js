// Debug device endpoint to see actual data structure
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

async function debugDeviceEndpoint() {
  try {
    console.log('🔍 Debugging Device Endpoint...');
    
    // Login as admin to see raw device data
    const adminToken = await login('admin@demo.com', 'demo123');
    console.log('✅ Admin login successful');

    const response = await makeRequest({
      url: `${BASE_URL}/api/v1/devices`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    console.log('📱 Device endpoint response:');
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('\\nRaw response:');
    console.log(response.rawData);
    
    if (response.data && response.data.data) {
      console.log('\\nParsed device data:');
      console.log(JSON.stringify(response.data.data, null, 2));
      
      console.log('\\nDevice structure analysis:');
      const devices = response.data.data;
      if (devices.length > 0) {
        const firstDevice = devices[0];
        console.log('First device keys:', Object.keys(firstDevice));
        console.log('First device:', firstDevice);
      }
    }

  } catch (error) {
    console.error('❌ Error debugging device endpoint:', error.message);
  }
}

debugDeviceEndpoint().catch(console.error);
// Create test scenario for data isolation by assigning some devices to different clients
const DatabaseHelper = require('./database-helper');

async function verifyDataIsolation() {
  const helper = new DatabaseHelper();
  
  try {
    console.log('🔗 Connecting to database...');
    const connected = await helper.connect();
    if (!connected) {
      process.exit(1);
    }

    console.log('📊 Current device distribution...');
    let request = helper.pool.request();
    let result = await request.query(`
      SELECT client_id, COUNT(*) as device_count
      FROM device 
      GROUP BY client_id
      ORDER BY client_id
    `);
    
    console.log('Current device distribution:');
    console.table(result.recordset);

    console.log('📋 Demo user assignments...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT user_name, email, roles, client_id
      FROM users 
      WHERE email LIKE '%demo.com'
      ORDER BY roles
    `);
    
    console.log('Demo user client assignments:');
    console.table(result.recordset);

    // Assign some devices to client 789 to test isolation
    console.log('🔧 Creating test scenario for data isolation...');
    console.log('Moving some devices to client 789 to test isolation...');
    
    request = helper.pool.request();
    await request.query(`
      UPDATE device 
      SET client_id = 789 
      WHERE id IN (7, 8)
    `);
    
    console.log('✅ Moved 2 devices to client 789');

    console.log('📊 New device distribution...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT client_id, COUNT(*) as device_count
      FROM device 
      GROUP BY client_id
      ORDER BY client_id
    `);
    
    console.log('Updated device distribution:');
    console.table(result.recordset);

    console.log('🔍 Device details by client...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT Device_ID, client_id
      FROM device 
      ORDER BY client_id, Device_ID
    `);
    
    console.log('Device assignments:');
    console.table(result.recordset);

    console.log('\\n✅ Data isolation test scenario created!');
    console.log('\\nExpected behavior:');
    console.log('- Admin: Should see ALL devices (both client 1 and 789)');
    console.log('- User/Viewer: Should see ONLY client 1 devices (3 devices)');
    console.log('\\nRun: node test-data-isolation.js to verify');

  } catch (error) {
    console.error('❌ Error setting up data isolation test:', error.message);
    process.exit(1);
  } finally {
    await helper.disconnect();
  }
}

verifyDataIsolation().catch(console.error);
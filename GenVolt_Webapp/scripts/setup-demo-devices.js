// Script to assign existing devices to demo client for testing
const DatabaseHelper = require('./database-helper');

async function setupDemoDevices() {
  const helper = new DatabaseHelper();
  
  try {
    console.log('🔗 Connecting to database...');
    const connected = await helper.connect();
    if (!connected) {
      process.exit(1);
    }

    console.log('📊 Checking current device distribution...');
    let request = helper.pool.request();
    let result = await request.query(`
      SELECT 
        client_id,
        COUNT(*) as device_count
      FROM device 
      GROUP BY client_id
      ORDER BY client_id
    `);
    
    console.log('Current device distribution:');
    console.table(result.recordset);

    console.log('🔍 Checking sample devices...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT TOP 10 id, Device_ID, client_id
      FROM device 
      ORDER BY id
    `);
    
    console.log('Sample devices:');
    console.table(result.recordset);

    // Find devices with NULL client_id and assign some to client 1
    console.log('🔧 Assigning devices to demo client...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT TOP 5 id, Device_ID 
      FROM device 
      WHERE client_id IS NULL OR client_id != 1
      ORDER BY id
    `);

    if (result.recordset.length > 0) {
      console.log(`Found ${result.recordset.length} devices to assign to client 1`);
      
      // Update these devices to client 1
      const deviceIds = result.recordset.map(r => r.id).join(',');
      request = helper.pool.request();
      await request.query(`
        UPDATE device 
        SET client_id = 1 
        WHERE id IN (${deviceIds})
      `);
      
      console.log(`✅ Assigned ${result.recordset.length} devices to client 1`);
    } else {
      console.log('⚠️  No available devices to assign');
    }

    console.log('📊 Final device distribution...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT 
        client_id,
        COUNT(*) as device_count
      FROM device 
      GROUP BY client_id
      ORDER BY client_id
    `);
    
    console.log('Final device distribution:');
    console.table(result.recordset);

    console.log('🔍 Devices for client 1 (demo users will see these):');
    request = helper.pool.request();
    result = await request.query(`
      SELECT id, Device_ID, client_id
      FROM device 
      WHERE client_id = 1
      ORDER BY id
    `);
    
    console.table(result.recordset);

    console.log('\\n✅ Demo device setup completed!');
    console.log('Demo users (user@demo.com and viewer@demo.com) will now see the devices assigned to client 1');

  } catch (error) {
    console.error('❌ Error setting up demo devices:', error.message);
    process.exit(1);
  } finally {
    await helper.disconnect();
  }
}

setupDemoDevices().catch(console.error);
// Check user client assignments for TK and AJ
const DatabaseHelper = require('./database-helper');

async function checkUserAssignments() {
  const helper = new DatabaseHelper();
  
  try {
    console.log('🔗 Connecting to database...');
    const connected = await helper.connect();
    if (!connected) {
      process.exit(1);
    }

    console.log('🔍 Checking user assignments...');
    let request = helper.pool.request();
    let result = await request.query(`
      SELECT 
        user_name,
        email,
        roles,
        client_id
      FROM users 
      WHERE user_name IN ('tk', 'aj')
      ORDER BY user_name
    `);
    
    console.log('User assignments:');
    console.table(result.recordset);

    console.log('🔍 Checking available clients...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT DISTINCT 
        client_id,
        COUNT(*) as device_count
      FROM device 
      WHERE client_id IS NOT NULL AND client_id != ''
      GROUP BY client_id
      ORDER BY client_id
    `);
    
    console.log('Available clients with device counts:');
    console.table(result.recordset);

    console.log('🔍 Checking IoT vs Motor device distribution...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT 
        client_id,
        device_type,
        COUNT(*) as count
      FROM device 
      WHERE client_id IS NOT NULL AND client_id != ''
      GROUP BY client_id, device_type
      ORDER BY client_id, device_type
    `);
    
    console.log('Device distribution by client and type:');
    console.table(result.recordset);

  } catch (error) {
    console.error('❌ Error checking user assignments:', error.message);
    process.exit(1);
  } finally {
    await helper.disconnect();
  }
}

checkUserAssignments().catch(console.error);
// Direct script to fix demo users using individual SQL commands
const DatabaseHelper = require('./database-helper');

async function fixDemoUsers() {
  const helper = new DatabaseHelper();
  
  try {
    console.log('🔗 Connecting to database...');
    const connected = await helper.connect();
    if (!connected) {
      process.exit(1);
    }

    console.log('📋 Checking current demo users...');
    let request = helper.pool.request();
    let result = await request.query(`
      SELECT user_name, email, roles, client_id
      FROM users 
      WHERE email LIKE '%demo.com'
      ORDER BY email
    `);
    
    console.log('Current demo users:');
    console.table(result.recordset);

    console.log('🔧 Fixing role assignments...');
    
    // Fix roles one by one
    request = helper.pool.request();
    await request.query("UPDATE users SET roles = 'admin' WHERE email = 'admin@demo.com'");
    console.log('✅ Fixed admin role');

    request = helper.pool.request();
    await request.query("UPDATE users SET roles = 'user' WHERE email = 'user@demo.com'");
    console.log('✅ Fixed user role');

    request = helper.pool.request();
    await request.query("UPDATE users SET roles = 'viewer' WHERE email = 'viewer@demo.com'");
    console.log('✅ Fixed viewer role');

    console.log('🏢 Getting client information...');
    request = helper.pool.request();
    result = await request.query('SELECT TOP 1 id FROM client WHERE id IS NOT NULL');
    
    if (result.recordset.length === 0) {
      console.log('❌ No clients found in client table');
      console.log('Creating a demo client...');
      
      request = helper.pool.request();
      await request.query("INSERT INTO client (id) VALUES (1)");
      console.log('✅ Created demo client with ID 1');
      var clientId = 1;
    } else {
      var clientId = result.recordset[0].id;
      console.log(`✅ Using existing client ID: ${clientId}`);
    }

    console.log('🔗 Assigning client IDs...');
    
    // Admin gets no client restriction
    request = helper.pool.request();
    await request.query("UPDATE users SET client_id = NULL WHERE email = 'admin@demo.com'");
    console.log('✅ Admin set to see all data');

    // User and viewer get assigned to client
    request = helper.pool.request();
    await request.query(`UPDATE users SET client_id = ${clientId} WHERE email IN ('user@demo.com', 'viewer@demo.com')`);
    console.log(`✅ User and viewer assigned to client ${clientId}`);

    console.log('📋 Verifying final state...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT user_name, email, roles, client_id,
        CASE 
          WHEN roles = 'admin' AND client_id IS NULL THEN 'Admin (All Data)'
          WHEN client_id = ${clientId} THEN 'Client ${clientId} Data Only'
          WHEN client_id IS NULL THEN 'No Data Access'
          ELSE 'Other Client Data'
        END as data_access
      FROM users 
      WHERE email LIKE '%demo.com'
      ORDER BY email
    `);
    
    console.log('Fixed demo users:');
    console.table(result.recordset);

    console.log('📊 Checking device data for client...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT COUNT(*) as device_count, client_id
      FROM device 
      WHERE client_id = ${clientId}
      GROUP BY client_id
    `);
    
    if (result.recordset.length > 0) {
      console.log(`✅ Found ${result.recordset[0].device_count} devices for client ${clientId}`);
    } else {
      console.log(`⚠️  No devices found for client ${clientId} - users may not see any data`);
    }

    console.log('\\n🎉 Demo user fix completed successfully!');
    console.log('\\n📝 Test credentials:');
    console.log('  admin@demo.com / demo123 - Admin role, sees all data');
    console.log(`  user@demo.com / demo123 - User role, sees client ${clientId} data only`);
    console.log(`  viewer@demo.com / demo123 - Viewer role, sees client ${clientId} data only`);
    console.log('\\n🧪 You can now run: node test_api_builtin.js');

  } catch (error) {
    console.error('❌ Error fixing demo users:', error.message);
    process.exit(1);
  } finally {
    await helper.disconnect();
  }
}

fixDemoUsers().catch(console.error);
// Check role permissions and dashboard setup
const DatabaseHelper = require('./database-helper');

async function checkPermissions() {
  const helper = new DatabaseHelper();
  
  try {
    console.log('🔗 Connecting to database...');
    const connected = await helper.connect();
    if (!connected) {
      process.exit(1);
    }

    console.log('📊 Checking roles table...');
    let request = helper.pool.request();
    let result = await request.query('SELECT * FROM roles ORDER BY name');
    console.log('Available roles:');
    console.table(result.recordset);

    console.log('📊 Checking dashboards table...');
    request = helper.pool.request();
    result = await request.query('SELECT * FROM dashboards ORDER BY name');
    console.log('Available dashboards:');
    console.table(result.recordset);

    console.log('📊 Checking role_permissions table...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT rp.*, d.name as dashboard_name, r.name as role_name
      FROM role_permissions rp
      LEFT JOIN dashboards d ON rp.dashboard_id = d.id  
      LEFT JOIN roles r ON rp.role_name = r.name
      ORDER BY rp.role_name, d.name
    `);
    console.log('Role permissions matrix:');
    console.table(result.recordset);

    console.log('📊 Checking for missing permissions...');
    
    // Check if basic roles exist
    const basicRoles = ['admin', 'user', 'viewer', 'dashboard_viewer'];
    for (const role of basicRoles) {
      request = helper.pool.request();
      result = await request.query(`SELECT COUNT(*) as count FROM roles WHERE name = '${role}'`);
      
      if (result.recordset[0].count === 0) {
        console.log(`⚠️  Missing role: ${role}`);
      } else {
        console.log(`✅ Role exists: ${role}`);
      }
    }

    // Check if basic dashboards exist
    console.log('\\n📊 Checking basic dashboard requirements...');
    request = helper.pool.request();
    result = await request.query('SELECT COUNT(*) as count FROM dashboards');
    
    if (result.recordset[0].count === 0) {
      console.log('⚠️  No dashboards found - this may cause permission API issues');
    } else {
      console.log(`✅ Found ${result.recordset[0].count} dashboards`);
    }

    // Check role permissions coverage
    console.log('\\n📊 Checking role permission coverage...');
    for (const role of basicRoles) {
      request = helper.pool.request();
      result = await request.query(`SELECT COUNT(*) as count FROM role_permissions WHERE role_name = '${role}'`);
      
      console.log(`${role}: ${result.recordset[0].count} dashboard permissions`);
    }

  } catch (error) {
    console.error('❌ Error checking permissions:', error.message);
    process.exit(1);
  } finally {
    await helper.disconnect();
  }
}

checkPermissions().catch(console.error);
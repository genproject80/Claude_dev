// Check what permissions TK's role actually has in the database
const DatabaseHelper = require('./database-helper');

async function checkRolePermissions() {
  const helper = new DatabaseHelper();
  
  try {
    console.log('🔗 Connecting to database...');
    const connected = await helper.connect();
    if (!connected) {
      process.exit(1);
    }

    console.log('🔍 Checking TK role permissions...');
    let request = helper.pool.request();
    let result = await request.query(`
      SELECT 
        rp.role_name,
        rp.dashboard_id,
        rp.can_access,
        d.name as dashboard_name,
        d.display_name as dashboard_display_name
      FROM role_permissions rp
      JOIN dashboards d ON rp.dashboard_id = d.id
      WHERE rp.role_name = 'tk_iot_access'
      ORDER BY d.name
    `);
    
    console.log('TK IoT Access role permissions:');
    console.table(result.recordset);

    console.log('🔍 Checking AJ role permissions...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT 
        rp.role_name,
        rp.dashboard_id,
        rp.can_access,
        d.name as dashboard_name,
        d.display_name as dashboard_display_name
      FROM role_permissions rp
      JOIN dashboards d ON rp.dashboard_id = d.id
      WHERE rp.role_name = 'aj_motor_access'
      ORDER BY d.name
    `);
    
    console.log('AJ Motor Access role permissions:');
    console.table(result.recordset);

    console.log('🔍 Checking all custom role permissions...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT 
        rp.role_name,
        rp.dashboard_id,
        rp.can_access,
        d.name as dashboard_name,
        d.display_name as dashboard_display_name
      FROM role_permissions rp
      JOIN dashboards d ON rp.dashboard_id = d.id
      WHERE rp.role_name IN ('tk_iot_access', 'aj_motor_access')
      ORDER BY rp.role_name, d.name
    `);
    
    console.log('All custom role permissions:');
    console.table(result.recordset);

    // Check if permissions exist at all
    if (result.recordset.length === 0) {
      console.log('❌ NO PERMISSIONS FOUND for custom roles!');
      console.log('This is why TK is getting "Insufficient permissions" errors.');
      console.log('We need to create the permissions for these roles.');
    } else {
      console.log('✅ Permissions exist for custom roles');
      console.log('The issue might be in the backend route protection logic.');
    }

  } catch (error) {
    console.error('❌ Error checking role permissions:', error.message);
    process.exit(1);
  } finally {
    await helper.disconnect();
  }
}

checkRolePermissions().catch(console.error);
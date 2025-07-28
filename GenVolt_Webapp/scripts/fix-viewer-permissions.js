// Fix viewer role permissions - ensure viewer has access to both dashboards
const DatabaseHelper = require('./database-helper');

async function fixViewerPermissions() {
  const helper = new DatabaseHelper();
  
  try {
    console.log('🔗 Connecting to database...');
    const connected = await helper.connect();
    if (!connected) {
      process.exit(1);
    }

    console.log('🔍 Checking current viewer permissions...');
    let request = helper.pool.request();
    let result = await request.query(`
      SELECT rp.*, d.display_name
      FROM role_permissions rp
      JOIN dashboards d ON rp.dashboard_id = d.id  
      WHERE rp.role_name = 'viewer'
      ORDER BY d.id
    `);
    
    console.log('Current viewer permissions:');
    console.table(result.recordset);

    // Check if viewer has permission for motor dashboard
    request = helper.pool.request();
    result = await request.query(`
      SELECT COUNT(*) as count 
      FROM role_permissions 
      WHERE role_name = 'viewer' AND dashboard_id = 2 AND can_access = 1
    `);

    if (result.recordset[0].count === 0) {
      console.log('⚠️  Viewer missing motor dashboard permission. Adding...');
      
      request = helper.pool.request();
      await request.query(`
        INSERT INTO role_permissions (role_name, dashboard_id, can_access, created_at, updated_at)
        VALUES ('viewer', 2, 1, GETDATE(), GETDATE())
      `);
      
      console.log('✅ Added motor dashboard permission for viewer');
    } else {
      console.log('✅ Viewer already has motor dashboard permission');
    }

    console.log('🔍 Final viewer permissions:');
    request = helper.pool.request();
    result = await request.query(`
      SELECT rp.role_name, d.display_name, rp.can_access
      FROM role_permissions rp
      JOIN dashboards d ON rp.dashboard_id = d.id  
      WHERE rp.role_name = 'viewer'
      ORDER BY d.id
    `);
    
    console.table(result.recordset);

    console.log('✅ Viewer permissions fixed!');

  } catch (error) {
    console.error('❌ Error fixing viewer permissions:', error.message);
    process.exit(1);
  } finally {
    await helper.disconnect();
  }
}

fixViewerPermissions().catch(console.error);
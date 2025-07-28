// Direct constraint fix using database helper
const DatabaseHelper = require('./database-helper');

async function fixRoleConstraint() {
  const helper = new DatabaseHelper();
  
  try {
    console.log('🔗 Connecting to database...');
    const connected = await helper.connect();
    if (!connected) {
      process.exit(1);
    }

    console.log('🔍 Checking current constraints...');
    let request = helper.pool.request();
    let result = await request.query(`
      SELECT cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
      FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
      JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
      WHERE ccu.TABLE_NAME = 'users'
      ORDER BY cc.CONSTRAINT_NAME
    `);
    
    console.log('Current constraints on users table:');
    console.table(result.recordset);

    // Drop all existing role-related constraints
    console.log('🗑️  Dropping existing role constraints...');
    
    for (const constraint of result.recordset) {
      if (constraint.CONSTRAINT_NAME.includes('role') || constraint.CHECK_CLAUSE.includes('roles')) {
        try {
          console.log(`Dropping constraint: ${constraint.CONSTRAINT_NAME}`);
          request = helper.pool.request();
          await request.query(`ALTER TABLE users DROP CONSTRAINT ${constraint.CONSTRAINT_NAME}`);
          console.log(`✅ Dropped ${constraint.CONSTRAINT_NAME}`);
        } catch (error) {
          console.log(`⚠️  Could not drop ${constraint.CONSTRAINT_NAME}: ${error.message}`);
        }
      }
    }

    console.log('➕ Creating new constraint with custom roles...');
    request = helper.pool.request();
    await request.query(`
      ALTER TABLE users ADD CONSTRAINT CK_Users_Roles_Updated 
      CHECK (roles IN (
        'admin', 
        'user', 
        'viewer', 
        'dashboard_viewer',
        'aj_motor_access',
        'tk_iot_access'
      ))
    `);
    
    console.log('✅ New constraint created successfully');

    console.log('🔍 Verifying new constraint...');
    request = helper.pool.request();
    result = await request.query(`
      SELECT cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
      FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
      JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
      WHERE ccu.TABLE_NAME = 'users'
      ORDER BY cc.CONSTRAINT_NAME
    `);
    
    console.log('Updated constraints:');
    console.table(result.recordset);

    console.log('\\n🎉 Role constraint fix completed!');
    console.log('You can now assign custom roles to users in the admin panel.');

  } catch (error) {
    console.error('❌ Error fixing role constraint:', error.message);
    process.exit(1);
  } finally {
    await helper.disconnect();
  }
}

fixRoleConstraint().catch(console.error);
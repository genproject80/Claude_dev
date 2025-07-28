import database from './src/config/database.js';
import SessionManager from './src/middleware/sessionManager.js';

async function testSessions() {
  try {
    console.log('Testing session functionality...\n');

    // Test 1: Check if User_Sessions table exists
    console.log('1. Checking if User_Sessions table exists...');
    try {
      const result = await database.query(`
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'User_Sessions'
      `);
      
      if (result[0].count > 0) {
        console.log('✅ User_Sessions table exists');
      } else {
        console.log('❌ User_Sessions table does NOT exist');
        console.log('Please run the create_user_sessions_table.sql script first');
        return;
      }
    } catch (error) {
      console.log('❌ Error checking table existence:', error.message);
      return;
    }

    // Test 2: Check table structure
    console.log('\n2. Checking table structure...');
    try {
      const columns = await database.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'User_Sessions'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log('Table columns:');
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE})`);
      });
    } catch (error) {
      console.log('❌ Error checking table structure:', error.message);
    }

    // Test 3: Check existing sessions
    console.log('\n3. Checking existing sessions...');
    try {
      const sessions = await database.query('SELECT COUNT(*) as count FROM User_Sessions');
      console.log(`📊 Current sessions in database: ${sessions[0].count}`);
      
      if (sessions[0].count > 0) {
        const recentSessions = await database.query(`
          SELECT TOP 5 
            s.id, s.user_id, s.login_time, s.is_active, u.user_name
          FROM User_Sessions s
          LEFT JOIN users u ON s.user_id = u.id
          ORDER BY s.login_time DESC
        `);
        
        console.log('Recent sessions:');
        recentSessions.forEach(session => {
          console.log(`  - ID: ${session.id}, User: ${session.user_name || 'Unknown'}, Login: ${session.login_time}, Active: ${session.is_active}`);
        });
      }
    } catch (error) {
      console.log('❌ Error checking existing sessions:', error.message);
    }

    // Test 4: Test SessionManager methods
    console.log('\n4. Testing SessionManager methods...');
    try {
      const stats = await SessionManager.getSessionStats();
      console.log('📈 Session statistics:', stats);
      
      const allSessions = await SessionManager.getActiveSessions();
      console.log(`📋 Active sessions count: ${allSessions.length}`);
    } catch (error) {
      console.log('❌ Error testing SessionManager:', error.message);
    }

    // Test 5: Check users table for reference
    console.log('\n5. Checking users table...');
    try {
      const users = await database.query('SELECT id, user_name, email FROM users');
      console.log(`👥 Total users in database: ${users.length}`);
      users.forEach(user => {
        console.log(`  - ID: ${user.id}, Name: ${user.user_name}, Email: ${user.email}`);
      });
    } catch (error) {
      console.log('❌ Error checking users table:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSessions();
import bcrypt from 'bcryptjs';
import database from './src/config/database.js';

async function testAuth() {
  try {
    // Test database connection
    const users = await database.query(
      'SELECT id, user_name, email, password, roles FROM users WHERE email = @email',
      { email: 'admin@demo.com' }
    );

    console.log('Query result:', users);

    if (!users || users.length === 0) {
      console.log('No user found');
      return;
    }

    const user = users[0];
    console.log('User data:', user);

    // Test password comparison
    const password = 'demo123';
    const isValid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isValid);

  } catch (error) {
    console.error('Test error:', error);
  }
}

testAuth();
import express from 'express';
import { query, param, body, validationResult } from 'express-validator';
import database from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import bcrypt from 'bcrypt';

const router = express.Router();

// Apply authentication and admin requirement to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await database.query(`
      SELECT 
        id,
        user_name as name,
        email,
        roles as role
      FROM users 
      ORDER BY id DESC
    `);

    res.json({
      success: true,
      data: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: 'active', // You can add status field to database later
        createdAt: new Date().toISOString(), // Default to current date
        updatedAt: new Date().toISOString()
      }))
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new user
router.post('/users', [
  body('name').notEmpty().trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'user', 'viewer'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await database.query(
      'SELECT id FROM users WHERE email = @email',
      { email }
    );

    if (existingUser && existingUser.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await database.query(`
      INSERT INTO users (user_name, email, password, roles)
      OUTPUT INSERTED.id, INSERTED.user_name as name, INSERTED.email, INSERTED.roles as role
      VALUES (@name, @email, @password, @role)
    `, {
      name,
      email,
      password: hashedPassword,
      role
    });

    if (result && result.length > 0) {
      const newUser = result[0];
      res.status(201).json({
        success: true,
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          status: 'active',
          createdAt: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/users/:userId', [
  param('userId').isInt().toInt(),
  body('name').optional().notEmpty().trim().escape(),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'user', 'viewer'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const updateFields = {};
    const params = { userId };

    if (req.body.name) {
      updateFields.user_name = '@name';
      params.name = req.body.name;
    }
    if (req.body.email) {
      updateFields.email = '@email';
      params.email = req.body.email;
    }
    if (req.body.role) {
      updateFields.roles = '@role';
      params.role = req.body.role;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = Object.entries(updateFields)
      .map(([field, placeholder]) => `${field} = ${placeholder}`)
      .join(', ');

    const result = await database.query(`
      UPDATE users 
      SET ${setClause}
      OUTPUT INSERTED.id, INSERTED.user_name as name, INSERTED.email, INSERTED.roles as role
      WHERE id = @userId
    `, params);

    if (result && result.length > 0) {
      const updatedUser = result[0];
      res.json({
        success: true,
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          status: 'active',
          updatedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:userId', [
  param('userId').isInt().toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;

    // Don't allow deleting the current user
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await database.query(
      'DELETE FROM users WHERE id = @userId',
      { userId }
    );

    if (result.rowsAffected && result.rowsAffected[0] > 0) {
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get system statistics
router.get('/stats', async (req, res) => {
  try {
    // Get user statistics
    const userStats = await database.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN roles = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN roles = 'user' THEN 1 END) as regular_users,
        COUNT(CASE WHEN roles = 'viewer' THEN 1 END) as viewer_users
      FROM users
    `);

    // Get device statistics
    const deviceStats = await database.query(`
      SELECT COUNT(DISTINCT Device_ID) as total_devices FROM device
    `);

    // Get IoT data statistics
    const dataStats = await database.query(`
      SELECT 
        COUNT(*) as total_iot_records,
        MAX(CreatedAt) as latest_data
      FROM IoT_Data_New
    `);

    // Get motor data statistics
    const motorStats = await database.query(`
      SELECT 
        COUNT(*) as total_motor_records,
        MAX(CreatedAt) as latest_motor_data
      FROM IoT_Data_Sick
    `);

    // Get recent activity (last 24 hours)
    const recentActivity = await database.query(`
      SELECT 
        COUNT(*) as recent_iot_readings,
        COUNT(CASE WHEN FaultCodes IS NOT NULL AND FaultCodes != '' THEN 1 END) as recent_faults
      FROM IoT_Data_New 
      WHERE CreatedAt >= DATEADD(hour, -24, GETDATE())
    `);

    const recentMotorActivity = await database.query(`
      SELECT 
        COUNT(*) as recent_motor_readings,
        COUNT(CASE WHEN Fault_Code > 0 THEN 1 END) as recent_motor_faults
      FROM IoT_Data_Sick 
      WHERE CreatedAt >= DATEADD(hour, -24, GETDATE())
    `);

    res.json({
      success: true,
      data: {
        users: userStats[0] || {},
        devices: deviceStats[0] || {},
        iotData: dataStats[0] || {},
        motorData: motorStats[0] || {},
        recentActivity: {
          ...recentActivity[0],
          ...recentMotorActivity[0]
        }
      }
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch system statistics' });
  }
});

// Get devices for management
router.get('/devices', async (req, res) => {
  try {
    const devices = await database.query(`
      SELECT 
        d.Device_ID,
        d.Channel_ID,
        d.client_id,
        d.APIKey,
        d.ConversionLogicID,
        latest.Entry_ID,
        latest.CreatedAt as last_data_time,
        CASE 
          WHEN latest.CreatedAt >= DATEADD(hour, -1, GETDATE()) THEN 'online'
          WHEN latest.CreatedAt >= DATEADD(hour, -24, GETDATE()) THEN 'inactive'
          ELSE 'offline'
        END as status
      FROM device d
      LEFT JOIN (
        SELECT 
          Device_ID,
          Entry_ID,
          CreatedAt,
          ROW_NUMBER() OVER (PARTITION BY Device_ID ORDER BY Entry_ID DESC) as rn
        FROM IoT_Data_New
      ) latest ON d.Device_ID = latest.Device_ID AND latest.rn = 1
      ORDER BY d.Device_ID
    `);

    res.json({
      success: true,
      data: devices.map(device => ({
        deviceId: device.Device_ID,
        channelId: device.Channel_ID,
        clientId: device.client_id,
        apiKey: device.APIKey,
        conversionLogicId: device.ConversionLogicID,
        lastDataTime: device.last_data_time,
        status: device.status
      }))
    });

  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

export default router;
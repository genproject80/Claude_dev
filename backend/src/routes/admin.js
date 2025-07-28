import express from 'express';
import { query, param, body, validationResult } from 'express-validator';
import database from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import SessionManager from '../middleware/sessionManager.js';

const router = express.Router();

// Apply authentication to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// Debug endpoint
router.get('/debug', async (req, res) => {
  try {
    console.log('Debug endpoint called, user:', req.user);
    res.json({
      success: true,
      user: req.user,
      message: 'Debug endpoint working'
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: 'Debug failed' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    console.log('Fetching users from database...');
    const users = await database.query(`
      SELECT 
        u.id,
        u.user_name,
        u.email,
        u.roles,
        u.client_id
      FROM users u
      ORDER BY u.id DESC
    `);

    console.log('Raw users from database:', users);

    res.json({
      success: true,
      data: users.map(user => ({
        id: user.id,
        name: user.user_name,
        email: user.email,
        role: user.roles,
        clientId: user.client_id,
        status: 'active', // You can add status field to database later
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      details: error.message 
    });
  }
});

// Get user by ID
router.get('/users/:userId', [
  param('userId').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;

    const users = await database.query(`
      SELECT 
        u.id,
        u.user_name,
        u.email,
        u.roles,
        u.client_id
      FROM users u
      WHERE u.id = @userId
    `, { userId: parseInt(userId) });

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.user_name,
        email: user.email,
        role: user.roles,
        clientId: user.client_id,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user
router.post('/users', [
  body('name').notEmpty().trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'user', 'viewer', 'dashboard_viewer']),
  body('clientId').optional().custom((value) => {
    if (value === null || value === undefined || typeof value === 'string') {
      return true;
    }
    throw new Error('clientId must be a string or null');
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, clientId } = req.body;

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
      INSERT INTO users (user_name, email, password, roles, client_id)
      OUTPUT INSERTED.id, INSERTED.user_name as name, INSERTED.email, INSERTED.roles as role, INSERTED.client_id as clientId
      VALUES (@name, @email, @password, @role, @clientId)
    `, {
      name,
      email,
      password: hashedPassword,
      role,
      clientId: (clientId && clientId !== "none") ? clientId : null
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
          clientId: newUser.clientId,
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
  param('userId').isNumeric(),
  body('name').optional().notEmpty().trim().escape(),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isString().trim(),
  body('clientId').optional().custom((value) => {
    if (value === null || value === undefined || typeof value === 'string') {
      return true;
    }
    throw new Error('clientId must be a string or null');
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors for user update:', errors.array());
      console.error('Request body:', req.body);
      console.error('User ID:', req.params.userId);
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const updateFields = {};
    const params = { userId: parseInt(userId) };

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
    if (req.body.clientId !== undefined) {
      updateFields.client_id = '@clientId';
      params.clientId = req.body.clientId || null;
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
      OUTPUT INSERTED.id, INSERTED.user_name as name, INSERTED.email, INSERTED.roles as role, INSERTED.client_id as clientId
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
          clientId: updatedUser.clientId,
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
  param('userId').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    console.log('Attempting to delete user with ID:', userId, 'parsed as:', parseInt(userId));

    // Don't allow deleting the current user
    if (parseInt(userId) === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    console.log('Executing DELETE query with userId:', parseInt(userId));
    const result = await database.query(
      'DELETE FROM users WHERE id = @userId',
      { userId: parseInt(userId) }
    );
    console.log('Delete query result:', result);

    // For DELETE operations, some database drivers return undefined on success
    // If result is undefined, assume the delete was successful
    if (result === undefined) {
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } else {
      const rowsAffected = result?.rowsAffected?.[0] || result?.rowsAffected || 0;
      if (rowsAffected > 0) {
        res.json({
          success: true,
          message: 'User deleted successfully'
        });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
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
        d.Field_ID,
        d.client_id,
        d.APIKey,
        d.ConversionLogicID,
        latest.Entry_ID,
        latest.CreatedAt as last_data_time,
        latest.FaultCodes,
        latest.FaultDescriptions,
        CASE 
          WHEN latest.CreatedAt >= DATEADD(hour, -1, GETDATE()) THEN 'online'
          WHEN latest.CreatedAt >= DATEADD(hour, -24, GETDATE()) THEN 'inactive'
          ELSE 'offline'
        END as status,
        fault_count.fault_count_24h
      FROM device d
      LEFT JOIN (
        SELECT 
          Device_ID,
          Entry_ID,
          CreatedAt,
          FaultCodes,
          FaultDescriptions,
          ROW_NUMBER() OVER (PARTITION BY Device_ID ORDER BY Entry_ID DESC) as rn
        FROM IoT_Data_New
      ) latest ON d.Device_ID = latest.Device_ID AND latest.rn = 1
      LEFT JOIN (
        SELECT 
          Device_ID,
          COUNT(CASE WHEN FaultCodes IS NOT NULL AND FaultCodes != '' THEN 1 END) as fault_count_24h
        FROM IoT_Data_New 
        WHERE CreatedAt >= DATEADD(hour, -24, GETDATE())
        GROUP BY Device_ID
      ) fault_count ON d.Device_ID = fault_count.Device_ID
      ORDER BY d.Device_ID
    `);

    res.json({
      success: true,
      data: devices.map(device => ({
        id: device.Device_ID,
        deviceId: device.Device_ID,
        channelId: device.Channel_ID,
        fieldId: device.Field_ID,
        clientId: device.client_id,
        apiKey: device.APIKey ? device.APIKey.substring(0, 8) + '...' : 'N/A', // Mask API key for security
        conversionLogicId: device.ConversionLogicID,
        lastDataTime: device.last_data_time,
        status: device.status,
        faultCodes: device.FaultCodes,
        faultDescriptions: device.FaultDescriptions,
        faultCount24h: device.fault_count_24h || 0,
        model: 'HV-2000X', // Default model - can be added to device table later
        firmware: 'v2.1.0', // Default firmware - can be added to device table later
        location: `Channel ${device.Channel_ID}` // Default location based on channel
      }))
    });

  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Get device by ID with detailed information
router.get('/devices/:deviceId', [
  param('deviceId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.params;

    // Get device details with latest data
    const deviceDetails = await database.query(`
      SELECT 
        d.Device_ID,
        d.Channel_ID,
        d.Field_ID,
        d.client_id,
        d.APIKey,
        d.ConversionLogicID,
        latest.Entry_ID,
        latest.CreatedAt as last_data_time,
        latest.FaultCodes,
        latest.FaultDescriptions,
        latest.HVOutputVoltage_kV,
        latest.HVOutputCurrent_mA,
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
          FaultCodes,
          FaultDescriptions,
          HVOutputVoltage_kV,
          HVOutputCurrent_mA,
          ROW_NUMBER() OVER (PARTITION BY Device_ID ORDER BY Entry_ID DESC) as rn
        FROM IoT_Data_New
      ) latest ON d.Device_ID = latest.Device_ID AND latest.rn = 1
      WHERE d.Device_ID = @deviceId
    `, { deviceId });

    if (!deviceDetails || deviceDetails.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = deviceDetails[0];

    // Get fault history (last 24 hours)
    const faultHistory = await database.query(`
      SELECT TOP 10
        Entry_ID,
        FaultCodes,
        FaultDescriptions,
        CreatedAt
      FROM IoT_Data_New 
      WHERE Device_ID = @deviceId 
        AND FaultCodes IS NOT NULL 
        AND FaultCodes != ''
        AND CreatedAt >= DATEADD(hour, -24, GETDATE())
      ORDER BY CreatedAt DESC
    `, { deviceId });

    // Get data statistics (last 24 hours)
    const dataStats = await database.query(`
      SELECT 
        COUNT(*) as total_readings,
        AVG(CAST(HVOutputVoltage_kV as FLOAT)) as avg_voltage,
        AVG(CAST(HVOutputCurrent_mA as FLOAT)) as avg_current,
        COUNT(CASE WHEN FaultCodes IS NOT NULL AND FaultCodes != '' THEN 1 END) as fault_count
      FROM IoT_Data_New 
      WHERE Device_ID = @deviceId 
        AND CreatedAt >= DATEADD(hour, -24, GETDATE())
    `, { deviceId });

    res.json({
      success: true,
      data: {
        device: {
          id: device.Device_ID,
          deviceId: device.Device_ID,
          channelId: device.Channel_ID,
          fieldId: device.Field_ID,
          clientId: device.client_id,
          apiKey: device.APIKey, // Full API key for editing
          conversionLogicId: device.ConversionLogicID,
          lastDataTime: device.last_data_time,
          status: device.status,
          currentData: {
            hvOutputVoltage: device.HVOutputVoltage_kV,
            outputCurrent: device.HVOutputCurrent_mA,
            faultCodes: device.FaultCodes,
            faultDescriptions: device.FaultDescriptions
          }
        },
        faultHistory: faultHistory,
        statistics: dataStats[0] || {}
      }
    });

  } catch (error) {
    console.error('Error fetching device details:', error);
    res.status(500).json({ error: 'Failed to fetch device details' });
  }
});

// Update device configuration
router.put('/devices/:deviceId', [
  param('deviceId').isString().notEmpty(),
  body('channelId').optional().isInt().toInt(),
  body('fieldId').optional().isInt().toInt(),
  body('clientId').optional().custom((value) => {
    if (value === null || value === undefined || typeof value === 'string') {
      return true;
    }
    throw new Error('clientId must be a string or null');
  }),
  body('apiKey').optional().isString(),
  body('conversionLogicId').optional().isInt().toInt()
], async (req, res) => {
  try {
    console.log(`=== PUT /admin/devices/${req.params.deviceId} ===`);
    console.log('Request body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.params;
    console.log('Device ID to update:', deviceId);
    const updateFields = {};
    const params = { deviceId };

    if (req.body.channelId !== undefined) {
      updateFields.Channel_ID = '@channelId';
      params.channelId = req.body.channelId;
    }
    if (req.body.fieldId !== undefined) {
      updateFields.Field_ID = '@fieldId';
      params.fieldId = req.body.fieldId;
    }
    if (req.body.clientId !== undefined) {
      updateFields.client_id = '@clientId';
      params.clientId = req.body.clientId;
    }
    if (req.body.apiKey !== undefined) {
      updateFields.APIKey = '@apiKey';
      params.apiKey = req.body.apiKey;
    }
    if (req.body.conversionLogicId !== undefined) {
      updateFields.ConversionLogicID = '@conversionLogicId';
      params.conversionLogicId = req.body.conversionLogicId;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = Object.entries(updateFields)
      .map(([field, placeholder]) => `${field} = ${placeholder}`)
      .join(', ');

    console.log('Update query:', `UPDATE device SET ${setClause} WHERE Device_ID = @deviceId`);
    console.log('Query params:', params);
    
    const result = await database.query(`
      UPDATE device 
      SET ${setClause}
      OUTPUT INSERTED.Device_ID, INSERTED.client_id, INSERTED.Channel_ID, INSERTED.Field_ID
      WHERE Device_ID = @deviceId
    `, params);

    console.log('Update result:', result);
    
    if (result && result.length > 0) {
      console.log('Device updated successfully');
      res.json({
        success: true,
        message: 'Device updated successfully',
        data: result[0]
      });
    } else {
      console.log('Device not found - no rows returned');
      res.status(404).json({ error: 'Device not found' });
    }

  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// Create new device
router.post('/devices', [
  body('deviceId').isString().notEmpty().trim(),
  body('channelId').isInt().toInt(),
  body('fieldId').optional().isInt().toInt(),
  body('clientId').isString().notEmpty().trim(),
  body('apiKey').isString().notEmpty().trim(),
  body('conversionLogicId').isInt().toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId, channelId, fieldId, clientId, apiKey, conversionLogicId } = req.body;

    // Check if device already exists
    const existingDevice = await database.query(
      'SELECT Device_ID FROM device WHERE Device_ID = @deviceId',
      { deviceId }
    );

    if (existingDevice && existingDevice.length > 0) {
      return res.status(409).json({ error: 'Device with this ID already exists' });
    }

    // Insert new device
    const result = await database.query(`
      INSERT INTO device (Device_ID, Channel_ID, Field_ID, client_id, APIKey, ConversionLogicID)
      VALUES (@deviceId, @channelId, @fieldId, @clientId, @apiKey, @conversionLogicId)
    `, {
      deviceId,
      channelId,
      fieldId: fieldId || null,
      clientId,
      apiKey,
      conversionLogicId
    });

    const rowsAffected = result?.rowsAffected?.[0] || result?.rowsAffected || 0;
    if (rowsAffected > 0) {
      res.status(201).json({
        success: true,
        message: 'Device added to monitoring successfully',
        data: {
          deviceId,
          channelId,
          fieldId,
          clientId,
          apiKey: apiKey.substring(0, 8) + '...', // Mask API key in response
          conversionLogicId
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to create device' });
    }

  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({ error: 'Failed to create device' });
  }
});

// Delete device (remove from monitoring)
router.delete('/devices/:deviceId', [
  param('deviceId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.params;

    const result = await database.query(
      'DELETE FROM device WHERE Device_ID = @deviceId',
      { deviceId }
    );

    // For DELETE operations, some database drivers return undefined on success
    if (result === undefined) {
      res.json({
        success: true,
        message: 'Device removed from monitoring successfully'
      });
    } else {
      const rowsAffected = result?.rowsAffected?.[0] || result?.rowsAffected || 0;
      if (rowsAffected > 0) {
        res.json({
          success: true,
          message: 'Device removed from monitoring successfully'
        });
      } else {
        res.status(404).json({ error: 'Device not found' });
      }
    }

  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// Get available client IDs for dropdown
router.get('/client-ids', async (req, res) => {
  try {
    const clientIds = await database.query(`
      SELECT DISTINCT client_id
      FROM device 
      WHERE client_id IS NOT NULL AND client_id != ''
      ORDER BY client_id
    `);

    res.json({
      success: true,
      data: clientIds.map(row => String(row.client_id))
    });

  } catch (error) {
    console.error('Error fetching client IDs:', error);
    res.status(500).json({ error: 'Failed to fetch client IDs' });
  }
});

// Session Management Endpoints

// Get all sessions with pagination and filtering
router.get('/sessions', [
  requireAdmin,
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('filter').optional().isIn(['active', 'recent', 'all', 'custom']),
  query('search').optional().isString().trim().escape(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('sortBy').optional().isIn(['created_at', 'user_name', 'email', 'roles', 'expires_at', 'last_activity']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const filter = req.query.filter || 'active';
    const search = req.query.search || '';
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'desc';
    const offset = (page - 1) * limit;

    // Validate custom filter requires date range
    if (filter === 'custom' && (!startDate || !endDate)) {
      return res.status(400).json({ 
        error: 'Custom filter requires both startDate and endDate parameters' 
      });
    }

    const sessions = await SessionManager.getSessionsPaginated(page, limit, filter, search, startDate, endDate, sortBy, sortOrder);
    
    res.json({
      success: true,
      data: sessions.sessions,
      pagination: {
        page,
        limit,
        total: sessions.total,
        totalPages: Math.ceil(sessions.total / limit),
        hasNext: page < Math.ceil(sessions.total / limit),
        hasPrev: page > 1
      },
      filter,
      search,
      startDate,
      endDate,
      sortBy,
      sortOrder
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get sessions for specific user
router.get('/sessions/user/:userId', [
  requireAdmin,
  param('userId').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const sessions = await SessionManager.getUserSessions(userId);
    
    res.json({
      success: true,
      data: sessions
    });

  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({ error: 'Failed to fetch user sessions' });
  }
});

// Terminate specific session
router.delete('/sessions/:sessionId', [
  requireAdmin,
  param('sessionId').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
], async (req, res) => {
  try {
    console.log('Attempting to terminate session:', req.params.sessionId);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { sessionId } = req.params;
    console.log('Calling SessionManager.terminateSession with:', sessionId);
    const success = await SessionManager.terminateSession(sessionId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Session terminated successfully'
      });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }

  } catch (error) {
    console.error('Error terminating session:', error);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

// Get session statistics
router.get('/sessions/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await SessionManager.getSessionStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session stats' });
  }
});

// Role Management Endpoints

// Get all dashboards
router.get('/dashboards', requireAdmin, async (req, res) => {
  try {
    const dashboards = await database.query(`
      SELECT 
        id,
        name,
        display_name,
        description,
        route_path,
        is_active,
        created_at,
        updated_at
      FROM dashboards
      WHERE is_active = 1
      ORDER BY display_name
    `);

    res.json({
      success: true,
      data: dashboards
    });

  } catch (error) {
    console.error('Error fetching dashboards:', error);
    res.status(500).json({ error: 'Failed to fetch dashboards' });
  }
});

// Get all roles with their permissions
router.get('/roles', requireAdmin, async (req, res) => {
  try {
    // Get all roles from the dedicated roles table
    const roles = await database.query(`
      SELECT 
        r.id,
        r.name as role_name,
        r.display_name,
        r.description,
        r.is_active,
        r.is_system_role,
        r.created_at,
        r.updated_at,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT rp.id) as permission_count
      FROM roles r
      LEFT JOIN users u ON r.name = u.roles
      LEFT JOIN role_permissions rp ON r.name = rp.role_name
      WHERE r.is_active = 1
      GROUP BY r.id, r.name, r.display_name, r.description, r.is_active, r.is_system_role, r.created_at, r.updated_at
      ORDER BY r.is_system_role DESC, r.name
    `);

    // Get all dashboards
    const dashboards = await database.query(`
      SELECT id, name, display_name
      FROM dashboards
      WHERE is_active = 1
      ORDER BY display_name
    `);

    // Get all role permissions
    const permissions = await database.query(`
      SELECT 
        rp.role_name,
        rp.dashboard_id,
        rp.can_access,
        d.name as dashboard_name,
        d.display_name as dashboard_display_name
      FROM role_permissions rp
      JOIN dashboards d ON rp.dashboard_id = d.id
      WHERE d.is_active = 1
    `);

    // Structure the response
    const rolePermissions = {};
    
    // Initialize all roles with metadata and empty permissions
    roles.forEach(role => {
      rolePermissions[role.role_name] = {
        id: role.id,
        role_name: role.role_name,
        display_name: role.display_name,
        description: role.description,
        is_active: role.is_active,
        is_system_role: role.is_system_role,
        created_at: role.created_at,
        updated_at: role.updated_at,
        user_count: role.user_count,
        permission_count: role.permission_count,
        permissions: {}
      };
    });

    // Add permissions for each role
    permissions.forEach(perm => {
      if (!rolePermissions[perm.role_name]) {
        rolePermissions[perm.role_name] = {
          role_name: perm.role_name,
          permissions: {}
        };
      }
      rolePermissions[perm.role_name].permissions[perm.dashboard_name] = {
        dashboard_id: perm.dashboard_id,
        dashboard_name: perm.dashboard_name,
        dashboard_display_name: perm.dashboard_display_name,
        can_access: perm.can_access
      };
    });

    res.json({
      success: true,
      data: {
        roles: Object.values(rolePermissions),
        dashboards: dashboards
      }
    });

  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles and permissions' });
  }
});

// Update role permissions
router.put('/roles/:roleName/permissions', [
  requireAdmin,
  param('roleName').isLength({ min: 1 }).trim(),
  body('permissions').isArray(),
  body('permissions.*.dashboard_id').isInt(),
  body('permissions.*.can_access').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors for role permissions:', errors.array());
      console.error('Request body:', req.body);
      console.error('Role name:', req.params.roleName);
      return res.status(400).json({ errors: errors.array() });
    }

    const { roleName } = req.params;
    const { permissions } = req.body;

    // Delete existing permissions for this role
    await database.query(
      'DELETE FROM role_permissions WHERE role_name = @roleName',
      { roleName }
    );

    // Insert new permissions
    for (const permission of permissions) {
      await database.query(`
        INSERT INTO role_permissions (role_name, dashboard_id, can_access)
        VALUES (@roleName, @dashboardId, @canAccess)
      `, {
        roleName,
        dashboardId: permission.dashboard_id,
        canAccess: permission.can_access
      });
    }

    res.json({
      success: true,
      message: `Permissions updated successfully for role: ${roleName}`
    });

  } catch (error) {
    console.error('Error updating role permissions:', error);
    res.status(500).json({ error: 'Failed to update role permissions' });
  }
});

// Get permissions for a specific user/role
router.get('/permissions/:roleName', [
  requireAdmin,
  param('roleName').isLength({ min: 1 }).trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { roleName } = req.params;

    const permissions = await database.query(`
      SELECT 
        rp.dashboard_id,
        rp.can_access,
        d.name as dashboard_name,
        d.display_name as dashboard_display_name,
        d.description as dashboard_description
      FROM role_permissions rp
      JOIN dashboards d ON rp.dashboard_id = d.id
      WHERE rp.role_name = @roleName AND d.is_active = 1
      ORDER BY d.display_name
    `, { roleName });

    res.json({
      success: true,
      data: {
        role_name: roleName,
        permissions: permissions
      }
    });

  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({ error: 'Failed to fetch role permissions' });
  }
});

// Create new dashboard (for future use)
router.post('/dashboards', [
  requireAdmin,
  body('name').isLength({ min: 1 }).trim().escape(),
  body('display_name').isLength({ min: 1 }).trim().escape(),
  body('description').optional().trim().escape(),
  body('route_path').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, display_name, description, route_path } = req.body;

    // Check if dashboard already exists
    const existingDashboard = await database.query(
      'SELECT id FROM dashboards WHERE name = @name',
      { name }
    );

    if (existingDashboard && existingDashboard.length > 0) {
      return res.status(409).json({ error: 'Dashboard with this name already exists' });
    }

    // Insert new dashboard
    const result = await database.query(`
      INSERT INTO dashboards (name, display_name, description, route_path)
      OUTPUT INSERTED.id, INSERTED.name, INSERTED.display_name, INSERTED.description, INSERTED.route_path
      VALUES (@name, @displayName, @description, @routePath)
    `, {
      name,
      displayName: display_name,
      description: description || null,
      routePath: route_path || null
    });

    if (result && result.length > 0) {
      const newDashboard = result[0];
      res.status(201).json({
        success: true,
        message: 'Dashboard created successfully',
        data: {
          id: newDashboard.id,
          name: newDashboard.name,
          display_name: newDashboard.display_name,
          description: newDashboard.description,
          route_path: newDashboard.route_path
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to create dashboard' });
    }

  } catch (error) {
    console.error('Error creating dashboard:', error);
    res.status(500).json({ error: 'Failed to create dashboard' });
  }
});

// Enhanced Role CRUD Management Endpoints

// Create new role
router.post('/roles', [
  requireAdmin,
  body('name').isLength({ min: 1, max: 50 }).trim().escape().matches(/^[a-zA-Z0-9_]+$/),
  body('display_name').isLength({ min: 1, max: 100 }).trim().escape(),
  body('description').optional().isLength({ max: 255 }).trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, display_name, description } = req.body;

    // Check if role already exists
    const existingRole = await database.query(
      'SELECT id FROM roles WHERE name = @name',
      { name }
    );

    if (existingRole && existingRole.length > 0) {
      return res.status(409).json({ error: 'Role with this name already exists' });
    }

    // Create new role
    await database.query(`
      INSERT INTO roles (name, display_name, description, is_system_role)
      VALUES (@name, @displayName, @description, 0)
    `, {
      name,
      displayName: display_name,
      description: description || null
    });

    // Fetch the created role
    const result = await database.query(`
      SELECT id, name, display_name, description, is_active, is_system_role, created_at
      FROM roles 
      WHERE name = @name
    `, { name });

    if (result && result.length > 0) {
      const newRole = result[0];
      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: {
          id: newRole.id,
          name: newRole.name,
          display_name: newRole.display_name,
          description: newRole.description,
          is_active: newRole.is_active,
          is_system_role: newRole.is_system_role,
          created_at: newRole.created_at,
          user_count: 0,
          permission_count: 0
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to create role' });
    }

  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// Get role details with statistics
router.get('/roles/:roleName/details', [
  requireAdmin,
  param('roleName').isLength({ min: 1 }).trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { roleName } = req.params;

    // Get role details with user count and permission count
    const roleDetails = await database.query(`
      SELECT 
        r.id,
        r.name,
        r.display_name,
        r.description,
        r.is_active,
        r.is_system_role,
        r.created_at,
        r.updated_at,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT rp.id) as permission_count
      FROM roles r
      LEFT JOIN users u ON r.name = u.roles
      LEFT JOIN role_permissions rp ON r.name = rp.role_name
      WHERE r.name = @roleName
      GROUP BY r.id, r.name, r.display_name, r.description, r.is_active, r.is_system_role, r.created_at, r.updated_at
    `, { roleName });

    if (!roleDetails || roleDetails.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const role = roleDetails[0];

    // Get role permissions
    const permissions = await database.query(`
      SELECT 
        rp.dashboard_id,
        rp.can_access,
        d.name as dashboard_name,
        d.display_name as dashboard_display_name,
        d.description as dashboard_description
      FROM role_permissions rp
      JOIN dashboards d ON rp.dashboard_id = d.id
      WHERE rp.role_name = @roleName AND d.is_active = 1
      ORDER BY d.display_name
    `, { roleName });

    res.json({
      success: true,
      data: {
        role: {
          id: role.id,
          name: role.name,
          display_name: role.display_name,
          description: role.description,
          is_active: role.is_active,
          is_system_role: role.is_system_role,
          created_at: role.created_at,
          updated_at: role.updated_at,
          user_count: role.user_count,
          permission_count: role.permission_count
        },
        permissions: permissions
      }
    });

  } catch (error) {
    console.error('Error fetching role details:', error);
    res.status(500).json({ error: 'Failed to fetch role details' });
  }
});

// Update role details
router.put('/roles/:roleName', [
  requireAdmin,
  param('roleName').isLength({ min: 1 }).trim().escape(),
  body('display_name').optional().isLength({ min: 1, max: 100 }).trim().escape(),
  body('description').optional().isLength({ max: 255 }).trim().escape(),
  body('is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { roleName } = req.params;
    const { display_name, description, is_active } = req.body;

    // Check if role exists and get its details
    const existingRole = await database.query(
      'SELECT id, is_system_role FROM roles WHERE name = @roleName',
      { roleName }
    );

    if (!existingRole || existingRole.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Build update query dynamically
    const updateFields = [];
    const params = { roleName };

    if (display_name !== undefined) {
      updateFields.push('display_name = @displayName');
      params.displayName = display_name;
    }

    if (description !== undefined) {
      updateFields.push('description = @description');
      params.description = description;
    }

    if (is_active !== undefined) {
      // Prevent deactivating system roles
      if (existingRole[0].is_system_role && !is_active) {
        return res.status(400).json({ error: 'Cannot deactivate system roles' });
      }
      updateFields.push('is_active = @isActive');
      params.isActive = is_active;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = GETDATE()');

    await database.query(`
      UPDATE roles 
      SET ${updateFields.join(', ')}
      WHERE name = @roleName
    `, params);

    // Fetch the updated role
    const result = await database.query(`
      SELECT id, name, display_name, description, is_active, is_system_role, updated_at
      FROM roles 
      WHERE name = @roleName
    `, { roleName });

    if (result && result.length > 0) {
      const updatedRole = result[0];
      res.json({
        success: true,
        message: 'Role updated successfully',
        data: {
          id: updatedRole.id,
          name: updatedRole.name,
          display_name: updatedRole.display_name,
          description: updatedRole.description,
          is_active: updatedRole.is_active,
          is_system_role: updatedRole.is_system_role,
          updated_at: updatedRole.updated_at
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to update role' });
    }

  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete role with safety checks
router.delete('/roles/:roleName', [
  requireAdmin,
  param('roleName').isLength({ min: 1 }).trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { roleName } = req.params;

    // Check if role exists
    const roleDetails = await database.query(`
      SELECT 
        r.id,
        r.name,
        r.is_system_role,
        COUNT(u.id) as user_count
      FROM roles r
      LEFT JOIN users u ON r.name = u.roles
      WHERE r.name = @roleName
      GROUP BY r.id, r.name, r.is_system_role
    `, { roleName });

    if (!roleDetails || roleDetails.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const role = roleDetails[0];

    // Prevent deletion of system roles
    if (role.is_system_role) {
      return res.status(400).json({ 
        error: 'Cannot delete system roles. System roles are required for proper system operation.' 
      });
    }

    // Prevent deletion if role has active users
    if (role.user_count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete role. There are ${role.user_count} users currently assigned to this role. Please reassign these users to other roles first.`,
        user_count: role.user_count
      });
    }

    // Ensure at least one admin role remains
    if (roleName === 'admin') {
      const adminCount = await database.query(
        "SELECT COUNT(*) as count FROM roles WHERE name != @roleName AND (name = 'admin' OR name LIKE '%admin%')",
        { roleName }
      );
      
      if (!adminCount || adminCount[0].count === 0) {
        return res.status(400).json({ 
          error: 'Cannot delete the last admin role. At least one admin role must exist.' 
        });
      }
    }

    // Delete the role (CASCADE will handle role_permissions)
    const deleteResult = await database.query(
      'DELETE FROM roles WHERE name = @roleName',
      { roleName }
    );

    res.json({
      success: true,
      message: `Role '${roleName}' deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// Get role usage statistics
router.get('/roles/statistics', requireAdmin, async (req, res) => {
  try {
    const stats = await database.query(`
      SELECT 
        COUNT(*) as total_roles,
        COUNT(CASE WHEN is_system_role = 1 THEN 1 END) as system_roles,
        COUNT(CASE WHEN is_system_role = 0 THEN 1 END) as custom_roles,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_roles,
        COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_roles
      FROM roles
    `);

    const roleUsage = await database.query(`
      SELECT 
        r.name,
        r.display_name,
        r.is_system_role,
        COUNT(u.id) as user_count,
        COUNT(rp.id) as permission_count
      FROM roles r
      LEFT JOIN users u ON r.name = u.roles
      LEFT JOIN role_permissions rp ON r.name = rp.role_name
      GROUP BY r.name, r.display_name, r.is_system_role
      ORDER BY COUNT(u.id) DESC, r.name
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {},
        role_usage: roleUsage
      }
    });

  } catch (error) {
    console.error('Error fetching role statistics:', error);
    res.status(500).json({ error: 'Failed to fetch role statistics' });
  }
});

export default router;
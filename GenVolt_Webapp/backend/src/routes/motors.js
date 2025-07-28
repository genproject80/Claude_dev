import express from 'express';
import { query, param, validationResult } from 'express-validator';
import database from '../config/database.js';
import { authenticateToken, requireViewerOrAbove } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all motor routes
router.use(authenticateToken);
router.use(requireViewerOrAbove);

// Get all motor devices with latest data
router.get('/', async (req, res) => {
  try {
    const motors = await database.query(`
      SELECT DISTINCT 
        latest.Entry_ID,
        latest.Device_ID,
        latest.GSM_Signal_Strength,
        latest.Motor_ON_Time_sec,
        latest.Motor_OFF_Time_sec,
        latest.Number_of_Wheels_Configured,
        latest.Latitude,
        latest.Longitude,
        latest.Number_of_Wheels_Detected,
        latest.Fault_Code,
        latest.Motor_Current_mA,
        latest.CreatedAt,
        latest.HexField,
        latest.Timestamp
      FROM (
        SELECT 
          Entry_ID,
          Device_ID,
          GSM_Signal_Strength,
          Motor_ON_Time_sec,
          Motor_OFF_Time_sec,
          Number_of_Wheels_Configured,
          Latitude,
          Longitude,
          Number_of_Wheels_Detected,
          Fault_Code,
          Motor_Current_mA,
          CreatedAt,
          HexField,
          Timestamp,
          ROW_NUMBER() OVER (PARTITION BY Device_ID ORDER BY CreatedAt DESC) as rn
        FROM IoT_Data_Sick
      ) latest 
      WHERE latest.rn = 1
      ORDER BY latest.Device_ID
    `);

    res.json({
      success: true,
      data: motors.map(motor => ({
        entryId: motor.Entry_ID,
        deviceId: motor.Device_ID,
        gsmSignalStrength: motor.GSM_Signal_Strength,
        motorOnTimeSec: motor.Motor_ON_Time_sec,
        motorOffTimeSec: motor.Motor_OFF_Time_sec,
        wheelsConfigured: motor.Number_of_Wheels_Configured,
        latitude: motor.Latitude,
        longitude: motor.Longitude,
        wheelsDetected: motor.Number_of_Wheels_Detected,
        faultCode: motor.Fault_Code,
        motorCurrentMA: motor.Motor_Current_mA,
        createdAt: motor.CreatedAt,
        hexField: motor.HexField,
        timestamp: motor.Timestamp
      }))
    });

  } catch (error) {
    console.error('Error fetching motors:', error);
    res.status(500).json({ error: 'Failed to fetch motors' });
  }
});

// Get motor device by ID with detailed data
router.get('/:deviceId', [
  param('deviceId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.params;

    // Get latest 100 data points for this motor device
    const dataPoints = await database.query(
      `SELECT TOP 100 
         Entry_ID,
         Device_ID,
         GSM_Signal_Strength,
         Motor_ON_Time_sec,
         Motor_OFF_Time_sec,
         Number_of_Wheels_Configured,
         Latitude,
         Longitude,
         Number_of_Wheels_Detected,
         Fault_Code,
         Motor_Current_mA,
         CreatedAt,
         HexField,
         Timestamp
       FROM IoT_Data_Sick 
       WHERE Device_ID = @deviceId 
       ORDER BY CreatedAt DESC`,
      { deviceId }
    );

    if (!dataPoints || dataPoints.length === 0) {
      return res.status(404).json({ error: 'Motor device not found' });
    }

    const latestData = dataPoints[0];

    res.json({
      success: true,
      data: {
        deviceId: latestData.Device_ID,
        latestData: {
          entryId: latestData.Entry_ID,
          gsmSignalStrength: latestData.GSM_Signal_Strength,
          motorOnTimeSec: latestData.Motor_ON_Time_sec,
          motorOffTimeSec: latestData.Motor_OFF_Time_sec,
          wheelsConfigured: latestData.Number_of_Wheels_Configured,
          latitude: latestData.Latitude,
          longitude: latestData.Longitude,
          wheelsDetected: latestData.Number_of_Wheels_Detected,
          faultCode: latestData.Fault_Code,
          motorCurrentMA: latestData.Motor_Current_mA,
          createdAt: latestData.CreatedAt,
          hexField: latestData.HexField,
          timestamp: latestData.Timestamp
        },
        dataPoints: dataPoints.map(point => ({
          entryId: point.Entry_ID,
          gsmSignalStrength: point.GSM_Signal_Strength,
          motorOnTimeSec: point.Motor_ON_Time_sec,
          motorOffTimeSec: point.Motor_OFF_Time_sec,
          wheelsConfigured: point.Number_of_Wheels_Configured,
          latitude: point.Latitude,
          longitude: point.Longitude,
          wheelsDetected: point.Number_of_Wheels_Detected,
          faultCode: point.Fault_Code,
          motorCurrentMA: point.Motor_Current_mA,
          createdAt: point.CreatedAt,
          hexField: point.HexField,
          timestamp: point.Timestamp
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching motor device:', error);
    res.status(500).json({ error: 'Failed to fetch motor device' });
  }
});

// Get motor data with pagination and filtering
router.get('/:deviceId/data', [
  param('deviceId').isString().notEmpty(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.params;
    const { page = 1, limit = 50, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = 'WHERE Device_ID = @deviceId';
    const params = { deviceId };

    if (startDate) {
      whereClause += ' AND CreatedAt >= @startDate';
      params.startDate = startDate;
    }

    if (endDate) {
      whereClause += ' AND CreatedAt <= @endDate';
      params.endDate = endDate;
    }

    // Get total count
    const countResult = await database.query(
      `SELECT COUNT(*) as total FROM IoT_Data_Sick ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Get paginated data
    const dataPoints = await database.query(
      `SELECT Entry_ID, Device_ID, GSM_Signal_Strength, Motor_ON_Time_sec, Motor_OFF_Time_sec,
              Number_of_Wheels_Configured, Latitude, Longitude, Number_of_Wheels_Detected,
              Fault_Code, Motor_Current_mA, CreatedAt, HexField, Timestamp
       FROM IoT_Data_Sick 
       ${whereClause}
       ORDER BY CreatedAt DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { ...params, offset, limit }
    );

    res.json({
      success: true,
      data: dataPoints.map(point => ({
        entryId: point.Entry_ID,
        deviceId: point.Device_ID,
        gsmSignalStrength: point.GSM_Signal_Strength,
        motorOnTimeSec: point.Motor_ON_Time_sec,
        motorOffTimeSec: point.Motor_OFF_Time_sec,
        wheelsConfigured: point.Number_of_Wheels_Configured,
        latitude: point.Latitude,
        longitude: point.Longitude,
        wheelsDetected: point.Number_of_Wheels_Detected,
        faultCode: point.Fault_Code,
        motorCurrentMA: point.Motor_Current_mA,
        createdAt: point.CreatedAt,
        hexField: point.HexField,
        timestamp: point.Timestamp
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching motor data:', error);
    res.status(500).json({ error: 'Failed to fetch motor data' });
  }
});

// Get motor statistics
router.get('/:deviceId/stats', [
  param('deviceId').isString().notEmpty(),
  query('period').optional().isIn(['1h', '24h', '7d', '30d'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.params;
    const { period = '24h' } = req.query;

    // Calculate time range
    const hours = {
      '1h': 1,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30
    }[period];

    const stats = await database.query(`
      SELECT 
        COUNT(*) as total_readings,
        AVG(CAST(Motor_Current_mA as FLOAT)) as avg_motor_current,
        MIN(Motor_Current_mA) as min_motor_current,
        MAX(Motor_Current_mA) as max_motor_current,
        AVG(CAST(Motor_ON_Time_sec as FLOAT)) as avg_on_time,
        AVG(CAST(Motor_OFF_Time_sec as FLOAT)) as avg_off_time,
        AVG(CAST(Number_of_Wheels_Detected as FLOAT)) as avg_wheels_detected,
        COUNT(CASE WHEN Fault_Code > 0 THEN 1 END) as fault_count
      FROM IoT_Data_Sick 
      WHERE Device_ID = @deviceId 
        AND CreatedAt >= DATEADD(hour, -@hours, GETDATE())
    `, { deviceId, hours });

    const faultStats = await database.query(`
      SELECT 
        Fault_Code,
        COUNT(*) as count
      FROM IoT_Data_Sick 
      WHERE Device_ID = @deviceId 
        AND CreatedAt >= DATEADD(hour, -@hours, GETDATE())
        AND Fault_Code > 0
      GROUP BY Fault_Code
      ORDER BY count DESC
    `, { deviceId, hours });

    res.json({
      success: true,
      data: {
        period,
        statistics: stats[0] || {},
        faultBreakdown: faultStats || []
      }
    });

  } catch (error) {
    console.error('Error fetching motor stats:', error);
    res.status(500).json({ error: 'Failed to fetch motor statistics' });
  }
});

// Get motor dashboard overview
router.get('/dashboard/overview', async (req, res) => {
  try {
    // Get motor device counts and stats (all available data)
    const motorStats = await database.query(`
      SELECT 
        COUNT(DISTINCT Device_ID) as total_motors,
        COUNT(CASE WHEN Fault_Code > 0 THEN 1 END) as motors_with_faults,
        AVG(CAST(Motor_Current_mA as FLOAT)) as avg_motor_current,
        AVG(CAST(Number_of_Wheels_Detected as FLOAT)) as avg_wheels_detected
      FROM IoT_Data_Sick
    `);

    // Get fault summary (all available data)
    const faultSummary = await database.query(`
      SELECT 
        COUNT(CASE WHEN Fault_Code = 1 THEN 1 END) as fault_code_1,
        COUNT(CASE WHEN Fault_Code = 2 THEN 1 END) as fault_code_2,
        COUNT(CASE WHEN Fault_Code > 2 THEN 1 END) as other_faults
      FROM IoT_Data_Sick 
      WHERE Fault_Code > 0
    `);

    res.json({
      success: true,
      data: {
        motors: motorStats[0] || {},
        faults: faultSummary[0] || {}
      }
    });

  } catch (error) {
    console.error('Error fetching motor dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch motor dashboard overview' });
  }
});

export default router;
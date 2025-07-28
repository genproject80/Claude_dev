import express from 'express';
import { query, param, validationResult } from 'express-validator';
import database from '../config/database.js';
import { authenticateToken, requireViewerOrAbove } from '../middleware/auth.js';
import { addDataFilter, requireDataAccess, addClientFilterToQuery } from '../middleware/dataFilter.js';

const router = express.Router();

// Apply authentication and data filtering to all device routes
router.use(authenticateToken);
router.use(requireViewerOrAbove);
router.use(addDataFilter);
router.use(requireDataAccess);

// Get all devices with latest data
router.get('/', async (req, res) => {
  try {
    const { dataFilter } = req;

    // Build query with client filtering
    const devicesQuery = `
      SELECT DISTINCT 
        latest.Device_ID,
        latest.Entry_ID,
        latest.RuntimeMin,
        latest.FaultCodes,
        latest.FaultDescriptions,
        latest.LeadingFaultCode,
        latest.LeadingFaultTimeHr,
        latest.GensetSignal,
        latest.ThermostatStatus,
        latest.HVOutputVoltage_kV,
        latest.HVSourceNo,
        latest.HVOutputCurrent_mA,
        latest.HexField,
        latest.CreatedAt as last_data_time,
        d.client_id
      FROM (
        SELECT 
          iot.Device_ID,
          iot.Entry_ID,
          iot.RuntimeMin,
          iot.FaultCodes,
          iot.FaultDescriptions,
          iot.LeadingFaultCode,
          iot.LeadingFaultTimeHr,
          iot.GensetSignal,
          iot.ThermostatStatus,
          iot.HVOutputVoltage_kV,
          iot.HVSourceNo,
          iot.HVOutputCurrent_mA,
          iot.HexField,
          iot.CreatedAt,
          ROW_NUMBER() OVER (PARTITION BY iot.Device_ID ORDER BY iot.Entry_ID DESC) as rn
        FROM IoT_Data_New iot
        JOIN device d ON iot.Device_ID = d.Device_ID
      ) latest 
      JOIN device d ON latest.Device_ID = d.Device_ID
      WHERE latest.rn = 1
      ORDER BY latest.Device_ID
    `;

    const { query: filteredQuery, params } = addClientFilterToQuery(devicesQuery, dataFilter, 'd');
    const devices = await database.query(filteredQuery, params);

    res.json({
      success: true,
      data: devices.map(device => ({
        id: device.Device_ID,
        name: device.Device_ID,
        channelId: null,
        clientId: device.client_id,
        latestData: {
          entryId: device.Entry_ID,
          runtimeMin: device.RuntimeMin,
          faultCodes: device.FaultCodes,
          faultDescriptions: device.FaultDescriptions,
          leadingFaultCode: device.LeadingFaultCode,
          leadingFaultTimeHr: device.LeadingFaultTimeHr,
          gensetSignal: device.GensetSignal,
          thermostatStatus: device.ThermostatStatus,
          hvOutputVoltage_kV: device.HVOutputVoltage_kV,
          hvSourceNo: device.HVSourceNo,
          hvOutputCurrent_mA: device.HVOutputCurrent_mA,
          hexField: device.HexField,
          timestamp: device.last_data_time
        }
      }))
    });

  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Get device by ID with detailed data
router.get('/:deviceId', [
  param('deviceId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.params;
    const { dataFilter } = req;

    // Get device info with client filtering
    const deviceQuery = 'SELECT * FROM device d WHERE Device_ID = @deviceId';
    const { query: filteredDeviceQuery, params: deviceParams } = addClientFilterToQuery(deviceQuery, dataFilter, 'd');
    const devices = await database.query(filteredDeviceQuery, { ...deviceParams, deviceId });

    if (!devices || devices.length === 0) {
      return res.status(404).json({ error: 'Device not found or access denied' });
    }

    const device = devices[0];

    // Get latest 100 data points with full details
    const dataPoints = await database.query(
      `SELECT TOP 100 
         Entry_ID, RuntimeMin, FaultCodes, FaultDescriptions,
         LeadingFaultCode, LeadingFaultTimeHr, GensetSignal, ThermostatStatus,
         HVOutputVoltage_kV, HVSourceNo, HVOutputCurrent_mA, HexField, CreatedAt
       FROM IoT_Data_New 
       WHERE Device_ID = @deviceId 
       ORDER BY Entry_ID DESC`,
      { deviceId }
    );

    res.json({
      success: true,
      data: {
        id: device.Device_ID,
        name: device.Device_ID,
        channelId: device.Channel_ID,
        clientId: device.client_id,
        apiKey: device.APIKey,
        conversionLogicID: device.ConversionLogicID,
        dataPoints: dataPoints.map(point => ({
          entryId: point.Entry_ID,
          runtimeMin: point.RuntimeMin,
          faultCodes: point.FaultCodes,
          faultDescriptions: point.FaultDescriptions,
          leadingFaultCode: point.LeadingFaultCode,
          leadingFaultTimeHr: point.LeadingFaultTimeHr,
          gensetSignal: point.GensetSignal,
          thermostatStatus: point.ThermostatStatus,
          hvOutputVoltage_kV: point.HVOutputVoltage_kV,
          hvSourceNo: point.HVSourceNo,
          hvOutputCurrent_mA: point.HVOutputCurrent_mA,
          hexField: point.HexField,
          timestamp: point.CreatedAt
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// Get device data with pagination and filtering
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
      `SELECT COUNT(*) as total FROM IoT_Data_New ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Get paginated data
    const dataPoints = await database.query(
      `SELECT Entry_ID, RuntimeMin, FaultCodes, FaultDescriptions,
              LeadingFaultCode, LeadingFaultTimeHr, GensetSignal, ThermostatStatus,
              HVOutputVoltage_kV, HVSourceNo, HVOutputCurrent_mA, HexField, CreatedAt
       FROM IoT_Data_New 
       ${whereClause}
       ORDER BY Entry_ID DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { ...params, offset, limit }
    );

    res.json({
      success: true,
      data: dataPoints.map(point => ({
        entryId: point.Entry_ID,
        runtimeMin: point.RuntimeMin,
        faultCodes: point.FaultCodes,
        faultDescriptions: point.FaultDescriptions,
        leadingFaultCode: point.LeadingFaultCode,
        leadingFaultTimeHr: point.LeadingFaultTimeHr,
        gensetSignal: point.GensetSignal,
        thermostatStatus: point.ThermostatStatus,
        hvOutputVoltage_kV: point.HVOutputVoltage_kV,
        hvSourceNo: point.HVSourceNo,
        hvOutputCurrent_mA: point.HVOutputCurrent_mA,
        hexField: point.HexField,
        timestamp: point.CreatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching device data:', error);
    res.status(500).json({ error: 'Failed to fetch device data' });
  }
});

// Get device statistics
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
        AVG(CAST(RuntimeMin as FLOAT)) as avg_runtime,
        MIN(RuntimeMin) as min_runtime,
        MAX(RuntimeMin) as max_runtime,
        AVG(CAST(HVOutputVoltage_kV as FLOAT)) as avg_voltage,
        AVG(CAST(HVOutputCurrent_mA as FLOAT)) as avg_current,
        COUNT(CASE WHEN FaultCodes IS NOT NULL AND FaultCodes != '' THEN 1 END) as fault_count,
        COUNT(CASE WHEN GensetSignal = 'On' THEN 1 END) as genset_on_count,
        COUNT(CASE WHEN ThermostatStatus = 'On' THEN 1 END) as thermostat_on_count
      FROM IoT_Data_New 
      WHERE Device_ID = @deviceId 
        AND CreatedAt >= DATEADD(hour, -@hours, GETDATE())
    `, { deviceId, hours });

    const faultStats = await database.query(`
      SELECT 
        FaultCodes,
        FaultDescriptions,
        COUNT(*) as count
      FROM IoT_Data_New 
      WHERE Device_ID = @deviceId 
        AND CreatedAt >= DATEADD(hour, -@hours, GETDATE())
        AND FaultCodes IS NOT NULL 
        AND FaultCodes != ''
      GROUP BY FaultCodes, FaultDescriptions
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
    console.error('Error fetching device stats:', error);
    res.status(500).json({ error: 'Failed to fetch device statistics' });
  }
});

export default router;
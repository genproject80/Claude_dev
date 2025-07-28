import express from 'express';
import { query, validationResult } from 'express-validator';
import database from '../config/database.js';
import { authenticateToken, requireViewerOrAbove } from '../middleware/auth.js';
import { addDataFilter, requireDataAccess, addClientFilterToQuery } from '../middleware/dataFilter.js';

const router = express.Router();

// Apply authentication and data filtering to all dashboard routes
router.use(authenticateToken);
router.use(requireViewerOrAbove);
router.use(addDataFilter);
router.use(requireDataAccess);

// Get dashboard overview statistics
router.get('/overview', async (req, res) => {
  try {
    const { dataFilter } = req;

    // Get device counts with client filtering
    const deviceQuery = `
      SELECT 
        COUNT(DISTINCT Device_ID) as total_devices
      FROM device d
    `;
    const { query: filteredDeviceQuery, params: deviceParams } = addClientFilterToQuery(deviceQuery, dataFilter, 'd');
    const deviceStats = await database.query(filteredDeviceQuery, deviceParams);

    // Get data points count from IoT_Data_New with client filtering
    const dataQuery = `
      SELECT 
        COUNT(*) as total_readings_24h,
        COUNT(CASE WHEN iot.FaultCodes IS NOT NULL AND iot.FaultCodes != '' THEN 1 END) as fault_readings_24h
      FROM IoT_Data_New iot
      JOIN device d ON iot.Device_ID = d.Device_ID
    `;
    const { query: filteredDataQuery, params: dataParams } = addClientFilterToQuery(dataQuery, dataFilter, 'd');
    const recentDataStats = await database.query(filteredDataQuery, dataParams);

    // Get device activity stats with client filtering
    const activityQuery = `
      SELECT 
        COUNT(DISTINCT iot.Device_ID) as active_devices_24h,
        COUNT(DISTINCT CASE WHEN iot.FaultCodes IS NOT NULL AND iot.FaultCodes != '' THEN iot.Device_ID END) as devices_with_faults
      FROM IoT_Data_New iot
      JOIN device d ON iot.Device_ID = d.Device_ID
    `;
    const { query: filteredActivityQuery, params: activityParams } = addClientFilterToQuery(activityQuery, dataFilter, 'd');
    const activityStats = await database.query(filteredActivityQuery, activityParams);

    // Get basic runtime statistics with client filtering
    const runtimeQuery = `
      SELECT 
        AVG(CAST(iot.RuntimeMin as FLOAT)) as avg_runtime,
        MIN(iot.RuntimeMin) as min_runtime,
        MAX(iot.RuntimeMin) as max_runtime,
        COUNT(*) as total_readings
      FROM IoT_Data_New iot
      JOIN device d ON iot.Device_ID = d.Device_ID
      WHERE iot.RuntimeMin IS NOT NULL
    `;
    const { query: filteredRuntimeQuery, params: runtimeParams } = addClientFilterToQuery(runtimeQuery, dataFilter, 'd');
    const runtimeStats = await database.query(filteredRuntimeQuery, runtimeParams);

    res.json({
      success: true,
      data: {
        devices: {
          total_devices: deviceStats[0]?.total_devices || 0,
          online_devices: activityStats[0]?.active_devices_24h || 0,
          offline_devices: Math.max(0, (deviceStats[0]?.total_devices || 0) - (activityStats[0]?.active_devices_24h || 0)),
          maintenance_devices: 0
        },
        dataPoints: recentDataStats[0] || {},
        alerts: {
          active_alerts: 0,
          critical_alerts: activityStats[0]?.devices_with_faults || 0,
          warning_alerts: 0,
          info_alerts: 0
        },
        runtimeStats: runtimeStats[0] || {}
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

// Get device performance trends
router.get('/trends', [
  query('period').optional().isIn(['1h', '6h', '24h', '7d', '30d']),
  query('interval').optional().isIn(['5m', '15m', '1h', '6h', '1d'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = '24h', interval = '1h' } = req.query;

    // Calculate time range and grouping
    const periodHours = {
      '1h': 1,
      '6h': 6,
      '24h': 24,
      '7d': 168,
      '30d': 720
    }[period];

    const intervalMinutes = {
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '6h': 360,
      '1d': 1440
    }[interval];

    const trends = await database.query(`
      WITH TimeSlots AS (
        SELECT 
          DATEADD(minute, @intervalMinutes * (DATEDIFF(minute, DATEADD(hour, -@periodHours, GETDATE()), CreatedAt) / @intervalMinutes), DATEADD(hour, -@periodHours, GETDATE())) as time_slot,
          Device_ID,
          RuntimeMin,
          CASE WHEN FaultCodes IS NOT NULL AND FaultCodes != '' THEN 1 ELSE 0 END as has_fault
        FROM IoT_Data_New
        WHERE CreatedAt >= DATEADD(hour, -@periodHours, GETDATE())
      )
      SELECT 
        time_slot,
        COUNT(DISTINCT Device_ID) as active_devices,
        AVG(CAST(RuntimeMin as FLOAT)) as avg_runtime,
        SUM(has_fault) as fault_count,
        COUNT(*) as total_readings
      FROM TimeSlots
      GROUP BY time_slot
      ORDER BY time_slot
    `, { periodHours, intervalMinutes });

    res.json({
      success: true,
      data: {
        period,
        interval,
        trends: trends || []
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard trends:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard trends' });
  }
});

// Get fault analysis
router.get('/faults', [
  query('period').optional().isIn(['1h', '24h', '7d', '30d'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = '24h' } = req.query;
    
    const periodHours = {
      '1h': 1,
      '24h': 24,
      '7d': 168,
      '30d': 720
    }[period];

    // Get fault code frequency
    const faultFrequency = await database.query(`
      SELECT 
        FaultCodes,
        FaultDescriptions,
        COUNT(*) as count,
        COUNT(DISTINCT Device_ID) as affected_devices,
        MIN(CreatedAt) as first_occurrence,
        MAX(CreatedAt) as last_occurrence
      FROM IoT_Data_New
      WHERE CreatedAt >= DATEADD(hour, -@periodHours, GETDATE())
        AND FaultCodes IS NOT NULL 
        AND FaultCodes != ''
      GROUP BY FaultCodes, FaultDescriptions
      ORDER BY count DESC
    `, { periodHours });

    // Get devices with most faults
    const deviceFaults = await database.query(`
      SELECT TOP 10
        iot.Device_ID,
        COUNT(*) as fault_count,
        MAX(iot.CreatedAt) as last_fault
      FROM IoT_Data_New iot
      WHERE iot.CreatedAt >= DATEADD(hour, -@periodHours, GETDATE())
        AND iot.FaultCodes IS NOT NULL 
        AND iot.FaultCodes != ''
      GROUP BY iot.Device_ID
      ORDER BY fault_count DESC
    `, { periodHours });

    // Get fault trends over time
    const faultTrends = await database.query(`
      SELECT 
        CAST(CreatedAt as DATE) as date,
        COUNT(*) as fault_count,
        COUNT(DISTINCT Device_ID) as affected_devices
      FROM IoT_Data_New
      WHERE CreatedAt >= DATEADD(hour, -@periodHours, GETDATE())
        AND FaultCodes IS NOT NULL 
        AND FaultCodes != ''
      GROUP BY CAST(CreatedAt as DATE)
      ORDER BY date
    `, { periodHours });

    res.json({
      success: true,
      data: {
        period,
        faultFrequency: faultFrequency || [],
        deviceFaults: deviceFaults || [],
        faultTrends: faultTrends || []
      }
    });

  } catch (error) {
    console.error('Error fetching fault analysis:', error);
    res.status(500).json({ error: 'Failed to fetch fault analysis' });
  }
});

// Get system health metrics
router.get('/health', async (req, res) => {
  try {
    // Get data freshness metrics
    const dataFreshness = await database.query(`
      SELECT 
        Device_ID,
        MAX(CreatedAt) as last_data,
        DATEDIFF(minute, MAX(CreatedAt), GETDATE()) as minutes_since_last_data
      FROM IoT_Data_New
      GROUP BY Device_ID
      HAVING MAX(CreatedAt) IS NOT NULL
    `);

    // Calculate health scores
    const healthMetrics = dataFreshness.map(device => {
      const minutesSinceLastData = device.minutes_since_last_data;
      let healthScore = 100;
      
      if (minutesSinceLastData > 60) healthScore = 50; // More than 1 hour
      if (minutesSinceLastData > 1440) healthScore = 0; // More than 24 hours
      
      return {
        deviceId: device.Device_ID,
        lastData: device.last_data,
        minutesSinceLastData,
        healthScore,
        status: healthScore > 80 ? 'healthy' : healthScore > 50 ? 'warning' : 'critical'
      };
    });

    // Get database performance metrics
    const dbMetrics = await database.query(`
      SELECT 
        COUNT(*) as total_records,
        MAX(CreatedAt) as latest_record,
        MIN(CreatedAt) as earliest_record
      FROM IoT_Data_New
    `);

    res.json({
      success: true,
      data: {
        deviceHealth: healthMetrics,
        systemMetrics: dbMetrics[0] || {},
        overallHealth: {
          healthy: healthMetrics.filter(d => d.status === 'healthy').length,
          warning: healthMetrics.filter(d => d.status === 'warning').length,
          critical: healthMetrics.filter(d => d.status === 'critical').length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

export default router;
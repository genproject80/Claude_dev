import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import database from '../config/database.js';
import { authenticateToken, requireViewerOrAbove, requireUserOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all alert routes
router.use(authenticateToken);
router.use(requireViewerOrAbove);

// Get all alerts with filtering and pagination
router.get('/', [
  query('status').optional().isIn(['active', 'acknowledged', 'resolved']),
  query('severity').optional().isIn(['info', 'warning', 'critical']),
  query('deviceId').optional().isString(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, severity, deviceId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const params = {};

    if (status) {
      whereClause += ' AND a.status = @status';
      params.status = status;
    }

    if (severity) {
      whereClause += ' AND a.severity = @severity';
      params.severity = severity;
    }

    if (deviceId) {
      whereClause += ' AND a.device_id = @deviceId';
      params.deviceId = deviceId;
    }

    // Get total count
    const countResult = await database.query(
      `SELECT COUNT(*) as total FROM alerts a ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Get paginated alerts
    const alerts = await database.query(`
      SELECT 
        a.id,
        a.device_id,
        a.alert_type,
        a.severity,
        a.status,
        a.title,
        a.description,
        a.created_at,
        a.updated_at,
        a.acknowledged_at,
        a.acknowledged_by,
        a.resolved_at,
        a.resolved_by,
        d.device_name,
        d.location
      FROM alerts a
      LEFT JOIN devices d ON a.device_id = d.device_id
      ${whereClause}
      ORDER BY 
        CASE a.severity 
          WHEN 'critical' THEN 1
          WHEN 'warning' THEN 2
          WHEN 'info' THEN 3
        END,
        a.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, { ...params, offset, limit });

    res.json({
      success: true,
      data: alerts.map(alert => ({
        id: alert.id,
        deviceId: alert.device_id,
        deviceName: alert.device_name,
        location: alert.location,
        type: alert.alert_type,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        description: alert.description,
        createdAt: alert.created_at,
        updatedAt: alert.updated_at,
        acknowledgedAt: alert.acknowledged_at,
        acknowledgedBy: alert.acknowledged_by,
        resolvedAt: alert.resolved_at,
        resolvedBy: alert.resolved_by
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get alert by ID
router.get('/:alertId', [
  param('alertId').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { alertId } = req.params;

    const alerts = await database.query(`
      SELECT 
        a.id,
        a.device_id,
        a.alert_type,
        a.severity,
        a.status,
        a.title,
        a.description,
        a.created_at,
        a.updated_at,
        a.acknowledged_at,
        a.acknowledged_by,
        a.resolved_at,
        a.resolved_by,
        d.device_name,
        d.location,
        d.device_type
      FROM alerts a
      LEFT JOIN devices d ON a.device_id = d.device_id
      WHERE a.id = @alertId
    `, { alertId });

    if (!alerts || alerts.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const alert = alerts[0];

    res.json({
      success: true,
      data: {
        id: alert.id,
        deviceId: alert.device_id,
        deviceName: alert.device_name,
        location: alert.location,
        deviceType: alert.device_type,
        type: alert.alert_type,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        description: alert.description,
        createdAt: alert.created_at,
        updatedAt: alert.updated_at,
        acknowledgedAt: alert.acknowledged_at,
        acknowledgedBy: alert.acknowledged_by,
        resolvedAt: alert.resolved_at,
        resolvedBy: alert.resolved_by
      }
    });

  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

// Create new alert (user or admin)
router.post('/', [
  requireUserOrAdmin,
  body('deviceId').isString().notEmpty(),
  body('type').isString().notEmpty(),
  body('severity').isIn(['info', 'warning', 'critical']),
  body('title').isString().isLength({ min: 1, max: 255 }),
  body('description').optional().isString().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId, type, severity, title, description } = req.body;

    // Verify device exists
    const devices = await database.query(
      'SELECT device_id FROM devices WHERE device_id = @deviceId',
      { deviceId }
    );

    if (!devices || devices.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const result = await database.query(`
      INSERT INTO alerts (device_id, alert_type, severity, status, title, description, created_at)
      OUTPUT INSERTED.id, INSERTED.created_at
      VALUES (@deviceId, @type, @severity, 'active', @title, @description, GETDATE())
    `, {
      deviceId,
      type,
      severity,
      title,
      description: description || null
    });

    if (!result || result.length === 0) {
      return res.status(500).json({ error: 'Failed to create alert' });
    }

    const newAlert = result[0];

    res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      data: {
        id: newAlert.id,
        deviceId,
        type,
        severity,
        status: 'active',
        title,
        description,
        createdAt: newAlert.created_at
      }
    });

  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Acknowledge alert (user or admin)
router.put('/:alertId/acknowledge', [
  requireUserOrAdmin,
  param('alertId').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { alertId } = req.params;
    const userId = req.user.id;

    const result = await database.query(`
      UPDATE alerts 
      SET 
        status = 'acknowledged',
        acknowledged_at = GETDATE(),
        acknowledged_by = @userId,
        updated_at = GETDATE()
      OUTPUT INSERTED.id, INSERTED.status, INSERTED.acknowledged_at
      WHERE id = @alertId AND status = 'active'
    `, { alertId, userId });

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Alert not found or already acknowledged' });
    }

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: {
        id: result[0].id,
        status: result[0].status,
        acknowledgedAt: result[0].acknowledged_at
      }
    });

  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Resolve alert (user or admin)
router.put('/:alertId/resolve', [
  requireUserOrAdmin,
  param('alertId').isUUID(),
  body('resolution').optional().isString().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { alertId } = req.params;
    const { resolution } = req.body;
    const userId = req.user.id;

    const result = await database.query(`
      UPDATE alerts 
      SET 
        status = 'resolved',
        resolved_at = GETDATE(),
        resolved_by = @userId,
        resolution = @resolution,
        updated_at = GETDATE()
      OUTPUT INSERTED.id, INSERTED.status, INSERTED.resolved_at
      WHERE id = @alertId AND status IN ('active', 'acknowledged')
    `, { alertId, userId, resolution: resolution || null });

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Alert not found or already resolved' });
    }

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      data: {
        id: result[0].id,
        status: result[0].status,
        resolvedAt: result[0].resolved_at
      }
    });

  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// Get alert statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await database.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts,
        COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged_alerts,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_alerts,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_alerts,
        COUNT(CASE WHEN severity = 'info' THEN 1 END) as info_alerts,
        COUNT(CASE WHEN created_at >= DATEADD(hour, -24, GETDATE()) THEN 1 END) as alerts_24h
      FROM alerts
    `);

    const deviceStats = await database.query(`
      SELECT TOP 5
        device_id,
        COUNT(*) as alert_count
      FROM alerts
      WHERE created_at >= DATEADD(day, -7, GETDATE())
      GROUP BY device_id
      ORDER BY alert_count DESC
    `);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {},
        topDevices: deviceStats || []
      }
    });

  } catch (error) {
    console.error('Error fetching alert statistics:', error);
    res.status(500).json({ error: 'Failed to fetch alert statistics' });
  }
});

export default router;
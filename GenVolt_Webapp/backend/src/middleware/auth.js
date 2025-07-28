import jwt from 'jsonwebtoken';
import database from '../config/database.js';
import SessionManager from './sessionManager.js';

export const authenticateToken = async (req, res, next) => {
  try {
    console.log('=== AUTHENTICATE TOKEN MIDDLEWARE CALLED ===');
    console.log('Request path:', req.path);
    console.log('Request method:', req.method);
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('Auth header present:', !!authHeader);
    console.log('Token extracted:', !!token);

    if (!token) {
      console.log('ERROR: No token found in request');
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify session is still active
    console.log('Checking session validity for token:', token.substring(0, 20) + '...');
    const sessionData = await SessionManager.validateSession(token);
    console.log('Session validation result:', sessionData ? 'VALID' : 'INVALID');
    
    if (!sessionData) {
      console.log('Session validation failed - returning 401');
      return res.status(401).json({ error: 'Session expired or invalid' });
    }
    
    // Verify user still exists and is active
    const user = await database.query(
      'SELECT id, user_name, email, roles FROM users WHERE id = @userId',
      { userId: decoded.userId }
    );

    if (!user || user.length === 0) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    req.user = {
      id: user[0].id,
      username: user[0].user_name,
      email: user[0].email,
      role: user[0].roles
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Define role hierarchy - higher numbers have more permissions
const ROLE_HIERARCHY = {
  'viewer': 1,
  'dashboard_viewer': 2,
  'tk_iot_access': 2,      // Custom role equivalent to dashboard_viewer
  'aj_motor_access': 2,    // Custom role equivalent to dashboard_viewer
  'user': 3,
  'admin': 4
};

// Helper function to check if user role meets minimum requirement
const hasMinimumRole = (userRole, requiredRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
};

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: userRole
      });
    }

    next();
  };
};

export const requireMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    
    if (!hasMinimumRole(userRole, minimumRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: `minimum role: ${minimumRole}`,
        current: userRole
      });
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin']);
export const requireUserOrAdmin = requireMinimumRole('user');
export const requireViewerOrAbove = requireMinimumRole('viewer');
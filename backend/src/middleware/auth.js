import jwt from 'jsonwebtoken';
import database from '../config/database.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
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

export const requireAdmin = requireRole(['admin']);
export const requireUserOrAdmin = requireRole(['user', 'admin']);
export const requireViewerOrAbove = requireRole(['viewer', 'user', 'admin']);
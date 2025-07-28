import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import database from '../config/database.js';
import SessionManager from '../middleware/sessionManager.js';

const router = express.Router();

// Validation middleware
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
];

const validateRegister = [
  body('name').isLength({ min: 2 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').optional().isIn(['admin', 'user', 'viewer'])
];

// Login endpoint
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const users = await database.query(
      'SELECT id, user_name, email, password, roles, client_id FROM users WHERE email = @email',
      { email }
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.roles
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Create session record
    await SessionManager.createSession(user.id, token, req);

    // Return user info and token
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.user_name,
        email: user.email,
        role: user.roles,
        clientId: user.client_id
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Register endpoint
router.post('/register', validateRegister, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role = 'user' } = req.body;

    // Check if user already exists
    const existingUsers = await database.query(
      'SELECT id FROM users WHERE email = @email',
      { email }
    );

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await database.query(`
      INSERT INTO users (user_name, email, password, roles)
      OUTPUT INSERTED.id, INSERTED.user_name, INSERTED.email, INSERTED.roles, INSERTED.client_id
      VALUES (@name, @email, @passwordHash, @role)
    `, {
      name,
      email,
      passwordHash,
      role
    });

    if (!result || result.length === 0) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const newUser = result[0];

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser.id,
        email: newUser.email,
        role: newUser.roles
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Create session record for new user
    await SessionManager.createSession(newUser.id, token, req);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: newUser.id,
        name: newUser.user_name,
        email: newUser.email,
        role: newUser.roles,
        clientId: newUser.client_id
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Token validation endpoint
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get fresh user data
    const users = await database.query(
      'SELECT id, user_name, email, roles, client_id FROM users WHERE id = @userId',
      { userId: decoded.userId }
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = users[0];

    res.json({
      valid: true,
      user: {
        id: user.id,
        name: user.user_name,
        email: user.email,
        role: user.roles,
        clientId: user.client_id
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Token verification failed' });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // End the session
      await SessionManager.endSession(token);
    }

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;
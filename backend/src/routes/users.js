import express from 'express';
import bcrypt from 'bcryptjs';
import { body, param, validationResult } from 'express-validator';
import database from '../config/database.js';
import { authenticateToken, requireAdmin, requireUserOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all user routes
router.use(authenticateToken);

// Get all users (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await database.query(`
      SELECT 
        id, 
        user_name, 
        email, 
        roles
      FROM users 
      ORDER BY id DESC
    `);

    res.json({
      success: true,
      data: users.map(user => ({
        id: user.id,
        name: user.user_name,
        email: user.email,
        role: user.roles
      }))
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;

    const users = await database.query(
      'SELECT id, user_name, email, roles FROM users WHERE id = @userId',
      { userId }
    );

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
        role: user.roles
      }
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Get current user's dashboard permissions (public endpoint)
router.get('/permissions', async (req, res) => {
  try {
    console.log('=== PERMISSIONS ENDPOINT CALLED ===');
    console.log('Request headers:', req.headers);
    console.log('Request user object:', req.user);
    
    if (!req.user) {
      console.log('ERROR: No req.user found - authentication middleware not called or failed');
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const userRole = req.user.role;
    console.log('Permissions endpoint called for user role:', userRole);

    if (!userRole) {
      console.log('No user role found in request');
      return res.status(400).json({ error: 'User role not found' });
    }

    // Get user's role permissions from the database
    const permissions = await database.query(`
      SELECT 
        rp.dashboard_id,
        rp.can_access,
        d.name as dashboard_name,
        d.display_name as dashboard_display_name,
        d.description as dashboard_description
      FROM role_permissions rp
      JOIN dashboards d ON rp.dashboard_id = d.id
      WHERE rp.role_name = @userRole AND d.is_active = 1 AND rp.can_access = 1
      ORDER BY d.display_name
    `, { userRole });

    console.log(`Found ${permissions?.length || 0} permissions for role ${userRole}:`, permissions);

    res.json({
      success: true,
      data: {
        role_name: userRole,
        permissions: permissions || []
      }
    });

  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ error: 'Failed to fetch user permissions' });
  }
});

// Get user by ID (admin only)
router.get('/:userId', [
  requireAdmin,
  param('userId').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;

    const users = await database.query(
      'SELECT id, user_name, email, roles FROM users WHERE id = @userId',
      { userId }
    );

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
        role: user.roles
      }
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile
router.put('/profile', [
  body('name').optional().isLength({ min: 2 }).trim(),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { name, email } = req.body;

    // Build update query dynamically
    const updateFields = [];
    const params = { userId };

    if (name) {
      updateFields.push('user_name = @name');
      params.name = name;
    }

    if (email) {
      // Check if email is already taken by another user
      const existingUsers = await database.query(
        'SELECT id FROM users WHERE email = @email AND id != @userId',
        { email, userId }
      );

      if (existingUsers && existingUsers.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      updateFields.push('email = @email');
      params.email = email;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await database.query(`
      UPDATE users 
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.id, INSERTED.user_name, INSERTED.email, INSERTED.roles
      WHERE id = @userId
    `, params);

    if (!result || result.length === 0) {
      return res.status(500).json({ error: 'Failed to update user' });
    }

    const updatedUser = result[0];

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        name: updatedUser.user_name,
        email: updatedUser.email,
        role: updatedUser.roles
      }
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Change password
router.put('/password', [
  body('currentPassword').isLength({ min: 6 }),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Get current password hash
    const users = await database.query(
      'SELECT password FROM users WHERE id = @userId',
      { userId }
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await database.query(
      'UPDATE users SET password = @newPasswordHash WHERE id = @userId',
      { newPasswordHash, userId }
    );

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Update user role (admin only)
router.put('/:userId/role', [
  requireAdmin,
  param('userId').isUUID(),
  body('role').isIn(['admin', 'user', 'viewer', 'dashboard_viewer'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { role } = req.body;

    // Prevent self-demotion from admin
    if (userId === req.user.id && req.user.role === 'admin' && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot demote yourself from admin role' });
    }

    const result = await database.query(`
      UPDATE users 
      SET roles = @role
      OUTPUT INSERTED.id, INSERTED.user_name, INSERTED.email, INSERTED.roles
      WHERE id = @userId
    `, { role, userId });

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = result[0];

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        id: updatedUser.id,
        name: updatedUser.user_name,
        email: updatedUser.email,
        role: updatedUser.roles
      }
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user (admin only)
router.delete('/:userId', [
  requireAdmin,
  param('userId').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await database.query(
      'DELETE FROM users WHERE id = @userId',
      { userId }
    );

    if (result.rowsAffected && result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
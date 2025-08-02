import database from '../config/database.js';

class PermissionService {
  // Cache for permissions to avoid frequent database calls
  static permissionCache = new Map();
  static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if user can access a specific client based on hierarchy
   * @param {number} userId - User ID
   * @param {number} clientId - Client ID to check access for
   * @returns {Promise<boolean>} - True if user has access
   */
  static async canUserAccessClient(userId, clientId) {
    if (!userId || !clientId) {
      return false;
    }

    try {
      const accessibleClients = await this.getAccessibleClients(userId);
      return accessibleClients.some(client => client.client_id === clientId);
    } catch (error) {
      console.error('Error checking client access:', error);
      return false;
    }
  }

  /**
   * Check if user can manage a specific client based on hierarchy
   * @param {number} userId - User ID
   * @param {number} clientId - Client ID to check management access for
   * @returns {Promise<boolean>} - True if user can manage
   */
  static async canUserManageClient(userId, clientId) {
    if (!userId || !clientId) {
      return false;
    }

    try {
      const user = await database.query(`
        SELECT roles, client_id, can_manage_hierarchy FROM users WHERE id = @userId
      `, { userId });

      if (!user.length) {
        return false;
      }

      const userInfo = user[0];

      // Admin users can manage all clients
      if (userInfo.roles === 'admin') {
        return true;
      }

      // Users with hierarchy management permission can manage their branch
      if (userInfo.can_manage_hierarchy && userInfo.client_id) {
        const accessibleClients = await this.getAccessibleClients(userId);
        return accessibleClients.some(client => client.client_id === clientId);
      }

      return false;
    } catch (error) {
      console.error('Error checking client management access:', error);
      return false;
    }
  }

  /**
   * Get all clients accessible to a user based on hierarchy
   * @param {number} userId - User ID
   * @returns {Promise<Array>} - Array of accessible clients
   */
  static async getAccessibleClients(userId) {
    if (!userId) {
      return [];
    }

    try {
      const user = await database.query(`
        SELECT id, roles, client_id FROM users WHERE id = @userId
      `, { userId });

      if (!user.length) {
        return [];
      }

      const userInfo = user[0];

      // Admin users see all clients
      if (userInfo.roles === 'admin') {
        return await database.query(`
          SELECT 
            id as client_id,
            name as client_name,
            display_name,
            contact_email,
            parent_client_id,
            hierarchy_level,
            hierarchy_path,
            client_type,
            is_leaf_node,
            display_order,
            is_active
          FROM client 
          ORDER BY hierarchy_path
        `);
      }

      // Branch admin users (e.g., paddy_admin) see their branch and descendants
      if (userInfo.roles.includes('_admin') && userInfo.client_id) {
        return await database.query(`
          SELECT 
            id as client_id,
            name as client_name,
            display_name,
            contact_email,
            parent_client_id,
            hierarchy_level,
            hierarchy_path,
            client_type,
            is_leaf_node,
            display_order,
            is_active
          FROM client 
          WHERE is_active = 1 
          AND (id = @clientId OR hierarchy_path LIKE (
            SELECT hierarchy_path + '%' FROM client WHERE id = @clientId
          ))
          ORDER BY hierarchy_path
        `, { 
          clientId: userInfo.client_id,
          pathPattern: `%/${userInfo.client_id}/%`
        });
      }

      // Regular users see only their client
      if (userInfo.client_id) {
        return await database.query(`
          SELECT 
            id as client_id,
            name as client_name,
            display_name,
            contact_email,
            parent_client_id,
            hierarchy_level,
            hierarchy_path,
            client_type,
            is_leaf_node,
            display_order,
            is_active
          FROM client 
          WHERE id = @clientId AND is_active = 1
        `, { clientId: userInfo.client_id });
      }

      return [];
    } catch (error) {
      console.error('Error getting accessible clients:', error);
      return [];
    }
  }

  /**
   * Get user permissions for dashboards
   * @param {string} role - User role
   * @returns {Promise<Object>} - Object with dashboard permissions
   */
  static async getUserPermissions(role) {
    if (!role) {
      return {};
    }

    // Check cache first
    const cacheKey = `permissions_${role}`;
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.permissions;
    }

    try {
      const permissions = await database.query(`
        SELECT 
          rp.dashboard_id,
          rp.can_access,
          d.name as dashboard_name,
          d.display_name as dashboard_display_name
        FROM role_permissions rp
        JOIN dashboards d ON rp.dashboard_id = d.id
        WHERE rp.role_name = @role AND d.is_active = 1 AND rp.can_access = 1
      `, { role });

      // Convert to object format for easy lookup
      const permissionObj = {};
      permissions.forEach(perm => {
        permissionObj[perm.dashboard_name] = {
          dashboard_id: perm.dashboard_id,
          can_access: perm.can_access,
          display_name: perm.dashboard_display_name
        };
      });

      // Cache the result
      this.permissionCache.set(cacheKey, {
        permissions: permissionObj,
        timestamp: Date.now()
      });

      return permissionObj;

    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return {};
    }
  }

  /**
   * Check if user has access to a specific dashboard
   * @param {string} role - User role
   * @param {string} dashboardName - Dashboard name (e.g., 'iot_dashboard', 'motor_dashboard')
   * @returns {Promise<boolean>} - True if user has access
   */
  static async hasPermission(role, dashboardName) {
    if (!role || !dashboardName) {
      return false;
    }

    // Admin always has access to everything
    if (role === 'admin') {
      return true;
    }

    const permissions = await this.getUserPermissions(role);
    return permissions[dashboardName]?.can_access === true;
  }

  /**
   * Check if user can access IoT dashboard
   * @param {string} role - User role
   * @param {string|number} clientId - User client ID (deprecated)
   * @returns {Promise<boolean>} - True if user has access
   */
  static async canAccessIoTDashboard(role, clientId = null) {
    // Admin always has access to everything
    if (role === 'admin') {
      return true;
    }

    // Check role-based permissions - this is now the only source of truth
    const hasRolePermission = await this.hasPermission(role, 'iot_dashboard');
    return hasRolePermission;
  }

  /**
   * Check if user can access Motor dashboard
   * @param {string} role - User role
   * @param {string|number} clientId - User client ID (deprecated)
   * @returns {Promise<boolean>} - True if user has access
   */
  static async canAccessMotorDashboard(role, clientId = null) {
    // Admin always has access to everything
    if (role === 'admin') {
      return true;
    }

    // Check role-based permissions - this is now the only source of truth
    const hasRolePermission = await this.hasPermission(role, 'motor_dashboard');
    return hasRolePermission;
  }

  /**
   * Get list of accessible dashboards for a user
   * @param {string} role - User role
   * @param {string|number} clientId - User client ID (deprecated)
   * @returns {Promise<Array>} - Array of accessible dashboard names
   */
  static async getAccessibleDashboards(role, clientId = null) {
    const permissions = await this.getUserPermissions(role);
    const accessibleDashboards = [];

    // Check each dashboard permission
    for (const [dashboardName, permission] of Object.entries(permissions)) {
      if (permission.can_access) {
        accessibleDashboards.push({
          name: dashboardName,
          display_name: permission.display_name
        });
      }
    }

    return accessibleDashboards;
  }

  /**
   * Clear permission cache for a specific role or all roles
   * @param {string} role - Optional specific role to clear, if not provided clears all
   */
  static clearCache(role = null) {
    if (role) {
      const cacheKey = `permissions_${role}`;
      this.permissionCache.delete(cacheKey);
    } else {
      this.permissionCache.clear();
    }
  }

  /**
   * Refresh permissions for all cached roles
   */
  static async refreshAllCaches() {
    const roles = Array.from(this.permissionCache.keys()).map(key => key.replace('permissions_', ''));
    this.permissionCache.clear();
    
    // Pre-populate cache with fresh data
    for (const role of roles) {
      await this.getUserPermissions(role);
    }
  }
}

export default PermissionService;
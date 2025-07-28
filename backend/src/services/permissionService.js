import database from '../config/database.js';

class PermissionService {
  // Cache for permissions to avoid frequent database calls
  static permissionCache = new Map();
  static cacheTimeout = 5 * 60 * 1000; // 5 minutes

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
import { userApi } from './api';

interface UserPermissions {
  [dashboardName: string]: {
    dashboard_id: number;
    can_access: boolean;
    display_name: string;
  };
}

class FrontendPermissionService {
  private static permissionCache = new Map<string, {
    permissions: UserPermissions;
    timestamp: number;
  }>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get user permissions for dashboards
   * @param role - User role
   * @returns Promise<UserPermissions> - Object with dashboard permissions
   */
  static async getUserPermissions(role: string): Promise<UserPermissions> {
    if (!role) {
      console.log('No role provided to getUserPermissions');
      return {};
    }

    // Check cache first
    const cacheKey = `permissions_${role}`;
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`Using cached permissions for role: ${role}`, cached.permissions);
      return cached.permissions;
    }

    try {
      console.log(`Fetching permissions for role: ${role}`);
      const response = await userApi.getPermissions();
      console.log('Permission API response:', response);
      
      if (response.success) {
        // Convert API response to our format
        const permissions: UserPermissions = {};
        response.data.permissions.forEach(perm => {
          permissions[perm.dashboard_name] = {
            dashboard_id: perm.dashboard_id,
            can_access: perm.can_access,
            display_name: perm.dashboard_display_name
          };
        });

        console.log(`Processed permissions for ${role}:`, permissions);

        // Cache the result
        this.permissionCache.set(cacheKey, {
          permissions,
          timestamp: Date.now()
        });

        return permissions;
      } else {
        console.log('Permission API returned unsuccessful response');
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      // Fallback to empty permissions on error, which will trigger legacy logic
    }

    console.log(`Returning empty permissions for role: ${role}, will use legacy logic`);
    return {};
  }

  /**
   * Check if user has access to a specific dashboard
   * @param role - User role
   * @param dashboardName - Dashboard name (e.g., 'iot_dashboard', 'motor_dashboard')
   * @returns Promise<boolean> - True if user has access
   */
  static async hasPermission(role: string, dashboardName: string): Promise<boolean> {
    if (!role || !dashboardName) {
      return false;
    }

    // Admin always has access to everything
    if (role === 'admin') {
      return true;
    }

    try {
      const permissions = await this.getUserPermissions(role);
      return permissions[dashboardName]?.can_access === true;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Check if user can access IoT dashboard
   * @param role - User role
   * @param clientId - User client ID (deprecated)
   * @returns Promise<boolean> - True if user has access
   */
  static async canAccessIoTDashboard(role: string, clientId?: string | number): Promise<boolean> {
    try {
      // Admin always has access to everything
      if (role === 'admin') {
        return true;
      }

      // Check role-based permissions - this is now the only source of truth
      const hasRolePermission = await this.hasPermission(role, 'iot_dashboard');
      return hasRolePermission;
    } catch (error) {
      console.error('Error in canAccessIoTDashboard:', error);
      // No fallback - deny access on error
      return false;
    }
  }

  /**
   * Check if user can access Motor dashboard
   * @param role - User role
   * @param clientId - User client ID (deprecated)
   * @returns Promise<boolean> - True if user has access
   */
  static async canAccessMotorDashboard(role: string, clientId?: string | number): Promise<boolean> {
    try {
      // Admin always has access to everything
      if (role === 'admin') {
        return true;
      }

      // Check role-based permissions - this is now the only source of truth
      const hasRolePermission = await this.hasPermission(role, 'motor_dashboard');
      return hasRolePermission;
    } catch (error) {
      console.error('Error in canAccessMotorDashboard:', error);
      // No fallback - deny access on error
      return false;
    }
  }

  /**
   * Get list of accessible dashboards for a user
   * @param role - User role
   * @param clientId - User client ID (deprecated)
   * @returns Promise<Array> - Array of accessible dashboard names
   */
  static async getAccessibleDashboards(role: string, clientId?: string | number): Promise<Array<{
    name: string;
    display_name: string;
  }>> {
    try {
      const permissions = await this.getUserPermissions(role);
      const accessibleDashboards: Array<{ name: string; display_name: string }> = [];

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
    } catch (error) {
      console.error('Error getting accessible dashboards:', error);
      // No fallback - return empty array on error
      return [];
    }
  }

  /**
   * Check if user should see both dashboard tabs (admin or dashboard_viewer)
   * @param role - User role
   * @param clientId - User client ID (for backward compatibility)
   * @returns Promise<boolean> - True if user should see both tabs
   */
  static async shouldShowBothDashboards(role: string, clientId?: string | number): Promise<boolean> {
    if (role === 'admin' || role === 'dashboard_viewer') {
      return true;
    }

    // Check if user has access to both dashboards via permissions
    const [canAccessIoT, canAccessMotor] = await Promise.all([
      this.canAccessIoTDashboard(role, clientId),
      this.canAccessMotorDashboard(role, clientId)
    ]);

    return canAccessIoT && canAccessMotor;
  }

  /**
   * Clear permission cache for a specific role or all roles
   * @param role - Optional specific role to clear, if not provided clears all
   */
  static clearCache(role?: string): void {
    if (role) {
      const cacheKey = `permissions_${role}`;
      this.permissionCache.delete(cacheKey);
    } else {
      this.permissionCache.clear();
    }
  }
}

export default FrontendPermissionService;
// API configuration and service layer
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3003/api/v1');

// Types for API responses
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Auth token management
class AuthManager {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly SESSION_KEY = 'session_active';
  
  // Always use sessionStorage for authentication tokens
  // This ensures tokens are cleared when tabs close (better security)
  static getToken(): string | null {
    // Check if session is still active
    if (!this.isSessionActive()) {
      this.removeToken();
      return null;
    }
    return sessionStorage.getItem(this.TOKEN_KEY);
  }
  
  static setToken(token: string): void {
    // Store token in sessionStorage (cleared when tab closes)
    sessionStorage.setItem(this.TOKEN_KEY, token);
    // Mark session as active
    sessionStorage.setItem(this.SESSION_KEY, 'true');
    
    // Also clear any old localStorage tokens for cleanup
    try {
      localStorage.removeItem(this.TOKEN_KEY);
    } catch (e) {
      // Ignore if localStorage is blocked
    }
  }
  
  static removeToken(): void {
    // Remove from both storage types to be thorough
    try {
      sessionStorage.removeItem(this.TOKEN_KEY);
      sessionStorage.removeItem(this.SESSION_KEY);
      localStorage.removeItem(this.TOKEN_KEY);
    } catch (e) {
      // Ignore errors if storage is not available
    }
  }
  
  static isSessionActive(): boolean {
    return sessionStorage.getItem(this.SESSION_KEY) === 'true';
  }
  
  static getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

// Base API client
class ApiClient {
  private baseURL: string;
  
  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }
  
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...AuthManager.getAuthHeaders(),
      ...options.headers,
    };
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          AuthManager.removeToken();
          window.location.href = '/login';
          throw new Error('Authentication required');
        }
        
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }
  
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }
  
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create API client instance
const apiClient = new ApiClient(API_BASE_URL);

// Authentication API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post<{
      token: string;
      user: {
        id: string;
        name: string;
        email: string;
        role: string;
        clientId?: string;
      };
    }>('/auth/login', { email, password });
    
    AuthManager.setToken(response.token);
    return response;
  },
  
  register: async (name: string, email: string, password: string, role?: string) => {
    const response = await apiClient.post<{
      token: string;
      user: {
        id: string;
        name: string;
        email: string;
        role: string;
        clientId?: string;
      };
    }>('/auth/register', { name, email, password, role });
    
    AuthManager.setToken(response.token);
    return response;
  },
  
  verify: async () => {
    return apiClient.get<{
      valid: boolean;
      user: {
        id: string;
        name: string;
        email: string;
        role: string;
        clientId?: string;
      };
    }>('/auth/verify');
  },
  
  logout: async () => {
    const token = AuthManager.getToken();
    if (token) {
      try {
        // Call backend logout to end session
        await apiClient.post('/auth/logout');
      } catch (error) {
        console.error('Logout API call failed:', error);
        // Continue with local logout even if API call fails
      }
    }
    AuthManager.removeToken();
  }
};

// Device API
export const deviceApi = {
  getAll: async () => {
    return apiClient.get<ApiResponse<any[]>>('/devices');
  },
  
  getById: async (deviceId: string) => {
    return apiClient.get<ApiResponse<any>>(`/devices/${deviceId}`);
  },
  
  getData: async (
    deviceId: string, 
    params?: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    }
  ) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const query = queryParams.toString();
    return apiClient.get<PaginatedResponse<any[]>>(
      `/devices/${deviceId}/data${query ? `?${query}` : ''}`
    );
  },
  
  getStats: async (deviceId: string, period?: string) => {
    const query = period ? `?period=${period}` : '';
    return apiClient.get<ApiResponse<any>>(`/devices/${deviceId}/stats${query}`);
  }
};

// Dashboard API
export const dashboardApi = {
  getOverview: async () => {
    return apiClient.get<ApiResponse<{
      devices: any;
      dataPoints: any;
      alerts: any;
      runtimeByType: any[];
    }>>('/dashboard/overview');
  },
  
  getTrends: async (period?: string, interval?: string) => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    if (interval) params.append('interval', interval);
    
    const query = params.toString();
    return apiClient.get<ApiResponse<{
      period: string;
      interval: string;
      trends: any[];
    }>>(`/dashboard/trends${query ? `?${query}` : ''}`);
  },
  
  getFaults: async (period?: string) => {
    const query = period ? `?period=${period}` : '';
    return apiClient.get<ApiResponse<{
      period: string;
      faultFrequency: any[];
      deviceFaults: any[];
      faultTrends: any[];
    }>>(`/dashboard/faults${query}`);
  },
  
  getHealth: async () => {
    return apiClient.get<ApiResponse<{
      deviceHealth: any[];
      systemMetrics: any;
      overallHealth: any;
    }>>('/dashboard/health');
  }
};

// User API
export const userApi = {
  getAll: async () => {
    return apiClient.get<ApiResponse<any[]>>('/users');
  },
  
  getProfile: async () => {
    return apiClient.get<ApiResponse<any>>('/users/profile');
  },
  
  updateProfile: async (data: { name?: string; email?: string }) => {
    return apiClient.put<ApiResponse<any>>('/users/profile', data);
  },
  
  changePassword: async (currentPassword: string, newPassword: string) => {
    return apiClient.put<ApiResponse<any>>('/users/password', {
      currentPassword,
      newPassword
    });
  },
  
  updateRole: async (userId: string, role: string) => {
    return apiClient.put<ApiResponse<any>>(`/users/${userId}/role`, { role });
  },
  
  delete: async (userId: string) => {
    return apiClient.delete<ApiResponse<any>>(`/users/${userId}`);
  },

  getPermissions: async () => {
    return apiClient.get<ApiResponse<{
      role_name: string;
      permissions: Array<{
        dashboard_id: number;
        can_access: boolean;
        dashboard_name: string;
        dashboard_display_name: string;
        dashboard_description?: string;
      }>;
    }>>('/users/permissions');
  }
};

// Alert API
export const alertApi = {
  getAll: async (params?: {
    status?: string;
    severity?: string;
    deviceId?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.severity) queryParams.append('severity', params.severity);
    if (params?.deviceId) queryParams.append('deviceId', params.deviceId);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return apiClient.get<PaginatedResponse<any[]>>(`/alerts${query ? `?${query}` : ''}`);
  },
  
  getById: async (alertId: string) => {
    return apiClient.get<ApiResponse<any>>(`/alerts/${alertId}`);
  },
  
  create: async (data: {
    deviceId: string;
    type: string;
    severity: string;
    title: string;
    description?: string;
  }) => {
    return apiClient.post<ApiResponse<any>>('/alerts', data);
  },
  
  acknowledge: async (alertId: string) => {
    return apiClient.put<ApiResponse<any>>(`/alerts/${alertId}/acknowledge`);
  },
  
  resolve: async (alertId: string, resolution?: string) => {
    return apiClient.put<ApiResponse<any>>(`/alerts/${alertId}/resolve`, {
      resolution
    });
  },
  
  getStats: async () => {
    return apiClient.get<ApiResponse<any>>('/alerts/stats/summary');
  }
};

// Motor API
export const motorApi = {
  getAll: async () => {
    return apiClient.get<ApiResponse<any[]>>('/motors');
  },
  
  getById: async (deviceId: string) => {
    return apiClient.get<ApiResponse<any>>(`/motors/${deviceId}`);
  },
  
  getData: async (
    deviceId: string, 
    params?: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    }
  ) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const query = queryParams.toString();
    return apiClient.get<PaginatedResponse<any[]>>(
      `/motors/${deviceId}/data${query ? `?${query}` : ''}`
    );
  },
  
  getStats: async (deviceId: string, period?: string) => {
    const query = period ? `?period=${period}` : '';
    return apiClient.get<ApiResponse<any>>(`/motors/${deviceId}/stats${query}`);
  },
  
  getDashboardOverview: async () => {
    return apiClient.get<ApiResponse<{
      motors: any;
      faults: any;
    }>>('/motors/dashboard/overview');
  }
};

// Admin API
export const adminApi = {
  // User management
  getUsers: async () => {
    return apiClient.get<ApiResponse<any[]>>('/admin/users');
  },

  getUserById: async (userId: string) => {
    return apiClient.get<ApiResponse<any>>(`/admin/users/${userId}`);
  },
  
  createUser: async (data: {
    name: string;
    email: string;
    password: string;
    role: string;
    clientId?: string;
  }) => {
    return apiClient.post<ApiResponse<any>>('/admin/users', data);
  },
  
  updateUser: async (userId: string, data: {
    name?: string;
    email?: string;
    role?: string;
    clientId?: string;
  }) => {
    return apiClient.put<ApiResponse<any>>(`/admin/users/${userId}`, data);
  },
  
  deleteUser: async (userId: string) => {
    return apiClient.delete<ApiResponse<any>>(`/admin/users/${userId}`);
  },

  // Get available client IDs
  getClientIds: async () => {
    return apiClient.get<ApiResponse<string[]>>('/admin/client-ids');
  },
  
  // System statistics
  getStats: async () => {
    return apiClient.get<ApiResponse<{
      users: any;
      devices: any;
      iotData: any;
      motorData: any;
      recentActivity: any;
    }>>('/admin/stats');
  },
  
  // Device management
  getDevices: async () => {
    return apiClient.get<ApiResponse<any[]>>('/admin/devices');
  },
  
  getDeviceById: async (deviceId: string) => {
    return apiClient.get<ApiResponse<any>>(`/admin/devices/${deviceId}`);
  },
  
  createDevice: async (data: {
    deviceId: string;
    channelId: number;
    fieldId?: number;
    clientId: string;
    apiKey: string;
    conversionLogicId: number;
  }) => {
    return apiClient.post<ApiResponse<any>>('/admin/devices', data);
  },
  
  updateDevice: async (deviceId: string, data: {
    channelId?: number;
    fieldId?: number;
    clientId?: string;
    apiKey?: string;
    conversionLogicId?: number;
  }) => {
    return apiClient.put<ApiResponse<any>>(`/admin/devices/${deviceId}`, data);
  },
  
  deleteDevice: async (deviceId: string) => {
    return apiClient.delete<ApiResponse<any>>(`/admin/devices/${deviceId}`);
  },

  // Session management
  getSessions: async (params?: {
    page?: number;
    limit?: number;
    filter?: 'active' | 'recent' | 'all' | 'custom';
    search?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.filter) queryParams.append('filter', params.filter);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const query = queryParams.toString();
    return apiClient.get<ApiResponse<any[]> & {
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
      filter: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      sortOrder?: string;
    }>(`/admin/sessions${query ? `?${query}` : ''}`);
  },

  getUserSessions: async (userId: string) => {
    return apiClient.get<ApiResponse<any[]>>(`/admin/sessions/user/${userId}`);
  },

  terminateSession: async (sessionId: string) => {
    return apiClient.delete<ApiResponse<any>>(`/admin/sessions/${sessionId}`);
  },

  getSessionStats: async () => {
    return apiClient.get<ApiResponse<{
      active_sessions: number;
      sessions_24h: number;
      sessions_7d: number;
      active_users: number;
      total_users_with_sessions: number;
    }>>('/admin/sessions/stats');
  },

  // Role Management
  getRoles: async () => {
    return apiClient.get<ApiResponse<{
      roles: Array<{
        id: number;
        role_name: string;
        display_name: string;
        description?: string;
        is_active: boolean;
        is_system_role: boolean;
        created_at: string;
        updated_at: string;
        user_count: number;
        permission_count: number;
        permissions: Record<string, {
          dashboard_id: number;
          dashboard_name: string;
          dashboard_display_name: string;
          can_access: boolean;
        }>;
      }>;
      dashboards: Array<{
        id: number;
        name: string;
        display_name: string;
        description?: string;
        route_path?: string;
        is_active: boolean;
      }>;
    }>>('/admin/roles');
  },

  getDashboards: async () => {
    return apiClient.get<ApiResponse<Array<{
      id: number;
      name: string;
      display_name: string;
      description?: string;
      route_path?: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>>>('/admin/dashboards');
  },

  getRolePermissions: async (roleName: string) => {
    return apiClient.get<ApiResponse<{
      role_name: string;
      permissions: Array<{
        dashboard_id: number;
        can_access: boolean;
        dashboard_name: string;
        dashboard_display_name: string;
        dashboard_description?: string;
      }>;
    }>>(`/admin/permissions/${roleName}`);
  },

  updateRolePermissions: async (roleName: string, permissions: Array<{
    dashboard_id: number;
    can_access: boolean;
  }>) => {
    return apiClient.put<ApiResponse<any>>(`/admin/roles/${roleName}/permissions`, {
      permissions
    });
  },

  createDashboard: async (data: {
    name: string;
    display_name: string;
    description?: string;
    route_path?: string;
  }) => {
    return apiClient.post<ApiResponse<{
      id: number;
      name: string;
      display_name: string;
      description?: string;
      route_path?: string;
    }>>('/admin/dashboards', data);
  },

  // Enhanced Role CRUD Operations
  createRole: async (data: {
    name: string;
    display_name: string;
    description?: string;
  }) => {
    return apiClient.post<ApiResponse<{
      id: number;
      name: string;
      display_name: string;
      description?: string;
      is_active: boolean;
      is_system_role: boolean;
      created_at: string;
      user_count: number;
      permission_count: number;
    }>>('/admin/roles', data);
  },

  getRoleDetails: async (roleName: string) => {
    return apiClient.get<ApiResponse<{
      role: {
        id: number;
        name: string;
        display_name: string;
        description?: string;
        is_active: boolean;
        is_system_role: boolean;
        created_at: string;
        updated_at: string;
        user_count: number;
        permission_count: number;
      };
      permissions: Array<{
        dashboard_id: number;
        can_access: boolean;
        dashboard_name: string;
        dashboard_display_name: string;
        dashboard_description?: string;
      }>;
    }>>(`/admin/roles/${roleName}/details`);
  },

  updateRole: async (roleName: string, data: {
    display_name?: string;
    description?: string;
    is_active?: boolean;
  }) => {
    return apiClient.put<ApiResponse<{
      id: number;
      name: string;
      display_name: string;
      description?: string;
      is_active: boolean;
      is_system_role: boolean;
      updated_at: string;
    }>>(`/admin/roles/${roleName}`, data);
  },

  deleteRole: async (roleName: string) => {
    return apiClient.delete<ApiResponse<{
      message: string;
    }>>(`/admin/roles/${roleName}`);
  },

  getRoleStatistics: async () => {
    return apiClient.get<ApiResponse<{
      overview: {
        total_roles: number;
        system_roles: number;
        custom_roles: number;
        active_roles: number;
        inactive_roles: number;
      };
      role_usage: Array<{
        name: string;
        display_name: string;
        is_system_role: boolean;
        user_count: number;
        permission_count: number;
      }>;
    }>>('/admin/roles/statistics');
  }
};

// Health check
export const healthApi = {
  check: async () => {
    return apiClient.get<{
      status: string;
      timestamp: string;
      uptime: number;
      environment: string;
    }>('/health');
  }
};

// Client Hierarchy API
export const hierarchyApi = {
  // Get complete client hierarchy tree
  getClients: async () => {
    return apiClient.get<ApiResponse<Array<{
      client_id: number;
      client_name: string;
      display_name: string;
      contact_email?: string;
      contact_phone?: string;
      address?: string;
      parent_client_id?: number;
      hierarchy_level: number;
      hierarchy_path: string;
      client_type: string;
      is_leaf_node: boolean;
      display_order: number;
      is_active: boolean;
      full_path_name?: string;
      indented_name?: string;
      device_count?: number;
      child_count?: number;
      created_at: string;
      updated_at: string;
    }>>>('/hierarchy/clients');
  },

  // Get specific client with hierarchy information
  getClientById: async (clientId: number) => {
    return apiClient.get<ApiResponse<any>>(`/hierarchy/clients/${clientId}`);
  },

  // Get children of a specific client
  getClientChildren: async (clientId: number) => {
    return apiClient.get<ApiResponse<any[]>>(`/hierarchy/clients/${clientId}/children`);
  },

  // Get all descendants of a specific client
  getClientDescendants: async (clientId: number) => {
    return apiClient.get<ApiResponse<any[]>>(`/hierarchy/clients/${clientId}/descendants`);
  },

  // Get ancestors of a specific client (parent chain)
  getClientAncestors: async (clientId: number) => {
    return apiClient.get<ApiResponse<any[]>>(`/hierarchy/clients/${clientId}/ancestors`);
  },

  // Get devices assigned to a client
  getClientDevices: async (clientId: number, includeDescendants?: boolean) => {
    const query = includeDescendants ? '?include_descendants=true' : '';
    return apiClient.get<ApiResponse<any[]>>(`/hierarchy/clients/${clientId}/devices${query}`);
  }
};

// Export auth manager for external use
export { AuthManager };
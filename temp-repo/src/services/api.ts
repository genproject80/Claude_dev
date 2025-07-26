// API configuration and service layer
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

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
  
  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }
  
  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
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
      };
    }>('/auth/verify');
  },
  
  logout: () => {
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
  
  createUser: async (data: {
    name: string;
    email: string;
    password: string;
    role: string;
  }) => {
    return apiClient.post<ApiResponse<any>>('/admin/users', data);
  },
  
  updateUser: async (userId: string, data: {
    name?: string;
    email?: string;
    role?: string;
  }) => {
    return apiClient.put<ApiResponse<any>>(`/admin/users/${userId}`, data);
  },
  
  deleteUser: async (userId: string) => {
    return apiClient.delete<ApiResponse<any>>(`/admin/users/${userId}`);
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

// Export auth manager for external use
export { AuthManager };
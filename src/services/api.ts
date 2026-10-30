import type { Site, User, Organization, Machine, MachineModel, OrganizationCreateData, DashboardStats } from '../types';

const API_BASE_URL = 'http://localhost:5000/api';
const TOKEN_KEY = 'foodie_jwt_token_v1';

export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Safely parse JSON or text bodies without failing on empty responses or 204 No Content
  let data: any = null;
  try {
    const text = await response.text();
    if (text && text.trim().length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMsg =
      data?.detail ||
      data?.error ||
      (typeof data === 'string' ? data : `Request failed with status ${response.status}`);
    throw new Error(errorMsg);
  }

  return (data || {}) as T;
}

// ----------------------------------------------------------------------------
// AUTHENTICATION API (JWT Based)
// ----------------------------------------------------------------------------
export const authApi = {
  login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
    const res = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    tokenStorage.set(res.token);
    return res;
  },

  getMe: async (): Promise<User> => {
    return request<User>('/auth/me');
  },

  forgotPassword: async (email: string): Promise<{ success: boolean; message: string; email: string; expires_in_minutes: number }> => {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  verifyResetToken: async (token: string): Promise<{ valid: boolean; email: string }> => {
    return request('/auth/verify-reset-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  resetPassword: async (token: string, new_password: string): Promise<{ success: boolean; message: string }> => {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password }),
    });
  },

  logout: () => {
    tokenStorage.clear();
  },
};

// ----------------------------------------------------------------------------
// SITES API
// ----------------------------------------------------------------------------
export const sitesApi = {
  getAll: async (): Promise<Site[]> => {
    return [];
  },

  create: async (_siteData: any): Promise<Site> => {
    return {} as Site;
  },

  update: async (_id: string, _updatedFields: any): Promise<Site> => {
    return {} as Site;
  },

  delete: async (_id: string): Promise<void> => { },
};

// ----------------------------------------------------------------------------
// USERS API (Direct PostgreSQL / FastAPI CRUD)
// ----------------------------------------------------------------------------
export const usersApi = {
  getAll: async (): Promise<User[]> => {
    return await request<User[]>('/users');
  },

  create: async (userData: any): Promise<User> => {
    return await request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  update: async (id: string, updatedFields: Partial<User>): Promise<User> => {
    return await request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedFields),
    });
  },

  delete: async (id: string): Promise<void> => {
    await request(`/users/${id}`, { method: 'DELETE' });
  },
};

// ----------------------------------------------------------------------------
// ORGANIZATIONS API (Direct PostgreSQL / FastAPI)
// ----------------------------------------------------------------------------
export const orgsApi = {
  getAll: async (): Promise<Organization[]> => {
    return await request<Organization[]>('/organizations');
  },

  getNextCode: async (): Promise<{ next_code: string }> => {
    return await request<{ next_code: string }>('/organizations/next-code');
  },

  getById: async (id: string): Promise<Organization> => {
    return await request<Organization>(`/organizations/${id}`);
  },

  create: async (orgData: Partial<Organization> | OrganizationCreateData): Promise<Organization> => {
    return await request<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify(orgData),
    });
  },

  update: async (id: string, updatedFields: Partial<Organization>): Promise<Organization> => {
    return await request<Organization>(`/organizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedFields),
    });
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return await request<{ success: boolean; message: string }>(`/organizations/${id}`, { method: 'DELETE' });
  },

  bulkDelete: async (ids: string[]): Promise<{ message: string; deleted_ids: string[] }> => {
    return await request('/organizations/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },
};

// ----------------------------------------------------------------------------
// SEARCH API (Multi-Entity Search across PostgreSQL)
// ----------------------------------------------------------------------------
export interface SearchResults {
  sites: { id: string; site_code: string; site_name: string; address: string; is_active: boolean }[];
  users: { id: string; first_name: string; last_name: string; email: string; role: string }[];
  machines: { id: string; model: string; location: string; status: string; temp: string }[];
}

export const searchApi = {
  query: async (q: string): Promise<SearchResults> => {
    if (!q.trim()) {
      return { sites: [], users: [], machines: [] };
    }
    return await request<SearchResults>(`/search?q=${encodeURIComponent(q.trim())}`);
  },
};

// ----------------------------------------------------------------------------
// MACHINES API (Direct PostgreSQL / FastAPI Machine Onboarding & Leases)
// ----------------------------------------------------------------------------
export const machinesApi = {
  getAll: async (): Promise<Machine[]> => {
    return await request<Machine[]>('/machines');
  },

  getNextCode: async (): Promise<{ next_code: string }> => {
    return await request<{ next_code: string }>('/machines/next-code');
  },

  getModels: async (): Promise<MachineModel[]> => {
    return await request<MachineModel[]>('/machines/models');
  },

  getById: async (id: string): Promise<Machine> => {
    return await request<Machine>(`/machines/${id}`);
  },

  create: async (machineData: any): Promise<Machine> => {
    return await request<Machine>('/machines', {
      method: 'POST',
      body: JSON.stringify(machineData),
    });
  },

  update: async (id: string, updatedFields: Partial<Machine>): Promise<Machine> => {
    return await request<Machine>(`/machines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedFields),
    });
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return await request<{ success: boolean; message: string }>(`/machines/${id}`, { method: 'DELETE' });
  },

  unassign: async (id: string): Promise<{ success: boolean; message: string; id: string }> => {
    return await request<{ success: boolean; message: string; id: string }>(`/machines/${id}/unassign`, {
      method: 'POST',
    });
  },
};

// ----------------------------------------------------------------------------
// DASHBOARD API (Live Dynamic Telemetry & Fleet Overview)
// ----------------------------------------------------------------------------
export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    return await request<DashboardStats>('/dashboard/stats');
  },
};


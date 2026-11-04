import type {
  Site,
  User,
  Organization,
  Machine,
  MachineModel,
  OrganizationCreateData,
  DashboardStats,
  UserInvitation,
  VerifyInvitationData,
  AcceptInvitationPayload,
} from '../types';

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
    let errorMsg = 'An error occurred';
    if (data?.detail) {
      if (typeof data.detail === 'string') {
        errorMsg = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      } else {
        errorMsg = JSON.stringify(data.detail);
      }
    } else if (data?.error) {
      errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    } else if (typeof data === 'string') {
      errorMsg = data;
    } else {
      errorMsg = `Request failed with status ${response.status}`;
    }
    throw new Error(errorMsg);
  }

  return (data || {}) as T;
}

// Authentication
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

  logout: async (): Promise<void> => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      tokenStorage.clear();
    }
  },
};

// Sites
export const sitesApi = {
  getAll: async (orgId?: string): Promise<Site[]> => {
    const url = orgId ? `/sites?organization_id=${encodeURIComponent(orgId)}` : '/sites';
    return await request<Site[]>(url);
  },

  create: async (siteData: any): Promise<Site> => {
    return await request<Site>('/sites', {
      method: 'POST',
      body: JSON.stringify(siteData),
    });
  },

  update: async (id: string, updatedFields: any): Promise<Site> => {
    return await request<Site>(`/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedFields),
    });
  },

  delete: async (id: string): Promise<void> => {
    await request<void>(`/sites/${id}`, {
      method: 'DELETE',
    });
  },
};

// Users
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

// Organizations
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

export interface SearchResultOrganization {
  id: string;
  organisation_code?: string;
  client_code?: string;
  company_name: string;
  business_type?: string;
  status?: string;
  email?: string;
}

export interface SearchResultSite {
  id: string;
  site_code: string;
  site_name: string;
  address: string;
  timezone?: string;
  is_active: boolean;
}

export interface SearchResultUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  phone_number?: string;
  location?: string;
}

export interface SearchResultMachine {
  id: string;
  machine_code?: string;
  serial_number?: string;
  model: string;
  location: string;
  status: string;
  temp: string;
}

export interface SearchResults {
  organizations: SearchResultOrganization[];
  sites: SearchResultSite[];
  users: SearchResultUser[];
  machines: SearchResultMachine[];
}

// Search
export const searchApi = {
  query: async (q: string): Promise<SearchResults> => {
    if (!q.trim()) {
      return { organizations: [], sites: [], users: [], machines: [] };
    }
    const res = await request<SearchResults>(`/search?q=${encodeURIComponent(q.trim())}`);
    return {
      organizations: res?.organizations || [],
      sites: res?.sites || [],
      users: res?.users || [],
      machines: res?.machines || [],
    };
  },
};

// Machines
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

// Dashboard
export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    return await request<DashboardStats>('/dashboard/stats');
  },
};

// Invitations
export const invitationsApi = {
  create: async (
    orgId: string,
    invitations: { email: string; role: string }[]
  ): Promise<{ success: boolean; invited_count: number; invitations: any[]; errors?: string[] }> => {
    return await request(`/organizations/${orgId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ invitations }),
    });
  },

  getAllByOrg: async (orgId: string): Promise<UserInvitation[]> => {
    return await request<UserInvitation[]>(`/organizations/${orgId}/invitations`);
  },

  list: async (orgId: string): Promise<UserInvitation[]> => {
    return await request<UserInvitation[]>(`/organizations/${orgId}/invitations`);
  },

  verify: async (token: string): Promise<VerifyInvitationData> => {
    return await request<VerifyInvitationData>(`/invitations/verify?token=${encodeURIComponent(token)}`);
  },

  accept: async (payload: AcceptInvitationPayload): Promise<{ token: string; user: User }> => {
    return await request<{ token: string; user: User }>('/invitations/accept', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};


import { API_BASE_URL } from '../../../config/apiConfig';

const ADMIN_BASE_URL = `${API_BASE_URL}/admin`;
const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const extractStaffList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.staff)) return payload.staff;
  if (Array.isArray(payload?.admins)) return payload.admins;
  if (Array.isArray(payload?.data?.staff)) return payload.data.staff;
  if (Array.isArray(payload?.data?.admins)) return payload.data.admins;
  return [];
};

export const loginAdmin = async (email, password) => {
  const response = await fetch(`${ADMIN_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Login failed');
  }
  return data;
};

export const getProfile = async (token) => {
  const response = await fetch(`${ADMIN_BASE_URL}/profile`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch profile');
  }
  return data;
};

export const updateProfile = async (token, profileData) => {
  const isFormData = profileData instanceof FormData;

  const headers = {
    'Authorization': `Bearer ${token}`,
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${ADMIN_BASE_URL}/profile`, {
    method: 'PUT',
    headers,
    body: isFormData ? profileData : JSON.stringify(profileData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update profile');
  }
  return data;
};

export const getAllStaff = async (token, params = {}, options = {}) => {
  const response = await fetch(`${ADMIN_BASE_URL}/staff${buildQuery(params)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch staff');
  const staff = extractStaffList(data);
  if (options.paginated) {
    const pagination = data?.pagination || {};
    return {
      staff,
      pagination: {
        total: Number(pagination.total ?? response.headers.get('x-total-count') ?? 0),
        page: Number(pagination.page ?? response.headers.get('x-page') ?? params.page ?? 1),
        limit: Number(pagination.limit ?? response.headers.get('x-limit') ?? params.limit ?? 10),
        totalPages: Number(pagination.totalPages ?? response.headers.get('x-total-pages') ?? 1)
      }
    };
  }
  return staff;
};

export const createStaff = async (token, staffData) => {
  const response = await fetch(`${ADMIN_BASE_URL}/staff`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(staffData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create staff');
  return data;
};

export const updateStaff = async (token, id, staffData) => {
  const response = await fetch(`${ADMIN_BASE_URL}/staff/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(staffData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update staff');
  return data;
};

export const deleteStaff = async (token, id) => {
  const response = await fetch(`${ADMIN_BASE_URL}/staff/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to delete staff');
  return data;
};

export const forgotAdminPassword = async (email) => {
  const response = await fetch(`${ADMIN_BASE_URL}/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, portal: 'admin' }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to send reset link');
  }
  return data;
};

export const resetAdminPassword = async (token, password) => {
  const response = await fetch(`${ADMIN_BASE_URL}/reset-password/${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to reset password');
  }
  return data;
};

export const getDashboardStats = async (token) => {
  const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch dashboard stats');
  return data;
};

export const getLowStockAlerts = async (token, params = {}) => {
  const query = buildQuery(params);
  const response = await fetch(`${API_BASE_URL}/admin/products/inventory/low-stock${query}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch stock alerts');
  return data;
};

export const quickRestockProduct = async (token, productId, payload) => {
  const response = await fetch(`${API_BASE_URL}/admin/products/${productId}/quick-restock`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to restock product');
  return data;
};


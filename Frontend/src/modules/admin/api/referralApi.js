import axios from 'axios';
import { API_BASE_URL } from '../../../config/apiConfig';

const API_URL = `${API_BASE_URL}/admin/referrals`;

const readTokenFromStorage = () => {
  const keys = [
    'saathigro_admin',
    'saathigro_staff',
    'saathigro_manager'
  ];

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.token) return parsed.token;
    } catch {
      // Ignore malformed localStorage values.
    }
  }

  return null;
};

const getHeaders = (token) => {
  const authToken = token || readTokenFromStorage();
  if (!authToken) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${authToken}` };
};

export const getReferralSettings = async (token = null) => {
  const response = await axios.get(`${API_URL}/settings`, {
    headers: getHeaders(token)
  });
  return response.data?.settings || response.data;
};

export const updateReferralSettings = async (token, settingsData) => {
  const response = await axios.put(`${API_URL}/settings`, settingsData, {
    headers: getHeaders(token)
  });
  return response.data?.settings || response.data;
};

export const getReferralAnalytics = async (token = null) => {
  const response = await axios.get(`${API_URL}/analytics`, {
    headers: getHeaders(token)
  });
  return response.data?.analytics || response.data;
};

export const getReferralsList = async (token = null, params = {}) => {
  const response = await axios.get(`${API_URL}/list`, {
    headers: getHeaders(token),
    params
  });
  return response.data;
};

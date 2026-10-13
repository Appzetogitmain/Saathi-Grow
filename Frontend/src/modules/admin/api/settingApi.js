import axios from 'axios';
import { API_BASE_URL } from '../../../config/apiConfig';

const API_URL = `${API_BASE_URL}/settings`;

const readTokenFromStorage = () => {
  const keys = [
    'saathigro_admin',
    'saathigro_staff',
    'saathigro_staff',
    'saathigro_manager',
    'saathigro_manager'
  ];

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.token) return parsed.token;
    } catch (error) {
      // Ignore malformed localStorage values.
    }
  }

  return null;
};

export const getAdminSettings = async (token = null) => {
  const authToken = token || readTokenFromStorage();
  if (!authToken) throw new Error('Not authenticated');

  const response = await axios.get(API_URL, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  return response.data;
};

export const updateAdminSettings = async (token, settingsData) => {
  const authToken = token || readTokenFromStorage();
  if (!authToken) throw new Error('Not authenticated');

  const response = await axios.put(API_URL, settingsData, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  return response.data;
};

export const getPublicSettings = async () => {
  const response = await axios.get(`${API_URL}/public`);
  return response.data;
};

export const uploadPopupBannerImage = async (token, file) => {
  const authToken = token || readTokenFromStorage();
  if (!authToken) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('image', file);

  const response = await axios.post(`${API_URL}/upload-popup-image`, formData, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

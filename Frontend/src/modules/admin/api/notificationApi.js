import { API_BASE_URL } from '../../../config/apiConfig';

export const sendNotification = async (token, data) => {
  const form = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.append(key === 'imageFile' ? 'image' : key, value);
  });
  const response = await fetch(`${API_BASE_URL}/notifications/admin/send`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form
  });
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.message || 'Failed to send notification');
  return resData;
};

export const getNotificationHistory = async (token, page = 1, limit = 10) => {
  const response = await fetch(`${API_BASE_URL}/notifications/admin/history?page=${page}&limit=${limit}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.message || 'Failed to fetch history');
  return resData;
};

export const getMyNotifications = async (token, page = 1, limit = 20) => {
  const response = await fetch(`${API_BASE_URL}/notifications/my?page=${page}&limit=${limit}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.message || 'Failed to fetch notifications');
  return resData;
};

export const markAsRead = async (token, id) => {
  const response = await fetch(`${API_BASE_URL}/notifications/read/${id}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

export const markAllRead = async (token) => {
  const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

export const deleteNotifications = async (token, ids) => {
  const response = await fetch(`${API_BASE_URL}/notifications/delete`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids })
  });
  return response.json();
};

export const searchRecipients = async (token, q, type) => {
  const response = await fetch(`${API_BASE_URL}/notifications/admin/search?q=${q}&type=${type}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.message || 'Failed to search recipients');
  return resData;
};

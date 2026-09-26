import axios from 'axios';
import { API_BASE_URL } from '../../../config/apiConfig';

const API_URL = `${API_BASE_URL}`;

// Helper to get the admin token from localStorage (same pattern as adminDeliveryApi.js)
const getToken = () => {
  const admin = localStorage.getItem('saathigro_admin');
  const manager = localStorage.getItem('saathigro_manager');
  if (admin) return JSON.parse(admin)?.token;
  if (manager) return JSON.parse(manager)?.token;
  return null;
};

const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// Public: get active slots for checkout (legacy)
export const getDeliverySlots = async () => {
  const { data } = await axios.get(`${API_URL}/delivery-slots`);
  return data;
};

// Public: get multi-day delivery availability (dates, slots, capacity, holidays)
export const getAvailableDeliveryDays = async (days = 5) => {
  const { data } = await axios.get(`${API_URL}/delivery-slots/available-days`, {
    params: { days }
  });
  return data;
};

// Admin: get all slots (active + inactive)
export const getAdminDeliverySlots = async () => {
  const { data } = await axios.get(`${API_URL}/delivery-slots/admin`, {
    headers: authHeaders()
  });
  return data;
};

// Admin: create a new slot
export const createDeliverySlot = async (slotData) => {
  const { data } = await axios.post(`${API_URL}/delivery-slots/admin`, slotData, {
    headers: authHeaders()
  });
  return data;
};

// Admin: update existing slot
export const updateDeliverySlot = async (id, slotData) => {
  const { data } = await axios.put(`${API_URL}/delivery-slots/admin/${id}`, slotData, {
    headers: authHeaders()
  });
  return data;
};

// Admin: delete slot
export const deleteDeliverySlot = async (id) => {
  const { data } = await axios.delete(`${API_URL}/delivery-slots/admin/${id}`, {
    headers: authHeaders()
  });
  return data;
};

// ==========================================
// Phase 8: Holiday Management APIs
// ==========================================

// Admin: get all holidays
export const getAdminHolidays = async () => {
  const { data } = await axios.get(`${API_URL}/delivery-slots/admin/holidays`, {
    headers: authHeaders()
  });
  return data;
};

// Admin: add holiday
export const addAdminHoliday = async (holidayData) => {
  const { data } = await axios.post(`${API_URL}/delivery-slots/admin/holidays`, holidayData, {
    headers: authHeaders()
  });
  return data;
};

// Admin: delete holiday
export const deleteAdminHoliday = async (date) => {
  const { data } = await axios.delete(`${API_URL}/delivery-slots/admin/holidays/${encodeURIComponent(date)}`, {
    headers: authHeaders()
  });
  return data;
};

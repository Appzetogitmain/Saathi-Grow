import { API_BASE_URL } from '../../../config/apiConfig';
import axios from 'axios';

const API_URL = `${API_BASE_URL}/orders`;

export const createRazorpayOrder = async (token, items, promoId = null, storeId = null, storeType = null, deliveryTiming = {}) => {
  const response = await fetch(`${API_URL}/razorpay`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ items, promoId, storeId, storeType, ...deliveryTiming })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create Razorpay secure window');
  return data;
};

export const calculateBill = async (token, items, storeInfo = null, promoId = null, deliveryTiming = {}) => {
  const body = { items, ...deliveryTiming };
  if (storeInfo) {
    body.storeId = storeInfo.storeId;
    body.storeType = storeInfo.storeType;
  }
  if (promoId) {
    body.promoId = promoId;
  }

  const response = await fetch(`${API_URL}/calculate-bill`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to calculate secure bill summary');
  return data;
};

export const validatePromoCode = async (token, code, totalAmount) => {
  const response = await fetch(`${API_BASE_URL}/promocodes/validate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code, totalAmount })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Invalid promo code');
  return data;
};

export const getApplicablePromos = async (token, totalAmount) => {
  const response = await fetch(`${API_BASE_URL}/promocodes/applicable`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ totalAmount })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch offers');
  return data;
};

export const getUpsellingPromos = async (token, subTotal) => {
  const response = await fetch(`${API_BASE_URL}/promocodes/upselling`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ subTotal })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch upselling offers');
  return data;
};

export const verifyRazorpayPayment = async (token, paymentPayload) => {
  const response = await fetch(`${API_URL}/verify`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(paymentPayload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to verify exact transaction logic');
  return data;
};

export const createCODOrder = async (token, orderData) => {
  const response = await fetch(`${API_URL}/cod`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderData })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to generate COD order layout');
  return data;
};

export const createWalletOrder = async (token, orderData) => {
  const response = await fetch(`${API_URL}/wallet`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderData })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to process wallet payment');
  return data;
};

export const fetchMyOrders = async (token) => {
  const response = await fetch(`${API_URL}/myorders`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Can't load transaction history currently");
  return data;
};

export const fetchOrderDetails = async (token, orderId) => {
  const response = await fetch(`${API_URL}/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Error syncing single historical layout');
  return data;
};

export const cancelOrder = async (token, orderId, reason) => {
  try {
    const { data } = await axios.post(`${API_URL}/${orderId}/cancel`, { reason }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to cancel order secure layout');
  }
};

export const submitReturnRequest = async (token, orderId, formData) => {
  try {
    const { data } = await axios.post(`${API_URL}/${orderId}/return`, formData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to submit return request');
  }
};

export const fetchOrderRoute = async (token, orderId, lat = null, lng = null) => {
  let url = `${API_URL}/${orderId}/route`;
  if (lat !== null && lng !== null) {
    url += `?lat=${lat}&lng=${lng}`;
  }

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch road directions');
  return data;
};

export const fetchDeliverySlots = async () => {
  const response = await fetch(`${API_BASE_URL}/delivery-slots`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch delivery slots');
  return data;
};

export const fetchAvailableDeliveryDays = async (days = 5) => {
  const response = await fetch(`${API_BASE_URL}/delivery-slots/available-days?days=${days}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch delivery availability');
  return data;
};

// ─── TAG API ──────────────────────────────────────────────────────────────────

export const setOrderTag = async (token, orderId, tag) => {
  const { data } = await axios.put(`${API_URL}/${orderId}/tag`, { tag }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const removeOrderTag = async (token, orderId) => {
  const { data } = await axios.delete(`${API_URL}/${orderId}/tag`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getUserTags = async (token) => {
  const { data } = await axios.get(`${API_URL}/tags`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getOrdersByTag = async (token, tag, page = 1) => {
  const { data } = await axios.get(`${API_URL}/by-tag/${encodeURIComponent(tag)}`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { page, limit: 20 }
  });
  return data;
};

export const submitOrderFeedback = async (token, orderId, rating, comment) => {
  const { data } = await axios.post(`${API_URL}/${orderId}/feedback`, { rating, comment }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

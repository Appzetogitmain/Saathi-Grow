import { API_BASE_URL } from '../../../config/apiConfig';

const API_URL = `${API_BASE_URL}/auth`;

/**
 * Request OTP for login or registration
 * @param {string} phone - 10 digit phone number
 * @param {string} type - 'login' or 'register'
 */
export const requestOTP = async (phone, type) => {
  const payload = { phone };
  if (type) payload.type = type;
  const response = await fetch(`${API_URL}/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to send OTP');
  return data;
};

/**
 * Verify OTP and authenticate
 * @param {object} credentials - { phone, otp, name, email, referralCode }
 */
export const verifyOTP = async (credentials) => {
  const response = await fetch(`${API_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Invalid OTP');
  return data;
};

/**
 * Resend OTP to phone
 * @param {string} phone 
 */
export const resendOTP = async (phone) => {
  const response = await fetch(`${API_URL}/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to resend OTP');
  return data;
};

/**
 * Get current user profile
 * @param {string} token 
 */
export const getProfile = async (token) => {
  const response = await fetch(`${API_URL}/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch profile');
  return data;
};

/**
 * Update user profile
 * @param {string} token 
 * @param {FormData} formData - Profile data including optional image
 */
export const updateProfile = async (token, formData) => {
  const response = await fetch(`${API_URL}/profile`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData // Note: Don't set Content-Type for FormData
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update profile');
  return data;
};

/**
 * Complete first-time customer registration
 * @param {string} token
 * @param {object} payload - { name, email }
 */
export const completeRegistration = async (token, { name, email }) => {
  const response = await fetch(`${API_URL}/complete-registration`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name, email })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to complete registration');
  return data;
};


import { API_BASE_URL } from '../../../config/apiConfig';

const API_URL = `${API_BASE_URL}/referrals`;

export const fetchMyReferralDashboard = async (token) => {
  const response = await fetch(`${API_URL}/my-dashboard`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to load referral dashboard');
  return data.data;
};

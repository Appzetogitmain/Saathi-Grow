import axios from 'axios';
import { API_BASE_URL } from '../../../config/apiConfig';

const REPORT_BASE_URL = `${API_BASE_URL}/admin/reports`;

export const getSalesReports = async (token, params = {}) => {
  try {
    const response = await axios.get(`${REPORT_BASE_URL}/sales`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const exportSalesCSV = async (token, params = {}) => {
  try {
    const response = await axios.get(`${REPORT_BASE_URL}/sales/export`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getInventoryReports = async (token, params = {}) => {
  try {
    const response = await axios.get(`${REPORT_BASE_URL}/inventory`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const exportInventoryCSV = async (token, params = {}) => {
  try {
    const response = await axios.get(`${REPORT_BASE_URL}/inventory/export`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getVendorReports = async (token, params = {}) => {
  try {
    const response = await axios.get(`${REPORT_BASE_URL}/vendors`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const exportVendorCSV = async (token, params = {}) => {
  try {
    const response = await axios.get(`${REPORT_BASE_URL}/vendors/export`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
export const getRevenueAnalytics = async (token, params = {}) => {
  try {
    const response = await axios.get(`${REPORT_BASE_URL}/revenue-analytics`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
export const getAdminVendorEarnings = async (token, params = {}) => {
  try {
    const response = await axios.get(`${REPORT_BASE_URL}/vendor-earnings`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
export const getAdminVendorPayoutDetail = async (token, id) => {
  try {
    const response = await axios.get(`${REPORT_BASE_URL}/vendor-payouts/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const exportVendorEarningsCSV = async (token, params = {}) => {
  try {
    const response = await axios.get(`${REPORT_BASE_URL}/vendor-earnings/export`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
export const getStrategicAnalytics = async (token, params = {}) => {
  try {
    const response = await axios.get(`${REPORT_BASE_URL}/strategic-analytics`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getSearchAnalytics = async (token, params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/search-logs`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const exportSearchAnalyticsExcel = async (token, params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/search-logs/export`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

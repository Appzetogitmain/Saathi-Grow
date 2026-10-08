import { API_BASE_URL } from '../../../config/apiConfig';

export const fetchCategories = async () => {
  // Show all active admin categories on user UI (even if products are not mapped yet).
  const response = await fetch(`${API_BASE_URL}/admin/categories?status=Active`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch categories');
  return data;
};

export const fetchSubCategories = async (category = '') => {
  const url = `${API_BASE_URL}/admin/subcategories${category ? `?category=${category}&status=Active` : '?status=Active'}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch subcategories');
  return data;
};

export const fetchProducts = async (params = {}) => {
  // Enforce location/store scoping for user storefront requests.
  // Many callers pass activeStoreId/activeStoreType; backend hard filtering expects storeId/storeType + hardFilter=true.
  const normalizedParams = { ...params };
  if (!normalizedParams.storeId && normalizedParams.activeStoreId) {
    normalizedParams.storeId = normalizedParams.activeStoreId;
  }
  if (!normalizedParams.storeType && normalizedParams.activeStoreType) {
    normalizedParams.storeType = normalizedParams.activeStoreType;
  }

  // No in-range store → do not show products from other areas
  if (!normalizedParams.storeId && !normalizedParams.skipStoreScope) {
    return { products: [], page: 1, pages: 0, total: 0 };
  }

  if (normalizedParams.storeId && !normalizedParams.hardFilter) {
    normalizedParams.hardFilter = 'true';
  }

  // Sanitize params: remove undefined, null, or empty string values
  const sanitizedParams = Object.keys(normalizedParams).reduce((acc, key) => {
    const val = normalizedParams[key];
    if (val !== undefined && val !== null && val !== '' && key !== 'skipStoreScope') {
      acc[key] = val;
    }
    return acc;
  }, {});
  
  const query = new URLSearchParams(sanitizedParams).toString();
  const response = await fetch(`${API_BASE_URL}/admin/products?${query}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch products');
  return data;
};

export const fetchBrands = async (category = '') => {
  const url = `${API_BASE_URL}/admin/products/brands${category ? `?category=${category}` : ''}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch brands');
  return data;
};

export const fetchBrandByName = async (name) => {
  const response = await fetch(`${API_BASE_URL}/admin/brands/public/name/${encodeURIComponent(name)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch brand details');
  return data;
};

export const fetchProductById = async (id, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}/admin/products/${id}?${query}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch product');
  return data;
};

export const fetchActiveCampaigns = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}/admin/campaigns/public?${query}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch campaigns');
  return data;
};

export const fetchCampaignMetadata = async (id) => {
  const response = await fetch(`${API_BASE_URL}/admin/campaigns/public/${id}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch campaign metadata');
  return data;
};

export const fetchActiveOfferDeals = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}/admin/offer-deals/public?${query}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch active offers');
  return data;
};

export const fetchCampaignProducts = async (id, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}/admin/campaigns/public/${id}/products?${query}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch campaign products');
  return data;
};

export const fetchOfferProducts = async (id, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}/admin/offer-deals/public/${id}/products?${query}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch offer products');
  return data;
};
export const searchProducts = async (query = '', page = 1, storeParams = {}, signal = null) => {
  const params = new URLSearchParams({ q: query, page });
  Object.entries(storeParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/products/search?${params.toString()}`, { signal });
    if (response.ok) {
      const data = await response.json();
      if (data.products?.length) return data;
    }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error;
  }

  // The catalog endpoint remains a useful fallback when the relevance index has
  // no candidates for a brand or the search service is temporarily unavailable.
  const fallbackParams = new URLSearchParams({ search: query, page, status: 'Active,Low Stock,Out of Stock' });
  Object.entries(storeParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') fallbackParams.append(key, value);
  });
  // Search remains discoverable when the selected store does not carry the item.
  // The product card uses store availability to prevent unavailable purchases.
  const fallbackResponse = await fetch(`${API_BASE_URL}/admin/products?${fallbackParams.toString()}`, { signal });
  const fallbackData = await fallbackResponse.json();
  if (!fallbackResponse.ok) throw new Error(fallbackData.message || 'Failed to search products');
  return fallbackData;
};

export const searchProductsWithAI = async (query = '', page = 1, storeParams = {}, signal = null) => {
  const params = new URLSearchParams({ q: query, page, isAI: 'true', ...storeParams }).toString();
  const response = await fetch(`${API_BASE_URL}/admin/products/search/ai?${params}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed AI search');
  return data;
};

export const getReverseGeocode = async (lat, lng) => {
  const url = `${API_BASE_URL}/user/stores/reverse-geocode?lat=${lat}&lng=${lng}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to reverse geocode');
  return data;
};

export const getNearbyStores = async (lat, lng, radius) => {
  const url = `${API_BASE_URL}/user/stores/nearby?lat=${lat}&lng=${lng}${radius ? `&radius=${radius}` : ''}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch nearby stores');
  return data;
};

export const stockAlertRequest = async (productId, scope, token, method = 'GET') => {
  const query = new URLSearchParams(scope).toString();
  const response = await fetch(`${API_BASE_URL}/admin/products/${productId}/stock-alert${method === 'GET' ? `?${query}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
    ...(method === 'GET' ? {} : { body: JSON.stringify(scope) })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Could not update stock alert');
  return data;
};

export const logDemandRequest = async (payload, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/demand`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to log demand');
  return data;
};

export const fetchPublicSettings = async () => {
  const response = await fetch(`${API_BASE_URL}/settings/public`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch settings');
  return data;
};

export const fetchProductReviews = async (productId, page = 1, limit = 10) => {
  const response = await fetch(`${API_BASE_URL}/reviews/product/${productId}?page=${page}&limit=${limit}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch reviews');
  return data;
};

export const submitProductReview = async (payload, token) => {
  const response = await fetch(`${API_BASE_URL}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to submit review');
  return data;
};

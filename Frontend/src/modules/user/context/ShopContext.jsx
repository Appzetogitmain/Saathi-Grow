import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchCategories, fetchProducts, fetchActiveCampaigns, fetchActiveOfferDeals, fetchPublicSettings } from '../api/shopApi';
import { useStore } from './StoreContext';
import { useCart } from './CartContext';
import { toast } from 'react-toastify';
import { readShopCache, hasShopCache, writeShopCache } from '../utils/shopCache';

const ShopContext = createContext();
const ShopUIContext = createContext();

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};

export const useShopUI = () => {
  const context = useContext(ShopUIContext);
  if (!context) {
    throw new Error('useShopUI must be used within a ShopProvider');
  }
  return context;
};

export const ShopProvider = ({ children }) => {
  const [categories, setCategories] = useState(() => readShopCache('shop_categories'));
  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState(() => readShopCache('shop_campaigns'));
  const [offers, setOffers] = useState(() => readShopCache('shop_offers'));
  const [loading, setLoading] = useState(() => !hasShopCache('shop_categories'));
  const [error, setError] = useState(null);
  const { activeStore } = useStore();
  const { clearCart } = useCart();
  const [lastStoreId, setLastStoreId] = useState(activeStore?.id);

  const [settings, setSettings] = useState(null);
  const [settingsRefreshing, setSettingsRefreshing] = useState(false);
  const settingsRequest = useRef(null);
  const mounted = useRef(true);
  const refreshSettings = useCallback(() => {
    if (settingsRequest.current) return settingsRequest.current;
    setSettingsRefreshing(true);
    settingsRequest.current = fetchPublicSettings().then(data => {
      if (mounted.current) setSettings(data);
      return data;
    }).catch(error => {
      console.error('Public settings refresh failed:', error);
      return null;
    }).finally(() => {
      settingsRequest.current = null;
      if (mounted.current) setSettingsRefreshing(false);
    });
    return settingsRequest.current;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const refresh = () => { if (document.visibilityState !== 'hidden') void refreshSettings(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = setInterval(refresh, 60_000);
    return () => {
      mounted.current = false;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(timer);
    };
  }, [refreshSettings]);

  const refreshShopData = useCallback(async (showLoading = true) => {
    // Only show full page loading if we don't have categories yet
    const hasCachedData = hasShopCache('shop_categories');
    if (showLoading && !hasCachedData) setLoading(true);
    try {
      const fetchParams = activeStore ? { storeId: activeStore.id, storeType: activeStore.type } : {};
      const [categoriesData, campaignsData, offersData] = await Promise.all([
        fetchCategories(),
        fetchActiveCampaigns(fetchParams).catch(() => []),
        fetchActiveOfferDeals(fetchParams).catch(() => []),
        refreshSettings()
      ]);
      setCategories(categoriesData);
      writeShopCache('shop_categories', categoriesData);
      
      setProducts([]); // No longer needed for home page mapping
      
      setCampaigns(campaignsData);
      writeShopCache('shop_campaigns', campaignsData);

      // Filter offers that are isActive and not expired
      const now = new Date();
      const filteredOffers = (offersData || []).filter(o => 
        o.isActive && (!o.expiryDate || new Date(o.expiryDate) > now)
      );
      setOffers(filteredOffers);
      writeShopCache('shop_offers', filteredOffers);
      
      setError(null);
    } catch (err) {
      console.error('Error fetching shop data:', err);
      setError(err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeStore, refreshSettings]);

  // Watch for store changes to clear cart and refresh data
  useEffect(() => {
    if (activeStore?.id !== lastStoreId) {
      if (lastStoreId && activeStore?.id) {
        // Only clear cart if it was a real switch between two different stores
        clearCart();
      }
      setLastStoreId(activeStore?.id);
      refreshShopData();
    }
  }, [activeStore?.id]);

  useEffect(() => {
    refreshShopData();
  }, []);

  const getProductsByCategory = useCallback((categoryName) => {
    if (!categoryName) return [];
    return products.filter(p =>
      p.category === categoryName ||
      p.category?.toLowerCase() === categoryName?.toLowerCase()
    );
  }, [products]);

  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [activePromotion, setActivePromotion] = useState(null);

  const uiContextValue = useMemo(() => ({
    isBottomSheetOpen,
    setIsBottomSheetOpen,
    activePromotion,
    setActivePromotion
  }), [isBottomSheetOpen, activePromotion]);

  const contextValue = useMemo(() => ({
    categories,
    products,
    campaigns,
    offers,
    loading,
    error,
    settings,
    settingsRefreshing,
    refreshSettings,
    refreshShopData,
    getProductsByCategory
  }), [
    categories, products, campaigns, offers, loading, error, settings, settingsRefreshing, refreshSettings,
    refreshShopData, getProductsByCategory
  ]);

  return (
    <ShopContext.Provider value={contextValue}>
      <ShopUIContext.Provider value={uiContextValue}>
        {children}
      </ShopUIContext.Provider>
    </ShopContext.Provider>
  );
};

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Filter, ChevronDown, Search, X, ShoppingBag, LayoutGrid, ListFilter } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useStore } from '../../context/StoreContext';
import { fetchCampaignMetadata, fetchProducts } from '../../api/shopApi';
import { normalizeProduct } from '../home/HomePage';
import { useShop, useShopUI } from '../../context/ShopContext';
import ProductCard from '../../components/product/ProductCard';
import { toast } from 'react-toastify';
import SEO from '../../../../common/components/SEO';

const CampaignProductsPage = () => {
  const { campaignId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { activeStore } = useStore();
  const { setIsBottomSheetOpen } = useShopUI();

  const [campaign, setCampaign] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || '-createdAt');
  const [isVegOnly, setIsVegOnly] = useState(searchParams.get('isVeg') === 'true');

  // Fetch Campaign Metadata
  useEffect(() => {
    const getMetadata = async () => {
      try {
        const data = await fetchCampaignMetadata(campaignId);
        setCampaign(data);
      } catch (err) {
        console.error("Failed to fetch campaign metadata:", err);
        toast.error("Campaign not found");
        navigate('/');
      }
    };
    getMetadata();
  }, [campaignId, navigate]);

  // Fetch Products
  const loadProducts = useCallback(async (pageNum = 1, shouldAppend = false) => {
    if (!campaignId) return;

    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = {
        campaignId,
        page: pageNum,
        limit: 20,
        search: searchQuery,
        sort: sortBy,
        storeId: activeStore?.id,
        storeType: activeStore?.type,
        status: ['Active', 'Low Stock', 'Out of Stock']
      };

      if (isVegOnly) params.isVeg = true;

      const data = await fetchProducts(params);
      const normalized = (data.products || []).map(normalizeProduct);

      if (shouldAppend) {
        setProducts(prev => [...prev, ...normalized]);
      } else {
        setProducts(normalized);
      }

      setTotalPages(data.pages || 1);
      setTotalItems(data.total || 0);
      setPage(data.page || pageNum);
    } catch (err) {
      console.error("Failed to load campaign products:", err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [campaignId, searchQuery, sortBy, isVegOnly, activeStore]);

  const hasMore = page < totalPages;

  // Initial Load & Filter Changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(1, false);
    }, 300); // debounce search/filter
    return () => clearTimeout(timer);
  }, [loadProducts]);

  useEffect(() => {
    setIsBottomSheetOpen(showFilters);
    return () => setIsBottomSheetOpen(false);
  }, [showFilters, setIsBottomSheetOpen]);

  const handleLoadMore = () => {
    if (page < totalPages) {
      loadProducts(page + 1, true);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    const newParams = new URLSearchParams(searchParams);
    if (val) newParams.set('q', val);
    else newParams.delete('q');
    setSearchParams(newParams);
  };

  const toggleVeg = () => {
    const newVal = !isVegOnly;
    setIsVegOnly(newVal);
    const newParams = new URLSearchParams(searchParams);
    if (newVal) newParams.set('isVeg', 'true');
    else newParams.delete('isVeg');
    setSearchParams(newParams);
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', newSort);
    setSearchParams(newParams);
    setShowFilters(false);
  };

  const themeColor = campaign?.accentColor || '#0c831f';
  const bgColor = campaign?.bgColor || '#ffffff';

  return (
    <div className="min-h-screen pb-20 bg-white dark:bg-black transition-colors duration-300">
      <style dangerouslySetInnerHTML={{ __html: `
        .back-btn-clear, .back-btn-clear:hover, .back-btn-clear:active {
            background: transparent !important;
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }
        .shop-pill-btn {
            border-radius: 9999px !important;
        }
      ` }} />
      <SEO 
        title={campaign?.title || 'Campaign'} 
        description={campaign?.subtitle || `Explore the finest selection of ${campaign?.title || 'products'} at SaathiGro.`}
        schemaData={{
          "@context": "https://schema.org/",
          "@type": "CollectionPage",
          "name": campaign?.title,
          "description": campaign?.subtitle
        }}
      />
      {/* Compact Campaign Header */}
      <div
        className="relative z-50 transition-all duration-300 border-b border-gray-50 dark:border-white/5"
        style={{ backgroundColor: isDarkMode ? '#000000' : bgColor }}
      >
        <div className="pt-3 pb-1.5 px-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="back-btn-clear p-2 text-gray-800 dark:text-gray-200 active:scale-90 transition-all"
          >
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black tracking-tight line-clamp-1" style={{ color: isDarkMode ? '#ffffff' : themeColor }}>
              {campaign?.title || 'Loading...'}
            </h1>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 capitalize">
              {totalItems} items matching your choice
            </p>
          </div>
        </div>

        {/* Compact Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search size={16} className="text-gray-400 group-focus-within:text-[var(--saathi-green)] transition-colors" />
            </div>
            <input
              type="text"
              placeholder={`Search in ${campaign?.title}...`}
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-zinc-900 rounded-full text-[13px] font-bold text-gray-900 dark:text-white border-2 border-transparent focus:border-[var(--saathi-green)] transition-all outline-none shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); const np = new URLSearchParams(searchParams); np.delete('q'); setSearchParams(np); }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <X size={16} className="text-gray-400 hover:text-gray-600 transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Filter Chips */}
        <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-hide lg-scrollbar-show">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`shop-pill-btn flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black tracking-wide border transition-all whitespace-nowrap ${showFilters ? 'bg-black text-white border-black' : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-300 shadow-sm'}`}
          >
            {sortBy === '-createdAt' ? 'Newest' : sortBy === 'basePrice' ? 'Price: Low' : 'Price: High'}
            <ChevronDown size={14} className={showFilters ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>

          <button
            onClick={toggleVeg}
            className={`shop-pill-btn flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black tracking-wide border transition-all whitespace-nowrap ${isVegOnly ? 'bg-green-600 text-white border-green-600 shadow-md shadow-green-500/10' : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-300 shadow-sm'}`}
          >
            <div className={`w-3 h-3 rounded-full border-2 ${isVegOnly ? 'border-white bg-white' : 'border-green-600 bg-transparent'} flex items-center justify-center`}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-600"></div>
            </div>
            Veg Only
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6">
        {loading && page === 1 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
              <div key={i} className="animate-pulse flex flex-col gap-3">
                <div className="aspect-square bg-gray-100 dark:bg-zinc-900 rounded-3xl w-full"></div>
                <div className="h-4 bg-gray-100 dark:bg-zinc-900 rounded w-3/4"></div>
                <div className="h-3 bg-gray-100 dark:bg-zinc-900 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-24 h-24 bg-gray-50 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6">
              <ShoppingBag size={48} className="text-gray-200 dark:text-zinc-800" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">No Items Found</h3>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 max-w-xs">
              We couldn't find any products matching your criteria in this campaign.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setIsVegOnly(false); }}
              className="mt-6 px-8 py-3 bg-[var(--saathi-green)] text-white text-sm font-black rounded-2xl shadow-lg ring-4 ring-[var(--saathi-green)]/10"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-8 gap-x-4 md:gap-6">
            {products.map(product => (
              <ProductCard
                key={product._id || product.id}
                product={product}
                customTheme={{
                  themeColor: isDarkMode ? '#f7cb15' : themeColor,
                  bgColor: isDarkMode ? '' : bgColor
                }}
              />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-12 mb-8 flex flex-col items-center gap-4">
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Showing {products.length} of {totalItems} items
            </div>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="group relative flex items-center gap-3 px-10 py-4 bg-white dark:bg-black rounded-2xl border-2 border-gray-100 dark:border-white/10 shadow-xl hover:shadow-2xl active:scale-95 transition-all disabled:opacity-50"
            >
              {loadingMore ? (
                <div className="w-5 h-5 border-3 border-[var(--saathi-green)] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <LayoutGrid size={20} className="text-[var(--saathi-green)] group-hover:rotate-12 transition-transform" />
              )}
              <span className="text-sm font-black text-gray-900 dark:text-white">
                {loadingMore ? 'Fetching...' : 'Show More Results'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Sort/Filter Modal Backdrop */}
      {showFilters && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-[40px] p-8 shadow-2xl animate-in slide-in-from-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full mx-auto mb-8"></div>

            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <ListFilter size={24} className="text-[var(--saathi-green)]" />
                Sort By
              </h3>
              <button onClick={() => setShowFilters(false)} className="p-2 rounded-xl bg-gray-50 dark:bg-zinc-800">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Newest First', value: '-createdAt' },
                { label: 'Price: Low to High', value: 'basePrice' },
                { label: 'Price: High to Low', value: '-basePrice' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSortChange(opt.value)}
                  className={`w-full flex items-center justify-between p-5 rounded-3xl border-2 transition-all ${sortBy === opt.value ? 'bg-[var(--saathi-green)]/5 border-[var(--saathi-green)]' : 'bg-transparent border-gray-100 dark:border-white/5'}`}
                >
                  <span className={`text-sm font-black transition-colors ${sortBy === opt.value ? 'text-[var(--saathi-green)]' : 'text-gray-700 dark:text-gray-300'}`}>
                    {opt.label}
                  </span>
                  {sortBy === opt.value && (
                    <div className="w-3 h-3 rounded-full bg-[var(--saathi-green)]"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignProductsPage;

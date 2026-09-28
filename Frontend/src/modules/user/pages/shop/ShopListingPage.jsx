import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useShop } from '../../context/ShopContext';
import { fetchProducts, fetchBrandByName } from '../../api/shopApi';
import ProductCard from '../../components/product/ProductCard';
import { ChevronLeft, Search, X, SlidersHorizontal, Leaf, MapPin, Star } from 'lucide-react';
import { ProductCardSkeleton } from '../../components/common/Skeleton';
import { useStore } from '../../context/StoreContext';
import { ASSET_URLS } from '../../../../constants/assetUrls';
import SEO from '../../../../common/components/SEO';
import { normalizeProduct } from '../home/HomePage';

const placeholder = ASSET_URLS.placeholder;

const ShopListingPage = ({ type }) => {
    const { brandName, storeId, storeType: urlStoreType } = useParams();
    const navigate = useNavigate();
    const { activeStore } = useStore();

    // Local State
    const [pageProducts, setPageProducts] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [localSearch, setLocalSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [sortOption, setSortOption] = useState('-createdAt');
    const [isVegOnly, setIsVegOnly] = useState(false);
    const [shopInfo, setShopInfo] = useState(null);
    
    // Refs for synchronization
    const lastFetchRef = useRef('');
    const fetchingRef = useRef(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(localSearch), 500);
        return () => clearTimeout(timer);
    }, [localSearch]);

    // Build params for API function
    const buildFetchParams = useCallback((pageNum) => {
        const currentStoreId = type === 'store' ? storeId : activeStore?.id;
        const currentStoreType = type === 'store' ? urlStoreType : activeStore?.type;

        return {
            page: pageNum,
            limit: 20,
            sort: sortOption,
            status: ['Active', 'Low Stock', 'Out of Stock'],
            brand: type === 'brand' ? brandName : undefined,
            storeId: type === 'store' ? currentStoreId : undefined,
            storeType: type === 'store' ? (currentStoreType || 'vendor') : undefined,
            hardFilter: type === 'store' ? 'true' : undefined,
            search: debouncedSearch || undefined,
            isVeg: isVegOnly ? 'true' : undefined,
            activeStoreId: activeStore?.id,
            activeStoreType: activeStore?.type
        };
    }, [type, brandName, storeId, urlStoreType, sortOption, debouncedSearch, isVegOnly, activeStore?.id, activeStore?.type]);

    const loadProducts = useCallback(async (pageNum = 1, append = false) => {
        const params = buildFetchParams(pageNum);
        // Validation: If store context is needed but missing, skip
        if (type === 'store' && !params.storeId) return;

        const paramKey = JSON.stringify(params);

        // Prevent redundant calls
        if (!append && lastFetchRef.current === paramKey) return;
        if (fetchingRef.current && !append) return;

        try {
            fetchingRef.current = true;
            if (append) setIsFetchingMore(true);
            else setIsLoading(true);

            const response = await fetchProducts(params);
            const newProducts = response.products || [];

            setPageProducts(prev => append ? [...prev, ...newProducts] : newProducts);
            setTotalPages(response.pages || 1);
            setTotalResults(response.total || 0);
            setPage(pageNum);
            lastFetchRef.current = paramKey;

            let fetchedBrand = null;
            if (type === 'brand' && !append) {
                try {
                    fetchedBrand = await fetchBrandByName(brandName);
                } catch (e) {
                    console.warn("Brand info not found natively, using fallback.");
                }
            }

            // Extract Info stably using updater
            setShopInfo(prevInfo => {
                 if (prevInfo) return prevInfo;
                 if (newProducts.length === 0 && !fetchedBrand) return null;
                 
                 const first = newProducts[0] || {};
                 if (type === 'brand') {
                     // Prefer the fetched brand logo, if empty return null (UI falls back to placeholder)
                     return { name: brandName, logo: fetchedBrand?.logo || null, type: 'Brand' };
                 } else if (type === 'store') {
                     if (params.storeType === 'vendor' && first.vendor) {
                         return { 
                             name: first.vendor.storeName, 
                             logo: first.vendor.logo, 
                             address: first.vendor.address, 
                             type: 'Vendor' 
                         };
                     } else if (params.storeType === 'branch') {
                         const b = first.branchStocks?.find(bs => (bs.branchId?._id || bs.branchId) === params.storeId);
                         if (b?.branchId) {
                             return { 
                                 name: b.branchId.name, 
                                 logo: b.branchId.logo, 
                                 address: b.branchId.address, 
                                 type: 'Branch' 
                             };
                         }
                     }
                 }
                 return null;
            });

        } catch (err) {
            console.error("Failed to fetch products:", err);
            // On error we should still update lastFetchRef to prevent infinite error loops unless filters change
            lastFetchRef.current = paramKey;
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
            fetchingRef.current = false;
        }
    }, [buildFetchParams, type, brandName]);

    // Track when filter parameters actually change to reset and fetch
    useEffect(() => {
        loadProducts(1, false);
    }, [loadProducts, sortOption, debouncedSearch, isVegOnly, storeId, urlStoreType, activeStore?.id, activeStore?.type, brandName]);

    const title = type === 'brand' ? brandName : (shopInfo?.name || 'Store');
    const subtitle = type === 'brand' ? 'Brand Source' : (type === 'store' ? 'Partner Store' : '');
    const normalizedProducts = pageProducts.map((p) => normalizeProduct(p));

    return (
        <div className="min-h-screen bg-white dark:bg-black pb-24 transition-colors">
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
                .sort-pill-btn {
                    border-radius: 9999px !important;
                }
            ` }} />
            <SEO
                title={`${title} - SaathiGro`}
                description={`Browse products from ${title} on SaathiGro.`}
                image={shopInfo?.logo}
            />

            {/* Compact Mobile Header */}
            <div className="relative pt-2 pb-6 px-4 bg-white dark:bg-black border-b border-gray-50 dark:border-white/5">
                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="back-btn-clear absolute left-3 top-6 p-2 text-gray-800 dark:text-gray-200 active:scale-90 transition-all z-20"
                >
                    <ChevronLeft size={24} strokeWidth={2.5} />
                </button>

                <div className="flex flex-col items-center">
                    {/* Small Circle Logo */}
                    <div className="w-20 h-20 bg-gray-50 dark:bg-[#18181b] rounded-full shadow-sm flex items-center justify-center overflow-hidden p-3 mb-2 border border-gray-100 dark:border-white/5">
                        <img
                            src={shopInfo?.logo || placeholder}
                            alt={title}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                if (!e.target.dataset.error) {
                                    e.target.dataset.error = true;
                                    e.target.src = placeholder;
                                }
                            }}
                        />
                    </div>

                    {/* Subtitle & Title */}
                    <span className="text-[9px] font-black text-[#0c831f] uppercase tracking-widest mb-1">
                        {subtitle}
                    </span>
                    <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight text-center px-4 mb-3">
                        {title}
                    </h1>

                    {/* Badges Row - Tightened */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                        {shopInfo?.address && (
                            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#111] px-3 py-1.5 rounded-full border border-gray-100 dark:border-white/5">
                                <MapPin size={12} className="text-orange-500" />
                                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 capitalize truncate max-w-[140px]">
                                    {typeof shopInfo.address === 'object'
                                        ? (shopInfo.address.city || 'Location')
                                        : (shopInfo.address || 'Location')}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#111] px-3 py-1.5 rounded-full border border-gray-100 dark:border-white/5">
                            <Star size={12} className="text-yellow-500 fill-yellow-500" />
                            <span className="text-[11px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-tight">{totalResults} Items</span>
                        </div>
                    </div>
                </div>

                {/* Search and Filters Section - Compact */}
                <div className="max-w-xl mx-auto">
                    <div className="bg-[#f2f4f7] dark:bg-[#141414] rounded-[24px] px-4 py-4 border border-transparent dark:border-white/5">
                        {/* Search Input Row */}
                        <div className="relative mb-3">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder={`Search in ${title}...`}
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#1f1f1f] border-none rounded-full text-[13px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-0 shadow-sm placeholder:text-gray-400"
                            />
                            {localSearch && (
                                <button
                                    onClick={() => setLocalSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                                >
                                    <X size={14} className="text-gray-400" />
                                </button>
                            )}
                        </div>

                        {/* Filter Buttons Row */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsVegOnly(!isVegOnly)}
                                className={`shop-pill-btn flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border ${isVegOnly ? 'bg-[#0c831f] border-[#0c831f] text-white' : 'bg-white dark:bg-[#1f1f1f] border-gray-100 dark:border-white/10 text-gray-600 dark:text-gray-400'}`}
                            >
                                <Leaf size={14} className={isVegOnly ? 'text-white' : 'text-green-600'} />
                                Veg
                            </button>

                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`shop-pill-btn flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border ${isFilterOpen ? 'bg-black border-black text-white' : 'bg-white dark:bg-[#1f1f1f] border-gray-100 dark:border-white/10 text-gray-600 dark:text-gray-400'}`}
                            >
                                <SlidersHorizontal size={14} />
                                Sort
                            </button>
                        </div>

                        {/* Sort Menu */}
                        {isFilterOpen && (
                            <div className="mt-4 flex flex-wrap gap-2 animate-in slide-in-from-top-2 duration-300">
                                {[
                                    { id: '-createdAt', label: 'Recent' },
                                    { id: 'basePrice', label: 'Price: Low' },
                                    { id: '-basePrice', label: 'Price: High' },
                                    { id: 'averageRating', label: 'Rating' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => {
                                            setSortOption(opt.id);
                                            setIsFilterOpen(false);
                                        }}
                                        className={`sort-pill-btn px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${sortOption === opt.id ? 'bg-[#0c831f] text-white' : 'bg-white dark:bg-[#1f1f1f] text-gray-500 shadow-sm'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Product Grid */}
            <div className="max-w-7xl mx-auto px-4 md:px-8">
                {isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-10 gap-x-4 sm:gap-6 pt-10">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <ProductCardSkeleton key={i} />
                        ))}
                    </div>
                ) : normalizedProducts.length > 0 ? (
                    <div className="pt-8">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-10 gap-x-4 sm:gap-6 animate-in fade-in duration-500">
                            {normalizedProducts.map((p) => (
                                <ProductCard
                                    key={p._id || p.id}
                                    product={p}
                                    isCompact={true}
                                />
                            ))}
                        </div>

                        {/* View More Button */}
                        {page < totalPages && (
                            <div className="mt-16 flex justify-center pb-12">
                                <button
                                    onClick={() => loadProducts(page + 1, true)}
                                    disabled={isFetchingMore}
                                    className="flex items-center gap-3 bg-white dark:bg-[#141414] border-2 border-gray-100 dark:border-white/5 px-10 py-4 rounded-[20px] text-[12px] font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white shadow-xl active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isFetchingMore ? (
                                        <div className="w-4 h-4 border-2 border-[#0c831f] border-t-transparent rounded-full animate-spin" />
                                    ) : 'View More Items'}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-24 text-center max-w-sm mx-auto">
                        <div className="w-20 h-20 bg-gray-50 dark:bg-[#141414] rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Search size={30} className="text-gray-300" />
                        </div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">No Items Found</h2>
                        <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest px-8">
                            We couldn't find any products matching your search.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShopListingPage;

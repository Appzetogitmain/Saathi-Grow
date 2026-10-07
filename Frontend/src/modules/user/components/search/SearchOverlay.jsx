import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
const VoiceSearchModal = lazy(() => import('./VoiceSearchModal'));
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, X, Search, Sparkles, Mic, Loader2 } from 'lucide-react';
import { useSearch } from '../../context/SearchContext';
import ProductCard from '../product/ProductCard';
import { ProductCardSkeleton } from '../common/Skeleton';
import { ASSET_URLS } from '../../../../constants/assetUrls';
const logo = ASSET_URLS.logo;
import { useTheme } from '../../context/ThemeContext';
import { useStore } from '../../context/StoreContext';
import { normalizeProduct } from '../../pages/home/HomePage';
import { searchProducts, searchProductsWithAI } from '../../api/shopApi';

const SearchOverlay = () => {
    const { searchQuery, setSearchQuery, isSearchOverlayOpen, setIsSearchOverlayOpen, startVoiceSearch, setStartVoiceSearch } = useSearch();
    const { isDarkMode } = useTheme();
    const { activeStore } = useStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [recentSearches, setRecentSearches] = useState(() => {
        const saved = localStorage.getItem('recentSearches');
        return saved ? JSON.parse(saved) : [];
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isMoreLoading, setIsMoreLoading] = useState(false);
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [micError, setMicError] = useState(null);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [isAISearch, setIsAISearch] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [isFocused, setIsFocused] = useState(true);

    useEffect(() => {
        if (isSearchOverlayOpen && startVoiceSearch) {
            setShowVoiceModal(true);
            setStartVoiceSearch(false);
        }
    }, [isSearchOverlayOpen, startVoiceSearch, setStartVoiceSearch]);

    const startListening = () => {
        setShowVoiceModal(true);
    };

    const handleVoiceResult = (result) => {
        setSearchQuery(result);
        addToHistory(result);
        setIsFocused(true);
    };

    const lastSearchRef = useRef({ query: '', storeId: '__UNINITIALIZED__', type: 'regular' });
    const abortControllerRef = useRef(null);
    const storeSettledRef = useRef(false);

    useEffect(() => {
        storeSettledRef.current = true;
    }, [activeStore]);

    useEffect(() => {
        if (isSearchOverlayOpen) {
            setIsSearchOverlayOpen(false);
            setSearchQuery('');
            setIsAISearch(false);
        }
    }, [location.pathname]);

    const handleAISearch = async (forcedQuery) => {
        const query = forcedQuery || searchQuery;
        if (!query || query.trim().length < 2) return;
        
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        setIsAISearch(true);
        setCurrentPage(1);

        try {
            const storeParams = activeStore ? { storeId: activeStore.id, storeType: activeStore.type } : {};
            const data = await searchProductsWithAI(query.trim(), 1, storeParams, abortControllerRef.current.signal);
            
            setFilteredProducts(data.products || []);
            setTotalPages(data.pages || 1);
            setTotalResults(data.total || 0);
            addToHistory(query);
            lastSearchRef.current = { query, storeId: activeStore?.id ?? null, type: 'ai' };
        } catch (err) {
            if (err.name !== 'AbortError') console.error('AI Search failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Standard Search Debouncer
    useEffect(() => {
        const trimmedQuery = searchQuery.trim();

        if (trimmedQuery.length < 2) {
            setFilteredProducts([]);
            setTotalResults(0);
            setIsLoading(false);
            setIsAISearch(false);
            lastSearchRef.current = { query: '', storeId: '__UNINITIALIZED__', type: 'regular' };
            return;
        }

        if (!storeSettledRef.current) return;

        const currentStoreId = activeStore?.id ?? null;
        if (lastSearchRef.current.query === trimmedQuery && 
            lastSearchRef.current.storeId === currentStoreId && 
            lastSearchRef.current.type === 'regular' && 
            !isAISearch) {
            return;
        }

        const runSearch = async () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            abortControllerRef.current = new AbortController();

            setIsLoading(true);
            setIsAISearch(false);
            setCurrentPage(1);

            try {
                const storeParams = activeStore ? { storeId: activeStore.id, storeType: activeStore.type } : {};
                const data = await searchProducts(trimmedQuery, 1, storeParams, abortControllerRef.current.signal);

                setFilteredProducts(data.products || []);
                setTotalPages(data.pages || 1);
                setTotalResults(data.total || 0);
                lastSearchRef.current = { query: trimmedQuery, storeId: currentStoreId, type: 'regular' };
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Search failed:', err);
                setFilteredProducts([]);
            } finally {
                setIsLoading(false);
            }
        };

        const timer = setTimeout(runSearch, 800);
        return () => {
            clearTimeout(timer);
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [searchQuery, activeStore?.id]);

    const handleLoadMore = async () => {
        if (currentPage >= totalPages || isMoreLoading) return;

        setIsMoreLoading(true);
        try {
            const nextPage = currentPage + 1;
            const storeParams = activeStore ? { storeId: activeStore.id, storeType: activeStore.type } : {};
            
            const data = isAISearch 
                ? await searchProductsWithAI(searchQuery, nextPage, storeParams)
                : await searchProducts(searchQuery, nextPage, storeParams);

            const newProducts = data.products || [];
            if (newProducts.length > 0) {
                setFilteredProducts(prev => [...prev, ...newProducts]);
                setCurrentPage(nextPage);
            }
        } catch (err) {
            console.error("Load more failed:", err);
        } finally {
            setIsMoreLoading(false);
        }
    };

    const addToHistory = (query) => {
        if (!query || query.trim() === '') return;
        const trimmedQuery = query.trim();
        const updated = [trimmedQuery, ...recentSearches.filter(s => s !== trimmedQuery)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
    };

    const handleClose = () => {
        setIsSearchOverlayOpen(false);
        setSearchQuery('');
        setIsAISearch(false);
    };

    const handleRecentClick = (query) => {
        setSearchQuery(query);
        addToHistory(query);
    };

    const removeRecent = (e, query) => {
        e.stopPropagation();
        const updated = recentSearches.filter(s => s !== query);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
    };

    const clearRecent = () => {
        setRecentSearches([]);
        localStorage.removeItem('recentSearches');
    };

    if (!isSearchOverlayOpen) return null;

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-[#e8f5e9] via-white to-white md:bg-white dark:bg-none dark:bg-black md:dark:bg-black z-[9999] overflow-y-auto transition-colors duration-300">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/80 md:bg-white dark:bg-black/80 md:dark:bg-[#111111] backdrop-blur-md md:backdrop-blur-none border-b border-gray-100 dark:border-white/5 shadow-sm transition-colors">
                <div className="max-w-7xl mx-auto px-4 py-3 md:py-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors flex-shrink-0">
                            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-200" />
                        </button>

                        <Link to="/" onClick={handleClose} className="hidden md:flex items-center group flex-shrink-0">
                            <img
                                src={logo}
                                alt="saathigro Logo"
                                className={`h-8 w-auto object-contain transition-all duration-300 hover:scale-105 ${isDarkMode ? 'filter brightness-0 invert' : ''}`}
                            />
                        </Link>

                        <div className="flex-1 relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:block">
                                {isAISearch ? <Sparkles size={18} className="text-yellow-500 animate-pulse" /> : <Search size={20} className="text-[#0c831f]" strokeWidth={2.5} />}
                            </div>
                            <input
                                type="text"
                                 placeholder='Search products...'
                                 value={searchQuery}
                                 onChange={(e) => setSearchQuery(e.target.value)}
                                 onFocus={() => setIsFocused(true)}
                                 className="w-full pl-4 md:pl-12 pr-24 md:pr-32 py-2.5 md:py-3.5 bg-white md:bg-gray-50 dark:bg-[#1c1c1c] border border-gray-100 md:border-transparent focus:border-[#0c831f] rounded-xl text-[15px] font-medium text-gray-800 dark:text-gray-100 focus:outline-none transition-all placeholder:text-[13px] md:placeholder:text-[15px]"
                                autoFocus
                            />
                            <div className="absolute right-1.5 md:right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 md:gap-1">
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="p-2 text-gray-400 hover:text-gray-600">
                                        <X size={20} />
                                    </button>
                                )}
                                <div className="w-[1px] h-5 bg-gray-200 dark:bg-white/10 mx-1"></div>
                                <button
                                    onClick={() => handleAISearch()}
                                    className={`p-2 rounded-lg transition-all ${isAISearch ? 'bg-yellow-50 text-yellow-600' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'}`}
                                    title="AI Visual Search"
                                >
                                    <Sparkles size={18} strokeWidth={2.5} className={isAISearch ? 'animate-spin-slow' : ''} />
                                </button>
                                <button onClick={startListening} className="p-2 text-[#0c831f] hover:bg-[#e8f5e9] rounded-lg transition-all">
                                    <Mic size={20} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {!searchQuery && (
                    <div className="animate-in fade-in duration-500">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[13px] font-bold text-gray-900 dark:text-gray-100">Recent searches</h3>
                            {recentSearches.length > 0 && <button onClick={clearRecent} className="text-[12px] font-bold text-[#0c831f]">Clear all</button>}
                        </div>
                        {recentSearches.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {recentSearches.map((m, i) => (
                                    <div key={i} className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-lg group">
                                        <button onClick={() => handleRecentClick(m)} className="text-sm font-medium text-gray-700 dark:text-gray-300">{m}</button>
                                        <button onClick={(e) => removeRecent(e, m)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-2xl text-center border border-dashed border-gray-100 dark:border-white/10">
                                <p className="text-[12px] font-medium text-gray-400">No recent searches yet</p>
                            </div>
                        )}
                        <div className="mt-8">
                            <h3 className="text-[14px] font-bold text-gray-900 dark:text-gray-100 mb-4">Popular categories</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {['Vegetables', 'Fruits', 'Dairy', 'Snacks'].map((name) => (
                                    <button key={name} onClick={() => setSearchQuery(name)} className="h-14 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg font-bold text-slate-700 dark:text-gray-200 hover:border-[#0c831f] transition-all">{name}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {searchQuery && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div>
                            {!isLoading && filteredProducts.length > 0 && (
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-[14px] md:text-xl font-bold flex items-center gap-3">
                                        {isAISearch ? <Sparkles className="text-yellow-500" size={20} /> : <Search className="text-[#0c831f]" size={20} />}
                                        {isAISearch ? 'AI Discovery for' : 'Results for'} <span className="text-[#0c831f]">"{searchQuery}"</span>
                                    </h2>
                                    <span className="text-[10px] font-black bg-gray-50 dark:bg-white/5 px-3 py-1.5 rounded-full border border-gray-100 dark:border-white/5 uppercase tracking-widest">{totalResults} Products</span>
                                </div>
                            )}

                            {!isLoading && !isAISearch && filteredProducts.length > 0 && (
                                <div className="mb-8 rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden bg-white dark:bg-[#1c1c1c]">
                                    <h3 className="px-4 py-3 text-sm font-bold text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-white/10">Suggestions and alternatives</h3>
                                    {filteredProducts.slice(0, 6).map((product) => {
                                        const available = product.isDeliverable ?? (product.vendor ? product.stock > 0 : product.branchStocks?.some(stock => stock.stock > 0));
                                        return (
                                            <Link key={product._id} to={`/product/${product._id}`} onClick={handleClose} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5">
                                                <img src={product.image || product.gallery?.[0] || logo} alt="" className="w-12 h-12 rounded-lg object-contain bg-gray-50 dark:bg-white/5" />
                                                <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{product.name}</span>
                                                {!available && <span className="text-xs text-gray-500 whitespace-nowrap">Out of stock</span>}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}

                            {isLoading ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)}
                                </div>
                            ) : filteredProducts.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {filteredProducts.map((p) => (
                                        <div key={p._id || p.id}>
                                            <ProductCard product={normalizeProduct(p)} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-gray-50/50 dark:bg-white/5 rounded-[3rem] border border-dashed border-gray-200 dark:border-white/5 flex flex-col items-center">
                                    <div className="w-20 h-20 bg-white dark:bg-black rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-gray-100 dark:shadow-none">
                                        <Search size={32} className="text-gray-200" />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">No products found</h3>
                                    <p className="text-sm text-gray-400 mt-1 mb-8">Try a different keyword or category</p>
                                    
                                    <button 
                                        onClick={() => handleAISearch()}
                                        className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-[#0c831f] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-100 dark:shadow-none hover:scale-105 active:scale-95 transition-all group"
                                    >
                                        <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                                        Use AI for related products
                                    </button>
                                </div>
                            )}

                            {/* Infinite Scroll Trigger */}
                            <div 
                                ref={(el) => {
                                    if (el && !isLoading && !isMoreLoading && currentPage < totalPages) {
                                        const observer = new IntersectionObserver(([e]) => e.isIntersecting && handleLoadMore(), { rootMargin: '300px' });
                                        observer.observe(el);
                                        return () => observer.disconnect();
                                    }
                                }}
                                className="h-20 flex items-center justify-center mt-12"
                            >
                                {isMoreLoading && <Loader2 className="animate-spin text-[#0c831f]" size={32} />}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <Suspense fallback={null}>
                <VoiceSearchModal isOpen={showVoiceModal} onClose={() => setShowVoiceModal(false)} onResult={handleVoiceResult} />
            </Suspense>
        </div>
    );
};

export default SearchOverlay;

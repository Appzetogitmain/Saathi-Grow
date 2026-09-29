import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RotateCcw, ArrowRight, ChevronLeft, ChevronRight, ShoppingBag, Sparkles } from 'lucide-react';
import ProductCard from '../product/ProductCard';
import { ProductCardSkeleton } from '../common/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { fetchBuyAgainProducts } from '../../api/orderApi';
import { normalizeProduct } from '../../pages/home/HomePage';
import { motion } from 'framer-motion';

const BuyAgainSection = () => {
    const { token, user } = useAuth();
    const { activeStore, loading: storeLoading } = useStore();
    const navigate = useNavigate();

    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

    const scrollContainerRef = useRef(null);
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(true);

    const loadBuyAgain = useCallback(async (silent = false) => {
        if (!token) {
            setProducts([]);
            return;
        }

        if (!silent && !hasLoadedOnce) setIsLoading(true);

        try {
            const params = {};
            if (activeStore?.id || activeStore?._id) {
                params.activeStoreId = activeStore.id || activeStore._id;
                params.activeStoreType = activeStore.type;
            }

            const data = await fetchBuyAgainProducts(token, params);
            const rawProducts = data.products || [];
            const normalized = rawProducts.map(normalizeProduct);
            setProducts(normalized);
            setHasLoadedOnce(true);
        } catch (error) {
            console.error('[BuyAgainSection] Error loading past products:', error);
        } finally {
            setIsLoading(false);
        }
    }, [token, activeStore?.id, activeStore?._id, activeStore?.type, hasLoadedOnce]);

    // Initial Load & Store Change Watch
    useEffect(() => {
        if (!storeLoading && token) {
            loadBuyAgain(false);
        }
    }, [token, activeStore?.id, storeLoading]);

    // Listen for custom global refresh event (Pull-to-refresh)
    useEffect(() => {
        const handleRefresh = () => {
            if (token) loadBuyAgain(true);
        };
        window.addEventListener('saathi_refresh', handleRefresh);
        return () => window.removeEventListener('saathi_refresh', handleRefresh);
    }, [token, loadBuyAgain]);

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        setShowLeft(scrollLeft > 20);
        setShowRight(scrollLeft + clientWidth < scrollWidth - 20);
    };

    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -360, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 360, behavior: 'smooth' });
        }
    };

    // If user is not authenticated or has no reorder products after loading, hide completely
    if (!token) return null;
    if (!isLoading && products.length === 0) return null;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 mb-4 md:mb-8">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-3 md:mb-5">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-[#0c831f]/10 dark:bg-[#0c831f]/20 flex items-center justify-center text-[#0c831f] shadow-xs">
                        <RotateCcw className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-xl md:text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight leading-none">
                                Buy Again
                            </h2>
                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <Sparkles size={11} />
                                Past Favorites
                            </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                            Everyday essentials from your previous orders
                        </p>
                    </div>
                </div>

                <Link
                    to="/orders"
                    className="flex items-center gap-1 text-[#0c831f] text-xs md:text-sm font-bold tracking-wide hover:opacity-80 transition-all border-b border-transparent hover:border-[#0c831f] group"
                >
                    <span>View Orders</span>
                    <ArrowRight size={15} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
            </div>

            {/* Product Horizontal Carousel */}
            <div className="relative group/carousel">
                {/* Desktop Left Scroll Button */}
                {showLeft && (
                    <button
                        onClick={scrollLeft}
                        aria-label="Scroll Left"
                        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/95 dark:bg-gray-900/95 shadow-xl border border-gray-100 dark:border-white/10 items-center justify-center text-gray-700 dark:text-gray-200 hover:scale-105 active:scale-95 transition-all"
                    >
                        <ChevronLeft size={20} strokeWidth={2.5} />
                    </button>
                )}

                {/* Desktop Right Scroll Button */}
                {showRight && (
                    <button
                        onClick={scrollRight}
                        aria-label="Scroll Right"
                        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/95 dark:bg-gray-900/95 shadow-xl border border-gray-100 dark:border-white/10 items-center justify-center text-gray-700 dark:text-gray-200 hover:scale-105 active:scale-95 transition-all"
                    >
                        <ChevronRight size={20} strokeWidth={2.5} />
                    </button>
                )}

                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex overflow-x-auto gap-3 sm:gap-4 md:gap-5 pb-3 pt-1 scrollbar-hide lg-scrollbar-show -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 scroll-smooth items-stretch"
                >
                    {isLoading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex-shrink-0 w-[140px] sm:w-[175px] md:w-[200px]">
                                <ProductCardSkeleton />
                            </div>
                        ))
                    ) : (
                        products.map((product) => (
                            <div
                                key={product.id || product._id}
                                className="flex-shrink-0 w-[140px] sm:w-[175px] md:w-[200px] flex flex-col"
                            >
                                <ProductCard product={product} />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default BuyAgainSection;

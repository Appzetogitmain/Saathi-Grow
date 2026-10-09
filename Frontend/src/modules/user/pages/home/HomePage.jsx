import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../../components/product/ProductCard';
import LowestPricesSection from '../../components/product/LowestPricesSection';
import { fetchProducts } from '../../api/shopApi';
import { useSearch } from '../../context/SearchContext';
import { useShop } from '../../context/ShopContext';
import { ChevronRight, ArrowRight, ArrowLeft, TrendingDown } from 'lucide-react';
import { BannerSkeleton, CategorySkeleton, ProductCardSkeleton } from '../../components/common/Skeleton';
import { useStore } from '../../context/StoreContext';
import { useTheme } from '../../context/ThemeContext';
import { ASSET_URLS } from '../../../../constants/assetUrls';
import SEO from '../../../../common/components/SEO';
import HolidayNoticeBanner from '../../components/home/HolidayNoticeBanner';
import BuyAgainSection from '../../components/home/BuyAgainSection';
import { motion, AnimatePresence } from 'framer-motion';

const categoryPlaceholder = ASSET_URLS.placeholder;

const categoryColors = {
    'staples-and-grains': '#f0f4f8',
    'masala-and-spices': '#fdf0d5',
    'dairy-egg-frozen': '#fff9c4',
    'oil-and-ghee': '#f5f5f5',
    'fruit-and-vegetables': '#e8f5e9',
    'meat-and-seafood': '#ffebee',
    'snacks-bakery': '#fff3e0',
    'food-beverage': '#e1f5fe',
    'personal-care': '#f3e5f5',
    'cleaning-essentials': '#e8f5e9',
    'home-office': '#e3f2fd',
    'pet-care': '#f3e5f5',
    'baby-care': '#fff3e0',
    'beauty-grooming': '#fce4ec'
};

const HomePage = ({ }) => {
    const navigate = useNavigate();
    const { searchQuery } = useSearch();
    const { isDarkMode } = useTheme();
    const { categories, products, campaigns, offers, loading, getProductsByCategory, refreshShopData } = useShop();
    const scrollContainerRef = useRef(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    // Update window width on resize & Handle Pull-to-Refresh
    useEffect(() => {
        let resizeTicking = false;
        const handleResize = () => {
            if (!resizeTicking) {
                window.requestAnimationFrame(() => {
                    setWindowWidth(window.innerWidth);
                    resizeTicking = false;
                });
                resizeTicking = true;
            }
        };
        window.addEventListener('resize', handleResize, { passive: true });

        const handleRefresh = () => refreshShopData(false); // silent refresh
        window.addEventListener('saathi_refresh', handleRefresh);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('saathi_refresh', handleRefresh);
        };
    }, []);

    const activeOffers = offers.length > 0 ? offers : [];
    // Zepto-style multi-item carousel for desktop, single for mobile
    const getItemsToShow = () => {
        if (windowWidth >= 1024) return 3; // Desktop
        if (windowWidth >= 768) return 2;  // Tablet
        return 1;                          // Mobile
    };

    const itemsToShow = Math.min(getItemsToShow(), activeOffers.length || 1);
    const isCarousel = activeOffers.length > 1;

    // Manual & Infinite Scroll Logic - Starts at middle set to allow bidirectional scrolling
    const [offerIndex, setOfferIndex] = useState(isCarousel ? activeOffers.length : 0);
    const [isTransitioning, setIsTransitioning] = useState(true);

    // Initial positioning check
    useEffect(() => {
        // If loaded with 0 (from previous state or SSR mismatch), jump to middle
        if (isCarousel && offerIndex === 0 && activeOffers.length > 0) {
            setOfferIndex(activeOffers.length);
        }
    }, [activeOffers.length, isCarousel]);

    // Handle Infinite Loop Reset (Bidirectional)
    useEffect(() => {
        if (!isCarousel || activeOffers.length === 0) return;

        const totalItems = activeOffers.length * 3;
        // If we reach the end of the 2nd set (start of 3rd set visually) or start of 1st set
        if (offerIndex >= activeOffers.length * 2) {
            const timer = setTimeout(() => {
                setIsTransitioning(false);
                setOfferIndex(activeOffers.length + (offerIndex % activeOffers.length));
            }, 1000);
            return () => clearTimeout(timer);
        } else if (offerIndex < activeOffers.length) {
            // If we are in the first set, we want to snap to the second set
            const timer = setTimeout(() => {
                setIsTransitioning(false);
                setOfferIndex(activeOffers.length + ((offerIndex % activeOffers.length + activeOffers.length) % activeOffers.length));
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [offerIndex, activeOffers.length]);

    // Restore transition capability after a snap reset
    useEffect(() => {
        if (!isTransitioning) {
            const timer = setTimeout(() => {
                setIsTransitioning(true);
            }, 50); // Small delay to ensure render cycle completes
            return () => clearTimeout(timer);
        }
    }, [isTransitioning]);

    const handleNextOffer = (e) => {
        e.stopPropagation();
        if (!isTransitioning) setIsTransitioning(true);
        setOfferIndex((prev) => prev + 1);
    };

    const handlePrevOffer = (e) => {
        e.stopPropagation();
        if (!isTransitioning) setIsTransitioning(true);
        setOfferIndex((prev) => prev - 1);
    };

    const [startX, setStartX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);

    const handlePointerDown = (e) => {
        setStartX(e.clientX);
        setIsDragging(true);
        setDragOffset(0);
    };

    const handlePointerMove = (e) => {
        if (!isDragging) return;
        const currentX = e.clientX;
        const diff = startX - currentX;
        setDragOffset(-diff);
        
        if (Math.abs(diff) > 60) {
            if (diff > 0) {
                handleNextOffer(e);
            } else {
                handlePrevOffer(e);
            }
            setIsDragging(false);
            setDragOffset(0);
        }
    };

    const handlePointerUp = () => {
        setIsDragging(false);
        setDragOffset(0);
    };

    const handleTouchStart = (e) => {
        setStartX(e.touches[0].clientX);
        setIsDragging(true);
        setDragOffset(0);
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const diff = startX - currentX;
        setDragOffset(-diff);

        if (Math.abs(diff) > 60) {
            if (diff > 0) {
                handleNextOffer(e);
            } else {
                handlePrevOffer(e);
            }
            setIsDragging(false);
            setDragOffset(0);
        }
    };

    // Auto-scroll logic for Banner
    useEffect(() => {
        if (!isCarousel || activeOffers.length === 0) return;

        const interval = setInterval(() => {
            if (isTransitioning) {
                setOfferIndex((prev) => prev + 1);
            }
        }, 3000); // Scroll every 3 seconds

        return () => clearInterval(interval);
    }, [isCarousel, activeOffers.length, isTransitioning]);

    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const handleCategoryScroll = () => {
        if (!scrollContainerRef.current) return;
        if (!scrollContainerRef.current._ticking) {
            window.requestAnimationFrame(() => {
                if (scrollContainerRef.current) {
                    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
                    setCanScrollLeft(scrollLeft > 20);
                    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 20);
                }
                if (scrollContainerRef.current) {
                    scrollContainerRef.current._ticking = false;
                }
            });
            scrollContainerRef.current._ticking = true;
        }
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleCategoryScroll, { passive: true });
            return () => container.removeEventListener('scroll', handleCategoryScroll);
        }
    }, [loading]);

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
        }
    };

    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
        }
    };

    const isSearching = searchQuery.length > 0;

    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    // getProductsByCategory comes from ShopContext, uses live backend data
    const getProductsByCategoryLocal = (categoryName) => {
        return getProductsByCategory(categoryName);
    };

    const { activeStore } = useStore();

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const sectionVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { type: "spring", stiffness: 100, damping: 20 }
        }
    };

    return (
        <div
            className="min-h-screen bg-gradient-to-r from-[#e8f5e9] to-[#ffffff] dark:from-[#000000] dark:to-[#000000] md:bg-none md:bg-white md:dark:bg-black transition-colors duration-300 w-full max-w-full"
        >
            <SEO
                title="Fresh Grocery Delivery"
                description="Get fresh groceries, staples, and daily essentials delivered to your doorstep with SaathiGro. Best quality and fast delivery guaranteed."
            />

            {/* Dynamic Holiday Notice (Auto-visible 2 days before & on holiday) */}
            {!isSearching && <HolidayNoticeBanner />}

            {/* Premium Offers Carousel */}
            {!isSearching && (
                loading ? (
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 mt-4 md:mt-8 mb-6 md:mb-10">
                        <BannerSkeleton />
                    </div>
                ) : activeOffers.length > 0 ? (
                    <div
                        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 mt-4 md:mt-8 mb-6 md:mb-10 group/offers relative"
                    >
                        <div className="relative overflow-hidden sm:rounded-2xl">
                            <div
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handlePointerUp}
                                className={`flex w-full cursor-grab active:cursor-grabbing ${isTransitioning && isCarousel && !isDragging ? 'transition-transform duration-700 ease-in-out' : ''}`}
                                style={{
                                    transform: isCarousel ? `translateX(calc(-${offerIndex * (100 / itemsToShow)}% - ${offerIndex * (itemsToShow === 1 ? 0 : 12 / itemsToShow)}px + ${dragOffset}px))` : 'none',
                                    gap: itemsToShow === 1 ? '0px' : '12px',
                                    touchAction: 'pan-y'
                                }}
                            >
                                {(isCarousel ? [...activeOffers, ...activeOffers, ...activeOffers] : activeOffers).map((offer, idx) => (
                                    <div
                                        key={`${offer._id || offer.id}-${idx}`}
                                        className="flex-shrink-0"
                                        style={{
                                            width: itemsToShow === 1 ? '100%' : `calc(${100 / itemsToShow}% - ${(12 * (itemsToShow - 1)) / itemsToShow}px)`
                                        }}
                                    >
                                        <div
                                            onClick={() => navigate(`/offer/${offer._id || offer.id}`)}
                                            className="relative cursor-pointer transition-all duration-500 mx-0 border-none group/banner block z-10 hover:shadow-2xl"
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div className={`overflow-hidden rounded-lg sm:rounded-2xl shadow-sm hover:shadow-xl border border-gray-100/10 pointer-events-none bg-gray-50 dark:bg-gray-900 transition-all duration-300 ${itemsToShow === 1 ? 'aspect-[16/8.5] sm:aspect-[24/9]' : 'aspect-[16/8.5] md:aspect-[21/10]'}`}>
                                                <img
                                                    src={offer.bannerImage || offer.image}
                                                    alt={offer.title || "Special Offer"}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover/banner:scale-[1.03]"
                                                    loading="lazy"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>


                    </div>
                ) : null
            )}

            {/* Categories */}
            {(filteredCategories.length > 0 || !isSearching) && (
                <div
                    className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-10 mb-6 md:mb-10"
                >
                    <div className="flex items-center justify-between mb-2 md:mb-6">
                        <h2 className="text-[13px] md:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Shop by Category</h2>
                        {!isSearching && (
                            <Link
                                to="/category"
                                className="flex items-center gap-1 text-[#0c831f] text-[10px] md:text-sm font-bold tracking-widest hover:opacity-80 transition-all border-b-2 border-transparent hover:border-[#0c831f]"
                            >
                                See all
                                <ArrowRight size={16} strokeWidth={2.5} />
                            </Link>
                        )}
                    </div>
                    <div className="relative group/nav">
                        <div
                            ref={scrollContainerRef}
                            className="flex overflow-x-auto gap-2 sm:gap-8 pt-1 pb-2 md:pb-8 scrollbar-hide lg-scrollbar-show -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 scroll-smooth items-start md:snap-x md:snap-mandatory"
                            onScroll={handleCategoryScroll}
                        >
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="flex-shrink-0 w-24">
                                        <CategorySkeleton />
                                    </div>
                                ))
                            ) : (
                                filteredCategories.map((cat, idx) => {
                                    return (
                                        <div
                                            key={cat._id || cat.id}
                                            className="flex-shrink-0"
                                        >
                                            <Link
                                                to={`/category/${encodeURIComponent(cat.slug || cat.name?.toLowerCase().replace(/\s+/g, '-'))}`}
                                                className="flex flex-col group w-[85px] sm:w-36 h-[100px] sm:h-[155px] transition-all duration-300 active:scale-95 md:snap-start rounded-xl sm:rounded-[32px] overflow-hidden border border-gray-100/50 dark:border-white/5 shadow-sm"
                                                style={{
                                                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : (cat.bgColor || categoryColors[cat.slug] || '#f3f4f6')
                                                }}
                                            >
                                                {/* Title Inside Card at Top */}
                                                <span className="text-[9px] sm:text-[13px] font-bold text-center text-gray-900 dark:text-gray-100 leading-tight tracking-tight pt-2 sm:pt-4 px-1 capitalize group-hover:text-[#0c831f] transition-colors">
                                                    {cat.name?.toLowerCase()}
                                                </span>

                                                {/* Image Container below title */}
                                                <div className="flex-1 w-full p-1.5 sm:p-4 flex items-center justify-center relative overflow-hidden">
                                                    <img
                                                        src={cat.image || categoryPlaceholder}
                                                        alt={cat.name}
                                                        className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-110 drop-shadow-md"
                                                        onError={(e) => {
                                                            if (e.target.src !== categoryPlaceholder) {
                                                                e.target.src = categoryPlaceholder;
                                                            }
                                                        }}
                                                        loading="lazy"
                                                    />
                                                </div>
                                            </Link>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Personalized Buy Again Section for Logged-in Customers */}
            {!isSearching && <BuyAgainSection />}

            {/* Gap between Category/BuyAgain and Campaigns */}
            {!isSearching && <div className="h-2 sm:h-4" />}

            {/* Dynamic Campaign Sections */}
            {!isSearching && campaigns.map((campaign) => {
                // Build normalized product list for this campaign
                const campaignProducts = campaign.products
                    .filter(cp => cp.productId)
                    .map(cp => ({
                        ...(cp.productId || {}),
                        id: cp.productId?._id || cp.productId?.id,
                        basePrice: cp.productId?.basePrice,
                        price: cp.productId?.basePrice,
                        mrp: cp.productId?.mrp || cp.productId?.basePrice,
                        isDeliverable: cp.productId?.isDeliverable,
                        variants: Array.isArray(cp.productId?.variants) ? cp.productId.variants : [],
                        subCategory: cp.productId?.subCategory || ''
                    }));
                return (
                    <div
                        key={campaign._id}
                    >
                        {campaign.displayType === 'lowest_prices' ? (
                            <LowestPricesSection
                                campaignProducts={campaignProducts}
                                loading={loading}
                                sectionTitle={campaign.title}
                                highlightText={campaign.highlightText || '🔥 Massive Discounts'}
                                campaignId={campaign._id}
                            />
                        ) : (
                            <OccasionSection
                                title={campaign.title}
                                subtitle={campaign.subtitle || ''}
                                badgeText={campaign.highlightText || ''}
                                products={campaignProducts}
                                loading={loading}
                                themeColor={campaign.accentColor || '#0c831f'}
                                bgColor={campaign.bgColor || '#f0fdf4'}
                                campaignId={campaign._id}
                                totalProductsCount={campaign.totalProducts}
                            />
                        )}
                    </div>
                );
            })}

            {/* Category Sections */}
            {!isSearching && (
                <div className="pb-12">
                    {categories.map((category) => (
                        <div
                            key={category._id || category.id}
                        >
                            <ProductRow
                                category={category}
                                loading={loading}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Normalizes a backend product object to the format expected by ProductCard.
 * Backend:  { _id, name, basePrice, mrp, image, unitType, unitValue, category, status }
 * Frontend: { id, name, price, originalPrice, image, weight, category, status }
 */
export const normalizeProduct = (product) => ({
    ...product,
    id: product._id || product.id,
    price: product.basePrice ?? product.price,
    originalPrice: (product.mrp && product.mrp > product.basePrice) ? product.mrp : (product.originalPrice || null),
    weight: product.unitValue ? `${product.unitValue} ${product.unitType || ''}`.trim() : (product.weight || ''),
    image: product.image || null,
    status: product.status,
    isDeliverable: product.isDeliverable,
    availableStock: product.availableStock,
    lowStockThreshold: product.lowStockThreshold,
    inStore: product.inStore,
    variants: Array.isArray(product.variants) ? product.variants : [],
    subCategory: product.subCategory || ''
});

// Sub-component for individual product rows to manage scroll state with Lazy Loading
const ProductRow = ({ category, loading: globalLoading }) => {
    const { activeStore, loading: storeLoading } = useStore();
    const sectionRef = useRef(null);
    const observerRef = useRef(null);
    const [hasEntredViewport, setHasEntredViewport] = useState(false);

    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(true);
    const [localProducts, setLocalProducts] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    const fetchItems = useCallback(async (pageNum) => {
        try {
            const data = await fetchProducts({
                category: category.name,
                page: pageNum,
                limit: 20,
                status: ['Active', 'Low Stock', 'Out of Stock'],
                activeStoreId: activeStore?.id || activeStore?._id,
                activeStoreType: activeStore?.type
            });
            const newProducts = data.products || [];
            if (pageNum === 1) {
                setLocalProducts(newProducts);
            } else {
                setLocalProducts(prev => [...prev, ...newProducts]);
            }
            setHasMore(data.page < data.pages);
            setPage(pageNum);
        } catch (err) {
            console.error("Error fetching category products:", err);
        } finally {
            setIsLoading(false);
        }
    }, [category.name, activeStore?.id, activeStore?._id, activeStore?.type]);

    // Intersection Observer to trigger fetch before it becomes fully visible for smooth loading
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setHasEntredViewport(true);
                    observer.unobserve(entry.target);
                }
            },
            { rootMargin: '150px' } // Fetch 150px before it enters view to prevent network waterfall
        );

        if (observerRef.current) {
            observer.observe(observerRef.current);
        }

        return () => {
            if (observerRef.current) observer.unobserve(observerRef.current);
        };
    }, []);

    useEffect(() => {
        // Must wait for store resolution to prevent double-fetch or early return bugs
        if (storeLoading) return;

        if (hasEntredViewport) {
            setPage(1);
            fetchItems(1);
        }
    }, [hasEntredViewport, category.name, activeStore?.id, activeStore?._id, fetchItems, storeLoading]);


    const handleScroll = () => {
        if (!sectionRef.current) return;
        if (!sectionRef.current._ticking) {
            window.requestAnimationFrame(() => {
                if (sectionRef.current) {
                    const { scrollLeft, scrollWidth, clientWidth } = sectionRef.current;
                    setShowLeft(scrollLeft > 20);
                    setShowRight(scrollLeft + clientWidth < scrollWidth - 20);
                }
                if (sectionRef.current) {
                    sectionRef.current._ticking = false;
                }
            });
            sectionRef.current._ticking = true;
        }
    };

    if (!hasEntredViewport || (isLoading && page === 1)) {
        return (
            <div ref={observerRef} className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-2">
                    <div className="h-6 w-32 bg-gray-100 dark:bg-white/5 animate-pulse rounded" />
                    <div className="h-4 w-16 bg-gray-100 dark:bg-white/5 animate-pulse rounded" />
                </div>
                <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-[128px] sm:w-[170px] md:w-[200px]">
                            <ProductCardSkeleton />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!localProducts.length && !isLoading) return null;

    const sectionScroll = (dir) => {
        if (sectionRef.current) {
            const scrollAmt = dir === 'left' ? -400 : 400;
            sectionRef.current.scrollBy({ left: scrollAmt, behavior: 'smooth' });
        }
    };

    return (
        <div ref={observerRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 md:py-4 border-b border-gray-50 dark:border-white/5 last:border-0 mb-3 md:mb-5">
            <div className="flex items-center justify-between mb-2 md:mb-6">
                <h2 className="text-[15px] md:text-xl font-bold text-[#1e293b] dark:text-gray-300 tracking-tight capitalize">
                    {category.name}
                </h2>
                <div className="flex items-center gap-3 lg:gap-5">
                    <Link
                        to={`/category/${encodeURIComponent(category.slug || category.name?.toLowerCase().replace(/\s+/g, '-'))}`}
                        className="flex items-center gap-1 text-[var(--saathi-green)] text-[10px] md:text-sm font-bold tracking-wider hover:opacity-80 transition-all border-b-2 border-transparent hover:border-[#0c831f]"
                    >
                        See all
                        <ArrowRight size={16} strokeWidth={2.5} />
                    </Link>
                </div>
            </div>

            <div className="relative flex items-center group/section -mx-4 md:mx-0">
                {/* Left Arrow Space */}
                <div className={`hidden md:flex w-10 lg:w-12 shrink-0 justify-start transition-opacity duration-300 ${showLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button
                        onClick={() => sectionScroll('left')}
                        className="bg-white dark:bg-[#1c1c1c] text-black dark:text-white w-9 h-9 lg:w-11 lg:h-11 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer border border-gray-100 dark:border-white/5"
                        aria-label="Scroll left"
                    >
                        <ArrowLeft size={18} strokeWidth={2.5} />
                    </button>
                </div>

                <div
                    ref={sectionRef}
                    onScroll={handleScroll}
                    className="flex-1 flex overflow-x-auto gap-3 md:gap-4 lg:gap-5 pb-2 md:pb-4 scrollbar-hide lg-scrollbar-show px-4 md:px-0 scroll-smooth items-stretch md:snap-x md:snap-mandatory w-full"
                >
                    {localProducts.map((product) => (
                        <div key={product._id || product.id} className="flex-shrink-0 w-[128px] sm:w-[170px] md:w-[calc(25%-12px)] lg:w-[calc(20%-16px)] xl:w-[calc(16.666667%-16.666667px)] md:snap-start">
                            <ProductCard product={normalizeProduct(product)} />
                        </div>
                    ))}
                    {hasMore && (
                        <div className="flex-shrink-0 w-[128px] sm:w-[170px] md:w-[calc(25%-12px)] lg:w-[calc(20%-16px)] xl:w-[calc(16.666667%-16.666667px)] flex flex-col md:snap-start">
                            <button
                                onClick={() => fetchItems(page + 1)}
                                className="w-full h-full rounded-3xl p-2 sm:p-5 shadow-[0_4px_12px_rgba(0,0,0,0.08)] md:shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-200/60 dark:border-white/10 hover:shadow-lg active:shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all duration-500 flex flex-col items-center justify-center gap-4 group/btn bg-white dark:bg-[#111111] mb-1 relative overflow-hidden md:!bg-white dark:md:!bg-[#111111]"
                            >
                                {/* Pulsing Border Highlight - Match ProductCard */}
                                <div
                                    className="absolute inset-0 rounded-3xl border-[1.5px] md:border-transparent animate-pulse md:animate-none pointer-events-none z-30"
                                    style={{ borderColor: '#0c831f20' }}
                                />

                                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-full shadow-inner group-hover/btn:scale-110 group-hover/btn:bg-green-50 dark:group-hover/btn:bg-green-500/10 transition-all duration-300 relative z-10">
                                    <TrendingDown size={32} className="text-[var(--saathi-green)]" />
                                </div>
                                <div className="flex flex-col items-center gap-1 relative z-10">
                                    <span className="text-[10px] sm:text-[13px] font-bold uppercase tracking-[0.15em] text-gray-900 dark:text-white">Load More</span>
                                    <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Next Batch</span>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Arrow Space */}
                <div className={`hidden md:flex w-10 lg:w-12 shrink-0 justify-end transition-opacity duration-300 ${showRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button
                        onClick={() => sectionScroll('right')}
                        className="bg-white dark:bg-[#1c1c1c] text-black dark:text-white w-9 h-9 lg:w-11 lg:h-11 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer border border-gray-100 dark:border-white/5"
                        aria-label="Scroll right"
                    >
                        <ArrowRight size={18} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Reusable Occasion Section Component with Lazy Loading
const OccasionSection = ({
    title,
    subtitle,
    products: initialProducts,
    loading: globalLoading,
    themeColor,
    bgColor,
    slug,
    badgeText,
    className,
    campaignId,
    wishlistPosition,
    totalProductsCount
}) => {
    const { isDarkMode } = useTheme();
    const { activeStore } = useStore();
    const navigate = useNavigate();
    const sectionRef = useRef(null);
    const observerRef = useRef(null);
    const [hasEntredViewport, setHasEntredViewport] = useState(false);

    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(true);
    const [localProducts, setLocalProducts] = useState(initialProducts || []);
    const [page, setPage] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState((initialProducts?.length || 0) < (totalProductsCount || 0));

    // Intersection Observer to trigger fetch/reveal only when visible
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setHasEntredViewport(true);
                    observer.unobserve(entry.target);
                }
            },
            { rootMargin: '150px' }
        );

        if (observerRef.current) {
            observer.observe(observerRef.current);
        }

        return () => {
            if (observerRef.current) observer.unobserve(observerRef.current);
        };
    }, []);

    useEffect(() => {
        // Skip if activeStore is not yet initialized to prevent redundant fetches
        if (!activeStore && !hasEntredViewport) return;

        if (hasEntredViewport) {
            setLocalProducts(initialProducts);
            setHasMore((initialProducts?.length || 0) < (totalProductsCount || 0));
            setPage(1);
        }
    }, [hasEntredViewport, initialProducts, totalProductsCount, activeStore?.id]);

    const handleScroll = () => {
        if (!sectionRef.current) return;
        if (!sectionRef.current._ticking) {
            window.requestAnimationFrame(() => {
                if (sectionRef.current) {
                    const { scrollLeft, scrollWidth, clientWidth } = sectionRef.current;
                    setShowLeft(scrollLeft > 20);
                    setShowRight(scrollLeft + clientWidth < scrollWidth - 20);
                }
                if (sectionRef.current) {
                    sectionRef.current._ticking = false;
                }
            });
            sectionRef.current._ticking = true;
        }
    };

    const fetchMore = async () => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        try {
            const nextPage = page + 1;
            const data = await fetchProducts({
                campaignId: campaignId,
                page: nextPage,
                limit: 20,
                status: ['Active', 'Low Stock', 'Out of Stock'],
                activeStoreId: activeStore?.id,
                activeStoreType: activeStore?.type
            });
            const newProducts = data.products || [];
            if (newProducts.length > 0) {
                setLocalProducts(prev => [...prev, ...newProducts]);
                setHasMore(data.page < data.pages);
                setPage(nextPage);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error("Error fetching campaign products:", err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    if (!hasEntredViewport) {
        return (
            <div ref={observerRef} className="max-w-7xl mx-auto px-4 py-8 rounded-xl" style={{ backgroundColor: isDarkMode ? '' : bgColor }}>
                <div className="h-20 w-full bg-gray-100/10 animate-pulse rounded-lg" />
            </div>
        );
    }

    if (!localProducts || localProducts.length === 0) return null;

    const sectionScroll = (dir) => {
        if (sectionRef.current) {
            const scrollAmt = dir === 'left' ? -400 : 400;
            sectionRef.current.scrollBy({ left: scrollAmt, behavior: 'smooth' });
        }
    };

    return (
        <div ref={observerRef} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 mb-3 md:mb-5 rounded-xl relative transition-all duration-300 ${className || ''}`} style={{ backgroundColor: isDarkMode ? '' : bgColor }}>
            <div className="flex items-center justify-between mb-1">
                <div className="flex flex-col">
                    <h2 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: isDarkMode ? 'var(--text-primary)' : themeColor }}>
                        {title}
                    </h2>
                    <p className={`text-xs font-bold ${isDarkMode ? 'text-gray-400' : 'opacity-70'}`} style={{ color: isDarkMode ? '' : themeColor }}>{subtitle}</p>
                </div>
                {campaignId && (
                    <button
                        onClick={() => navigate(`/campaign/${campaignId}`)}
                        className="flex items-center gap-1 group/seeall"
                    >
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors" style={{ color: isDarkMode ? 'var(--saathi-yellow)' : themeColor }}>See all</span>
                        <div className="p-1 rounded-full transition-all group-hover/seeall:translate-x-1" style={{ backgroundColor: isDarkMode ? '' : `${themeColor}10` }}>
                            <ArrowRight size={14} style={{ color: isDarkMode ? 'var(--saathi-yellow)' : themeColor }} />
                        </div>
                    </button>
                )}
            </div>

            {badgeText && (
                <div className="mb-4 md:mb-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm" style={{ backgroundColor: `${themeColor}10`, borderColor: `${themeColor}30` }}>
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: themeColor }} />
                        <span className="text-[9px] md:text-xs font-bold tracking-wide uppercase" style={{ color: themeColor }}>{badgeText}</span>
                    </div>
                </div>
            )}

            <div className="relative flex items-center group/section -mx-4 md:mx-0">
                {/* Left Arrow Space */}
                <div className={`hidden md:flex w-10 lg:w-12 shrink-0 justify-start transition-opacity duration-300 ${showLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button
                        onClick={() => sectionScroll('left')}
                        className="bg-white dark:bg-[#1c1c1c] text-black dark:text-white w-9 h-9 lg:w-11 lg:h-11 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer border"
                        style={{ borderColor: themeColor ? `${themeColor}40` : '#e5e7eb' }}
                        aria-label="Scroll left"
                    >
                        <ArrowLeft size={18} strokeWidth={2.5} />
                    </button>
                </div>

                <div
                    ref={sectionRef}
                    onScroll={handleScroll}
                    className="flex-1 flex overflow-x-auto gap-3 md:gap-4 lg:gap-5 pb-2 md:pb-4 scrollbar-hide lg-scrollbar-show px-4 md:px-0 scroll-smooth items-stretch md:snap-x md:snap-mandatory w-full"
                >
                    {localProducts.map((product) => (
                        <div key={product._id || product.id} className="flex-shrink-0 w-[128px] sm:w-[170px] md:w-[calc(25%-12px)] lg:w-[calc(20%-16px)] xl:w-[calc(16.666667%-16.666667px)] md:snap-start">
                            <ProductCard
                                product={normalizeProduct(product)}
                                customTheme={{
                                    themeColor: isDarkMode ? 'var(--saathi-yellow)' : themeColor,
                                    bgColor: isDarkMode ? '' : bgColor
                                }}
                                wishlistPosition={wishlistPosition}
                            />
                        </div>
                    ))}
                    {hasMore && (
                        <div className="flex-shrink-0 w-[128px] sm:w-[170px] md:w-[calc(25%-12px)] lg:w-[calc(20%-16px)] xl:w-[calc(16.666667%-16.666667px)] flex flex-col md:snap-start">
                            <button
                                onClick={fetchMore}
                                disabled={isLoadingMore}
                                className="w-full h-full rounded-3xl p-2 sm:p-5 shadow-[0_4px_12px_rgba(0,0,0,0.08)] md:shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-200/60 dark:border-white/10 hover:shadow-lg active:shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all duration-500 flex flex-col items-center justify-center gap-4 group/btn bg-white dark:bg-[#111111] mb-1 relative overflow-hidden disabled:opacity-50 md:!bg-white dark:md:!bg-[#111111]"
                                style={{
                                    borderColor: themeColor ? `${themeColor}30` : undefined,
                                    '--theme-color': themeColor || '#0c831f'
                                }}
                            >
                                {/* Pulsing Border Highlight - Match ProductCard */}
                                <div
                                    className="absolute inset-0 rounded-3xl border-[1.5px] md:border-transparent animate-pulse md:animate-none pointer-events-none z-30"
                                    style={{ borderColor: themeColor ? `${themeColor}20` : '#0c831f20' }}
                                />

                                <div className="p-4 bg-opacity-5 rounded-full shadow-inner group-hover/btn:scale-110 transition-all duration-300 relative z-10"
                                    style={{ backgroundColor: `${themeColor}15` }}>
                                    {isLoadingMore ? (
                                        <div className="w-8 h-8 border-3 border-[var(--saathi-green)] border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <TrendingDown size={32} style={{ color: themeColor || 'var(--saathi-green)' }} />
                                    )}
                                </div>
                                <div className="flex flex-col items-center gap-1 relative z-10">
                                    <span className="text-[10px] sm:text-[13px] font-black uppercase tracking-[0.15em] text-gray-900 dark:text-white">
                                        {isLoadingMore ? 'Loading...' : 'More Results'}
                                    </span>
                                    <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                        {isLoadingMore ? 'Wait for it' : 'Load more'}
                                    </span>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Arrow Space */}
                <div className={`hidden md:flex w-10 lg:w-12 shrink-0 justify-end transition-opacity duration-300 ${showRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button
                        onClick={() => sectionScroll('right')}
                        className="bg-white dark:bg-[#1c1c1c] text-black dark:text-white w-9 h-9 lg:w-11 lg:h-11 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer border"
                        style={{ borderColor: themeColor ? `${themeColor}40` : '#e5e7eb' }}
                        aria-label="Scroll right"
                    >
                        <ArrowRight size={18} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HomePage;

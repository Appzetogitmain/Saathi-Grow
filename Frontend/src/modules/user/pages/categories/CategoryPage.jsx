import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useShop, useShopUI } from '../../context/ShopContext';
import { fetchProducts, fetchBrands, fetchSubCategories } from '../../api/shopApi';
import ProductCard from '../../components/product/ProductCard';
import { ChevronRight, Filter, ArrowLeft, Search, X, SlidersHorizontal, Leaf, Info, TrendingUp, Apple, Cookie, ShoppingBag } from 'lucide-react';
import { ProductCardSkeleton } from '../../components/common/Skeleton';
import { useStore } from '../../context/StoreContext';
import { ASSET_URLS } from '../../../../constants/assetUrls';
import { normalizeProduct } from '../home/HomePage';
import SEO from '../../../../common/components/SEO';
import { useTheme } from '../../context/ThemeContext';
// import { catSlug } from '../../../../constants/catSlug';

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

const CategoryPage = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { categories, products: globalProducts, refreshShopData } = useShop();
    const { activeStore } = useStore();
    const { isDarkMode } = useTheme();

    // Parse URL search params
    const queryParams = new URLSearchParams(location.search);
    const initialSearch = queryParams.get('search') || '';

    // Local State for Pagination & Filtering
    const [pageProducts, setPageProducts] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [localSearch, setLocalSearch] = useState(initialSearch);
    const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
    const [showSearch, setShowSearch] = useState(!!initialSearch);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [sortOption, setSortOption] = useState('-createdAt'); // '-createdAt', 'basePrice', '-basePrice'
    const [isVegOnly, setIsVegOnly] = useState(false);
    const [selectedSubCat, setSelectedSubCat] = useState(queryParams.get('sub') || 'all');
    const [availableBrands, setAvailableBrands] = useState([]);
    const [selectedBrands, setSelectedBrands] = useState([]);
    const [availableSubCategories, setAvailableSubCategories] = useState([]);
    const isProductsRoute = location.pathname.endsWith('/products');

    // If no slug, we represent the "All Categories" view
    const isMainListView = !slug;

    const currentCategory = categories.find(c => {
        const catSlug = c.slug || c.name?.toLowerCase().replace(/\s+/g, '-');
        const decodedSlug = decodeURIComponent(slug || '');
        return catSlug === slug || c.slug === slug || c.name === decodedSlug || c.name?.toLowerCase() === decodedSlug.toLowerCase();
    });

    const categoryName = currentCategory?.name;

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(localSearch), 500);
        return () => clearTimeout(timer);
    }, [localSearch]);

    // Fetch Brands and Subcategories for current category
    useEffect(() => {
        const loadCategoryData = async () => {
            if (!categoryName) return;
            try {
                const [brandsData, subCatsData] = await Promise.all([
                    fetchBrands(categoryName),
                    fetchSubCategories(categoryName)
                ]);
                setAvailableBrands(brandsData);
                setAvailableSubCategories(subCatsData);
            } catch (err) {
                console.error("Error loading category metadata:", err);
            }
        };
        loadCategoryData();
    }, [categoryName]);

    const loadCategoryProducts = useCallback(async (pageNum = 1, append = false) => {
        if (!categoryName && !isMainListView) return;

        try {
            if (append) setIsFetchingMore(true);
            else setIsLoading(true);

            const params = {
                page: pageNum,
                limit: 20,
                sort: sortOption,
                status: ['Active', 'Low Stock', 'Out of Stock']
            };

            if (categoryName) params.category = categoryName;
            if (debouncedSearch) params.search = debouncedSearch;
            if (selectedSubCat !== 'all') params.subCategory = selectedSubCat;
            if (isVegOnly) params.isVeg = 'true';
            if (selectedBrands.length > 0) params.brand = selectedBrands.join(',');
            if (activeStore) {
                params.activeStoreId = activeStore.id;
                params.activeStoreType = activeStore.type;
            }

            const response = await fetchProducts(params);
            const newProducts = response.products || [];

            setPageProducts(prev => append ? [...prev, ...newProducts] : newProducts);
            setTotalPages(response.pages || 1);
            setTotalResults(response.total || 0);
            setPage(pageNum);
        } catch (err) {
            console.error("Failed to fetch category products:", err);
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [categoryName, debouncedSearch, sortOption, isVegOnly, isMainListView, selectedSubCat, selectedBrands, activeStore]);

    // Initial load and filter change
    useEffect(() => {
        setPage(1);
        loadCategoryProducts(1, false);
    }, [debouncedSearch, sortOption, isVegOnly, slug, categoryName, selectedSubCat, selectedBrands]);

    const [searchParams] = useSearchParams();
    const querySub = searchParams.get('sub');

    // Reset/Sync filters on category change or query param change
    useEffect(() => {
        setSelectedBrands([]);
        setSelectedSubCat(querySub || 'all');
        setLocalSearch('');
    }, [slug, querySub]);

    const { setIsBottomSheetOpen } = useShopUI();

    useEffect(() => {
        setIsBottomSheetOpen(isFilterOpen);
        return () => setIsBottomSheetOpen(false);
    }, [isFilterOpen, setIsBottomSheetOpen]);

    useEffect(() => {
        const handleRefresh = () => loadCategoryProducts(1, false);
        window.addEventListener('saathi_refresh', handleRefresh);
        return () => window.removeEventListener('saathi_refresh', handleRefresh);
    }, [loadCategoryProducts]);

    if (isMainListView) {
        // Grouping logic for categories
        const categoryGroups = [
            {
                name: 'Food',
                icon: <Apple size={18} className="text-green-600" />,
                keywords: ['fruit', 'vegetable', 'dairy', 'egg', 'bread', 'meat', 'fish', 'atta', 'rice', 'dal', 'staples', 'grains', 'masala', 'spices', 'oil', 'ghee', 'organic', 'frozen', 'chicken']
            },
            {
                name: 'Snacks & Beverages',
                icon: <Cookie size={18} className="text-orange-500" />,
                keywords: ['snack', 'bakery', 'beverage', 'drink', 'juice', 'instant', 'chocolate', 'sweet', 'tooth', 'munchie', 'pan', 'sauce', 'spread', 'tea', 'coffee', 'noodles', 'biscuit']
            },
            {
                name: 'Essentials',
                icon: <ShoppingBag size={18} className="text-blue-500" />,
                keywords: ['baby', 'clean', 'personal', 'beauty', 'grooming', 'pet', 'pharma', 'wellness', 'oral', 'fashion', 'home', 'office', 'care']
            }
        ];

        const groupedCategories = categoryGroups.map(group => ({
            ...group,
            items: categories.filter(cat => {
                const name = cat.name?.toLowerCase() || '';
                return group.keywords.some(keyword => name.includes(keyword));
            })
        }));

        // Catch-all for uncategorized
        const categorizedIds = new Set(groupedCategories.flatMap(g => g.items.map(item => item._id || item.id)));
        const otherItems = categories.filter(cat => !categorizedIds.has(cat._id || cat.id));
        if (otherItems.length > 0) {
            groupedCategories.push({
                name: 'Miscellaneous',
                icon: <ChevronRight size={18} />,
                items: otherItems
            });
        }

        return (
            <div className="category-products-page category-products-index min-h-screen bg-[#fcfcfc] dark:bg-black p-4 pt-6 pb-24 w-full max-w-full">
                <SEO title="All Categories" description="Browse through all categories of fresh products and groceries available on SaathiGro." />
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 sm:p-2.5 bg-white dark:bg-[#141414] rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.05)] text-gray-800 dark:text-gray-200"
                        >
                            <ArrowLeft size={18} strokeWidth={2.5} />
                        </button>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Categories</h1>
                    </div>

                    {isLoading ? (
                        <div className="space-y-10">
                            {[1, 2, 3].map(i => (
                                <div key={i}>
                                    <div className="h-6 w-32 bg-gray-100 dark:bg-white/5 rounded-md mb-6 animate-pulse" />
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6 px-1">
                                        {Array.from({ length: 4 }).map((_, j) => (
                                            <div key={j} className="w-full h-36 sm:h-48 bg-gray-100 dark:bg-white/5 rounded-[24px] sm:rounded-[32px] animate-pulse" />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-10 sm:space-y-12">
                            {groupedCategories.filter(g => g.items.length > 0).map((group) => (
                                <section key={group.name} className="category-group">
                                    <div className="flex items-center gap-2 mb-3 sm:mb-4 px-1">
                                        <div className="p-1.5 bg-gray-100 dark:bg-white/10 rounded-lg">
                                            {group.icon}
                                        </div>
                                        <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight">{group.name}</h2>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6 sm:gap-8 px-1">
                                        {group.items.map((cat) => {
                                            const catSlug = cat.slug || cat.name?.toLowerCase().replace(/\s+/g, '-');
                                            return (
                                                <Link
                                                    key={cat._id || cat.id}
                                                    to={`/category/${encodeURIComponent(catSlug)}`}
                                                    className="flex flex-col group w-full bg-white dark:bg-[#0A0A0A] transition-all duration-300 active:scale-95 rounded-[20px] sm:rounded-[28px] overflow-hidden border border-gray-100 dark:border-white/5 shadow-[0_2px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:border-gray-200 dark:hover:border-white/10"
                                                >
                                                    <div className="relative flex-1 w-full pt-2 px-2 flex items-center justify-center">
                                                        <img
                                                            src={cat.image || categoryPlaceholder}
                                                            alt={cat.name}
                                                            className="h-16 sm:h-24 w-full object-contain transition-transform duration-500 group-hover:scale-105"
                                                            onError={(e) => {
                                                                if (e.target.src !== categoryPlaceholder) {
                                                                    e.target.src = categoryPlaceholder;
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="pb-3 px-2 text-center">
                                                        <span className="text-[10px] sm:text-[12px] font-bold text-gray-900 dark:text-gray-100 leading-tight tracking-tight capitalize block truncate px-0.5">
                                                            {cat.name?.toLowerCase() || 'Category'}
                                                        </span>
                                                        <span className="text-[8px] font-semibold text-gray-300 dark:text-gray-600 mt-0.5 block uppercase tracking-wider">
                                                           Explore
                                                        </span>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const normalizedProducts = pageProducts.map(normalizeProduct);

    return (
        <div className="category-products-page min-h-screen bg-white dark:bg-black pb-28 transition-colors duration-300 w-full max-w-full">
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
                @media (max-width: 767px) {
                    .category-products-content-area {
                        margin-top: calc(max(env(safe-area-inset-top, 32px), 32px) + 16px) !important;
                    }
                }
            ` }} />
            <SEO
                title={currentCategory?.name || 'Category'}
                description={`Shop for ${currentCategory?.name || 'products'} at SaathiGro. Best quality and fast delivery for all your needs.`}
                image={currentCategory?.image}
            />
            {/* Sticky Optimized Header - App-like Feel */}
            <div 
                className="category-products-header sticky top-0 z-[50] bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-100 dark:border-white/5 px-3 py-2"
            >
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate(isProductsRoute && slug ? `/category/${encodeURIComponent(slug)}` : '/category')}
                                className="back-btn-clear p-2 text-gray-800 dark:text-gray-200 active:scale-90 transition-all"
                            >
                                <ArrowLeft size={22} strokeWidth={2.5} />
                            </button>
                            {!showSearch ? (
                                <div className="flex flex-col">
                                    <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">
                                        {currentCategory?.name || 'Store'}
                                    </h1>
                                    <div className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">
                                        {totalResults} Products
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Fast Search Toggle */}
                        <div className={`flex-1 transition-all duration-300 ${showSearch ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none absolute invisible max-w-0'}`}>
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={`Search...`}
                                    value={localSearch}
                                    onChange={(e) => setLocalSearch(e.target.value)}
                                    className="w-full pl-9 pr-9 py-2 bg-gray-50 dark:bg-white/5 border-none rounded-full text-[16px] font-bold text-gray-900 dark:text-white focus:outline-none shadow-inner"
                                    autoFocus
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
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => {
                                    setShowSearch(!showSearch);
                                    if (showSearch) setLocalSearch('');
                                }}
                                className={`back-btn-clear p-2 transition-all ${showSearch ? 'text-[#0c831f]' : 'text-gray-600'}`}
                            >
                                <Search size={22} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {/* Subcategories Horizontal Scroll Row (Force Scroll with Flow) */}
                    {availableSubCategories.length > 0 && (
                        <div className="mt-4 mb-4" style={{ position: 'relative', zIndex: 5 }}>
                            <div className="category-products-subcategories flex items-center gap-3 overflow-x-auto scrollbar-hide lg-scrollbar-show px-1 py-1">
                                {/* "All" as a compact card */}
                                    <button
                                        onClick={() => setSelectedSubCat('all')}
                                        className="flex-shrink-0 flex flex-col items-center group transition-all duration-300 active:scale-95"
                                        style={{ width: '68px' }}
                                    >
                                        <div 
                                            className={`rounded-2xl flex flex-col items-center border transition-all duration-300 ${selectedSubCat === 'all' ? 'bg-[#0c831f]/10 border-[#0c831f] shadow-sm' : 'bg-gray-50 dark:bg-white/5 border-transparent'}`}
                                            style={{ width: '68px', height: '68px', minWidth: '68px' }}
                                        >
                                            <span 
                                                className={`font-black text-center transition-colors ${selectedSubCat === 'all' ? 'text-[#0c831f]' : 'text-gray-900 dark:text-white'}`}
                                                style={{ fontSize: '8px', paddingTop: '8px', width: '100%', paddingLeft: '4px', paddingRight: '4px' }}
                                            >
                                                ALL
                                            </span>
                                            <div className="flex-1 w-full flex items-center justify-center pb-2">
                                                <Leaf size={14} className={selectedSubCat === 'all' ? 'text-[#0c831f]' : 'text-gray-400'} />
                                            </div>
                                        </div>
                                    </button>

                                {availableSubCategories.map((sc) => {
                                    const scSlug = sc.slug || sc.name?.toLowerCase().replace(/\s+/g, '-');
                                    const isActive = selectedSubCat === sc.name || selectedSubCat === scSlug;
                                    
                                    return (
                                        <button
                                            key={sc._id}
                                            onClick={() => {
                                                setSelectedSubCat(sc.name);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="flex-shrink-0 flex flex-col items-center group transition-all duration-300 active:scale-95"
                                            style={{ width: '68px' }}
                                        >
                                            <div 
                                                className={`rounded-2xl flex flex-col items-center border transition-all duration-300 ${isActive ? 'bg-[#0c831f]/10 border-[#0c831f] shadow-sm' : 'bg-gray-50 dark:bg-white/5 border-transparent'}`}
                                                style={{ 
                                                    width: '68px',
                                                    height: '68px',
                                                    backgroundColor: !isActive && !isDarkMode ? (categoryColors[scSlug] || categoryColors[slug] || '#f8f9fa') : (isActive ? 'rgba(12, 131, 31, 0.08)' : undefined)
                                                }}
                                            >
                                                <span 
                                                    className={`font-black text-center capitalize transition-colors ${isActive ? 'text-[#0c831f]' : 'text-gray-900 dark:text-gray-100'}`}
                                                    style={{ fontSize: '8px', paddingTop: '8px', width: '100%', paddingLeft: '4px', paddingRight: '4px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                >
                                                    {sc.name?.toLowerCase()}
                                                </span>
                                                <div 
                                                    className="flex-1 w-full flex items-center justify-center p-1.5"
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <img 
                                                        src={sc.image || currentCategory?.image || categoryPlaceholder} 
                                                        alt={sc.name}
                                                        className="transition-transform duration-500 group-hover:scale-110 drop-shadow-sm"
                                                        style={{ maxHeight: '24px', width: 'auto', objectFit: 'contain' }}
                                                        onError={(e) => { e.target.src = categoryPlaceholder; }}
                                                    />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Combined Filter Row (Force Normal Flow) */}
                    <div className="category-products-filter-row mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide lg-scrollbar-show pb-0.5" style={{ position: 'relative', zIndex: 4 }}>
                        <button
                            onClick={() => setIsVegOnly(!isVegOnly)}
                            className={`shop-pill-btn flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${isVegOnly ? 'bg-[#0c831f] border-[#0c831f] text-white' : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-600 dark:text-gray-400'}`}
                        >
                            <Leaf size={12} className={isVegOnly ? 'text-white' : 'text-green-600'} />
                            Veg Only
                        </button>

                        {[
                            { id: '-createdAt', label: 'Recent' },
                            { id: 'basePrice', label: 'Price: Low' },
                            { id: '-basePrice', label: 'Price: High' }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setSortOption(opt.id)}
                                className={`sort-pill-btn px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${sortOption === opt.id ? 'bg-black text-white border-black' : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-600 dark:text-gray-400'}`}
                            >
                                {opt.label}
                            </button>
                        ))}

                        {availableBrands.map(brand => (
                            <button
                                key={brand}
                                onClick={() => {
                                    setSelectedBrands(prev =>
                                        prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
                                    );
                                }}
                                className={`sort-pill-btn px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${selectedBrands.includes(brand) ? 'bg-black text-white border-black shadow-md' : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-white/5'}`}
                            >
                                {brand}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filters Applied Counter */}
            {(debouncedSearch || isVegOnly || sortOption !== '-createdAt' || selectedBrands.length > 0) && (
                <div className="max-w-7xl mx-auto px-4 mt-2 text-[8px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0c831f] animate-pulse" />
                    Filters Applied: {(debouncedSearch ? 1 : 0) + (isVegOnly ? 1 : 0) + (sortOption !== '-createdAt' ? 1 : 0) + (selectedBrands.length)}
                </div>
            )}

            <div className="category-products-content-area max-w-7xl mx-auto px-4 py-6">
                {isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-6 gap-x-5 sm:gap-4">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <ProductCardSkeleton key={i} />
                        ))}
                    </div>
                ) : normalizedProducts.length > 0 ? (
                    <>
                        <div className="category-products-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-6 gap-x-5 sm:gap-4 animate-in fade-in duration-500">
                            {normalizedProducts.map((product) => (
                                <ProductCard
                                    key={product._id || product.id}
                                    product={product}
                                    isCompact={true}
                                />
                            ))}
                        </div>

                        {/* Pagination / Load More */}
                        {page < totalPages && (
                            <div className="mt-12 flex justify-center">
                                <button
                                    onClick={() => loadCategoryProducts(page + 1, true)}
                                    disabled={isFetchingMore}
                                    className="category-products-loadmore group flex items-center gap-3 bg-white dark:bg-[#141414] border border-gray-100 dark:border-white/10 px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] text-gray-900 dark:text-white shadow-xl shadow-gray-200/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {isFetchingMore ? (
                                        <div className="w-4 h-4 border-2 border-[#0c831f] border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <TrendingUp size={16} className="text-[#0c831f]" />
                                    )}
                                    {isFetchingMore ? 'Cooking more results...' : 'Load More Products'}
                                </button>
                            </div>
                        )}

                        <div className="mt-8 text-center">
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                Showing {normalizedProducts.length} of {totalResults} items
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="py-20 text-center max-w-sm mx-auto">
                        <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Search size={32} className="text-gray-200" />
                        </div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">No matches found</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-tight mb-8">Try clearing search or filters</p>
                        <button
                            onClick={() => {
                                setLocalSearch('');
                                setSortOption('-createdAt');
                                setIsVegOnly(false);
                            }}
                            className="bg-[#0c831f] text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-green-500/20 active:scale-95 transition-all"
                        >
                            Reset All Filters
                        </button>
                    </div>
                )}
            </div>
            {/* Mobile Bottom Float Info */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                {debouncedSearch && (
                    <div className="bg-black/90 text-white text-[8px] font-black px-4 py-2 rounded-full backdrop-blur-md shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-4">
                        <Info size={10} className="text-yellow-400" />
                        FILTERED BY "{debouncedSearch.toUpperCase()}"
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoryPage;

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, Clock, Tag, Sparkles, Filter, ChevronDown,
    Copy, Check, Zap, ShoppingBag, Info, ShoppingCart, Truck,
    TrendingUp, Gift, Percent, Plus, Minus
} from 'lucide-react';

import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';

import { useShop } from '../../context/ShopContext';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';
import { useTheme } from '../../context/ThemeContext';
import { fetchProducts } from '../../api/shopApi';
import SEO from '../../../../common/components/SEO';
import FadeImage from '../../components/common/FadeImage';

// Helper for countdown
const useCountdown = (targetDate) => {
    const [countDown, setCountDown] = useState(0);

    useEffect(() => {
        if (!targetDate) return;
        
        const target = new Date(targetDate).getTime();
        
        const updateCount = () => {
            setCountDown(Math.max(0, target - new Date().getTime()));
        };

        updateCount();
        const interval = setInterval(updateCount, 1000);
        return () => clearInterval(interval);
    }, [targetDate]);

    return countDown;
};

// Flyer-Style Product Card (Matched to app styling)
const FlyerProductCard = ({ product, badgeText }) => {
    const { cart, addToCart, updateQuantity } = useCart();
    const { isStoreOutOfRange } = useStore();
    const cartItem = cart.find(item => item.id === (product._id || product.id));
    const quantity = cartItem ? cartItem.quantity : 0;

    // Check deliverability and stock
    const isDeliverable = product.isDeliverable !== false;
    const availableStock = product.availableStock ?? 999;
    const lowStockThreshold = product.lowStockThreshold ?? 0;

    const isOutOfStock = availableStock <= 0;
    const isLowStock = availableStock <= lowStockThreshold && availableStock > 0;

    const isBtnDisabled = !isDeliverable || isStoreOutOfRange || isOutOfStock || isLowStock;

    // Safety check for discount
    const validOriginal = product.originalPrice || product.price;
    const computedDiscount = validOriginal > product.price
        ? Math.round(((validOriginal - product.price) / validOriginal) * 100)
        : 0;

    return (
        <div className="bg-white dark:bg-[#111111] rounded-xl md:rounded-2xl p-1 md:p-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] md:shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-none border border-gray-200/60 dark:border-white/20 hover:border-[#0c831f]/40 dark:hover:border-white/40 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 flex flex-col gap-0 h-auto md:h-full group relative overflow-hidden">


            {/* Discount Badge - Flyer Style (Leaf Shape) */}
            <div className="absolute -top-1 -left-1 w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-[#0c831f] to-[#085a15] rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm flex flex-col items-center justify-center text-white font-bold leading-tight border-2 border-white dark:border-black shadow-xl z-20 rotate-[-5deg] group-hover:rotate-0 transition-all duration-500">
                <span className="text-[5.5px] md:text-[9px] uppercase font-bold tracking-tighter opacity-90">{badgeText.split(' ')[0]}</span>
                <span className="text-[7.5px] md:text-[12px] font-bold tracking-tighter">
                    {badgeText.split(' ').length > 2 ? badgeText.split(' ').slice(1, 3).join(' ') : badgeText.split(' ').slice(1).join(' ')}
                </span>
            </div>

            {/* Product Image Section */}
            <Link to={`/product/${product.id}`} className="relative w-full aspect-square overflow-hidden rounded-xl bg-gray-50/50 dark:bg-[#0a0a0a] z-10 flex items-center justify-center p-1.5 md:p-2.5">
                <FadeImage
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full"
                    imgClassName="w-full h-full object-contain transition-transform duration-1000 group-hover:scale-105"
                />

                {/* Sale Percentage Tag (Matched to Home Reference) */}
                {computedDiscount > 0 && (
                    <div className="absolute top-1 right-1 bg-gradient-to-r from-red-600 to-red-500 text-white text-[6.5px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-white/20 z-20 transform hover:scale-110 transition-transform">
                        {computedDiscount}% OFF
                    </div>
                )}
            </Link>

            {/* Product Details */}
            <div className="flex flex-col flex-grow z-10 px-1">
                <Link to={`/product/${product.id}`}>
                    <h4 className="font-medium md:font-bold text-gray-900 dark:text-gray-100 text-[8px] sm:text-[10px] md:!text-[9.5px] leading-tight mb-0.5 line-clamp-2 min-h-[14px] sm:min-h-[24px]">
                        {product.name}
                    </h4>
                </Link>
                <div className="text-gray-500 dark:text-gray-400 text-[7px] md:text-[9px] mb-1 font-medium italic opacity-80 line-clamp-1">
                    {product.weight || (product.unitValue ? product.unitValue + ' ' + (product.unitType || '') : '1 pcs')} ₹ {product.category || product.subCategory || "Premium"}
                </div>

                <div className="flex items-center justify-between mt-auto pt-1">
                    <div className="flex flex-col justify-end">
                        {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-gray-400 dark:text-gray-500 line-through text-[8px] leading-[1] mb-0.5">₹{product.originalPrice}</span>
                        )}
                        <div className="flex items-baseline">
                            <span className="text-[12px] sm:text-[16px] font-bold text-gray-900 dark:text-[#f8fafc] leading-none">₹{product.price}</span>
                        </div>
                    </div>

                    {quantity > 0 ? (
                        <div
                            className={`flex items-center !rounded-full shadow-lg h-[26px] sm:h-[40px] min-w-[70px] sm:min-w-[95px] border ${isBtnDisabled ? 'bg-gray-300 border-gray-300 text-gray-500 opacity-70' : 'bg-[#0c831f] border-[#0c831f] text-white'}`}
                        >
                            <button
                                onClick={() => !isBtnDisabled && updateQuantity(product._id || product.id, -1)}
                                disabled={isBtnDisabled}
                                className="flex-1 h-full flex items-center justify-center hover:bg-black/10 transition-colors active:bg-black/20 rounded-l-full will-change-transform disabled:cursor-not-allowed"
                            >
                                <Minus size={12} sm:size={16} strokeWidth={2.5} />
                            </button>
                            <span className="text-[10px] sm:text-[15px] font-bold w-4 sm:w-7 text-center select-none leading-none">
                                {quantity}
                            </span>
                            <button
                                onClick={() => !isBtnDisabled && updateQuantity(product._id || product.id, 1)}
                                disabled={isBtnDisabled}
                                className="flex-1 h-full flex items-center justify-center hover:bg-black/10 transition-colors active:bg-black/20 rounded-r-full will-change-transform disabled:cursor-not-allowed"
                            >
                                <Plus size={12} sm:size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => !isBtnDisabled && addToCart(product)}
                            disabled={isBtnDisabled}
                            className={`px-3 sm:px-4 py-0.5 border border-transparent active:scale-95 transition-all text-[9px] sm:text-[13px] font-bold !rounded-full uppercase tracking-wider shadow-sm h-[24px] sm:h-[38px] flex items-center justify-center ${isBtnDisabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-70' : 'bg-[#0c831f] text-white hover:bg-[#0a6b19]'}`}
                            aria-label="Add to cart"
                        >
                            ADD
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const OfferPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isDarkMode } = useTheme();
    const [activeFilter, setActiveFilter] = useState('Hot Deals');

    const { offers, loading, refreshShopData } = useShop();

    const [allProducts, setAllProducts] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const { activeStore } = useStore();

    useEffect(() => {
        window.scrollTo(0, 0);

        const handleRefresh = () => refreshShopData(false); // silent refresh
        window.addEventListener('saathi_refresh', handleRefresh);
        return () => window.removeEventListener('saathi_refresh', handleRefresh);
    }, [id]);

    const fetchProductsData = useCallback(async (pageNum = 1) => {
        if (!id) return;
        setIsFetching(true);
        try {
            const data = await fetchProducts({
                offerId: id,
                page: pageNum,
                limit: 15,
                storeId: activeStore?.id,
                storeType: activeStore?.type
            });
            
            const normalized = (data.products || []).map(p => ({
                ...p,
                id: p._id,
                price: p.basePrice,
                originalPrice: p.mrp || p.basePrice,
                weight: p.unitValue && p.unitType 
                    ? `${p.unitValue} ${p.unitType}` 
                    : (p.unitValue ? String(p.unitValue) : '1 pcs')
            }));

            if (pageNum === 1) {
                setAllProducts(normalized);
            } else {
                setAllProducts(prev => [...prev, ...normalized]);
            }
            
            setHasMore(pageNum < (data.pages || 1));
            setPage(pageNum);
        } catch (error) {
            console.error("Failed to fetch offer products:", error);
        } finally {
            setIsFetching(false);
        }
    }, [id, activeStore]);

    useEffect(() => {
        fetchProductsData(1);
    }, [id, activeStore]);

    const offer = useMemo(() => {
        // Find offer by _id (string) or fallback to id (number) if needed
        return offers.find(o => o._id === id || String(o.id) === id);
    }, [id, offers]);

    const timeLeft = useCountdown(offer?.expiryDate || new Date().setDate(new Date().getDate() + 1));
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft / 1000) % 60);

    const dealProducts = useMemo(() => {
        if (allProducts.length === 0) return [];

        const base = allProducts;
        if (activeFilter === 'Hot Deals') return base;
        if (activeFilter === 'Under ₹99') return base.filter(p => p.price < 99);
        if (activeFilter === 'Buy 1 Get 1') return base.slice(0, 6); // Just visual trick for now
        if (activeFilter === 'Best Price') return [...base].sort((a, b) => a.price - b.price);

        return base;
    }, [allProducts, activeFilter]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">Loading...</div>;
    if (!offer) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">Offer not found</div>;

    const offerBadge = offer.discountPercentage ? `DISC. ${offer.discountPercentage}%` : 'SPECIAL DEAL';
    const offerDiscountDisplay = offer.discountPercentage ? `${offer.discountPercentage}%` : 'HOT';

    return (
        <>
            <SEO 
                title={offer.title} 
                description={offer.description || `Claim the best deals on ${offer.title} at SaathiGro. Hurry up, festive discounts are live!`}
                image={offer.bannerImage || offer.image}
                schemaData={{
                    "@context": "https://schema.org/",
                    "@type": "SpecialAnnouncement",
                    "name": offer.title,
                    "description": offer.description,
                    "expires": offer.expiryDate,
                    "url": window.location.href
                }}
            />
            <style>
                {`
                    .font-inter {
                        font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    }

                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }

                    @keyframes fadeInRight {
                        from { opacity: 0; transform: translateX(-20px); }
                        to { opacity: 1; transform: translateX(0); }
                    }

                    @keyframes pulse-soft {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.05); opacity: 0.8; }
                    }

                    .animate-fadeInUp { animation: fadeInUp 0.8s ease-out forwards; }
                    .animate-fadeInRight { animation: fadeInRight 0.8s ease-out forwards; }
                    .animate-pulse-soft { animation: pulse-soft 3s infinite ease-in-out; }

                    @keyframes fall {
                        0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
                        10% { opacity: 1; }
                        90% { opacity: 1; }
                        100% { transform: translateY(400px) rotate(360deg); opacity: 0; }
                    }

                    @keyframes rise {
                        0% { transform: translateY(20px); opacity: 0; }
                        10% { opacity: 0.5; }
                        100% { transform: translateY(-300px); opacity: 0; }
                    }

                    .particle {
                        position: absolute;
                        pointer-events: none;
                        z-index: 5;
                    }
                `}
            </style>

            {/* Desktop-only rebuilt layout */}
            <div className="hidden md:block min-h-screen bg-[#fcfcfc] dark:bg-black font-inter pb-24 transition-colors duration-500">
                {/* Desktop Header - Matched to Reference */}
                <div className="sticky top-0 z-[60] px-12 pt-8 pointer-events-none">
                    <div className="max-w-7xl mx-auto flex items-center justify-between bg-white/95 dark:bg-[#111]/95 backdrop-blur-md border border-gray-100 dark:border-white/5 px-10 py-5 rounded-[2.5rem] shadow-[0_12px_45px_-10px_rgba(0,0,0,0.06)] pointer-events-auto">
                        <div className="flex items-center gap-8">
                            <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5 rounded-full transition-all active:scale-90">
                                <ArrowLeft size={22} className="text-[#111827] dark:text-white" />
                            </button>
                            <div className="h-8 w-[1px] bg-gray-100 dark:bg-white/10"></div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-extrabold text-[#0c831f] uppercase tracking-[0.2em] leading-none mb-2">Active Offer</span>
                                <h1 className="text-4xl font-extrabold text-[#111827] dark:text-white leading-none tracking-tight capitalize">{offer.title.toLowerCase()}</h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-12">
                            <div className="flex items-center gap-5">
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Ending In</p>
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex flex-col items-center">
                                            <span className="bg-gray-50 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-white/5 shadow-sm min-w-[45px] text-center font-mono text-base">{hours.toString().padStart(2, '0')}</span>
                                            <span className="text-[8px] uppercase mt-1 opacity-40">Hours</span>
                                        </div>
                                        <span className="text-xl font-light opacity-30 mt-[-15px]">:</span>
                                        <div className="flex flex-col items-center">
                                            <span className="bg-gray-50 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-white/5 shadow-sm min-w-[45px] text-center font-mono text-base">{minutes.toString().padStart(2, '0')}</span>
                                            <span className="text-[8px] uppercase mt-1 opacity-40">Mins</span>
                                        </div>
                                        <span className="text-xl font-light opacity-30 mt-[-15px]">:</span>
                                        <div className="flex flex-col items-center">
                                            <span className="bg-gray-50 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-white/5 shadow-sm min-w-[45px] text-center font-mono text-base text-red-500">{seconds.toString().padStart(2, '0')}</span>
                                            <span className="text-[8px] uppercase mt-1 opacity-40">Secs</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-white px-8 py-3 rounded-full text-[13px] font-black uppercase tracking-widest shadow-lg active:scale-95 cursor-pointer transition-all hover:shadow-xl"
                                style={{ backgroundColor: offer.accentColor || '#0c831f', boxShadow: `0 8px 18px -4px ${offer.accentColor || '#0c831f'}80` }}>
                                {offerDiscountDisplay} OFF
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-12 mt-8 space-y-12">
                    {/* Premium Hero Section - 1:1 Match with Reference Image */}
                    <div className="grid grid-cols-[1.1fr_0.9fr] gap-0 overflow-hidden rounded-[3.5rem] bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-white/10 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.04)] min-h-[400px] animate-fadeInUp">
                        <div className="p-12 md:p-14 flex flex-col justify-center space-y-6 relative overflow-hidden bg-[#f3f9f4]/30 dark:bg-[#0c831f]/5">
                            <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-green-500/10 blur-[120px] rounded-full"></div>

                            <div className="relative space-y-6">
                                <div className="inline-flex items-center gap-2 bg-white dark:bg-[#0c831f]/10 px-5 py-2 rounded-full border border-green-100/60 dark:border-[#0c831f]/20 shadow-sm animate-fadeInRight">
                                    <Zap size={14} className="text-[#0c831f] fill-[#0c831f]" />
                                    <span className="text-[12px] font-extrabold uppercase tracking-[0.3em] text-[#0c831f]">{offer.subtitle || 'MEGA SAVINGS DAY'}</span>
                                </div>

                                <div className="flex flex-col space-y-2">
                                    <h2 className="text-5xl font-extrabold text-[#111827] dark:text-white leading-tight uppercase tracking-tight">
                                        {offer.title.split(' ')[0]}
                                    </h2>
                                    <h3 className="text-6xl font-black leading-none tracking-tight" style={{ color: offer.accentColor || '#0c831f' }}>
                                        {offerDiscountDisplay} OFF
                                    </h3>
                                    <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-[85%]">
                                        "{offer.description}"
                                    </p>
                                </div>

                                {/* Action Area */}
                                <div className="pt-4 flex items-center gap-4">
                                     <div className="bg-white dark:bg-[#0c831f]/10 px-6 py-3 rounded-2xl border border-green-100 dark:border-[#0c831f]/20 shadow-sm flex items-center gap-3">
                                          <ShoppingBag size={18} className="text-[#0c831f]" />
                                          <span className="text-[14px] font-bold text-gray-700 dark:text-gray-300">Browse Live Collection</span>
                                     </div>
                                </div>
                            </div>
                        </div>

                        <div className="relative h-full overflow-hidden group flex items-center justify-center p-8 bg-white dark:bg-[#0a0a0a]">
                            <img
                                src={offer.bannerImage || offer.image}
                                alt={offer.title}
                                className="w-full h-full object-contain transition-transform duration-[6s] group-hover:scale-105"
                            />

                            {/* Glassmorphism Circle Badge */}
                            <div className="absolute top-16 right-16 bg-white/40 dark:bg-black/40 backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-full w-28 h-28 flex flex-col items-center justify-center shadow-[0_20px_40px_rgba(0,0,0,0.1)] z-20 animate-pulse-soft">
                                <span className="text-[20px] font-black uppercase text-[#1e293b] dark:text-white leading-none mb-1">{offerDiscountDisplay}</span>
                                <span className="text-[11px] font-black uppercase text-[#1e293b] dark:text-white opacity-40">OFF</span>
                            </div>

                            {/* Decorative Accent Pill Bar */}
                            <div className="absolute bottom-16 left-[25%] w-12 h-2 bg-[#0c831f] rounded-full opacity-100 z-20 shadow-sm" style={{ backgroundColor: offer.accentColor || '#0c831f' }}></div>
                        </div>
                    </div>

                    {/* Trust Pillar Row - Refined */}
                    <div className="grid grid-cols-4 gap-8">
                        {[
                            { icon: LocalShippingOutlinedIcon, title: "Superfast Delivery", desc: "Arrives in 15 mins", color: "bg-blue-50 text-blue-600 dark:bg-blue-500/10" },
                            { icon: CardGiftcardOutlinedIcon, title: "Special Gift", desc: "On first application", color: "bg-purple-50 text-purple-600 dark:bg-purple-500/10" },
                            { icon: AutoAwesomeOutlinedIcon, title: "Premium Quality", desc: "Handpicked basics", color: "bg-orange-50 text-orange-600 dark:bg-orange-500/10" },
                            { icon: ShoppingBagOutlinedIcon, title: "Easy Returns", desc: "No questions asked", color: "bg-red-50 text-red-600 dark:bg-red-500/10" }
                        ].map((item, i) => (
                            <div key={i} className="bg-white dark:bg-[#0a0a0a] p-10 rounded-[3rem] border border-gray-100 dark:border-white/5 flex items-center gap-6 transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-2 group">
                                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all group-hover:rotate-6 ${item.color}`}>
                                    <item.icon style={{ fontSize: '28px' }} />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-lg font-black text-[#111827] dark:text-white leading-none mb-2">{item.title}</p>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Product Grid Layout */}
                    <div className="pt-8 grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {dealProducts.map(product => (
                            <FlyerProductCard
                                key={product.id || product._id}
                                product={product}
                                badgeText={offerBadge}
                            />
                        ))}
                    </div>

                    {/* Load More Desktop */}
                    {hasMore && (
                        <div className="mt-16 flex justify-center">
                            <button
                                onClick={() => fetchProductsData(page + 1)}
                                disabled={isFetching}
                                className="group relative flex items-center gap-3 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 px-10 py-4 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isFetching ? (
                                    <div className="w-5 h-5 border-2 border-[#0c831f] border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Zap size={18} className="text-[#0c831f] group-hover:animate-pulse" />
                                )}
                                <span className="text-sm font-black tracking-widest text-[#111827] dark:text-white uppercase">
                                    {isFetching ? 'Fetching Deals...' : 'Unlock More Deals'}
                                </span>
                                <div className="absolute inset-0 rounded-3xl bg-[#0c831f]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Mobile View (Redesigned) */}
            <div className="md:hidden min-h-screen bg-white dark:bg-[#060606] font-sans pb-20 transition-colors duration-300">
                {/* Header / Navbar */}
                <div className={`sticky top-0 z-50 border-b border-gray-100/50 dark:border-white/10 px-4 pt-10 pb-3 flex items-center justify-between h-auto ${isDarkMode ? 'bg-[#060606]' : 'bg-white/95 backdrop-blur-md'}`} >
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all">
                            <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
                        </button>
                        <div className="h-4 w-[2px] bg-gray-200 dark:bg-white/10 rounded-full mx-1"></div>
                        <span className="text-xs font-black text-[#0c831f] tracking-widest capitalize truncate max-w-[150px]">
                            {offer.title.toLowerCase()}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-500/10 px-3 py-1 rounded-full border border-green-100 dark:border-green-500/20">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-bold text-green-700 dark:text-green-400">Live Deals</span>
                    </div>
                </div >

                <div className="px-3 py-2 space-y-3">
                    {/* Display Actual Banner Image on Mobile if available */}
                    {(offer.bannerImage || offer.image) && (
                        <div className="w-full rounded-3xl overflow-hidden shadow-md border border-gray-100 dark:border-white/10 mb-2">
                            <img 
                                src={offer.bannerImage || offer.image} 
                                alt={offer.title} 
                                className="w-full h-auto object-cover"
                            />
                        </div>
                    )}

                    {/* Mobile Hero Section (Premium Rebuild) */}
                    <div 
                        className="relative w-full pb-6 pt-5 px-6 overflow-hidden shadow-[0_15px_35px_rgba(0,0,0,0.1)] rounded-[2rem] transition-all duration-500"
                        style={{ 
                            backgroundColor: offer.bgColor || '#0c831f',
                            backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.1) 100%)`
                        }}
                    >
                        {/* Abstract Background Accents */}
                        <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/20 blur-[60px] rounded-full group-hover:scale-125 transition-transform duration-[4s]"></div>
                        <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-black/10 blur-[50px] rounded-full"></div>

                        <div className="relative z-20 flex flex-col min-h-[220px] justify-between">
                            <div>
                                {/* Subtitle Pill */}
                                <div className="inline-block mb-3">
                                    <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-[0.15em] border backdrop-blur-sm shadow-sm" style={{ color: offer.textColor || '#ffffff', borderColor: (offer.textColor || '#ffffff') + '40' }}>
                                        {offer.subtitle || 'Fresh Product with Great Price'}
                                    </span>
                                </div>

                                {/* Main Title */}
                                <h1 className="text-[34px] font-black leading-tight mb-2 tracking-tight drop-shadow-sm" style={{ color: offer.textColor || '#ffffff' }}>
                                    {offer.title}<br />
                                    <span className="text-[40px] block mt-1" style={{ color: offer.accentColor || '#ffffff' }}>
                                        {offerDiscountDisplay || (offer.discountPercentage > 0 ? `${offer.discountPercentage}% OFF` : (offer.discount || 'Special Offer'))}
                                    </span>
                                </h1>
                            </div>

                            <div className="space-y-4">
                                {/* Mobile Timer Pill */}
                                {offer.expiryDate && (
                                    <div className="flex flex-col gap-1.5">
                                        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-lg self-start">
                                            <Clock size={12} style={{ color: offer.textColor || '#ffffff' }} className="opacity-80" />
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex items-center gap-1 text-[14px] font-black font-mono tracking-wider" style={{ color: offer.textColor || '#ffffff' }}>
                                                    <span>{hours.toString().padStart(2, '0')}</span>
                                                    <span className="opacity-50 text-[10px]">:</span>
                                                    <span>{minutes.toString().padStart(2, '0')}</span>
                                                    <span className="opacity-50 text-[10px]">:</span>
                                                    <span className="text-red-400">{seconds.toString().padStart(2, '0')}</span>
                                                </div>
                                                <span className="text-[8px] font-bold uppercase tracking-widest opacity-60 ml-1" style={{ color: offer.textColor || '#ffffff' }}>Left</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Bottom Status Pills */}
                                <div className="flex items-center gap-2.5">
                                    <div className="bg-white text-[#566846] px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5">
                                        LIVE <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_5px_#10b981]"></div>
                                    </div>
                                    <div className="bg-[#ffae00] text-black px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5">
                                        <Truck size={12} strokeWidth={3} /> FREE DELIVERY
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Particles/Effects Layer (Background) */}
                        {offer.backgroundEffect && offer.backgroundEffect !== 'None' && (
                            <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                                {Array.from({ length: 15 }).map((_, i) => {
                                    const effect = offer.backgroundEffect;
                                    const particle = effect === 'Confetti' ? ['🎉', '✨', '🟡', '🔴'][i % 4] :
                                                    effect === 'Sparkles' ? '✨' : 
                                                    effect === 'Bubbles' ? '🫧' : 
                                                    effect === 'Snow' ? '❄️' : '🔘';
                                    
                                    const delay = i * 0.4;
                                    const duration = effect === 'Bubbles' ? 4 : 6;
                                    const left = Math.random() * 100;
                                    const size = effect === 'Bubbles' ? Math.random() * 15 + 5 : Math.random() * 10 + 10;
                                    
                                    return (
                                        <div 
                                            key={i} 
                                            className="particle" 
                                            style={{
                                                left: `${left}%`,
                                                top: effect === 'Bubbles' ? '100%' : '-10%',
                                                fontSize: `${size}px`,
                                                animation: `${effect === 'Bubbles' ? 'rise' : 'fall'} ${duration}s infinite linear`,
                                                animationDelay: `${delay}s`,
                                                opacity: 0.6
                                            }}
                                        >
                                            {particle}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Floating Hero Icons (Dynamic by Content) */}
                        <div className="absolute right-[-10px] top-[10px] w-[140px] h-[150px] z-0 pointer-events-none">
                            {(() => {
                                let icons = [];
                                const type = offer.animationType || 'Default';
                                
                                // Mapping based on the new animationType field
                                const animationMap = {
                                    'Cleaning': ['🧹', '🧽', '🧼'],
                                    'Fruits': ['🍎', '🍇', '🍌'],
                                    'Vegetables': ['🥦', '🥕', '🥔'],
                                    'Staples': ['🍚', '🥛', '🌾'],
                                    'Snacks': ['🍿', '🍪', '🍫'],
                                    'Meat': ['🍗', '🐔', '🥚'],
                                    'Beverages': ['🧃', '🥤', '☕'],
                                    'Bakery': ['🥐', '🥨', '🍩'],
                                    'BabyCare': ['🍼', '🧸', '👶'],
                                    'PetCare': ['🦴', '🐾', '🐈'],
                                    'Beauty': ['💄', '💅', '✨'],
                                    'Festive': ['🥫', '🍫', '🧃'],
                                    'Default': ['🎁', '₹', '🛍️'],
                                    'None': []
                                };

                                if (type !== 'Default' && animationMap[type]) {
                                    icons = animationMap[type];
                                } else if (type === 'None') {
                                    icons = [];
                                } else {
                                    // Fallback to keyword matching for 'Default' or undefined types
                                    const searchString = `${offer.title} ${offer.subtitle || ''} ${offer.description || ''} ${offer.category || ''}`.toLowerCase();
                                    if (searchString.includes('clean') || searchString.includes('wash')) icons = animationMap['Cleaning'];
                                    else if (searchString.includes('fruit')) icons = animationMap['Fruits'];
                                    else if (searchString.includes('veg')) icons = animationMap['Vegetables'];
                                    else if (searchString.includes('staple') || searchString.includes('rice')) icons = animationMap['Staples'];
                                    else if (searchString.includes('snack') || searchString.includes('bakery')) icons = animationMap['Snacks'];
                                    else if (searchString.includes('meat') || searchString.includes('chicken')) icons = animationMap['Meat'];
                                    else if (searchString.includes('beverage') || searchString.includes('juice')) icons = animationMap['Beverages'];
                                    else if (searchString.includes('baby') || searchString.includes('kids')) icons = animationMap['BabyCare'];
                                    else if (searchString.includes('pet') || searchString.includes('dog')) icons = animationMap['PetCare'];
                                    else if (searchString.includes('beauty') || searchString.includes('glow')) icons = animationMap['Beauty'];
                                    else if (searchString.includes('treat') || searchString.includes('packaged')) icons = animationMap['Festive'];
                                    else icons = animationMap['Default'];
                                }

                                if (icons.length === 0) return null;

                                return (
                                    <>
                                        <div className="absolute top-2 right-0 text-[70px] lg:text-[75px] drop-shadow-2xl animate-spin-slow select-none origin-center opacity-95" style={{ animationDuration: '8s' }}>{icons[0]}</div>
                                        <div className="absolute bottom-[35px] right-[45px] text-[35px] drop-shadow-xl animate-bounce select-none opacity-95" style={{ animationDuration: '3s' }}>{icons[1]}</div>
                                        <div className="absolute bottom-[20px] right-[25px] text-[40px] drop-shadow-md animate-pulse select-none opacity-90" style={{ animationDuration: '2s' }}>{icons[2]}</div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Subtle lighting / glare */}
                        <div className="absolute top-0 left-10 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
                    </div>


                    {/* All Deal Products */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-4 pt-2">
                        {dealProducts.map(product => (
                            <FlyerProductCard
                                key={product.id || product._id}
                                product={product}
                                badgeText={offerBadge}
                            />
                        ))}
                    </div>

                    {/* Load More Mobile */}
                    {hasMore && (
                        <div className="pt-6 pb-2">
                             <button
                                onClick={() => fetchProductsData(page + 1)}
                                disabled={isFetching}
                                className="w-full flex items-center justify-center gap-3 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 py-4 rounded-2xl active:scale-95 transition-all text-xs font-black uppercase tracking-[0.2em]"
                            >
                                {isFetching ? (
                                     <div className="w-4 h-4 border-2 border-[#0c831f] border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Sparkles size={16} className="text-[#0c831f]" />
                                )}
                                <span className="text-[#111827] dark:text-gray-300">
                                    {isFetching ? 'Loading...' : `View ${allProducts.length % 15 === 0 ? 'Next 15' : 'More'} Items`}
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* End Mobile View */}
        </>
    );
};

export default OfferPage;

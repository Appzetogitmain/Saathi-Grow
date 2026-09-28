import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, ChevronDown, TrendingDown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { products } from '../../data/products';
import ProductCard from '../../components/product/ProductCard';
import SEO from '../../../../common/components/SEO';

const LowestPricesPage = () => {
    const navigate = useNavigate();

    const { isDarkMode } = useTheme();

    const themeColor = isDarkMode ? "#ffffff" : "#0c831f";
    const bgColor = isDarkMode ? "#000000" : "#e8f5e9";
    const accentColor = isDarkMode ? "#000000" : "#ffffff";

    // Filter for products with discounts
    const discountedProducts = useMemo(() => {
        return products
            .filter(p => p.originalPrice && p.originalPrice > p.price)
            .sort((a, b) => {
                const discountA = ((a.originalPrice - a.price) / a.originalPrice);
                const discountB = ((b.originalPrice - b.price) / b.originalPrice);
                return discountB - discountA; // Sort by highest discount percentage
            });
    }, []);

    return (
        <div
            className="min-h-screen pb-20 transition-colors duration-300"
            style={{
                background: isDarkMode ? bgColor : `linear-gradient(to right, ${bgColor}, ${accentColor})`,
                minHeight: '100vh'
            }}
        >
            <style dangerouslySetInnerHTML={{ __html: `
                .back-btn-clear, .back-btn-clear:hover, .back-btn-clear:active {
                    background: transparent !important;
                    background-color: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }
            ` }} />
            <SEO 
                title="Lowest Prices Ever" 
                description="Unbeatable deals and lowest prices on fresh groceries, staples, and daily essentials at SaathiGro. Save big on your daily shopping!" 
            />
            {/* Compact Header */}
            <div
                className="relative z-40 px-4 pt-4 pb-2 flex items-center gap-3 transition-colors duration-300 border-b border-gray-50 dark:border-white/5"
                style={{ backgroundColor: bgColor }}
            >
                <button
                    onClick={() => navigate(-1)}
                    className="back-btn-clear p-2 text-gray-800 dark:text-gray-200 active:scale-90 transition-all font-black"
                >
                    <ArrowLeft size={24} style={{ color: themeColor }} strokeWidth={2.5} />
                </button>
                <div className="flex flex-col">
                    <h1 className="text-sm font-black leading-none tracking-tight flex items-center gap-2 mb-1" style={{ color: themeColor }}>
                        Lowest Prices Ever <TrendingDown size={16} />
                    </h1>
                    <p className={`text-[9px] font-bold ${isDarkMode ? 'text-gray-400' : 'opacity-70'}`} style={{ color: isDarkMode ? '' : themeColor }}>
                        Massive discounts on top products
                    </p>
                </div>
            </div>

            {/* Compact Filter/Sort Bar */}
            <div
                className="relative z-30 px-4 py-2.5 transition-colors duration-300"
                style={{ backgroundColor: `${bgColor}90` }}
            >
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-zinc-800 hover:opacity-90 rounded-full text-[11px] font-bold border border-gray-100 dark:border-white/10 shadow-sm transition-all whitespace-nowrap" style={{ color: themeColor }}>
                        <Filter size={11} strokeWidth={2.5} />
                        Filter
                    </button>
                    <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-zinc-800 hover:opacity-90 rounded-full text-[11px] font-bold border border-gray-100 dark:border-white/10 shadow-sm transition-all whitespace-nowrap" style={{ color: themeColor }}>
                        Sort By <ChevronDown size={11} strokeWidth={2.5} />
                    </button>
                    <div className="w-[1px] h-3 bg-black/5 dark:bg-white/10 mx-1"></div>
                    <span className="text-[9px] font-black opacity-60 uppercase tracking-wider" style={{ color: themeColor }}>
                        {discountedProducts.length} Items
                    </span>
                </div>
            </div>

            {/* Product Grid */}
            <div className="max-w-7xl mx-auto px-6 sm:px-4 pb-12 pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-6 gap-x-5 sm:gap-4">
                    {discountedProducts.map(product => (
                        <div key={product.id} className="relative">
                            {/* Discount Badge */}
                            <div className="absolute top-1.5 right-1.5 z-50 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[7.5px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-lg">
                                {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                            </div>
                            <ProductCard
                                product={product}
                                customTheme={{
                                    themeColor: '#0c831f',
                                    bgColor: isDarkMode ? bgColor : `#e8f5e9`
                                }}
                                imgPadding="p-5 sm:p-4"
                                wishlistPosition="top-8 right-2"
                                isLowestPrice={true}
                                isLargeButton={true}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Recommendations Section */}
            <div className="max-w-7xl mx-auto px-6 sm:px-4 pb-12">
                <div className="border-t border-dashed border-gray-200 dark:border-white/10 pt-8 mt-4">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-1 h-4 bg-[#f7cb15] rounded-full"></div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">You Might Also Like</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-6 gap-x-5 sm:gap-4">
                        {products.filter(p => !p.originalPrice || p.originalPrice <= p.price).slice(0, 6).map((product) => (
                            <ProductCard
                                key={`rec-${product.id}`}
                                product={product}
                                isCompact={true}
                                customTheme={{ bgColor: '#e8f5e9', themeColor: '#0c831f' }}
                                isLowestPrice={true}
                                isLargeButton={true}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LowestPricesPage;

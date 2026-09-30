import React, { memo, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, Heart, Star } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useWishlist } from '../../context/WishlistContext';
import { useStore } from '../../context/StoreContext';
import FadeImage from '../common/FadeImage';

const ProductCard = memo(({ product, isCompact = false, customTheme, imgPadding, wishlistPosition = "top-2 right-2", isLowestPrice = false, isValentine = false, isSaathiSignature = false, isLargeButton = false }) => {
  const { cart, addToCart, updateQuantity } = useCart();
  const { user, protectAction } = useAuth();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { activeStore, nearbyStores, setActiveStore, isStoreOutOfRange, isStoreInactive } = useStore();

  const productId = product.id || product._id;
  const hasVariants = Array.isArray(product.variants) && product.variants.some((v) => v?.value);
  const availableVariants = useMemo(
    () => (product.variants || []).filter((v) => v?.value),
    [product.variants]
  );
  const [showVariantModal, setShowVariantModal] = useState(false);

  const cartItem = cart.find(item => item.id === productId);
  const quantity = cartItem ? cartItem.quantity : 0;
  const effectiveOriginalPrice = (product.originalPrice && Number(product.originalPrice) > Number(product.price))
    ? Number(product.originalPrice)
    : ((product.mrp && Number(product.mrp) > Number(product.price)) ? Number(product.mrp) : null);
  const savings = effectiveOriginalPrice ? (effectiveOriginalPrice - Number(product.price)) : 0;

  // Dynamic availability evaluation based on nearbyStores
  const productVendorId = (product.vendor?._id || product.vendor)?.toString();
  
  let effectiveStore = null;
  let effectiveIsDeliverable = false;
  let effectiveAvailableStock = 0;
  let effectiveLowStockThreshold = product.lowStockThreshold ?? 10;
  
  if (productVendorId) {
    // Vendor product: check if vendor is in nearby stores
    const matchedVendor = nearbyStores?.find(s => s.id?.toString() === productVendorId && s.type === 'vendor');
    if (matchedVendor) {
      effectiveStore = matchedVendor;
      effectiveIsDeliverable = true;
      effectiveAvailableStock = product.stock ?? product.availableStock ?? 999;
      effectiveLowStockThreshold = product.lowStockThreshold ?? 10;
    }
  } else if (product.branchStocks && product.branchStocks.length > 0) {
    // Branch product: check if any branch in nearby stores has stock
    const matchedBranch = nearbyStores?.find(s => 
      s.type === 'branch' && 
      product.branchStocks.some(bs => (bs.branchId?._id || bs.branchId)?.toString() === s.id?.toString() && bs.stock > 0)
    );
    if (matchedBranch) {
      const bsEntry = product.branchStocks.find(bs => (bs.branchId?._id || bs.branchId)?.toString() === matchedBranch.id?.toString());
      effectiveStore = matchedBranch;
      effectiveIsDeliverable = true;
      effectiveAvailableStock = bsEntry?.stock ?? product.availableStock ?? 999;
      effectiveLowStockThreshold = bsEntry?.lowStockThreshold ?? 10;
    }
  }

  // If the product vendor/branch is in nearby stores, override default backend values
  const isDeliverable = effectiveStore ? effectiveIsDeliverable : (product.isDeliverable !== false);
  const availableStock = effectiveStore ? effectiveAvailableStock : (product.availableStock ?? product.stock ?? 999);
  const lowStockThreshold = effectiveStore ? effectiveLowStockThreshold : (product.lowStockThreshold ?? 10);
  
  const isOutOfStock = availableStock <= 0;
  const isBtnDisabled = !isDeliverable || isStoreOutOfRange || isStoreInactive || isOutOfStock;

  const handleAddToCart = (e) => {
    if (isBtnDisabled) return;
    e.preventDefault();
    e.stopPropagation();
    protectAction(() => {
      if (hasVariants) {
        setShowVariantModal(true);
        return;
      }

      if (effectiveStore && activeStore?.id?.toString() !== effectiveStore.id?.toString()) {
        console.log("[ProductCard] Switching active store to:", effectiveStore.name);
        setActiveStore(effectiveStore);
        setTimeout(() => {
          addToCart({
            ...product,
            isDeliverable: true,
            availableStock: availableStock,
            maxAllowed: availableStock
          });
        }, 100);
      } else {
        addToCart({
          ...product,
          isDeliverable: isDeliverable,
          availableStock: availableStock,
          maxAllowed: availableStock
        });
      }
    });
  };

  const handleVariantAdd = (variant) => {
    if (!variant || (variant.stock ?? 0) <= 0) return;
    protectAction(() => {
      const variantId = `${productId}::${variant.value}`;
      const payload = {
        ...product,
        id: variantId,
        productId,
        name: `${product.name} (${variant.value})`,
        weight: variant.value,
        price: variant.price ?? product.price ?? 0,
        isDeliverable,
        availableStock: variant.stock,
        maxAllowed: variant.stock,
        selectedVariant: {
          type: variant.type || '',
          value: variant.value,
          price: variant.price,
          stock: variant.stock
        }
      };
      addToCart(payload);
      setShowVariantModal(false);
    });
  };

  const handleUpdateQuantity = (e, delta) => {
    if (isBtnDisabled) return;
    e.preventDefault();
    e.stopPropagation();
    protectAction(() => updateQuantity(productId, delta));
  };

  return (
    <div
      className="rounded-lg sm:rounded-xl p-2 shadow-[0_4px_12px_rgba(0,0,0,0.08)] md:shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-200/60 dark:border-white/10 hover:shadow-lg active:shadow-md transition-all duration-500 flex flex-col gap-1 h-auto md:h-full group relative overflow-hidden mb-1 md:ring-0 md:!bg-white dark:md:!bg-[#111111] hover:-translate-y-1.5 hover:scale-[1.02]"
      style={{
        background: isDarkMode ? '#111111' : (customTheme?.bgColor || '#ffffff'),
        borderColor: customTheme ? `${customTheme.themeColor}30` : undefined,
        '--theme-color': customTheme ? customTheme.themeColor : '#0c831f'
      }}
    >



      {/* Pulsing Border Highlight - Mobile Only */}
      <div
        className="absolute inset-0 rounded-lg sm:rounded-xl border-[1.5px] md:border-transparent pointer-events-none z-30 opacity-50"
        style={{ borderColor: customTheme ? `${customTheme.themeColor}20` : '#0c831f20' }}
      />
      {savings > 0 && (
        <div className="absolute top-0 left-0 bg-[#0c831f] text-white text-[7.5px] sm:text-[10px] font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-br-lg z-30 shadow-sm flex items-center gap-0.5">
          <span>Save ₹{Number(savings).toFixed(2)}</span>
        </div>
      )}

      {/* Rating Badge */}
      {product.averageRating > 0 && (
        <div className="absolute top-0 right-[-1px] bg-white/90 dark:bg-black/80 backdrop-blur-sm text-gray-900 dark:text-white text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-bl-lg z-30 shadow-sm flex items-center gap-1 border-l border-b border-gray-100 dark:border-white/5">
          <Star size={10} className="fill-yellow-500 text-yellow-500" />
          <span>{product.averageRating.toFixed(1)}</span>
        </div>
      )}

      {/* Wishlist Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          protectAction(() => toggleWishlist(product));
        }}
        className={`absolute ${wishlistPosition} z-30 p-1.5 rounded-full transition-all group/wishlist`}
      >
        <Heart
          size={16}
          className={`transition-colors ${isInWishlist(productId) ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-gray-200 group-hover/wishlist:text-red-500'}`}
        />
      </button>

      {/* Product Image */}
      <div className="relative w-full aspect-square overflow-hidden rounded-md sm:rounded-lg bg-white dark:bg-zinc-800 z-10 transition-all duration-500">

        {/* Shine Effect on Hover - Image Only */}
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden dark:hidden rounded-md sm:rounded-lg">
          <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-[-25deg] group-hover:animate-[shine-sweep-fast_0.75s_ease-in-out]" />
        </div>
        <Link to={`/product/${productId}`} className="block w-full h-full">
          <FadeImage
            src={product.image}
            alt={product.name}
            className="w-full h-full"
            imgClassName={`w-full h-full object-contain transition-transform duration-500 group-hover:scale-110 ${imgPadding || 'p-2'}`}
            loading="lazy"
          />
        </Link>
      </div>

      <div className="flex flex-col flex-grow px-1.5">
        {/* Title */}
        <Link to={`/product/${productId}`} className="z-10">
          <div
            className="font-bold text-gray-800 dark:text-zinc-100 text-[11px] sm:text-[16px] leading-tight mb-0.5 line-clamp-2 min-h-[26px] sm:min-h-[34px] transition-colors tracking-tight hover:text-[var(--theme-color)]"
            style={{ color: 'inherit' }}
          >
            {product.name}
          </div>
        </Link>

        {/* Weight */}
        <div className="text-gray-400 dark:text-zinc-500 text-[10px] sm:text-[11px] mb-1.5 font-medium uppercase tracking-widest">{product.weight}</div>

        {/* Bottom Row: Price & Action */}
        <div className={`flex items-center justify-between mt-auto z-10 ${isLowestPrice ? 'gap-1' : ''}`}>
          <div className="flex flex-col">
            {effectiveOriginalPrice && effectiveOriginalPrice > product.price && (
              <span className="text-gray-400 dark:text-zinc-600 line-through text-[10px] sm:text-[11px] font-medium leading-none">₹{effectiveOriginalPrice}</span>
            )}
            <span className="text-[14px] sm:text-[19px] font-bold text-gray-900 dark:text-white tracking-tighter leading-tight">₹{product.price}</span>
          </div>

          {!hasVariants && quantity > 0 ? (
            <div
              className={`flex items-center text-white !rounded-full shadow-lg ${(isLargeButton || isLowestPrice || isValentine || isSaathiSignature) ? ((isLowestPrice || isValentine || isSaathiSignature) ? 'h-[24px] sm:h-[30px] min-w-[65px] sm:min-w-[70px]' : 'h-[28px] sm:h-[36px] min-w-[75px] sm:min-w-[85px]') : (isCompact ? 'h-[21px] sm:h-[30px] min-w-[50px] sm:min-w-[70px]' : 'h-[25px] sm:h-[36px] min-w-[60px] sm:min-w-[85px]')} border quantity-selector ${isBtnDisabled ? 'cursor-not-allowed bg-gray-400' : ''}`}
              style={{
                backgroundColor: isDarkMode ? '#0c831f' : (customTheme ? customTheme.themeColor : '#0c831f'),
                borderColor: isDarkMode ? '#0c831f' : (customTheme ? customTheme.themeColor : '#0c831f')
              }}
            >
              <button
                onClick={(e) => handleUpdateQuantity(e, -1)}
                disabled={isBtnDisabled}
                className="flex-1 h-full flex items-center justify-center hover:bg-black/10 transition-colors active:bg-black/20 rounded-l-full will-change-transform disabled:cursor-not-allowed"
              >
                <Minus className={`${isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} sm:w-4 sm:h-4`} strokeWidth={3} />
              </button>
              <span className={`${(isLowestPrice || isValentine || isSaathiSignature) ? 'text-[7px]' : isCompact ? 'text-[9px]' : 'text-[11px]'} sm:text-[14px] font-bold w-4 sm:w-7 text-center select-none leading-none`}>
                {quantity}
              </span>
              <button
                onClick={(e) => handleUpdateQuantity(e, 1)}
                disabled={isBtnDisabled}
                className="flex-1 h-full flex items-center justify-center hover:bg-black/10 transition-colors active:bg-black/20 rounded-r-full will-change-transform disabled:cursor-not-allowed"
              >
                <Plus className={`${isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} sm:w-4 sm:h-4`} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={isBtnDisabled}
              className={`${(isLargeButton || isLowestPrice || isValentine || isSaathiSignature) ? ((isValentine || isSaathiSignature) ? 'px-3 sm:px-3 h-[24px] sm:h-[30px] text-[9px]' : isLowestPrice ? 'px-3 sm:px-3 h-[24px] sm:h-[30px] text-[10px]' : 'px-4 sm:px-4 h-[28px] sm:h-[34px] text-[10px]') : (isCompact ? 'px-2 sm:px-3 h-[20px] sm:h-[30px] text-[10px]' : 'px-3 sm:px-4 h-[24px] sm:h-[34px] text-[10px]')} py-1 text-white border border-transparent transition-all sm:text-[12px] font-bold !rounded-full uppercase tracking-wider shadow-sm flex items-center justify-center ${isBtnDisabled ? 'bg-gray-400 cursor-not-allowed' : 'active:scale-95'}`}
              style={!isBtnDisabled ? { backgroundColor: isDarkMode ? '#0c831f' : (customTheme ? customTheme.themeColor : '#0c831f') } : {}}
            >
              ADD
            </button>
          )}
        </div>
      </div>

      {showVariantModal && createPortal(
        <div className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowVariantModal(false)} />
          <div className="relative bg-white dark:bg-[#111111] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 border border-gray-100 dark:border-white/10">
            <h3 className="text-sm font-black text-gray-900 dark:text-white mb-1">Select Variant</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{product.name}</p>
            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {availableVariants.map((variant, index) => {
                const variantCartId = `${productId}::${variant.value}`;
                const variantInCart = cart.find((item) => item.id === variantCartId);
                const isOut = (variant.stock ?? 0) <= 0;
                return (
                  <button
                    key={`${variant.value}-${index}`}
                    onClick={() => handleVariantAdd(variant)}
                    disabled={isOut}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[#0c831f] disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{variant.value}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{isOut ? 'Out of stock' : `₹${variant.price ?? product.price}`}</div>
                    </div>
                    <div className="text-xs font-bold text-[#0c831f]">
                      {variantInCart ? `In cart: ${variantInCart.quantity}` : 'Add'}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowVariantModal(false)}
              className="w-full mt-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}


    </div >
  );
});

export default ProductCard;

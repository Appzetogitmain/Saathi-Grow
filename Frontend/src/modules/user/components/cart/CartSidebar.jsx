import React from 'react';
import { X, Minus, Plus, ChevronRight, ChevronLeft, Clock, ShoppingBag, Info, AlertCircle } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { ASSET_URLS } from '../../../../constants/assetUrls';
const categoryPlaceholder = ASSET_URLS.placeholder;

const CartSidebar = () => {
    const { isCartOpen, setIsCartOpen, cart, updateQuantity, cartTotal, cartCount, publicSettings } = useCart();
    const { user, protectAction } = useAuth();
    const { isStoreOutOfRange, activeStore } = useStore();
    const navigate = useNavigate();

    // Calculate total bill using dynamic Global Settings synced from backend
    const itemTotalOriginal = cart.reduce((acc, item) => {
        const itemOriginal = (item.originalPrice && Number(item.originalPrice) > Number(item.price))
            ? Number(item.originalPrice)
            : ((item.mrp && Number(item.mrp) > Number(item.price)) ? Number(item.mrp) : Number(item.price));
        return acc + itemOriginal * item.quantity;
    }, 0);
    const itemTotalDiscounted = cartTotal;
    const savings = Math.max(0, itemTotalOriginal - itemTotalDiscounted);

    const baseDelivery = publicSettings?.baseDeliveryFee ?? 25;
    const thresh = publicSettings?.freeDeliveryThreshold ?? 500;
    const surge = publicSettings?.surgeMultiplier ?? 1.0;

    const deliveryFee = itemTotalDiscounted >= thresh ? 0 : baseDelivery * surge;
    const handlingFee = publicSettings?.handlingFee ?? 5;

    // Note: We don't render tax on the sidebar to keep it simple, it gets added on secure CheckoutPage.
    const finalTotal = itemTotalDiscounted + deliveryFee + handlingFee;

    const remainingForFreeDelivery = thresh - itemTotalDiscounted;

    if (!isCartOpen) return null;

    return (
        <div className="fixed inset-0 z-[10005] flex justify-end font-sans">
            {/* Overlay - Hidden on Mobile for "Full Page" feel */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity hidden sm:block"
                onClick={() => setIsCartOpen(false)}
            ></div>

            {/* Main Container */}
            <div className={`relative w-full sm:max-w-[360px] bg-gradient-to-r from-[#e8f5e9] to-[#ffffff] dark:from-[#141414] dark:to-[#141414] h-full shadow-2xl flex flex-col transform transition-all animate-in slide-in-from-bottom sm:slide-in-from-right duration-500 sm:rounded-l-[24px] overflow-hidden`}>

                {/* Header */}
                <div className="px-3.5 py-3.5 bg-transparent flex items-center justify-between sticky top-0 z-10 border-b border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsCartOpen(false)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                        >
                            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" strokeWidth={2.5} />
                        </button>
                        <h2 className="text-[15px] font-black text-[#1f2937] dark:text-gray-100 tracking-tight">My Basket</h2>
                    </div>
                    <button
                        onClick={() => setIsCartOpen(false)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                    >
                        <X size={18} className="text-gray-600 dark:text-gray-400" />
                    </button>
                </div>

                {/* Out of Range Banner */}
                {isStoreOutOfRange && activeStore && (
                    <div className="px-3.5 py-2 bg-red-50 dark:bg-red-500/10 flex items-start gap-2 border-b border-red-100 dark:border-red-500/20">
                        <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <span className="text-red-600 dark:text-red-400 font-bold text-[8.5px] uppercase tracking-wide leading-tight">
                            Your selected store <span className="font-black">({activeStore.name})</span> is currently out of your delivery range.
                            Please switch location to continue.
                        </span>
                    </div>
                )}

                {/* Savings Banner */}
                {savings > 0 && (
                    <div className="px-3.5 py-1.5 bg-[#0c831f]/10 flex items-center justify-between border-b border-[#0c831f]/10">
                        <span className="text-[#0c831f] dark:text-green-400 font-bold text-[8px] uppercase tracking-wider">Your total savings</span>
                        <span className="text-[#0c831f] dark:text-green-400 font-black text-[11px]">₹{Number(savings).toFixed(2)}</span>
                    </div>
                )}

                {/* Dynamic Free Delivery Banner */}
                {cart.length > 0 && remainingForFreeDelivery > 0 && (
                    <div className="px-3.5 py-1.5 bg-blue-50/50 dark:bg-blue-500/10 flex items-center justify-between border-b border-blue-500/10">
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-[8.5px] tracking-wide">Add ₹{remainingForFreeDelivery.toFixed(2)} more to get <span className="font-black uppercase tracking-widest">Free Delivery</span></span>
                    </div>
                )}
                {cart.length > 0 && remainingForFreeDelivery <= 0 && (
                    <div className="px-3.5 py-1.5 bg-emerald-50/50 dark:bg-emerald-500/10 flex items-center justify-between border-b border-emerald-500/10">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[8.5px] uppercase tracking-widest">Wow! You unlocked <span className="font-black border-b border-dashed border-emerald-400">Free Delivery</span></span>
                    </div>
                )}

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-2.5 pb-10 space-y-2.5">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6">
                            <div className="w-16 h-16 bg-white dark:bg-white/5 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                <ShoppingBag size={32} className="text-gray-300" />
                            </div>
                            <h3 className="text-base font-black text-gray-900 dark:text-gray-100 mb-1">Your basket is empty</h3>
                            <p className="text-[11px] text-gray-500 font-medium mb-5">Add items to start shopping</p>
                            <button
                                onClick={() => {
                                    setIsCartOpen(false);
                                    navigate('/');
                                }}
                                className="px-8 py-3 bg-[#0c831f] text-white rounded-full font-black text-[10px] hover:translate-y-[-2px] transition-all shadow-lg shadow-green-500/20 uppercase tracking-widest"
                            >
                                Browse Products
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Delivery Info removed by user request (slot-based delivery) */}
                            <div className="px-3.5 pt-2 flex items-center gap-2">
                                <ShoppingBag size={14} className="text-[#0c831f]" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Your Shipment ({cartCount} {cartCount > 1 ? 'items' : 'item'})</span>
                            </div>

                            {/* Items List - Integrated */}
                            <div className="divide-y divide-gray-50 dark:divide-white/5 px-1">
                                {cart.map((item) => (
                                    <div key={item.id} className="flex gap-2.5 items-center py-3.5 first:pt-1">
                                        <div className="w-10 h-10 border border-gray-50 dark:border-white/5 rounded-lg bg-white dark:bg-white/5 p-1 flex-shrink-0 flex items-center justify-center shadow-sm">
                                            <img
                                                src={item.image || categoryPlaceholder}
                                                alt={item.name}
                                                className="w-full h-full object-contain"
                                                onError={(e) => {
                                                    if (e.target.src !== categoryPlaceholder) {
                                                        e.target.src = categoryPlaceholder;
                                                        e.target.style.objectFit = 'cover';
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="!text-[10px] font-black text-gray-800 dark:text-gray-100 leading-tight mb-0.5 line-clamp-2 tracking-tight uppercase">{item.name}</div>
                                            <p className="!text-[8px] text-gray-400 font-bold mb-1 uppercase tracking-widest opacity-70">{item.weight}</p>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black text-gray-900 dark:text-gray-100 !text-[12px]">₹{item.price}</span>
                                                {((item.originalPrice && Number(item.originalPrice) > Number(item.price)) || (item.mrp && Number(item.mrp) > Number(item.price))) && (
                                                    <span className="line-through text-gray-400 dark:text-zinc-500 text-[10px] font-semibold">
                                                        ₹{item.originalPrice || item.mrp}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={`flex items-center bg-[#0c831f] text-white rounded-lg h-6.5 w-[64px] shadow-md shadow-green-500/10 overflow-hidden flex-shrink-0 quantity-selector ${isStoreOutOfRange ? 'bg-gray-400 cursor-not-allowed opacity-80' : ''}`}>
                                            <button
                                                disabled={isStoreOutOfRange}
                                                onClick={() => !isStoreOutOfRange && updateQuantity(item.id, -1)}
                                                className="flex-1 h-full flex items-center justify-center hover:bg-black/10 transition-colors disabled:cursor-not-allowed"
                                            >
                                                <Minus size={9} strokeWidth={3} />
                                            </button>
                                            <span className="text-[9px] font-black w-4 text-center select-none">{item.quantity}</span>
                                            <button
                                                disabled={isStoreOutOfRange}
                                                onClick={() => !isStoreOutOfRange && updateQuantity(item.id, 1)}
                                                className="flex-1 h-full flex items-center justify-center hover:bg-black/10 transition-colors disabled:cursor-not-allowed"
                                            >
                                                <Plus size={9} strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Add More Items Button */}
                            <div className="px-1 mt-4 mb-2">
                                <button
                                    onClick={() => setIsCartOpen(false)}
                                    className="w-full py-2.5 border border-[#0c831f] text-[#0c831f] dark:border-green-500 dark:text-green-500 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-[#0c831f]/5 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={14} strokeWidth={3} />
                                    Add more products
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Fixed Bottom Section (Bill & CTA) */}
                {cart.length > 0 && (
                    <div className="bg-white dark:bg-[#111111] border-t border-gray-100 dark:border-white/5 px-3 pt-3 pb-[calc(max(env(safe-area-inset-bottom,16px),16px)+20px)] sm:p-4 sm:pb-4 space-y-3 z-20">
                        {/* Bill Details - Moved here to be fixed */}
                        <div className="p-3 bg-gray-50/50 dark:bg-white/5 rounded-[20px] shadow-sm border border-gray-100 dark:border-white/5">
                            <h3 className="!text-[9px] font-black text-gray-400 dark:text-gray-500 mb-3 text-left uppercase tracking-widest">Bill details</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight text-gray-500 dark:text-gray-400">
                                    <span>Items total</span>
                                    <div className="flex items-center gap-1.5 font-black">
                                        {savings > 0 && <span className="line-through text-gray-300 dark:text-gray-600 opacity-60">₹{itemTotalOriginal}</span>}
                                        <span className="text-gray-900 dark:text-gray-100">₹{itemTotalDiscounted}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer CTA */}
                        <button
                            disabled={isStoreOutOfRange}
                            onClick={() => {
                                if (isStoreOutOfRange) return;
                                protectAction(() => {
                                    setIsCartOpen(false);
                                    navigate('/checkout');
                                });
                            }}
                            style={{ borderRadius: '16px' }}
                            className={`w-full text-white px-8 flex items-center justify-between transition-all h-14 shadow-lg shadow-green-500/10 group ${isStoreOutOfRange ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-[#0c831f] hover:bg-[#0a6b19] active:scale-[0.98]'}`}
                        >
                            <div className="flex flex-col items-start leading-none gap-0.5">
                                <span className="font-black text-[15px]">₹{itemTotalDiscounted}</span>
                                <span className="text-[7.5px] font-black uppercase tracking-[0.15em] opacity-80">Item Total</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-black text-[12px]">{user ? (isStoreOutOfRange ? 'Out of Range' : 'Proceed') : 'Login'}</span>
                                <ChevronRight size={16} strokeWidth={3} className={isStoreOutOfRange ? '' : 'group-hover:translate-x-1 transition-transform'} />
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CartSidebar;

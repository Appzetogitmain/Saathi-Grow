import React from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Minus, Plus, ArrowRight, Gift, Sparkles, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ASSET_URLS } from '../../../../constants/assetUrls';
import { getUpsellingPromos } from '../../api/orderApi';
import { toast } from 'react-toastify';
const categoryPlaceholder = ASSET_URLS.placeholder;

const CartPage = () => {
  const { cart, updateQuantity, cartTotal, cartCount, publicSettings } = useCart();
  const { user, protectAction } = useAuth();
  const navigate = useNavigate();

  const thresh = publicSettings?.freeDeliveryThreshold ?? 500;
  const baseDelivery = publicSettings?.baseDeliveryFee ?? 25;
  const surge = publicSettings?.surgeMultiplier ?? 1.0;
  const estimatedDeliveryFee = cartTotal >= thresh ? 0 : Math.round(baseDelivery * surge);
  const handlingFee = publicSettings?.handlingFee ?? 5;
  const [upsellingPromos, setUpsellingPromos] = React.useState([]);
  const [loadingPromos, setLoadingPromos] = React.useState(false);

  const itemTotalOriginal = cart.reduce((acc, item) => {
    const itemOriginal = (item.originalPrice && Number(item.originalPrice) > Number(item.price))
      ? Number(item.originalPrice)
      : ((item.mrp && Number(item.mrp) > Number(item.price)) ? Number(item.mrp) : Number(item.price));
    return acc + itemOriginal * item.quantity;
  }, 0);
  const savings = Math.max(0, itemTotalOriginal - cartTotal);

  const finalTotal = cartTotal + estimatedDeliveryFee + handlingFee;
  const remainingForFreeDelivery = Math.max(0, thresh - cartTotal);

  React.useEffect(() => {
    const fetchUpselling = async () => {
      if (!user || cartTotal <= 0) return;
      setLoadingPromos(true);
      try {
        const result = await getUpsellingPromos(user.token, cartTotal);
        setUpsellingPromos(result.data || []);
      } catch (err) {
        console.error("Upselling fetch failed", err);
      } finally {
        setLoadingPromos(false);
      }
    };
    fetchUpselling();
  }, [cartTotal, user]);

  const handleProceed = () => {
    protectAction(() => {
      navigate('/checkout');
    });
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-[#e8f5e9] to-[#ffffff] md:bg-none md:bg-white dark:from-[#141414] dark:to-[#141414] pb-20 flex flex-col items-center justify-center p-4">
        <div className="w-24 h-24 bg-white/50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
          <span className="text-4xl">??</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Your Cart is Empty</h2>
        <p className="text-gray-500 mb-6 text-center">Looks like you haven't added anything to your cart yet.</p>
        <Link
          to="/"
          style={{ borderRadius: '16px' }}
          className="bg-[var(--saathi-green)] text-white px-8 py-3.5 font-black hover:bg-green-700 transition shadow-lg shadow-green-500/10 uppercase text-xs tracking-widest"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-[#e8f5e9] to-[#ffffff] md:bg-none md:bg-white dark:from-[#141414] dark:to-[#141414] pb-20 transition-colors duration-300">
      <div className="max-w-3xl mx-auto px-4 py-8 md:max-w-6xl md:grid md:grid-cols-3 md:gap-6">
        <div className="md:col-span-2">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">My Cart <span className="text-gray-400 dark:text-gray-500 text-lg font-normal">({cart.length} items)</span></h1>

          {/* Upselling Banners */}
          {!loadingPromos && upsellingPromos.length > 0 && (
            <div className="space-y-3 mb-6 animate-in slide-in-from-left duration-500">
              {upsellingPromos.map((promo) => {
                const diff = promo.minOrderValue - cartTotal;
                if (diff <= 0) return null;
                return (
                  <div key={promo._id} className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-100 dark:border-emerald-800/30 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-emerald-800/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
                        {promo.discountType === 'FreeGift' ? <Gift size={20} /> : <Sparkles size={20} />}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tight leading-none mb-1">
                          {promo.discountType === 'FreeGift' ? '🎁 Free Gift Awaits!' : '🎉 Special Offer unlocked!'}
                        </h4>
                        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-bold leading-tight">
                          Add <span className="text-emerald-900 dark:text-emerald-100 text-sm font-black">₹{diff}</span> more to get {promo.discountType === 'FreeGift' ? (promo.freeGift?.title || 'a Free Gift') : promo.description || 'this offer'}!
                        </p>
                      </div>
                    </div>
                    <Link to="/" className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-white dark:bg-emerald-800/20 px-3 py-2 rounded-lg border border-emerald-100 dark:border-emerald-800/30 hover:bg-emerald-50 transition-colors">
                      Shop More
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-transparent md:bg-white dark:bg-transparent dark:md:bg-gray-800 rounded-none md:rounded-2xl shadow-none md:shadow-sm border-none md:border border-gray-100 dark:border-gray-700 overflow-visible md:overflow-hidden mb-6 md:mb-0">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {cart.map((item) => (
                <div key={item.id} className="p-4 flex gap-4">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center">
                    <img
                      src={item.image || categoryPlaceholder}
                      alt={item.name}
                      className="w-12 h-12 object-contain"
                      onError={(e) => {
                        if (e.target.src !== categoryPlaceholder) {
                          e.target.src = categoryPlaceholder;
                          e.target.style.objectFit = 'cover';
                        }
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-gray-800 dark:text-white text-sm">{item.name}</h3>
                      <div className="text-right">
                        <span className="font-semibold text-gray-900 dark:text-white">₹{item.price * item.quantity}</span>
                        {((item.originalPrice && Number(item.originalPrice) > Number(item.price)) || (item.mrp && Number(item.mrp) > Number(item.price))) && (
                          <span className="block text-xs text-gray-400 dark:text-zinc-500 line-through">
                            ₹{(item.originalPrice || item.mrp) * item.quantity}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{item.weight}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 bg-[var(--saathi-green)]/10 text-[var(--saathi-green)] rounded-lg p-1 w-fit">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-[var(--saathi-green)] hover:text-white rounded transition"><Minus size={14} /></button>
                        <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-[var(--saathi-green)] hover:text-white rounded transition"><Plus size={14} /></button>
                      </div>
                      {/* Optional delete button if needed, but quantity 0 handles it */}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-1">
          {/* Bill Details */}
          <div className="bg-transparent md:bg-white dark:bg-transparent dark:md:bg-gray-800 rounded-none md:rounded-2xl shadow-none md:shadow-sm border-none md:border border-gray-100 dark:border-gray-700 p-6 mb-24 md:mb-0">
            {/* Free Delivery Threshold Banner */}
            {remainingForFreeDelivery > 0 ? (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300">
                Add <span className="font-extrabold text-blue-900 dark:text-blue-100">₹{remainingForFreeDelivery.toFixed(0)}</span> more to unlock <span className="uppercase">Free Delivery</span>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300">
                🎉 You've unlocked <span className="uppercase font-extrabold">Free Standard Delivery</span>!
              </div>
            )}

            <h3 className="font-bold text-gray-800 dark:text-white mb-4">Bill Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Item Total</span>
                <div className="flex items-center gap-1.5 font-semibold">
                  {savings > 0 && <span className="line-through text-gray-400 dark:text-zinc-500 font-normal">₹{itemTotalOriginal}</span>}
                  <span>₹{cartTotal}</span>
                </div>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-[#0c831f] dark:text-emerald-400 font-bold">
                  <span>Product Savings</span>
                  <span>−₹{savings.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Delivery Fee</span>
                <span className={estimatedDeliveryFee === 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                  {estimatedDeliveryFee === 0 ? 'Free' : `₹${estimatedDeliveryFee}`}
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Handling Fee</span>
                <span>₹{handlingFee}</span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between font-bold text-lg text-gray-900 dark:text-white">
                <span>To Pay</span>
                <span>₹{finalTotal}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-[1001]">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={handleProceed}
            style={{ borderRadius: '16px' }}
            className="w-full bg-[var(--saathi-green)] text-white py-4 font-black text-center hover:bg-green-700 transition active:scale-[0.98] shadow-lg shadow-green-500/20 flex items-center justify-between px-8"
          >
            <div className="flex flex-col items-start leading-none gap-0.5">
              <span className="text-xs font-medium opacity-90">{cartCount} {cartCount > 1 ? 'items' : 'item'}</span>
              <span className="text-lg font-bold">₹{finalTotal}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wide">Proceed</span>
              <ArrowRight size={20} strokeWidth={2.5} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;

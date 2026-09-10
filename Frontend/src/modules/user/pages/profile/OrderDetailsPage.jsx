import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, AlertCircle, RefreshCw, XCircle, ChevronRight, Package, Truck, CheckCircle, Navigation as NavIcon, Shield, ShieldCheck, ShoppingBag, Tag, X, Check, Pencil, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as orderApi from '../../api/orderApi';
import { toast } from 'react-toastify';

const OrderDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();

    const [order, setOrder] = useState(null);
    const [rawOrder, setRawOrder] = useState(null); // Full raw data for guard checks
    const [isLoading, setIsLoading] = useState(true);
    const [currentTag, setCurrentTag] = useState(null);
    const [showTagModal, setShowTagModal] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [userTags, setUserTags] = useState([]);
    const [tagLoading, setTagLoading] = useState(false);
    
    // Feedback State
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackComment, setFeedbackComment] = useState('');
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [hoverRating, setHoverRating] = useState(0);

    useEffect(() => {
        const processOrderData = (data) => {
            const d = new Date(data.createdAt);
            const formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ", " + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

            const resolveWeight = (item) => {
                if (item.selectedVariant?.value) return item.selectedVariant.value;
                if (item.weight) return item.weight;
                const p = item.product;
                if (p?.unitValue != null && p.unitValue !== '') {
                    return `${p.unitValue} ${p.unitType || ''}`.trim();
                }
                const match = String(item.name || '').match(/\(([^)]+)\)\s*$/);
                return match?.[1]?.trim() || '';
            };

            const resolveDisplayName = (item, weight) => {
                const raw = item.name || item.product?.name || 'Unknown Product';
                if (!weight) return raw;
                const escaped = weight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return raw.replace(new RegExp(`\\s*\\(${escaped}\\)\\s*$`, 'i'), '').trim() || raw;
            };

            const immediateDeliveryFee = Number(data.immediateDeliveryFee) || 0;
            const totalDeliveryFee = Number(data.deliveryFee) || 0;
            const baseDeliveryFee = data.baseDeliveryFee != null ? Number(data.baseDeliveryFee) : Math.max(0, totalDeliveryFee - immediateDeliveryFee);

            return {
                id: data._id,
                status: data.status,
                date: formattedDate,
                subTotal: data.subTotal || 0,
                deliveryFee: totalDeliveryFee,
                baseDeliveryFee,
                immediateDeliveryFee,
                isImmediate: data.isImmediate,
                deliverySlot: data.deliverySlot,
                taxAmount: data.taxAmount || 0,
                handlingFee: data.handlingFee || 0,
                discountAmount: data.discountAmount || 0,
                total: data.totalAmount,
                items: data.items.map(item => {
                    const weight = resolveWeight(item);
                    const name = resolveDisplayName(item, weight);
                    return {
                        name,
                        fullName: item.name || item.product?.name || name,
                        weight,
                        qty: item.quantity,
                        price: '₹' + item.price,
                        img: item.image || (item.product?.image && item.product.image) || 'https://via.placeholder.com/150'
                    };
                })
            };
        };

        const loadOrder = async (isFirstLoad = true) => {
            if (token && id) {
                try {
                    if (isFirstLoad) setIsLoading(true);
                    const data = await orderApi.fetchOrderDetails(token, id);
                    const processed = processOrderData(data);
                    
                    setRawOrder(data);
                    setOrder(processed);
                    setCurrentTag(data.tag || null);
                } catch (err) {
                    if (isFirstLoad) {
                        toast.error("Failed to load secure order details.");
                        navigate('/orders');
                    }
                } finally {
                    if (isFirstLoad) setIsLoading(false);
                }
            }
        };

        loadOrder(true);

        // Polling every 5 seconds for real-time status updates
        const intervalId = setInterval(async () => {
            if (token && id) {
                try {
                    const data = await orderApi.fetchOrderDetails(token, id);
                    
                    setRawOrder((prevRaw) => {
                        if (!prevRaw) return data;
                        // Check if status or critical tracking fields have updated
                        if (
                            prevRaw.status !== data.status || 
                            prevRaw.deliveryOTP !== data.deliveryOTP || 
                            prevRaw.deliveryPartnerId?._id !== data.deliveryPartnerId?._id ||
                            prevRaw.returnRequest?.status !== data.returnRequest?.status ||
                            prevRaw.returnRequest?.returnOTP !== data.returnRequest?.returnOTP
                        ) {
                            const processed = processOrderData(data);
                            setOrder(processed);
                            setCurrentTag(data.tag || null);
                            
                            // If order reached a final/terminal state, clear interval
                            if (['delivered', 'cancelled', 'returned'].includes(data.status)) {
                                clearInterval(intervalId);
                            }
                            return data;
                        }
                        return prevRaw;
                    });
                } catch (err) {
                    console.warn('[ORDER_DETAILS] Realtime polling update failed:', err);
                }
            }
        }, 5000);

        return () => clearInterval(intervalId);
    }, [token, id, navigate]);

    useEffect(() => {
        if (token) {
            orderApi.getUserTags(token).then(setUserTags).catch(() => {});
        }
    }, [token]);

    // Prevent body scroll when tag modal is open
    useEffect(() => {
        if (showTagModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showTagModal]);

    const handleSaveTag = async () => {
        if (!tagInput.trim()) return;
        setTagLoading(true);
        try {
            const res = await orderApi.setOrderTag(token, id, tagInput.trim());
            setCurrentTag(res.tag);
            setShowTagModal(false);
            setTagInput('');
            toast.success('Tag saved!');
        } catch {
            toast.error('Failed to save tag');
        } finally {
            setTagLoading(false);
        }
    };

    const handleRemoveTag = async () => {
        setTagLoading(true);
        try {
            await orderApi.removeOrderTag(token, id);
            setCurrentTag(null);
            setShowTagModal(false);
            toast.success('Tag removed');
        } catch {
            toast.error('Failed to remove tag');
        } finally {
            setTagLoading(false);
        }
    };

    const handleFeedbackSubmit = async () => {
        if (!feedbackRating) {
            toast.error('Please select a rating');
            return;
        }
        setIsSubmittingFeedback(true);
        try {
            const res = await orderApi.submitOrderFeedback(token, id, feedbackRating, feedbackComment);
            toast.success('Feedback submitted successfully!');
            setRawOrder(prev => ({ ...prev, feedback: res.feedback }));
        } catch (err) {
            toast.error(err.message || 'Failed to submit feedback');
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex justify-center items-center bg-[#f4f6f8] dark:bg-[#141414]">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0c831f]"></div>
            </div>
        );
    }

    if (!order) return null;

    return (
        <div className="min-h-screen bg-[#f4f6f8] dark:bg-[#141414] transition-colors duration-300 pb-28">
            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-40 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-white/5 shadow-sm">
                <div className="max-w-2xl md:max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
                    <button
                        onClick={() => navigate('/orders')}
                        className="w-9 h-9 flex items-center justify-center bg-gray-50 dark:bg-white/5 rounded-full border border-gray-100 dark:border-white/10 text-gray-500 active:scale-95 transition-all flex-shrink-0"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-gray-900 dark:text-white leading-none truncate">Order Summary</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-0.5 truncate">#{rawOrder?.orderId || order.id.slice(-8).toUpperCase()} · {order.date}</p>
                    </div>
                    {/* Tag badge in header */}
                    {currentTag ? (
                        <button
                            onClick={() => { setTagInput(currentTag); setShowTagModal(true); }}
                            className="flex items-center gap-1 bg-[#eefaf1] dark:bg-[#0c831f]/10 text-[#0c831f] border border-[#0c831f]/20 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide active:scale-95 transition-all flex-shrink-0"
                        >
                            <Tag size={10} /> {currentTag} <Pencil size={9} className="opacity-50" />
                        </button>
                    ) : (
                        <button
                            onClick={() => { setTagInput(''); setShowTagModal(true); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-gray-300 dark:border-white/10 text-gray-400 text-[10px] font-black uppercase tracking-wide active:scale-95 transition-all flex-shrink-0"
                        >
                            <Tag size={10} /> Tag
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-2xl md:max-w-3xl mx-auto px-4 py-4">
                {order.status === 'cancelled' ? (
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4 mb-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400">
                            <XCircle size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-wide">Order Cancelled</h3>
                            <p className="text-xs font-medium text-red-500 dark:text-red-300">This order has been cancelled.</p>
                        </div>
                    </div>
                ) : (
                <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl p-4 mb-4 border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden relative">
                    {/* Background Line */}
                    <div className="absolute top-[27px] md:top-[38px] left-[12.5%] right-[12.5%] h-[2px] bg-gray-200 dark:bg-white/10 z-0"></div>
                    {/* Active Line (75% total span across 3 gaps) */}
                    <div className="absolute top-[27px] md:top-[38px] left-[12.5%] h-[2px] bg-[#0c831f] z-0 transition-all duration-700 ease-in-out shadow-[0_0_10px_rgba(12,131,31,0.3)]" 
                        style={{
                            width: ['delivered', 'returned'].includes(order.status) ? '75%' :
                                   order.status === 'out_for_delivery' ? '50%' :
                                   ['confirmed', 'preparing', 'ready_for_pickup'].includes(order.status) ? '25%' : '0%'
                        }}
                    ></div>

                    <div className="flex items-start justify-between relative z-10 text-center">
                        <div className="flex flex-col items-center gap-2 w-1/4">
                            <div className={`w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${order.status === 'cancelled' ? 'bg-red-600 text-white shadow-red-500/20' : 'bg-[#0c831f] text-white shadow-green-500/20'}`}>
                                <Package size={12} className="md:w-4 md:h-4" />
                            </div>
                            <span className={`text-[8px] md:text-sm font-black uppercase tracking-tight ${order.status === 'cancelled' ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>Placed</span>
                        </div>
                        
                        <div className="flex flex-col items-center gap-2 w-1/4">
                            <div className={`w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'returned'].includes(order.status) ? 'bg-[#0c831f] text-white shadow-green-500/20' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border border-gray-200 dark:border-white/10'}`}>
                                <RefreshCw size={12} className="md:w-4 md:h-4" />
                            </div>
                            <span className={`text-[8px] md:text-sm font-black uppercase tracking-tight ${['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'returned'].includes(order.status) ? 'text-[#0c831f]' : 'text-gray-400'}`}>Processing</span>
                        </div>
                        
                        <div className="flex flex-col items-center gap-2 w-1/4">
                            <div className={`w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${['out_for_delivery', 'delivered', 'returned'].includes(order.status) ? 'bg-[#0c831f] text-white shadow-green-500/20' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border border-gray-200 dark:border-white/10'}`}>
                                <Truck size={12} className="md:w-4 md:h-4" />
                            </div>
                            <span className={`text-[8px] md:text-sm font-black uppercase tracking-tight ${['out_for_delivery', 'delivered', 'returned'].includes(order.status) ? 'text-[#0c831f]' : 'text-gray-400'}`}>Shipped</span>
                        </div>
                        
                        <div className="flex flex-col items-center gap-2 w-1/4">
                            <div className={`w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${['delivered', 'returned'].includes(order.status) ? 'bg-[#0c831f] text-white shadow-green-500/20' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border border-gray-200 dark:border-white/10'}`}>
                                <CheckCircle size={12} className="md:w-4 md:h-4" />
                            </div>
                            <span className={`text-[8px] md:text-sm font-black uppercase tracking-tight leading-none ${['delivered', 'returned'].includes(order.status) ? 'text-[#0c831f]' : 'text-gray-400'}`}>
                                {order.status === 'returned' || rawOrder?.returnRequest?.isRequested ? 'Returned' : 'Delivered'}
                            </span>
                        </div>
                    </div>
                </div>
                )}

                {/* Tag Modal */}
                {showTagModal && (
                <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowTagModal(false)}>
                        <div className="bg-white dark:bg-[#1a1a1a] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm p-6 pb-24 sm:pb-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black text-gray-900 dark:text-white text-base">Tag this order</h3>
                                <button onClick={() => setShowTagModal(false)} className="p-1.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-400"><X size={16} /></button>
                            </div>
                            <input
                                type="text"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveTag()}
                                placeholder="e.g. ration, monthly, groceries"
                                maxLength={30}
                                autoFocus
                                className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#0c831f] bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white mb-3"
                            />
                            {userTags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {userTags.map(t => (
                                        <button key={t.tagName} onClick={() => setTagInput(t.tagName)}
                                            className={`px-3 py-1 rounded-full text-[11px] font-black border transition-all ${tagInput === t.tagName ? 'bg-[#0c831f] text-white border-[#0c831f]' : 'bg-gray-50 dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/10 hover:border-[#0c831f] hover:text-[#0c831f]'}`}>
                                            {t.tagName} <span className="opacity-60">({t.orderCount})</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                {currentTag && (
                                    <button onClick={handleRemoveTag} disabled={tagLoading} className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-black hover:bg-red-50 transition-all disabled:opacity-50">
                                        Remove
                                    </button>
                                )}
                                <button onClick={handleSaveTag} disabled={tagLoading || !tagInput.trim()} className="flex-1 py-2.5 rounded-xl bg-[#0c831f] text-white text-sm font-black hover:bg-[#0a6b19] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                    {tagLoading ? <RefreshCw size={14} className="animate-spin" /> : <><Check size={14} /> Save Tag</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {order.status === 'returned' && (
                    <div className="bg-[#0c831f]/10 border border-[#0c831f]/20 p-4 rounded-2xl flex items-center gap-4 mb-6 animate-pulse">
                        <div className="w-10 h-10 rounded-xl bg-[#0c831f] flex items-center justify-center text-white">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#0c831f] mb-1">Refund Processed</p>
                            <p className="text-xs font-bold text-gray-600 dark:text-gray-400">Total amount has been credited back to your wallet.</p>
                        </div>
                    </div>
                )}

                {/* PIN and Tracking in one line */}
                <div className="flex gap-2 mb-4">
                    {rawOrder?.deliveryOTP && !['delivered', 'cancelled', 'returned', 'return_requested', 'return_pickup_scheduled', 'return_pickup_out'].includes(rawOrder.status) && (
                        <div className="flex-1 bg-[#0c831f] text-white p-2.5 !rounded-[1.2rem] flex items-center justify-center gap-2 shadow-lg shadow-green-500/10 border border-white/10 overflow-hidden">
                            <Shield size={14} className="text-white" />
                            <span className="text-[10.5px] font-black tracking-widest uppercase">PIN: {rawOrder.deliveryOTP}</span>
                        </div>
                    )}

                    {!['delivered', 'cancelled', 'returned', 'return_requested', 'return_pickup_scheduled', 'return_pickup_out', 'failed'].includes(order.status) && (
                        <div
                            role="button"
                            onClick={() => navigate(`/orders/${order.id}/tracking`)}
                            className="flex-[1.5] bg-[#0c831f] text-white py-2.5 !rounded-[1.2rem] flex items-center justify-center gap-2 font-black text-[10.5px] uppercase tracking-widest shadow-lg shadow-green-500/10 active:scale-95 transition-all cursor-pointer overflow-hidden border-none"
                        >
                            <NavIcon size={14} />
                            Track Delivery
                        </div>
                    )}                </div>

                {/* Secure Return PIN Display - Always Full Width */}
                {rawOrder?.returnRequest?.isRequested &&
                    ['Accepted', 'Approved', 'Scheduled', 'PickedUp'].includes(rawOrder.returnRequest.status) &&
                    rawOrder.returnRequest.returnOTP &&
                    rawOrder.status !== 'returned' && (
                        <div className="bg-orange-600 text-white p-3 rounded-xl flex items-center justify-between shadow-lg shadow-orange-500/10 mb-4 border border-white/10 animate-in slide-in-from-top duration-500">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md">
                                    <Shield size={16} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-[10.5px] font-black uppercase tracking-widest text-white leading-none mb-0.5">Return PIN: {rawOrder.returnRequest.returnOTP}</p>
                                    <p className="text-[8.5px] font-bold tracking-tight text-white/80">Share with partner for pickup</p>
                                </div>
                            </div>
                        </div>
                    )}

                <div className="space-y-4 animate-in fade-in duration-500">
                    
                    {/* Order Feedback / Rating Section */}
                    {order.status === 'delivered' && (
                        <div className="bg-white dark:bg-[#1c1c1c] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <Star size={13} className="text-[#0c831f]" />
                                <h3 className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Order Feedback</h3>
                            </div>
                            {rawOrder?.feedback?.rating ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star key={star} size={16} className={star <= rawOrder.feedback.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 dark:text-gray-600"} />
                                        ))}
                                    </div>
                                    {rawOrder.feedback.comment && (
                                        <p className="text-[12px] text-gray-600 dark:text-gray-300 italic">"{rawOrder.feedback.comment}"</p>
                                    )}
                                    <p className="text-[10px] text-gray-400 font-bold">Thank you for your feedback!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-[12px] font-bold text-gray-800 dark:text-gray-200">How was your order experience?</p>
                                    <div className="flex items-center gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button 
                                                key={star} 
                                                type="button"
                                                onClick={() => setFeedbackRating(star)}
                                                onMouseEnter={() => setHoverRating(star)}
                                                onMouseLeave={() => setHoverRating(0)}
                                                className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                                            >
                                                <Star size={24} className={(hoverRating || feedbackRating) >= star ? "text-yellow-400 fill-yellow-400" : "text-gray-200 dark:text-white/10"} />
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        value={feedbackComment}
                                        onChange={(e) => setFeedbackComment(e.target.value)}
                                        placeholder="Tell us what you liked or how we can improve..."
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl p-3 text-[12px] font-medium outline-none focus:border-[#0c831f] resize-none h-20"
                                    ></textarea>
                                    <button 
                                        onClick={handleFeedbackSubmit}
                                        disabled={!feedbackRating || isSubmittingFeedback}
                                        className="w-full py-3 rounded-xl bg-[#0c831f] text-white text-[12px] font-black uppercase tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        {isSubmittingFeedback ? <RefreshCw size={14} className="animate-spin" /> : 'Submit Feedback'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Order Items */}
                    <div className="bg-white dark:bg-[#1c1c1c] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] mb-3 uppercase">Ordered items</p>
                        <div className="divide-y divide-gray-50 dark:divide-white/5">
                            {order.items.map((item, i) => (
                                <div key={i} className="flex items-center gap-3 py-3">
                                    <div className="w-11 h-11 rounded-xl bg-gray-50 dark:bg-white/10 p-1.5 border border-gray-100 dark:border-white/10 flex-shrink-0">
                                        <img src={item.img} alt={item.name} className="w-full h-full object-contain" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="text-[12px] font-black text-gray-800 dark:text-gray-100 leading-tight truncate cursor-default"
                                            title={item.fullName || item.name}
                                        >
                                            {item.name}
                                        </div>
                                        {item.weight ? (
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold mt-0.5 uppercase tracking-wide">
                                                {item.weight}
                                            </div>
                                        ) : null}
                                        <div className="text-[10px] text-gray-400 font-bold mt-0.5">{item.qty} × {item.price}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bill Details */}
                    <div className="bg-white dark:bg-[#1c1c1c] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <ShoppingBag size={13} className="text-[#0c831f]" />
                            <h3 className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Bill details</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-[12px] text-gray-500 font-medium">Items Total</span>
                                <span className="text-[12px] font-black text-gray-900 dark:text-white">₹{order.subTotal}</span>
                            </div>
                            {order.immediateDeliveryFee > 0 ? (
                                <>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[12px] text-gray-500 font-medium">Base Delivery Fee</span>
                                        <span className={`text-[12px] font-black ${order.baseDeliveryFee === 0 ? 'text-[#0c831f]' : 'text-gray-900 dark:text-white'}`}>
                                            {order.baseDeliveryFee === 0 ? 'Free' : `₹${order.baseDeliveryFee}`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[#0c831f]">
                                        <span className="text-[12px] font-bold">Express Delivery Surcharge</span>
                                        <span className="text-[12px] font-black">+₹{order.immediateDeliveryFee}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <span className="text-[12px] text-gray-500 font-medium">Delivery Fee</span>
                                    <span className={`text-[12px] font-black ${order.deliveryFee === 0 ? 'text-[#0c831f]' : 'text-gray-900 dark:text-white'}`}>
                                        {order.deliveryFee === 0 ? 'Free' : `₹${order.deliveryFee}`}
                                    </span>
                                </div>
                            )}
                            {order.handlingFee > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[12px] text-gray-500 font-medium">Handling Fee</span>
                                    <span className="text-[12px] font-black text-gray-900 dark:text-white">₹{order.handlingFee}</span>
                                </div>
                            )}
                            {order.taxAmount > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[12px] text-gray-500 font-medium">Taxes (GST)</span>
                                    <span className="text-[12px] font-black text-gray-900 dark:text-white">₹{order.taxAmount}</span>
                                </div>
                            )}
                            {order.discountAmount > 0 && (
                                <div className="flex justify-between items-center text-[#0c831f]">
                                    <span className="text-[12px] font-bold">Promo Discount</span>
                                    <span className="text-[12px] font-black">−₹{order.discountAmount}</span>
                                </div>
                            )}
                            <div className="pt-3 border-t border-dashed border-gray-100 dark:border-white/10 flex justify-between items-center">
                                <span className="text-[14px] font-black text-gray-900 dark:text-white">Grand Total</span>
                                <span className="text-[18px] font-black text-gray-900 dark:text-white">₹{order.total}</span>
                            </div>
                        </div>
                    </div>

                    {/* Support Actions */}
                    <div className="bg-white dark:bg-[#1c1c1c] border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] px-4 pt-4 pb-2 uppercase">Need help with this order?</p>
                        <div className="divide-y divide-gray-50 dark:divide-white/5">
                            <button
                                onClick={() => navigate(`/orders/${order.id}/reorder`)}
                                className="w-full py-4 px-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98] transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-[#0c831f] border border-green-100 dark:border-green-500/10 flex-shrink-0">
                                        <RefreshCw size={15} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[12px] font-black text-gray-800 dark:text-gray-100">Reorder these items</div>
                                        <p className="text-[10px] text-gray-400 font-medium">Quickly repeat this order with custom quantities</p>
                                    </div>
                                </div>
                                <ChevronRight size={14} className="text-gray-300 group-hover:text-[#0c831f] transition-all flex-shrink-0" />
                            </button>

                            {['delivered', 'returned', 'cancelled'].includes(order.status) && (
                                <button onClick={() => navigate(`/orders/${order.id}/complaint`)} className="w-full py-4 px-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98] transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-100 dark:border-orange-500/10 flex-shrink-0">
                                            <MessageSquare size={15} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[12px] font-black text-gray-800 dark:text-gray-100">Raise a complaint</div>
                                            <p className="text-[10px] text-gray-400 font-medium">Issues with delivery or payment</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} className="text-gray-300 group-hover:text-orange-500 transition-all flex-shrink-0" />
                                </button>
                            )}

                            {(['delivered', 'returned'].includes(order.status) || rawOrder?.returnRequest?.isRequested) && (
                                <button
                                    onClick={() => {
                                        const canReturn = order.status === 'delivered' && !rawOrder?.returnRequest?.isRequested;
                                        if (canReturn) { navigate(`/orders/${order.id}/return`); }
                                        else if (rawOrder?.returnRequest?.isRequested) {
                                            const rStatus = rawOrder.returnRequest.status;
                                            toast.info(rStatus === 'Approved' ? 'Return approved! Refund processing.' : rStatus === 'Rejected' ? 'Return request was rejected.' : 'Return request is under review.');
                                        } else { toast.info('Returns available only for delivered orders.'); }
                                    }}
                                    className={`w-full py-4 px-4 flex items-center justify-between transition-all group ${order.status === 'delivered' && !rawOrder?.returnRequest?.isRequested ? 'hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98]' : 'opacity-50 cursor-not-allowed'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${rawOrder?.returnRequest?.isRequested ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-blue-50 text-blue-500 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/10'}`}>
                                            <RefreshCw size={15} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[12px] font-black text-gray-800 dark:text-gray-100">Return items</div>
                                            <p className="text-[10px] text-gray-400 font-medium">
                                                {rawOrder?.returnRequest?.isRequested ? `Request ${rawOrder.returnRequest.status?.toLowerCase()}` : order.status === 'delivered' ? 'Returning defective or wrong items' : 'Available only after delivery'}
                                            </p>
                                        </div>
                                    </div>
                                    {order.status === 'delivered' && !rawOrder?.returnRequest?.isRequested && <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-all flex-shrink-0" />}
                                </button>
                            )}

                            {order.status === 'pending' && (
                                <button
                                    onClick={() => navigate(`/orders/${order.id}/cancel`)}
                                    className="w-full py-4 px-4 flex items-center justify-between transition-all group hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 border border-red-100 dark:border-red-500/10 flex-shrink-0">
                                            <XCircle size={15} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[12px] font-black text-gray-800 dark:text-gray-100">Cancel order</div>
                                            <p className="text-[10px] text-gray-400 font-medium">Cancel before the order is confirmed</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} className="text-gray-300 group-hover:text-red-500 transition-all flex-shrink-0" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetailsPage;

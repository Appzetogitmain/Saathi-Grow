import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShoppingBag, Package, ChevronRight, Clock, Loader2, Navigation } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as orderApi from '../../api/orderApi';
import { toast } from 'react-toastify';

const OrdersPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { token } = useAuth();

    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchOrders = async (silent = false) => {
        if (token) {
            try {
                if (!silent) setIsLoading(true);
                const data = await orderApi.fetchMyOrders(token);

                const mappedOrders = data.map(o => {
                    const d = new Date(o.createdAt);
                    const formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ", " + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

                    // Determine Color & Display Status
                    const statusLower = (o.status || '').toLowerCase();
                    let colorClass = 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/10'; // Default: Success/Delivered
                    let displayStatus = o.status;

                    if (['pending'].includes(statusLower)) {
                        colorClass = 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-white/5';
                        displayStatus = 'Placed';
                    } else if (['confirmed', 'preparing', 'ready_for_pickup'].includes(statusLower)) {
                        colorClass = 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/10';
                        displayStatus = statusLower === 'ready_for_pickup' ? 'Ready for Pickup' : statusLower === 'preparing' ? 'Preparing' : 'Confirmed';
                    } else if (['out_for_delivery', 'shipped'].includes(statusLower)) {
                        colorClass = 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10';
                        displayStatus = 'Out for Delivery';
                    } else if (['cancelled', 'returned'].includes(statusLower)) {
                        colorClass = 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10';
                        displayStatus = statusLower === 'cancelled' ? 'Cancelled' : 'Returned';
                    } else if (statusLower.includes('return')) {
                        colorClass = 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10';
                        displayStatus = 'Return Processing';
                    }

                    return {
                        id: o._id,
                        orderId: o.orderId,
                        status: displayStatus,
                        rawStatus: o.status,
                        date: formattedDate,
                        amount: '₹' + o.totalAmount.toFixed(2),
                        items: o.items.map((item, idx) => {
                            return item.name;
                        }).reduce((acc, curr, i) => {
                             return i === 0 ? [curr] : [...acc, ', ', curr];
                        }, []),
                        color: colorClass,
                        paymentMethod: o.paymentMethod,
                        isImmediate: Boolean(o.isImmediate || o.immediateDeliveryFee > 0),
                        deliveryOTP: o.deliveryOTP,
                        returnRequest: o.returnRequest
                    }
                });

                setOrders(mappedOrders);
            } catch (err) {
                if (!silent) toast.error("Failed to load secure transaction history");
            } finally {
                if (!silent) setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchOrders();

        const handleRefresh = () => fetchOrders(true);
        window.addEventListener('saathi_refresh', handleRefresh);
        return () => window.removeEventListener('saathi_refresh', handleRefresh);
    }, [token]);

    return (
        <div className="min-h-screen bg-gradient-to-r from-[#e8f5e9] to-[#ffffff] dark:from-[#141414] dark:to-[#141414] md:bg-white md:dark:bg-black md:bg-none transition-colors duration-300 pb-20 md:p-8 md:pb-8">
            <div className="max-w-2xl md:max-w-6xl mx-auto">
                {/* Header */}
                {/* Header- Sticky & Blurred */}
                <div className="flex items-center gap-3 mb-0 md:mb-10 p-4 md:p-0 border-b border-gray-200/50 dark:border-white/5 md:border-none bg-white/80 dark:bg-black/80 backdrop-blur-lg z-50 sticky top-0 transition-colors">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 md:p-2 bg-white/50 dark:bg-[#141414] rounded-full shadow-sm hover:bg-gray-100 transition-colors md:bg-gray-50 active:scale-95"
                    >
                        <ArrowLeft size={18} className="md:w-6 md:h-6" />
                    </button>
                    <h1 className="!text-[16px] md:!text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">My Orders</h1>
                </div>

                {/* Orders List */}
                <div className="px-0 md:px-0">
                    <p className="!text-[10px] md:!text-sm font-bold text-gray-500 dark:text-gray-400 px-4 py-3 md:px-0 md:mb-6 tracking-widest uppercase bg-gray-50/80 dark:bg-white/5 border-y border-gray-100 dark:border-white/5 md:border-none md:bg-transparent">Your Purchase History</p>
                    <div className="divide-y divide-gray-200 dark:divide-white/5 md:divide-none grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:gap-6 bg-transparent md:bg-transparent">
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                onClick={() => navigate(`/orders/${order.id}`)}
                                className="w-full py-3 px-6 md:p-6 flex flex-col hover:bg-gray-50 dark:hover:bg-white/5 md:bg-white dark:md:bg-[#141414] md:border md:border-gray-100 dark:md:border-white/5 md:rounded-2xl transition-all group cursor-pointer md:hover:shadow-md"
                            >
                                <div className="flex justify-between items-start mb-1 md:mb-6">
                                    <div className="flex items-center gap-4 md:gap-4">
                                        <div className="w-9 h-9 md:w-14 md:h-14 rounded-full md:rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center shadow-sm text-[#0c831f]">
                                            <Package size={18} className="md:w-7 md:h-7" />
                                        </div>
                                        <div>
                                            <div className="!text-[13px] md:!text-lg font-black text-gray-900 dark:text-gray-100 tracking-tight leading-none mb-1 md:mb-1.5">Order #{order.orderId || order.id.slice(-6).toUpperCase()}</div>
                                            <div className="!text-[10px] md:!text-xs text-gray-400 font-bold uppercase tracking-wider">{order.date}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-2">
                                            {/* Track Action for Active Orders */}
                                            {!['delivered', 'cancelled', 'returned', 'return_requested', 'return_pickup_scheduled', 'return_pickup_out', 'failed'].includes((order.rawStatus || order.status || '').toLowerCase()) && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/orders/${order.id}/tracking`);
                                                    }}
                                                    className="px-2.5 py-1 bg-[#0c831f] hover:bg-[#0a6b19] text-white rounded-full md:rounded-lg !text-[8px] md:!text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                                                >
                                                    <Navigation size={9} className="fill-current" />
                                                    Track
                                                </button>
                                            )}
                                            <div className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full md:rounded-lg !text-[8px] md:!text-[10px] font-black uppercase tracking-widest border border-current bg-opacity-10 ${order.color}`}>
                                                {order.status}
                                            </div>
                                        </div>
                                        {/* Delivery OTP Flow */}
                                        {order.deliveryOTP && !['delivered', 'cancelled', 'returned', 'return_requested', 'return_pickup_scheduled', 'return_pickup_out'].includes(order.status) && (
                                            <div className="px-2 py-0.5 bg-[#0c831f] text-white rounded-lg text-[9px] md:text-[10px] font-black tracking-widest shadow-sm">
                                                PIN: {order.deliveryOTP}
                                            </div>
                                        )}
                                        {/* Return OTP Flow */}
                                        {order.returnRequest?.isRequested &&
                                            ['Accepted', 'Approved', 'Scheduled', 'PickedUp'].includes(order.returnRequest.status) &&
                                            order.returnRequest.returnOTP &&
                                            order.status !== 'returned' && (
                                                <div className="px-2 py-0.5 bg-orange-600 text-white rounded-lg text-[9px] md:text-[10px] font-black tracking-widest shadow-sm">
                                                    RETURN PIN: {order.returnRequest.returnOTP}
                                                </div>
                                            )}
                                    </div>
                                </div>

                                <div className="flex justify-between items-end md:items-center pl-13 md:pl-0 md:mt-auto">
                                    <div className="md:flex-1 md:pr-4">
                                        {/* Mobile: Removed 'Items Summary' label for cleaner look, usually context is sufficient or keep concise */}
                                        <div className="!text-[11px] md:!text-sm font-medium text-gray-600 dark:text-gray-300 line-clamp-1 md:line-clamp-2 mt-1">{order.items}</div>
                                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                            <div className="inline-block px-2 py-0.5 rounded text-[8px] md:text-[10px] font-black tracking-widest uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                                PAYMENT: {order.paymentMethod === 'cod' ? 'COD' : 'ONLINE'}
                                            </div>
                                            {order.isImmediate && (
                                                <div className="inline-block px-2 py-0.5 rounded text-[8px] md:text-[10px] font-black tracking-widest uppercase bg-green-50 text-[#0c831f] border border-green-200 dark:bg-green-500/10 dark:border-green-500/20">
                                                    ⚡ Express
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right md:flex flex-col items-end md:justify-between md:h-full">
                                        <div className="!text-[14px] md:!text-xl font-black text-gray-900 dark:text-gray-100 mb-0 md:mb-2">{order.amount}</div>
                                        <div className="hidden md:flex !text-[8px] md:!text-xs text-[#0c831f] font-black items-center gap-1 justify-end uppercase tracking-widest md:group-hover:translate-x-1 transition-transform">
                                            Details <ChevronRight size={10} className="md:w-4 md:h-4" strokeWidth={3} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-24 md:py-32 text-center">
                        <Loader2 className="animate-spin text-[#0c831f] mb-4" size={32} />
                        <p className="text-[10px] md:text-xs text-gray-400 font-bold tracking-widest uppercase">Fetching Order History...</p>
                    </div>
                )}

                {!isLoading && orders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 md:py-32 text-center px-6">
                        <div className="w-16 h-16 md:w-24 md:h-24 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 md:mb-8 shadow-inner">
                            <ShoppingBag size={32} className="text-gray-300 md:w-10 md:h-10" />
                        </div>
                        <h2 className="!text-[14px] md:!text-2xl font-black text-gray-900 dark:text-gray-100 mb-2 md:mb-4">No orders yet</h2>
                        <p className="!text-[10px] md:!text-base text-gray-400 font-medium mb-8 md:mb-10 max-w-[200px] md:max-w-md">Start shopping to see your purchase history here!</p>
                        <button
                            onClick={() => navigate('/')}
                            className="bg-[#0c831f] text-white px-8 py-3 md:px-10 md:py-4 rounded-xl !text-[11px] md:!text-sm font-black uppercase tracking-widest shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all hover:bg-[#0a6b19]"
                        >
                            Explore Store
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrdersPage;

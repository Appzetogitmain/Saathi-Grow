import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDeliveryDetail } from '../services/deliveryService';
import useDeliveryStore from '../store/deliveryStore';
import { 
    ChevronLeft, Loader2, Package, MapPin, 
    CheckCircle2, AlertCircle, Phone, Truck, ArrowRight, FileText
} from 'lucide-react';

const RunDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useDeliveryStore();
    const [run, setRun] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetail = async () => {
            if (!token || !id) return;
            try {
                const data = await getDeliveryDetail(token, id);
                setRun(data);
            } catch (error) {
                console.error("Failed to load run details:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [id, token]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-[#028A0F] mb-4" size={40} />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Mission Protocol...</p>
            </div>
        );
    }

    if (!run) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <AlertCircle className="text-red-500 mb-4" size={40} />
                <p className="font-bold">Mission details not found.</p>
                <button 
                    onClick={() => navigate('/delivery/orders')}
                    className="mt-4 px-6 py-2 bg-slate-100 rounded-xl font-bold"
                >
                    Back to Orders
                </button>
            </div>
        );
    }

    const isReturn = run.runType === 'return';
    const activeStopsCount = run.orders?.filter(o => 
        isReturn ? ['pending', 'out_for_delivery'].includes(o.status) : ['pending', 'out_for_delivery'].includes(o.status)
    ).length || 0;

    // Calculate source/pickup point info safely
    const pickupSource = run.vendor || run.branchId || run.orders?.[0]?.order?.vendor || run.orders?.[0]?.order?.branchId;
    const isVendor = !!(run.vendor || run.orders?.[0]?.order?.vendor);
    const sourceName = isVendor ? (pickupSource?.storeName || 'Vendor Store') : (pickupSource?.name || 'Central Branch');
    const sourceAddress = typeof pickupSource?.address === 'object' 
        ? `${pickupSource.address.street || ''}, ${pickupSource.address.city || ''}, ${pickupSource.address.state || ''}`.trim().replace(/^,\s*/, '')
        : (pickupSource?.address || 'Store Location Address not specified');
    const sourcePhone = pickupSource?.phone || 'N/A';

    return (
        <div className="space-y-4 md:space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button 
                    onClick={() => navigate(-1)} 
                    className="p-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl text-slate-400 hover:text-[#028A0F] transition-all shadow-sm"
                >
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                        {isReturn ? 'Reverse Logistics' : 'Dispatch Batch'}
                    </h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5">
                        Mission ID: {run.orders?.[0]?.order?.orderId ? `#${run.orders[0].order.orderId}` : run.runId}
                    </p>
                </div>
            </div>

            {/* General Info Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-slate-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                    <Truck size={120} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-end justify-between">
                    <div>
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4
                            ${run.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              run.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 
                              'bg-amber-100 text-amber-700'}`
                        }>
                            {run.status.replace('_', ' ')}
                        </div>
                        <h2 className="text-3xl font-black mb-1">
                            {activeStopsCount} <span className="text-slate-400 text-xl font-bold">Task</span>
                        </h2>
                        <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
                            <MapPin size={14} className="text-[#028A0F]" />
                            {isReturn ? 'Return to HQ/Vendor' : 'Delivery from Branch/Vendor'}
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => navigate(`/delivery/tracking/${run._id}`)}
                        className="w-full md:w-auto px-8 py-4 bg-[#028A0F] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-[#028A0F]/20 flex items-center justify-center gap-2 hover:bg-[#037A0D] transition-colors active:scale-95"
                    >
                        <MapPin size={16} />
                        View Live Map
                    </button>
                </div>
            </div>

            {/* Route Points Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pickup Point (Source) */}
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 p-5 shadow-sm relative overflow-hidden">
                    <span className="absolute top-4 right-4 bg-lime-100 text-lime-800 dark:bg-lime-950/40 dark:text-lime-400 px-2.5 py-1 rounded-full text-[8px] font-black tracking-widest uppercase">
                        {isReturn ? 'Return Target' : 'Pickup Point'}
                    </span>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <MapPin size={12} className="text-[#028A0F]" />
                        {isReturn ? 'Destination Store' : 'Source Store'}
                    </h3>
                    <h4 className="text-lg font-black text-slate-800 dark:text-zinc-100">{sourceName}</h4>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">{sourceAddress}</p>
                    {sourcePhone && sourcePhone !== 'N/A' && (
                        <a 
                            href={`tel:${sourcePhone}`} 
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#028A0F] mt-3 bg-[#028A0F]/10 hover:bg-[#028A0F]/20 px-3 py-1.5 rounded-xl transition-all"
                        >
                            <Phone size={12} /> Call Store ({sourcePhone})
                        </a>
                    )}
                </div>

                {/* Batch Information */}
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 p-5 shadow-sm relative overflow-hidden">
                    <span className="absolute top-4 right-4 bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 px-2.5 py-1 rounded-full text-[8px] font-black tracking-widest uppercase">
                        Run Batch
                    </span>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Package size={12} className="text-blue-500" />
                        Summary & Notes
                    </h3>
                    <div className="space-y-2 mt-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400 font-medium">Batch Type:</span>
                            <span className="font-bold uppercase text-slate-700 dark:text-slate-200">{run.runType}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400 font-medium">Created On:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{new Date(run.createdAt).toLocaleDateString()}</span>
                        </div>
                        {run.notes && (
                            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/25 border border-amber-100 dark:border-amber-900/50 rounded-2xl text-xs text-amber-800 dark:text-amber-400 leading-relaxed font-semibold">
                                <span className="font-black uppercase tracking-wider block mb-0.5">Admin Note:</span>
                                {run.notes}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <h3 className="font-black text-lg tracking-tight mt-8 mb-4 px-2 uppercase text-slate-400 text-[11px] tracking-[0.2em]">
                {isReturn ? 'Pickup Tasks' : 'Delivery Tasks'}
            </h3>

            {/* Stops Details */}
            <div className="space-y-4">
                {run.orders?.map((stop, i) => {
                    const order = stop.order;
                    const isDone = isReturn ? stop.status === 'picked_up' : stop.status === 'delivered';
                    const items = isReturn ? order?.returnRequest?.items : order?.items;

                    return (
                        <div key={stop._id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 p-5 shadow-sm">
                            <div className="flex flex-col md:flex-row gap-5 mb-5 border-b border-slate-50 dark:border-zinc-800/50 pb-5">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center
                                        ${isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`
                                    }>
                                        {isDone ? <CheckCircle2 size={24} /> : <span className="font-black text-lg">{i + 1}</span>}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-lg text-slate-800 dark:text-zinc-100">
                                            {order?.user?.name || 'Customer'}
                                        </h4>
                                        <a href={`tel:${order?.user?.phone}`} className="text-xs font-bold text-[#028A0F] flex items-center gap-1 mt-0.5">
                                            <Phone size={12} /> {order?.user?.phone || 'N/A'}
                                        </a>
                                    </div>
                                </div>
                                <div className="ml-0 md:ml-auto text-left md:text-right">
                                    <p className="font-black text-lg text-slate-800 dark:text-zinc-100">₹{order?.totalAmount}</p>
                                    <div className="flex items-center gap-1.5 justify-start md:justify-end mt-0.5 flex-wrap">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                            {order?.paymentMethod} • {stop.status.replace('_', ' ')}
                                        </span>
                                        {order?.isImmediate ? (
                                            <span className="px-1.5 py-0.5 rounded bg-green-100 text-[#028A0F] dark:bg-green-950/40 dark:text-green-400 text-[8px] font-black uppercase tracking-wider">
                                                ⚡ Express
                                            </span>
                                        ) : (
                                            order?.deliverySlot && (
                                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 text-[8px] font-black uppercase tracking-wider">
                                                    {order.deliverySlot}
                                                </span>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-2 text-slate-500 mb-5 pb-5 border-b border-slate-50 dark:border-zinc-800/50">
                                <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
                                <p className="text-sm font-medium leading-relaxed">
                                    {order?.shippingAddress?.street}, {order?.shippingAddress?.city}, {order?.shippingAddress?.state} {order?.shippingAddress?.zipCode}
                                </p>
                            </div>

                            {/* Customer Delivery Instructions */}
                            {(order?.deliveryInstructions?.chips?.length > 0 || order?.deliveryInstructions?.customNote) && (
                                <div className="mb-5 p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 rounded-2xl">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <FileText size={12} className="text-amber-600 dark:text-amber-400" />
                                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                            Customer Delivery Instructions
                                        </span>
                                    </div>
                                    {order.deliveryInstructions.chips?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {order.deliveryInstructions.chips.map((chip, cIdx) => (
                                                <span key={cIdx} className="px-2.5 py-1 bg-white dark:bg-zinc-800 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-700/50 rounded-full text-[11px] font-bold shadow-2xs">
                                                    ✓ {chip}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {order.deliveryInstructions.customNote && (
                                        <div className="bg-white/90 dark:bg-black/30 p-2.5 rounded-xl border border-amber-100 dark:border-white/5 text-xs text-amber-950 dark:text-amber-100 font-semibold">
                                            "{order.deliveryInstructions.customNote}"
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pl-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#028A0F] mb-3 flex items-center gap-2">
                                    <Package size={12} />
                                    {isReturn ? 'Items to Pickup' : 'Items to Deliver'}
                                </p>
                                <div className="space-y-3">
                                    {items && items.length > 0 ? items.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 overflow-hidden border border-slate-100">
                                                <img 
                                                    src={item.image || item.product?.images?.[0] || item.product?.image || 'https://via.placeholder.com/100'} 
                                                    alt={item.name || item.product?.name} 
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-700 dark:text-zinc-300">
                                                    {item.quantity}x {item.name || item.product?.name || 'Product'}
                                                </p>
                                                {isReturn && item.returnReason && (
                                                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-0.5">
                                                        Reason: {item.returnReason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-sm font-medium text-slate-400">Items details not available.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RunDetail;

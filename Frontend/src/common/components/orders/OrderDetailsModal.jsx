import React, { useEffect, useState } from 'react';
import { Download, Package, User, MapPin, CreditCard, Clock, X, Truck, Zap, CheckCircle, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAvailablePartners, assignOrder, autoAssignOrder } from '../../api/adminDeliveryApi';
import { getOrderDetails, updateOrderStatus } from '../../api/orderApi';
import { useAdminAuth } from '../../../modules/admin/context/AdminAuthContext';
import { useStoreManagerAuth } from '../../../modules/store-manager/context/StoreManagerAuthContext';
import { useStaffAuth } from '../../../modules/staff/context/StaffAuthContext';
import { toast } from 'react-toastify';

const OrderDetailsModal = ({ show, onHide, order, onOrderUpdate }) => {
    const { t } = useTranslation(['admin_orders', 'common']);
    const [availablePartners, setAvailablePartners] = useState([]);
    const [assigning, setAssigning] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState('');
    const [detailedOrderState, setDetailedOrderState] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const statusOptions = [
        { value: 'pending', label: 'Pending' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'preparing', label: 'Preparing' },
        { value: 'ready_for_pickup', label: 'Ready for Pickup' },
        { value: 'out_for_delivery', label: 'Out for Delivery' },
        { value: 'delivered', label: 'Delivered' },
        { value: 'cancelled', label: 'Cancelled' }
    ];

    const adminAuth = useAdminAuth?.();
    const managerAuth = useStoreManagerAuth?.();
    const staffAuth = useStaffAuth?.();
    const currentUser = adminAuth?.adminUser || managerAuth?.managerUser || staffAuth?.staffUser;
    const userRole = currentUser?.role;

    const displayOrder = detailedOrderState || order;

    useEffect(() => {
        if (show) {
            document.body.style.overflow = 'hidden';
            fetchAvailablePartners();
            if (order?._id) fetchFullOrderDetails();
        } else {
            document.body.style.overflow = 'unset';
            setDetailedOrderState(null);
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [show, order?._id]);

    const fetchFullOrderDetails = async () => {
        try {
            setLoadingDetails(true);
            const data = await getOrderDetails(order._id);
            setDetailedOrderState(data);
        } catch (error) {
            console.error('Error fetching order details:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const fetchAvailablePartners = async () => {
        try {
            const partners = await getAvailablePartners();
            setAvailablePartners(partners);
        } catch (error) {
            console.error('Error fetching partners:', error);
        }
    };

    const handleAutoAssign = async () => {
        setAssigning(true);
        try {
            await autoAssignOrder(order._id);
            toast.success(t('actions.update_success'));
            if (onOrderUpdate) onOrderUpdate();
            onHide();
        } catch (error) {
            toast.error(error.response?.data?.message || t('common:error_occurred'));
        } finally {
            setAssigning(false);
        }
    };

    const handleManualAssign = async () => {
        if (!selectedPartner) return toast.warning('Select a partner');
        setAssigning(true);
        try {
            await assignOrder(order._id, selectedPartner);
            toast.success(t('actions.update_success'));
            if (onOrderUpdate) onOrderUpdate();
            onHide();
        } catch (error) {
            toast.error(error.response?.data?.message || t('common:error_occurred'));
        } finally {
            setAssigning(false);
        }
    };

    const statusOrderMap = {
        'pending': 1,
        'confirmed': 2,
        'preparing': 3,
        'ready_for_pickup': 4,
        'out_for_delivery': 5,
        'delivered': 6,
        'cancelled': 7
    };

    const handleStatusUpdate = async (newStatus) => {
        if (newStatus === displayOrder.status) return;

        const currentRank = statusOrderMap[displayOrder.status] || 0;
        const newRank = statusOrderMap[newStatus] || 0;

        if (newRank < currentRank) {
            return toast.error('Cannot revert order to a previous status');
        }

        setUpdatingStatus(true);
        try {
            await updateOrderStatus(displayOrder._id, newStatus);
            toast.success(t('actions.update_success'));

            // Refresh details locally or through parent
            fetchFullOrderDetails();
            if (onOrderUpdate) onOrderUpdate();
        } catch (error) {
            toast.error(error.response?.data?.message || t('common:error_occurred'));
        } finally {
            setUpdatingStatus(false);
        }
    };

    if (!show || !order) return null;

    const displayId = displayOrder.orderId || displayOrder._id;
    const displayCustomer = displayOrder.user?.name || displayOrder.posCustomer?.name || 'Guest';
    const displayTotal = displayOrder.totalAmount?.toLocaleString() || '0';
    const displayDate = new Date(displayOrder.createdAt).toLocaleString();
    const immediateDeliveryFee = Number(displayOrder.immediateDeliveryFee) || 0;
    const totalDeliveryFee = Number(displayOrder.deliveryFee) || 0;
    const baseDeliveryFee = displayOrder.baseDeliveryFee != null ? Number(displayOrder.baseDeliveryFee) : Math.max(0, totalDeliveryFee - immediateDeliveryFee);

    const getStatusColor = (status = '') => {
        const s = status.toLowerCase();
        switch (s) {
            case 'delivered': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'cancelled': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'confirmed':
            case 'preparing': return 'bg-blue-50 text-blue-600 border-blue-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    const displayStore = displayOrder.branchId?.name || displayOrder.vendor?.storeName || displayOrder.vendor?.name || 'Main Warehouse';
    const storeType = displayOrder.branchId ? 'Branch' : (displayOrder.vendor ? 'Vendor' : 'Internal');

    const handlePrint = () => {
        const content = document.getElementById('print-receipt').innerHTML;
        const printWindow = window.open('', '', 'width=800,height=600');

        // Collect all styles from the current document
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(s => s.outerHTML)
            .join('\n');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Receipt #${displayId}</title>
                    ${styles}
                    <style>
                        body { padding: 20px; background: white !important; font-family: system-ui, -apple-system, sans-serif; }
                        .print\\:hidden { display: none !important; }
                        #print-receipt-content { box-shadow: none !important; border: none !important; max-height: none !important; overflow: visible !important; width: 100% !important; margin: 0 auto; max-width: 800px; }
                        .animate-in { animation: none !important; }
                    </style>
                </head>
                <body>
                    <div id="print-receipt-content" class="bg-white">
                        ${content}
                    </div>
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div id="print-receipt" className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <h5 className="text-lg font-bold text-slate-900">
                        Order Details: <span className="text-blue-600">#{displayId?.slice(-8).toUpperCase()}</span>
                    </h5>
                    <button onClick={onHide} className="p-1 rounded-lg hover:bg-slate-50 transition-colors text-slate-400 print:hidden"><X size={20} /></button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {loadingDetails ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                            <Clock size={40} className="animate-spin mb-4" />
                            <p className="text-sm font-bold uppercase tracking-widest">Loading Details...</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap gap-2 items-center mb-6">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase ${getStatusColor(displayOrder.status)}`}>
                                    {displayOrder.status?.replace(/_/g, ' ')}
                                </span>
                                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 ml-auto">
                                    <Clock size={14} /> {displayDate}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 print:hidden">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase mb-2">Store / Branch</p>
                                    <p className="font-bold text-blue-900 text-[11px] leading-tight">{displayStore}</p>
                                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold tracking-wider">{storeType}</span>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Customer</p>
                                    <p className="font-bold text-slate-900 text-[11px] whitespace-nowrap overflow-hidden text-ellipsis">{displayCustomer}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">{displayOrder.user?.phone || displayOrder.posCustomer?.phone || 'N/A'}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Address</p>
                                    <p className="text-[10px] text-slate-700 leading-relaxed font-semibold">
                                        {displayOrder.shippingAddress?.street ? (
                                            `${displayOrder.shippingAddress.street}${displayOrder.shippingAddress.city ? `, ${displayOrder.shippingAddress.city}` : ''}${displayOrder.shippingAddress.state ? `, ${displayOrder.shippingAddress.state}` : ''}${displayOrder.shippingAddress.zipCode ? ` - ${displayOrder.shippingAddress.zipCode}` : ''}`
                                        ) : (
                                            displayOrder.shippingAddress?.address || 'Direct Transaction'
                                        )}
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Status</p>
                                    <select
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer print:hidden"
                                        value={displayOrder.status}
                                        onChange={(e) => handleStatusUpdate(e.target.value)}
                                        disabled={updatingStatus}
                                    >
                                        {statusOptions
                                            .filter(opt => {
                                                const currentRank = statusOrderMap[displayOrder.status] || 0;
                                                const optRank = statusOrderMap[opt.value] || 0;
                                                return optRank >= currentRank;
                                            })
                                            .map(opt => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                    </select>
                                    <p className="hidden print:block text-[11px] font-bold text-slate-900 uppercase">
                                        {displayOrder.status?.replace(/_/g, ' ')}
                                    </p>
                                </div>
                            </div>

                            {displayOrder.orderSource !== 'pos' && (
                                <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-2 flex items-center gap-2">
                                        <Clock size={14} /> Customer Delivery Time
                                    </p>
                                    <p className="text-sm font-bold text-slate-800">
                                        {displayOrder.isImmediate
                                            ? 'Immediate Delivery'
                                            : (displayOrder.deliveryWindowSnapshot?.label || displayOrder.deliverySlotId?.label || displayOrder.deliverySlot || 'Not specified')}
                                    </p>
                                    {!displayOrder.isImmediate && displayOrder.deliveryWindowSnapshot?.startTime && (
                                        <p className="text-xs text-slate-500 mt-1">
                                            {displayOrder.deliveryWindowSnapshot.startTime} - {displayOrder.deliveryWindowSnapshot.endTime}
                                            {displayOrder.deliveryWindowSnapshot.scheduledDate ? ` on ${displayOrder.deliveryWindowSnapshot.scheduledDate}` : ''}
                                        </p>
                                    )}
                                </div>
                            )}

                            {displayOrder.orderSource !== 'pos' && (
                                <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-100">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase mb-3 flex items-center gap-2">
                                        <Truck size={14} /> Delivery Status
                                    </p>
                                    {displayOrder.deliveryPartnerId ? (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle size={16} className="text-emerald-500" />
                                                <span className="text-xs font-bold text-slate-700">Partner Assigned</span>
                                            </div>
                                            {displayOrder.deliveryOTP && <span className="text-xs font-black bg-white px-2 py-1 rounded border border-blue-200">OTP: {displayOrder.deliveryOTP}</span>}
                                        </div>
                                    ) : (
                                        ['Admin', 'Store Manager', 'Staff'].includes(userRole) && ['confirmed', 'preparing', 'ready_for_pickup'].includes(displayOrder.status) && (
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <select
                                                    className="flex-1 bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                                                    value={selectedPartner}
                                                    onChange={e => setSelectedPartner(e.target.value)}
                                                >
                                                    <option value="">Select Rider</option>
                                                    {availablePartners.map(p => <option key={p._id} value={p._id}>{p.name} ({p.activeOrderCount || 0}/{p.maxActiveOrders || 10} parcels)</option>)}
                                                </select>
                                                <button
                                                    onClick={handleManualAssign}
                                                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold"
                                                >
                                                    Assign
                                                </button>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}

                            {displayOrder.feedback?.rating && (
                                <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-100 print:hidden">
                                    <p className="text-[10px] font-bold text-yellow-600 uppercase mb-3 flex items-center gap-2">
                                        <Star size={14} className="fill-yellow-500 text-yellow-500" /> Order Feedback
                                    </p>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex gap-0.5">
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <Star key={s} size={14} className={s <= displayOrder.feedback.rating ? "fill-yellow-500 text-yellow-500" : "text-yellow-200"} />
                                            ))}
                                        </div>
                                        {displayOrder.feedback.submittedAt && (
                                            <span className="text-xs text-slate-500 font-medium ml-2">
                                                {new Date(displayOrder.feedback.submittedAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                    {displayOrder.feedback.comment && (
                                        <p className="text-xs text-slate-700 italic bg-white p-3 rounded border border-yellow-200 mt-2 font-medium">
                                            "{displayOrder.feedback.comment}"
                                        </p>
                                    )}
                                </div>
                            )}

                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Order Items</p>

                            {/* ── Mobile: stacked item cards (< md) ── */}
                            <div className="md:hidden border border-slate-100 rounded-lg overflow-hidden mb-6 divide-y divide-slate-100">
                                {displayOrder.items?.map((item, i) => {
                                    const weight =
                                        item.selectedVariant?.value ||
                                        item.weight ||
                                        (item.product?.unitValue != null
                                            ? `${item.product.unitValue} ${item.product.unitType || ''}`.trim()
                                            : '') ||
                                        (String(item.name || '').match(/\(([^)]+)\)\s*$/)?.[1] || '');
                                    const displayName = weight
                                        ? (item.name || '').replace(
                                            new RegExp(`\\s*\\(${weight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*$`, 'i'),
                                            ''
                                          ).trim() || item.name
                                        : item.name;
                                    return (
                                        <div key={i} className="flex items-start gap-3 p-3 bg-white">
                                            <img
                                                src={item.image || 'https://placehold.co/40'}
                                                className="w-11 h-11 rounded-lg border border-slate-100 object-cover shrink-0 mt-0.5"
                                                alt={displayName}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-800 text-sm leading-tight break-words">{displayName}</p>
                                                {weight && (
                                                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">{weight}</p>
                                                )}
                                                {item.physicalLocation && (
                                                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-black border border-amber-100">
                                                        <MapPin size={9} /> {item.physicalLocation}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="font-black text-slate-900 text-sm">₹{item.price * item.quantity}</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">Qty: {item.quantity}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ── Desktop: existing table (md+) ── */}
                            <div className="hidden md:block border border-slate-100 rounded-lg overflow-hidden mb-6">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-2">Item</th>
                                            <th className="px-4 py-2 text-center print:hidden">Location</th>
                                            <th className="px-4 py-2 text-center">Qty</th>
                                            <th className="px-4 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {displayOrder.items?.map((item, i) => {
                                            const weight =
                                                item.selectedVariant?.value ||
                                                item.weight ||
                                                (item.product?.unitValue != null
                                                    ? `${item.product.unitValue} ${item.product.unitType || ''}`.trim()
                                                    : '') ||
                                                (String(item.name || '').match(/\(([^)]+)\)\s*$/)?.[1] || '');
                                            const displayName = weight
                                                ? (item.name || '').replace(
                                                    new RegExp(`\\s*\\(${weight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*$`, 'i'),
                                                    ''
                                                  ).trim() || item.name
                                                : item.name;
                                            const fullLabel = [item.name, weight].filter(Boolean).join(' · ');

                                            return (
                                            <tr key={i}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <img src={item.image || 'https://placehold.co/40'} className="w-8 h-8 rounded border border-slate-100 object-cover shrink-0" alt={displayName} />
                                                        <div className="min-w-0 max-w-[180px]">
                                                            <div
                                                                className="font-bold text-slate-700 truncate cursor-default"
                                                                title={fullLabel || displayName}
                                                            >
                                                                {displayName}
                                                            </div>
                                                            {weight ? (
                                                                <div className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">
                                                                    {weight}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center print:hidden">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{displayStore.split(' ')[0]}</span>
                                                        {item.physicalLocation ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-black border border-amber-100">
                                                                <MapPin size={10} /> {item.physicalLocation}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] text-slate-300 font-bold tracking-tighter">SHELF N/A</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-slate-900">{item.quantity}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900">₹{item.price * item.quantity}</td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── Phase 8: Free Gift Section ── only shown when order has a gift snapshot */}
                            {displayOrder.freeGiftSnapshot?.title && (
                                <div className="mb-6 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
                                    {displayOrder.freeGiftSnapshot.image ? (
                                        <img
                                            src={displayOrder.freeGiftSnapshot.image}
                                            alt={displayOrder.freeGiftSnapshot.title}
                                            className="w-12 h-12 rounded-lg object-cover border border-emerald-200 shrink-0"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 text-2xl">🎁</div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Free Gift Included</p>
                                        <p className="text-sm font-black text-slate-800 break-words">{displayOrder.freeGiftSnapshot.title}</p>
                                        {displayOrder.freeGiftSnapshot.description && (
                                            <p className="text-xs text-slate-500 mt-0.5">{displayOrder.freeGiftSnapshot.description}</p>
                                        )}
                                    </div>
                                    <span className="shrink-0 bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg tracking-wider">FREE</span>
                                </div>
                            )}


                            <div className="flex justify-end">
                                <div className="w-full max-w-[240px] space-y-2">
                                    <div className="flex justify-between text-xs font-medium text-slate-500 mb-1">
                                        <span>Payment Method</span>
                                        <span className="uppercase text-slate-800 font-bold">{displayOrder.paymentMethod?.replace(/_/g, ' ') || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-medium text-slate-500 pb-2 border-b border-slate-100 mb-2">
                                        <span>Payment Status</span>
                                        <span className={`uppercase font-bold ${displayOrder.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {displayOrder.paymentStatus || 'pending'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs font-medium text-slate-400">
                                        <span>Subtotal</span>
                                        <span>₹{displayOrder.subTotal || 0}</span>
                                    </div>
                                    {displayOrder.taxAmount > 0 && (
                                        <div className="flex justify-between text-xs font-medium text-slate-400">
                                            <span>Tax</span>
                                            <span>₹{displayOrder.taxAmount}</span>
                                        </div>
                                    )}
                                    {immediateDeliveryFee > 0 ? (
                                        <>
                                            <div className="flex justify-between text-xs font-medium text-slate-400">
                                                <span>Base Delivery Fee</span>
                                                <span className={baseDeliveryFee === 0 ? 'text-emerald-600 font-bold' : ''}>
                                                    {baseDeliveryFee === 0 ? 'Free' : `₹${baseDeliveryFee}`}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-xs font-medium text-blue-600">
                                                <span className="font-bold">Express Delivery Surcharge</span>
                                                <span className="font-bold">+₹{immediateDeliveryFee}</span>
                                            </div>
                                        </>
                                    ) : (
                                        totalDeliveryFee > 0 && (
                                            <div className="flex justify-between text-xs font-medium text-slate-400">
                                                <span>Delivery Fee</span>
                                                <span>₹{totalDeliveryFee}</span>
                                            </div>
                                        )
                                    )}
                                    {displayOrder.handlingFee > 0 && (
                                        <div className="flex justify-between text-xs font-medium text-slate-400">
                                            <span>Handling Fee</span>
                                            <span>₹{displayOrder.handlingFee}</span>
                                        </div>
                                    )}
                                    {displayOrder.discountAmount > 0 && (
                                        <div className="flex justify-between text-xs font-medium text-emerald-500">
                                            <span>Discount {displayOrder.promoCode ? `(${displayOrder.promoCode})` : ''}</span>
                                            <span>-₹{displayOrder.discountAmount}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-2">
                                        <span className="text-sm font-black text-slate-900 uppercase">Total</span>
                                        <span className="text-lg font-black text-blue-600">₹{displayTotal}</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onHide} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-all print:hidden">Close</button>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 print:hidden"
                    >
                        <Download size={14} /> Print Receipt
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderDetailsModal;

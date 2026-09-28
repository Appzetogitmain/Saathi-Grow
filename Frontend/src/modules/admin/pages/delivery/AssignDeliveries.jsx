import React, { useState, useEffect } from 'react';
import { 
    Clock, 
    MapPin, 
    RefreshCw, 
    Zap, 
    Calendar, 
    Truck, 
    AlertCircle, 
    X, 
    Package,
    CheckCircle, 
    Layers, 
    TrendingUp,
    Search,
    ChevronLeft,
    Loader2,
    ClipboardList,
    MoreHorizontal,
    User,
    ArrowRight,
    Store,
    Phone
} from 'lucide-react';
import {
    getOrdersBySlot,
    createDeliveryRun,
    getAllDeliveryRuns,
    cancelDeliveryRun,
    getAvailablePartners
} from '../../api/adminDeliveryApi';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import PageInfoTooltip from '../../../../common/components/modals/PageInfoTooltip';
import { pageInfoData } from '../../../../common/data/pageInfoData';

const getTodayDeliveryDate = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

const AssignDeliveries = () => {
    const { t } = useTranslation('admin_delivery');
    const [viewType, setViewType] = useState('slots'); // 'slots' or 'runs'
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [slotData, setSlotData] = useState({ immediate: { orders: [], count: 0 }, slots: [] });
    const [selectedOrders, setSelectedOrders] = useState([]);
    const [currentSlotContext, setCurrentSlotContext] = useState(null);
    const [activeRuns, setActiveRuns] = useState([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [availableDrivers, setAvailableDrivers] = useState([]);
    const [loadingDrivers, setLoadingDrivers] = useState(false);
    const [assigningLoading, setAssigningLoading] = useState(false);
    const [optimizeRoute, setOptimizeRoute] = useState(true);
    const [locationSort, setLocationSort] = useState(false); // sort orders by city
    const [selectedDeliveryDate, setSelectedDeliveryDate] = useState(getTodayDeliveryDate);

    const fetchData = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            
            if (viewType === 'slots') {
                const data = await getOrdersBySlot(selectedDeliveryDate);
                setSlotData(data || { immediate: { orders: [], count: 0 }, slots: [] });
                setSelectedOrders([]);
                setCurrentSlotContext(null);
            } else {
                const data = await getAllDeliveryRuns('', selectedDeliveryDate);
                setActiveRuns(data || []);
            }
        } catch {
            toast.error(t('assign.alerts.error'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [viewType, selectedDeliveryDate]);

    useEffect(() => {
        if (showAssignModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showAssignModal]);

    const handleSelectOrder = (orderId, slotContextId) => {
        if (currentSlotContext && currentSlotContext !== slotContextId && selectedOrders.length > 0) {
            toast.warning("Please assign orders from one slot at a time.");
            return;
        }

        setCurrentSlotContext(slotContextId);
        setSelectedOrders(prev => {
            if (prev.includes(orderId)) {
                const newSelection = prev.filter(id => id !== orderId);
                if (newSelection.length === 0) setCurrentSlotContext(null);
                return newSelection;
            }
            return [...prev, orderId];
        });
    };

    const handleSelectAllInSlot = (slotGroup, slotContextId) => {
        if (currentSlotContext && currentSlotContext !== slotContextId && selectedOrders.length > 0) {
            toast.warning("Please assign orders from one slot at a time.");
            return;
        }

        const orderIds = slotGroup.orders.map(o => o._id);
        const allSelected = orderIds.every(id => selectedOrders.includes(id));

        if (allSelected) {
            setSelectedOrders(prev => {
                const newSelection = prev.filter(id => !orderIds.includes(id));
                if (newSelection.length === 0) setCurrentSlotContext(null);
                return newSelection;
            });
        } else {
            setCurrentSlotContext(slotContextId);
            setSelectedOrders(prev => [...new Set([...prev, ...orderIds])]);
        }
    };

    const handleOpenAssignModal = async () => {
        if (selectedOrders.length === 0) {
            toast.error(t('assign.alerts.error'));
            return;
        }
        setShowAssignModal(true);
        setLoadingDrivers(true);
        try {
            const drivers = await getAvailablePartners(selectedOrders);
            // Only show drivers who are currently online
            const onlineDrivers = drivers.filter(d => d.dutyStatus === 'Online');
            setAvailableDrivers(onlineDrivers);
        } catch {
            // toast.error("Failed to load available riders");
        } finally {
            setLoadingDrivers(false);
        }
    };

    const handleConfirmAssignment = async (driverId) => {
        try {
            setAssigningLoading(true);
            const payload = {
                partnerId: driverId,
                slotId: (currentSlotContext === 'immediate' || !currentSlotContext) ? null : currentSlotContext,
                slotDate: `${selectedDeliveryDate}T00:00:00.000Z`,
                orderIds: selectedOrders,
                optimizeRoute: optimizeRoute
            };

            await createDeliveryRun(payload);
            toast.success(t('assign.alerts.success'));
            setShowAssignModal(false);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || t('assign.alerts.error'));
        } finally {
            setAssigningLoading(false);
        }
    };

    const handleCancelRun = async (runId) => {
        const result = await Swal.fire({
            title: "Cancel Trip?",
            text: "Orders will return to pending list.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: "Yes, Cancel",
            cancelButtonText: "Close"
        });

        if (result.isConfirmed) {
            try {
                await cancelDeliveryRun(runId);
                toast.success("Trip cancelled");
                fetchData();
            } catch (error) {
                toast.error(error.response?.data?.message || "Failed to cancel");
            }
        }
    };

    return (
        <div className="container-fluid py-6 bg-slate-50/20 min-h-screen px-4 md:px-6 max-w-7xl mx-auto font-sans text-slate-800">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold tracking-tight">{t('assign.title')}</h1>
                        <PageInfoTooltip data={pageInfoData.assignDeliveries} />
                    </div>
                    <p className="text-slate-500 text-xs mt-1 font-medium">{t('assign.subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm text-[11px] font-bold text-slate-600">
                        <Calendar size={14} />
                        <span className="sr-only">Dispatch date</span>
                        <input
                            type="date"
                            value={selectedDeliveryDate}
                            onChange={(event) => {
                                setSelectedOrders([]);
                                setCurrentSlotContext(null);
                                setSelectedDeliveryDate(event.target.value);
                            }}
                            className="bg-transparent text-slate-700 outline-none"
                            aria-label="Dispatch date"
                        />
                    </label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        <button
                            onClick={() => setViewType('slots')}
                            className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${
                                viewType === 'slots' 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            {t('assign.tabs.pending')}
                        </button>
                        <button
                            onClick={() => setViewType('runs')}
                            className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${
                                viewType === 'runs' 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            {t('assign.tabs.assigned')}
                        </button>
                    </div>
                    <button
                        onClick={() => setLocationSort(v => !v)}
                        title="Sort by location"
                        className={`p-2.5 border rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${locationSort ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-500'}`}
                    >
                        <MapPin size={15} /> Sort by Area
                    </button>
                    <button
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className={`p-2.5 bg-white border border-slate-200 rounded-xl transition-all shadow-sm active:scale-95 ${refreshing ? 'opacity-50' : 'hover:border-blue-500'}`}
                    >
                        <RefreshCw size={18} className={`${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {loading && !refreshing ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 size={40} className="text-blue-500 animate-spin" />
                    <p className="text-slate-400 text-sm font-medium">Syncing order data...</p>
                </div>
            ) : viewType === 'slots' ? (
                <div className="space-y-6">
                    {[
                        { title: "Immediate Priority", data: slotData.immediate, id: 'immediate', icon: <Zap size={18} className="text-amber-500" />, color: 'amber' },
                        ...slotData.slots.map(s => ({
                            title: `${s.slot.label} (${s.slot.startTime} - ${s.slot.endTime})`,
                            data: s,
                            id: s.slot._id,
                            icon: <Clock size={18} className="text-blue-500" />,
                            color: 'blue'
                        }))
                    ].map((group) => group.data.orders.length > 0 && (
                        <div key={group.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 bg-${group.color}-50 border border-${group.color}-100 rounded-xl`}>
                                        {group.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">{group.title}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{group.data.count} Pending Orders</span>
                                            {currentSlotContext === group.id && selectedOrders.length > 0 && (
                                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold border border-emerald-100 uppercase">{selectedOrders.length} Selected</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => handleSelectAllInSlot(group.data, group.id)}
                                        className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                                    >
                                        {group.data.orders.every(o => selectedOrders.includes(o._id)) ? 'Deselect All' : 'Select All'}
                                    </button>
                                    {currentSlotContext === group.id && selectedOrders.length > 0 && (
                                        <button
                                            onClick={handleOpenAssignModal}
                                            className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold shadow-md shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 border-none uppercase tracking-wide"
                                        >
                                            <User size={14} /> Assign Now
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                                            <th className="px-6 py-3 w-16 text-center">Select</th>
                                            <th className="px-4 py-3">{t('assign.table.order_id')}</th>
                                            <th className="px-4 py-3">{t('assign.table.customer')}</th>
                                            <th className="px-4 py-3">{t('assign.table.address')}{locationSort && <span className="ml-1 text-blue-500">↑</span>}</th>
                                            <th className="px-6 py-3 text-right">{t('assign.table.amount')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                                        {(() => {
                                            const getAreaKey = (order) => {
                                                const zip = order.shippingAddress?.zipCode ? String(order.shippingAddress.zipCode).trim() : '';
                                                const city = order.shippingAddress?.city ? String(order.shippingAddress.city).trim() : 'Unknown Area';
                                                return zip ? `${city} - ${zip}` : city;
                                            };

                                            const sortedOrders = locationSort
                                                ? [...group.data.orders].sort((a, b) => {
                                                    const areaA = getAreaKey(a).toLowerCase();
                                                    const areaB = getAreaKey(b).toLowerCase();
                                                    if (areaA !== areaB) return areaA.localeCompare(areaB);
                                                    
                                                    const streetA = (a.shippingAddress?.street || '').toLowerCase().trim();
                                                    const streetB = (b.shippingAddress?.street || '').toLowerCase().trim();
                                                    return streetA.localeCompare(streetB);
                                                })
                                                : [...group.data.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                                            const rows = [];
                                            let lastArea = null;

                                            sortedOrders.forEach((order, idx) => {
                                                const areaKey = getAreaKey(order);
                                                const isSelected = selectedOrders.includes(order._id);
                                                const isDisabled = currentSlotContext && currentSlotContext !== group.id && selectedOrders.length > 0;

                                                // Area group header divider row
                                                if (locationSort && areaKey !== lastArea) {
                                                    lastArea = areaKey;
                                                    const areaCount = sortedOrders.filter(o => getAreaKey(o) === areaKey).length;
                                                    rows.push(
                                                        <tr key={`area-header-${areaKey}-${idx}`} className="bg-slate-50 border-y border-slate-200">
                                                            <td colSpan="5" className="px-4 py-2">
                                                                <div className="flex items-center gap-2">
                                                                    <MapPin size={12} className="text-blue-500 shrink-0" />
                                                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{areaKey}</span>
                                                                    <span className="text-[9px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded-full">{areaCount} order{areaCount !== 1 ? 's' : ''}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                rows.push(
                                                    <tr
                                                        key={order._id}
                                                        className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/30' : ''} ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                        onClick={() => !isDisabled && handleSelectOrder(order._id, group.id)}
                                                    >
                                                        <td className="px-6 py-4 text-center">
                                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mx-auto transition-all ${
                                                                isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'
                                                            }`}>
                                                                {isSelected && <CheckCircle size={12} strokeWidth={3} />}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-xs font-bold text-slate-900">#{order.orderId}</span>
                                                                <span className={`w-fit px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tight ${
                                                                    order.paymentMethod === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                                }`}>
                                                                    {order.paymentMethod === 'online' ? 'PAID' : 'CASH'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-700">{order.user?.name || 'Customer'}</span>
                                                                <span className="text-[10px] text-slate-400">{order.user?.phone}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-start gap-1.5 max-w-[280px]">
                                                                <MapPin size={12} className="text-slate-300 mt-0.5 shrink-0" />
                                                                <span className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                                                                    {order.shippingAddress?.street}, {order.shippingAddress?.city}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="text-xs font-bold text-slate-900 tracking-tight">₹{order.totalAmount}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            });

                                            return rows;
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}

                    {/* Empty State */}
                    {(!slotData.immediate.orders.length && slotData.slots.every(s => s.orders.length === 0)) && (
                        <div className="bg-white rounded-2xl py-20 px-6 text-center shadow-sm border border-slate-200">
                            <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <CheckCircle size={40} className="text-slate-200" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800">No Pending Orders</h2>
                            <p className="text-slate-500 text-xs max-w-sm mx-auto mt-2">All orders for the current slots have been dispatched.</p>
                            <button onClick={() => fetchData(true)} className="mt-8 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-black transition-all shadow-sm">
                                Check For Updates
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* --- ACTIVE RUNS VIEW --- */
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
                    <div className="overflow-x-auto scrollbar-thin">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                                    <th className="px-10 py-4">Trip ID</th>
                                    <th className="px-8 py-4">Rider</th>
                                    <th className="px-8 py-4 text-center">Status</th>
                                    <th className="px-8 py-4">Progress</th>
                                    <th className="px-8 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px] font-medium">
                                {activeRuns.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center py-32 opacity-30 grayscale">
                                            <ClipboardList size={48} className="mx-auto mb-4 text-slate-200" />
                                            <h4 className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">No active trips running</h4>
                                        </td>
                                    </tr>
                                ) : activeRuns.map(run => {
                                    const { total, delivered, failed } = run.summary;
                                    const isComplete = ['completed', 'partial_complete'].includes(run.status);
                                    const progress = total > 0 ? (delivered / total) * 100 : 0;

                                    return (
                                        <tr key={run._id} className={`hover:bg-slate-50/30 transition-colors ${isComplete ? 'opacity-60' : ''}`}>
                                            <td className="px-10 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-bold text-blue-600 tracking-tight">#{run.runId}</span>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase">{run.runType || 'Standard Trip'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                                        {run.deliveryPartner?.profileImage ? (
                                                            <img src={run.deliveryPartner.profileImage} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <User size={16} className="text-slate-300" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-800 leading-none">{run.deliveryPartner?.name || 'Unknown Rider'}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">{run.deliveryPartner?.vehicleType || 'Bike'} • {run.deliveryPartner?.phone}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border uppercase tracking-tight ${
                                                    run.status === 'assigned' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                }`}>
                                                    {run.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 min-w-[200px]">
                                                <div className="flex items-center justify-between mb-1.5 px-0.5">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{delivered}/{total} Delivered</span>
                                                    <span className="text-[10px] font-bold text-slate-900">{Math.round(progress)}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                                    <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                                                    <div className="bg-rose-500 h-full transition-all duration-1000" style={{ width: `${(failed / total) * 100}%` }}></div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {!isComplete && run.status !== 'cancelled' && (
                                                    <button 
                                                        onClick={() => handleCancelRun(run._id)}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-95"
                                                        title="Cancel Trip"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Assignment Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => !assigningLoading && setShowAssignModal(false)} />
                    
                    <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200">
                        <div className="p-8 space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">{t('assign.modal.title')}</h3>
                                    <p className="text-xs font-medium text-slate-500 mt-1">Assign {selectedOrders.length} orders to an available rider</p>
                                </div>
                                <button 
                                    onClick={() => !assigningLoading && setShowAssignModal(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Orders</span>
                                    <div className="text-3xl font-bold text-slate-900">{selectedOrders.length}</div>
                                </div>
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Trip Mode</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100">
                                            {currentSlotContext === 'immediate' ? <Zap size={14} className="text-amber-500" /> : <Clock size={14} className="text-blue-500" />}
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 capitalize">
                                            {currentSlotContext === 'immediate' ? 'Priority' : 'Scheduled'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="button"
                                className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                                    optimizeRoute ? 'bg-emerald-50 border-emerald-500/20' : 'bg-slate-50 border-slate-100 border-dashed'
                                }`} 
                                onClick={() => setOptimizeRoute(!optimizeRoute)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                        optimizeRoute ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white text-slate-300'
                                    }`}>
                                        <TrendingUp size={20} />
                                    </div>
                                    <div className="text-left">
                                        <span className="text-[11px] font-bold text-slate-800 block leading-tight">Optimize Route</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Recommended dispatch help</span>
                                    </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                    optimizeRoute ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-200 shadow-inner'
                                }`}>
                                    {optimizeRoute && <CheckCircle size={14} className="text-white" strokeWidth={4} />}
                                </div>
                            </button>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                        Select Rider
                                        {availableDrivers.length > 0 && (
                                            <span className="ml-2 text-blue-500 normal-case font-bold">
                                                — {availableDrivers.filter(d => d.distanceKm != null).length > 0
                                                    ? `${availableDrivers.length} nearby`
                                                    : `${availableDrivers.length} available`}
                                            </span>
                                        )}
                                    </h6>
                                    {availableDrivers.some(d => d.distanceKm != null) && (
                                        <span className="text-[9px] font-bold text-blue-500 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <MapPin size={9} /> Within 20km
                                        </span>
                                    )}
                                </div>
                                
                                {loadingDrivers ? (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-30">
                                        <Loader2 size={32} className="animate-spin text-blue-500" />
                                        <p className="text-[10px] font-bold uppercase mt-3 tracking-widest">Searching nearby fleet...</p>
                                    </div>
                                ) : availableDrivers.length === 0 ? (
                                    <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center gap-3">
                                        <AlertCircle size={28} className="text-slate-300" />
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase">No riders in this area</p>
                                            <p className="text-[10px] text-slate-400 mt-1">No online rider has enough remaining parcel capacity.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {availableDrivers.map((driver, idx) => {
                                            // Show a divider before the first no-GPS rider
                                            const prevHasGps = idx > 0 && availableDrivers[idx - 1].distanceKm != null;
                                            const showDivider = prevHasGps && driver.distanceKm === null;
                                            return (
                                                <React.Fragment key={driver._id}>
                                                    {showDivider && (
                                                        <div className="flex items-center gap-2 py-1">
                                                            <div className="flex-1 h-px bg-slate-100"></div>
                                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest whitespace-nowrap">Location unknown</span>
                                                            <div className="flex-1 h-px bg-slate-100"></div>
                                                        </div>
                                                    )}
                                                    <div
                                                        className="group p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between"
                                                        onClick={() => !assigningLoading && handleConfirmAssignment(driver._id)}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors overflow-hidden">
                                                                {driver.profileImage ? (
                                                                    <img src={driver.profileImage} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-sm font-bold text-slate-300 italic">{driver.name.charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span className="text-xs font-bold text-slate-800 block leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight">{driver.name}</span>
                                                                <div className="flex items-center gap-2 mt-1.5">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{driver.vehicleType}</span>
                                                                    <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                                                                    <div className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                                                        <Phone size={10} /> {driver.phone}
                                                                    </div>
                                                                    {driver.distanceKm != null && (
                                                                        <>
                                                                            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                                                                            <div className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                                                                                <MapPin size={10} /> {driver.distanceKm < 1 ? `${Math.round(driver.distanceKm * 1000)}m` : `${driver.distanceKm.toFixed(1)}km`}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                                                                    <span className="text-[9px] font-bold text-blue-600">
                                                                        {driver.activeOrderCount || 0}/{driver.maxActiveOrders || 10} parcels
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${driver.dutyStatus === 'Online' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                                {driver.dutyStatus}
                                                            </span>
                                                            <ArrowRight size={16} className="text-slate-200 group-hover:text-blue-500 transition-all opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0" />
                                                        </div>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .scrollbar-thin::-webkit-scrollbar { height: 4px; border-radius: 10px; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}} />
        </div>
    );
};

export default AssignDeliveries;

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search, Eye, Filter, Clock, CreditCard, Store, Zap,
    ChevronLeft, ChevronRight, IndianRupee, Calendar, Pencil, Trash2, CheckCircle
} from 'lucide-react';
import OrderDetailsModal from '../../../../common/components/orders/OrderDetailsModal';
import { getAllOrdersAdmin, updateOrderStatus, deleteOrder } from '../../api/orderApi';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import PageInfoTooltip from '../../../../common/components/modals/PageInfoTooltip';
import { pageInfoData } from '../../../../common/data/pageInfoData';
import { showDeleteConfirmation } from '../../../../common/utils/alertUtils';

const OrderStatusBadge = ({ status, t }) => {
    const variants = {
        delivered: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        pending: 'bg-amber-50 text-amber-600 border-amber-100',
        preparing: 'bg-blue-50 text-blue-600 border-blue-100',
        confirmed: 'bg-cyan-50 text-cyan-600 border-cyan-100',
        out_for_delivery: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        cancelled: 'bg-rose-50 text-rose-600 border-rose-100',
        return_requested: 'bg-orange-50 text-orange-600 border-orange-100',
        returned: 'bg-slate-50 text-slate-600 border-slate-100',
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${variants[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
            {t(`status.${status}`, status.replace(/_/g, ' '))}
        </span>
    );
};

const OnlineOrders = () => {
    const { t } = useTranslation(['admin_orders', 'common']);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, revenue: 0 });

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                limit,
                search: debouncedSearch,
                paymentMethod: 'online',
                orderSource: 'online',
                status: statusFilter,
                paymentStatus: paymentStatusFilter,
                startDate,
                endDate
            };
            const data = await getAllOrdersAdmin(params);
            if (data?.orders) {
                setOrders(data.orders);
                setPagination(data.pagination || { total: 0, totalPages: 1 });
                const s = data.stats || {};
                setStats({
                    total: s.totalOrders ?? data.pagination?.total ?? data.orders.length,
                    paid: s.totalPaid ?? 0,
                    pending: s.totalPendingPayment ?? 0,
                    revenue: s.totalRevenue ?? 0
                });
            }
        } catch (err) {
            console.error('OnlineOrders fetch error:', err);
            toast.error(t('common:error_occurred'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [page, debouncedSearch, statusFilter, paymentStatusFilter, startDate, endDate]);

    useEffect(() => {
        const handleFirebaseMessage = (event) => {
            const payload = event.detail;
            const type = payload?.data?.type || '';
            const title = payload?.notification?.title || payload?.data?.title || '';
            
            // If it's related to an order update or a new order, refresh the list
            if (type.includes('order') || title.toLowerCase().includes('order') || type === 'delivery_status_update') {
                fetchOrders();
            }
        };

        window.addEventListener('onFirebaseMessage', handleFirebaseMessage);
        return () => window.removeEventListener('onFirebaseMessage', handleFirebaseMessage);
    }, [page, debouncedSearch, statusFilter, paymentStatusFilter, startDate, endDate]);

    const handleFilterChange = (setter) => (e) => { setter(e.target.value); setPage(1); };

    const clearFilters = () => {
        setStatusFilter(''); setPaymentStatusFilter('');
        setStartDate(''); setEndDate('');
        setSearchTerm(''); setPage(1);
        setShowFilterMenu(false);
    };

    const activeFiltersCount = [statusFilter, paymentStatusFilter, startDate, endDate].filter(Boolean).length;

    const handleShowDetails = (order) => { setSelectedOrder(order); setShowModal(true); };

    const handleDeleteOrder = async (orderId) => {
        const result = await showDeleteConfirmation(
            t('actions.delete_confirm_title'),
            t('actions.delete_warning', { defaultValue: 'This action cannot be undone.' })
        );
        if (result.isConfirmed) {
            try {
                await deleteOrder(orderId);
                toast.success(t('actions.delete_success'));
                fetchOrders();
            } catch (error) {
                toast.error(error.response?.data?.message || t('common:error_occurred'));
            }
        }
    };

    const handleUpdateStatus = async (orderId, currentStatus) => {
        const statusOptions = [
            { value: 'pending', label: t('status.pending'), icon: '⏳', color: '#f59e0b', bgColor: '#fef3c7' },
            { value: 'confirmed', label: t('status.confirmed'), icon: '✅', color: '#10b981', bgColor: '#d1fae5' },
            { value: 'preparing', label: t('status.preparing'), icon: '👨‍🍳', color: '#3b82f6', bgColor: '#dbeafe' },
            { value: 'ready_for_pickup', label: t('filters.status.ready_for_pickup'), icon: '📦', color: '#8b5cf6', bgColor: '#ede9fe' },
            { value: 'out_for_delivery', label: t('status.out_for_delivery'), icon: '🚚', color: '#6366f1', bgColor: '#e0e7ff' },
            { value: 'delivered', label: t('status.delivered'), icon: '🎉', color: '#059669', bgColor: '#d1fae5' },
            { value: 'cancelled', label: t('status.cancelled'), icon: '❌', color: '#ef4444', bgColor: '#fee2e2' }
        ];

        const statusOrderMap = {
            'pending': 1,
            'confirmed': 2,
            'preparing': 3,
            'ready_for_pickup': 4,
            'out_for_delivery': 5,
            'delivered': 6,
            'cancelled': 7
        };

        const currentRank = statusOrderMap[currentStatus] || 0;
        const filteredOptions = statusOptions.filter(opt => {
            const optRank = statusOrderMap[opt.value] || 0;
            return optRank >= currentRank;
        });

        const optionsHtml = filteredOptions.map(opt => 
            `<div class="status-option ${opt.value === currentStatus ? 'status-option-active' : ''}" data-value="${opt.value}" style="border-color: ${opt.color}20; background: ${opt.value === currentStatus ? opt.bgColor : 'white'};">
                <span class="status-icon" style="background: ${opt.bgColor}; color: ${opt.color};">${opt.icon}</span>
                <span class="status-label" style="color: ${opt.value === currentStatus ? opt.color : '#334155'};">${opt.label}</span>
                ${opt.value === currentStatus ? '<span class="status-check" style="color: ' + opt.color + ';">✓</span>' : ''}
            </div>`
        ).join('');

        const { value: status } = await Swal.fire({
            title: '<div style="font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Update Order Status</div>',
            html: `
                <div style="margin-bottom: 16px;">
                    <p style="color: #64748b; font-size: 14px; margin: 0;">Select the new status for this order</p>
                </div>
                <div class="status-options-container">
                    ${optionsHtml}
                </div>
                <style>
                    .status-options-container {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                        margin-top: 20px;
                    }
                    .status-option {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 14px 16px;
                        border: 2px solid #e2e8f0;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s;
                        background: white;
                    }
                    .status-option:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                        border-color: #3b82f6 !important;
                    }
                    .status-option-active {
                        border-width: 2px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                    }
                    .status-icon {
                        width: 40px;
                        height: 40px;
                        border-radius: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                        flex-shrink: 0;
                    }
                    .status-label {
                        flex: 1;
                        font-weight: 600;
                        font-size: 15px;
                        text-align: left;
                    }
                    .status-check {
                        font-size: 20px;
                        font-weight: bold;
                    }
                    .swal2-popup {
                        border-radius: 20px;
                        padding: 32px;
                        width: 480px;
                    }
                    .swal2-actions {
                        gap: 12px;
                        margin-top: 24px;
                    }
                    .swal2-confirm {
                        background: #0f172a !important;
                        border-radius: 10px !important;
                        padding: 12px 32px !important;
                        font-weight: 600 !important;
                        font-size: 15px !important;
                    }
                    .swal2-cancel {
                        background: white !important;
                        border: 2px solid #e2e8f0 !important;
                        color: #64748b !important;
                        border-radius: 10px !important;
                        padding: 12px 32px !important;
                        font-weight: 600 !important;
                        font-size: 15px !important;
                    }
                    .swal2-cancel:hover {
                        background: #f8fafc !important;
                    }
                </style>
            `,
            showCancelButton: true,
            confirmButtonText: 'Update Status',
            cancelButtonText: 'Cancel',
            width: '500px',
            didOpen: () => {
                const options = document.querySelectorAll('.status-option');
                let selectedValue = currentStatus;
                
                options.forEach(option => {
                    option.addEventListener('click', function() {
                        options.forEach(opt => {
                            opt.classList.remove('status-option-active');
                            opt.style.background = 'white';
                            const check = opt.querySelector('.status-check');
                            if (check) check.remove();
                        });
                        
                        this.classList.add('status-option-active');
                        selectedValue = this.getAttribute('data-value');
                        
                        const statusOpt = statusOptions.find(s => s.value === selectedValue);
                        if (statusOpt) {
                            this.style.background = statusOpt.bgColor;
                            this.style.borderColor = statusOpt.color;
                            const label = this.querySelector('.status-label');
                            if (label) label.style.color = statusOpt.color;
                            
                            const checkmark = document.createElement('span');
                            checkmark.className = 'status-check';
                            checkmark.textContent = '✓';
                            checkmark.style.color = statusOpt.color;
                            this.appendChild(checkmark);
                        }
                    });
                });
            },
            preConfirm: () => {
                const activeOption = document.querySelector('.status-option-active');
                return activeOption ? activeOption.getAttribute('data-value') : currentStatus;
            }
        });

        if (status && status !== currentStatus) {
            try {
                await updateOrderStatus(orderId, status);
                toast.success(t('actions.update_success'));
                fetchOrders();
            } catch (error) {
                toast.error(error.response?.data?.message || t('common:error_occurred'));
            }
        }
    };

    const acceptOrder = async (orderId) => {
        try {
            await updateOrderStatus(orderId, 'confirmed');
            toast.success(t('actions.update_success', 'Order Accepted!'));
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.message || t('common:error_occurred'));
        }
    };

    return (
        <div className="container-fluid px-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold text-slate-900">{t('online_orders_title', 'Online Orders')}</h1>
                        <PageInfoTooltip data={pageInfoData.onlineOrders} />
                        <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                            {t('total_count', { count: pagination.total })}
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm">{t('online_orders_subtitle', 'Manage digital transactions and online deliveries.')}</p>
                </div>
            </div>

            {/* Simple Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { label: t('stats.total_online', 'Total Online'), value: stats.total, icon: <Zap size={18} />, bg: 'bg-blue-50', color: 'text-blue-600' },
                    { label: t('stats.paid_orders', 'Paid Orders'), value: stats.paid, icon: <CreditCard size={18} />, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                    { label: t('stats.pending_payment', 'Pending Payment'), value: stats.pending, icon: <Clock size={18} />, bg: 'bg-amber-50', color: 'text-amber-600' },
                    { label: t('stats.revenue', 'Revenue'), value: `₹${Number(stats.revenue).toLocaleString()}`, icon: <IndianRupee size={18} />, bg: 'bg-slate-100', color: 'text-slate-900' },
                ].map((s, i) => (
                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${s.bg} ${s.color}`}>
                                {s.icon}
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{s.label}</p>
                                <p className="text-base font-bold text-slate-900 leading-tight">{s.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm flex flex-col lg:flex-row items-center gap-4">
                <div className="w-full lg:flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={t('search_placeholder')}
                        className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative">
                        <button
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors border ${activeFiltersCount > 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                            <Filter size={18} /> {t('filters.title')}
                            {activeFiltersCount > 0 && <span className="w-5 h-5 bg-white text-blue-600 rounded-full flex items-center justify-center text-[10px] ml-1">{activeFiltersCount}</span>}
                        </button>

                        {showFilterMenu && (
                            <div className="absolute top-12 right-0 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-5 z-50">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-slate-900">{t('filters.title')}</h3>
                                    {activeFiltersCount > 0 && (
                                        <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:text-red-600">{t('filters.clear_all')}</button>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase">{t('filters.status.label')}</label>
                                        <select className="filter-select-simple" value={statusFilter} onChange={handleFilterChange(setStatusFilter)}>
                                            <option value="">{t('filters.status.all')}</option>
                                            <option value="pending">{t('status.pending')}</option>
                                            <option value="confirmed">{t('status.confirmed')}</option>
                                            <option value="preparing">{t('status.preparing')}</option>
                                            <option value="out_for_delivery">{t('status.out_for_delivery')}</option>
                                            <option value="delivered">{t('status.delivered')}</option>
                                            <option value="cancelled">{t('status.cancelled')}</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase">{t('filters.p_status.label')}</label>
                                        <select className="filter-select-simple" value={paymentStatusFilter} onChange={handleFilterChange(setPaymentStatusFilter)}>
                                            <option value="">{t('filters.p_status.all')}</option>
                                            <option value="paid">{t('filters.p_status.paid')}</option>
                                            <option value="pending">{t('filters.p_status.pending')}</option>
                                            <option value="failed">{t('filters.p_status.failed')}</option>
                                        </select>
                                    </div>
                                    <button onClick={() => setShowFilterMenu(false)} className="w-full py-2 bg-slate-900 text-white font-bold text-sm rounded-lg hover:bg-slate-800 transition-colors mt-2">
                                        {t('filters.apply')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="px-6 py-4">{t('table.id')}</th>
                                <th className="px-6 py-4">{t('table.customer')}</th>
                                <th className="px-6 py-4">{t('table.date')}</th>
                                <th className="px-6 py-4">{t('table.payment')}</th>
                                <th className="px-6 py-4 text-center">{t('table.status')}</th>
                                <th className="px-6 py-4 text-right">{t('table.amount')}</th>
                                <th className="px-6 py-4 text-center">{t('table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="8" className="px-6 py-4"><div className="h-10 bg-slate-50 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : orders.length > 0 ? (
                                orders.map((order) => (
                                    <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                                                    {order.orderId || `#${order._id}`}
                                                </span>
                                                {order.razorpayPaymentId && (
                                                    <span className="text-[9px] text-slate-400 font-medium mt-1">rzp: {order.razorpayPaymentId.slice(-8)}</span>
                                                )}
                                                {(order.deliveryInstructions?.chips?.length > 0 || order.deliveryInstructions?.customNote) && (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded mt-1 w-fit" title={order.deliveryInstructions.customNote || order.deliveryInstructions.chips?.join(', ')}>
                                                        📝 Instructions
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900">{order.user?.name || t('common:guest')}</div>
                                                <div className="text-xs text-slate-400">{order.user?.phone || ''}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600 flex items-center gap-1.5">
                                                <Calendar size={14} className="text-slate-400" />
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs">
                                                <span className={`font-bold ${order.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {order.paymentStatus?.toUpperCase() || 'PENDING'}
                                                </span>
                                                <p className="text-slate-400 font-medium mt-0.5">ONLINE</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleUpdateStatus(order._id, order.status)} className="hover:opacity-80 transition-opacity" title="Update Status">
                                                <OrderStatusBadge status={order.status} t={t} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                                            ₹{order.totalAmount?.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                {order.status === 'pending' && (
                                                    <button onClick={() => acceptOrder(order._id)} title="Accept Order" className="p-2 hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600 rounded-lg transition-colors">
                                                        <CheckCircle size={16} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleShowDetails(order)} className="p-2 hover:bg-slate-100 hover:text-slate-900 rounded-lg text-slate-400 transition-colors" title="View Details"><Eye size={16} /></button>
                                                <button onClick={() => handleDeleteOrder(order._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete Order"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="px-6 py-20 text-center text-slate-300">
                                        <CreditCard size={48} strokeWidth={1.5} />
                                        <p className="mt-4 text-sm font-bold text-slate-400">{t('empty.no_orders', 'No online orders found')}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && pagination.total > 0 && (
                    <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-xs font-bold text-slate-400 uppercase">
                            {t('total_count', { count: pagination.total })}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-sm font-bold text-slate-600 px-2">{page} / {pagination.totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <OrderDetailsModal
                show={showModal}
                onHide={() => setShowModal(false)}
                order={selectedOrder}
                onOrderUpdate={fetchOrders}
            />

            <style dangerouslySetInnerHTML={{ __html: `
                .filter-select-simple { width: 100%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 8px 10px; font-size: 13px; font-weight: 600; color: #1e293b; outline: none; transition: all 0.2s; }
                .filter-select-simple:focus { border-color: #3b82f6; background: #fff; }
            `}} />
        </div>
    );
};

export default OnlineOrders;

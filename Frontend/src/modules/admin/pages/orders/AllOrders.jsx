import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Search, Eye, Printer, Filter, Download, Store, Upload, Clock, ChevronLeft, ChevronRight, Zap, CreditCard, Calendar, Truck, Edit3, Trash2, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import OrderDetailsModal from '../../../../common/components/orders/OrderDetailsModal';
import { getAllOrdersAdmin, deleteOrder, bulkDeleteOrders, updateOrderStatus, getOrderDetails } from '../../api/orderApi';
import { getDeliverySlots } from '../../api/deliverySlotApi';
import { useAdminAuth } from '../../context/AdminAuthContext';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import PageInfoTooltip from '../../../../common/components/modals/PageInfoTooltip';
import { pageInfoData } from '../../../../common/data/pageInfoData';
import { downloadCSV } from '../../../../common/utils/formatUtils';
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

const AllOrders = () => {
    const { t } = useTranslation(['admin_orders', 'common']);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const { adminUser } = useAdminAuth();

    const generateAndPrintReceipt = (order) => {
        const items = order.items || order.orderItems || [];
        const itemsHtml = items.length > 0 ? items.map(item => {
            const name = item.product?.name || item.name || 'Item';
            const qty = item.quantity || 1;
            const unitPrice = item.price || item.basePrice || item.product?.basePrice || 0;
            const total = unitPrice * qty;
            return `
                <tr>
                    <td style="padding:5px 0;font-size:12px;border-bottom:1px dotted #ddd;vertical-align:top;">${name}</td>
                    <td style="padding:5px 4px;font-size:12px;text-align:center;border-bottom:1px dotted #ddd;vertical-align:top;">${qty}</td>
                    <td style="padding:5px 0;font-size:12px;text-align:right;border-bottom:1px dotted #ddd;white-space:nowrap;vertical-align:top;">₹${total.toLocaleString('en-IN')}</td>
                </tr>
            `;
        }).join('') : '<tr><td colspan="3" style="text-align:center;font-size:11px;padding:8px;">No items found</td></tr>';

        const immediateFee = Number(order.immediateDeliveryFee) || 0;
        const totalDelFee = Number(order.deliveryFee) || 0;
        const baseDelFee = order.baseDeliveryFee != null ? Number(order.baseDeliveryFee) : Math.max(0, totalDelFee - immediateFee);

        const receiptHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt - #${order.orderId || order._id?.slice(-8).toUpperCase()}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Courier New', monospace; width: 300px; margin: 0 auto; padding: 16px; font-size: 13px; color: #000; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .divider { border-top: 1px dashed #000; margin: 8px 0; }
                    .divider-solid { border-top: 2px solid #000; margin: 8px 0; }
                    table { width: 100%; border-collapse: collapse; }
                    th { font-size: 11px; text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; }
                    th:nth-child(2) { text-align: center; }
                    th:nth-child(3) { text-align: right; }
                    .total-row td { font-weight: bold; font-size: 14px; padding-top: 8px; }
                    .store-name { font-size: 22px; font-weight: 900; letter-spacing: 2px; }
                    .tag { font-size: 10px; color: #444; margin-top: 2px; }
                    @media print { @page { margin: 0; size: 80mm auto; } body { width: 100%; } }
                </style>
            </head>
            <body>
                <div class="center" style="margin-bottom:12px;">
                    <div class="store-name">Saathigro</div>
                    <div class="tag">Your Everyday Grocery Partner</div>
                    <div class="tag">Indore, Madhya Pradesh</div>
                    <div class="tag">support@Saathigro.com</div>
                </div>
                <div class="divider-solid"></div>
                <div style="margin:8px 0;">
                    <div class="bold" style="font-size:13px;">ORDER #${order.orderId || order._id?.slice(-8).toUpperCase()}</div>
                    <div class="tag">Date: ${new Date(order.createdAt).toLocaleString('en-IN')}</div>
                    <div class="tag">Customer: ${order.user?.name || order.posCustomer?.name || 'Guest'}</div>
                    ${order.user?.phone || order.posCustomer?.phone ? `<div class="tag">Phone: ${order.user?.phone || order.posCustomer?.phone}</div>` : ''}
                    ${order.deliveryAddress?.street ? `<div class="tag">Address: ${order.deliveryAddress.street}, ${order.deliveryAddress.city || ''}</div>` : ''}
                    ${order.isImmediate ? '<div class="tag" style="color:green;font-weight:bold;">⚡ EXPRESS DELIVERY</div>' : ''}
                </div>
                <div class="divider"></div>
                <table>
                    <thead>
                        <tr>
                            <th>ITEM</th>
                            <th style="text-align:center;">QTY</th>
                            <th style="text-align:right;">AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div class="divider"></div>
                <table>
                    <tr><td style="font-size:12px;padding:2px 0;">Subtotal</td><td style="text-align:right;font-size:12px;">₹${(order.subTotal || order.subtotal || order.totalAmount)?.toLocaleString('en-IN')}</td></tr>
                    ${immediateFee > 0 ? `
                        <tr><td style="font-size:12px;padding:2px 0;">Base Delivery Fee</td><td style="text-align:right;font-size:12px;">${baseDelFee === 0 ? '<span style="color:green;">FREE</span>' : `₹${baseDelFee.toLocaleString('en-IN')}`}</td></tr>
                        <tr><td style="font-size:12px;padding:2px 0;">Express Surcharge</td><td style="text-align:right;font-size:12px;color:green;">+₹${immediateFee.toLocaleString('en-IN')}</td></tr>
                    ` : (totalDelFee > 0 ? `<tr><td style="font-size:12px;padding:2px 0;">Delivery Fee</td><td style="text-align:right;font-size:12px;">₹${totalDelFee.toLocaleString('en-IN')}</td></tr>` : '<tr><td style="font-size:12px;padding:2px 0;">Delivery Fee</td><td style="text-align:right;font-size:12px;color:green;">FREE</td></tr>')}
                    ${(order.taxAmount > 0) ? `<tr><td style="font-size:12px;padding:2px 0;">Tax</td><td style="text-align:right;font-size:12px;">₹${order.taxAmount?.toLocaleString('en-IN')}</td></tr>` : ''}
                    ${(order.platformFee > 0) ? `<tr><td style="font-size:12px;padding:2px 0;">Handling Fee</td><td style="text-align:right;font-size:12px;">₹${order.platformFee?.toLocaleString('en-IN')}</td></tr>` : ''}
                    ${(order.discountAmount > 0) ? `<tr><td style="font-size:12px;padding:2px 0;">Discount</td><td style="text-align:right;font-size:12px;color:green;">-₹${order.discountAmount?.toLocaleString('en-IN')}</td></tr>` : ''}
                    <tr class="total-row"><td>TOTAL</td><td style="text-align:right;">₹${order.totalAmount?.toLocaleString('en-IN')}</td></tr>
                </table>
                <div class="divider"></div>
                <div style="font-size:12px;margin:6px 0;">
                    <div>Payment: <span class="bold">${(order.paymentMethod || 'N/A').toUpperCase()}</span></div>
                    <div>Status: <span class="bold" style="color:${order.paymentStatus === 'paid' ? 'green' : 'orange'}">${(order.paymentStatus || 'Pending').toUpperCase()}</span></div>
                </div>
                <div class="divider-solid"></div>
                <div class="center" style="margin-top:12px;">
                    <div style="font-size:11px;">Thank you for shopping with Saathigro!</div>
                    <div style="font-size:10px;color:#555;margin-top:4px;">Visit us again • www.Saathigro.com</div>
                    <div style="font-size:10px;color:#888;margin-top:10px;">*** This is a computer generated receipt ***</div>
                </div>
            </body>
            </html>
        `;
        const win = window.open('', '_blank', 'width=420,height=750');
        win.document.write(receiptHtml);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
    };

    const handlePrintReceipt = async (order) => {
        toast.info('Preparing receipt...', { autoClose: 1500 });
        try {
            const fullOrder = await getOrderDetails(order._id);
            generateAndPrintReceipt(fullOrder);
        } catch (err) {
            // Fallback: use whatever data we have
            generateAndPrintReceipt(order);
        }
    };

    const handleExportOrders = () => {
        if (!orders || orders.length === 0) {
            return toast.warning('No orders available to export');
        }

        // CSV headers
        const headers = [
            'Order ID',
            'Customer Name',
            'Phone',
            'Date',
            'Payment Status',
            'Payment Method',
            'Status',
            'Total Amount (₹)'
        ];

        // Format rows
        const csvRows = [
            headers.join(','), // Header row
            ...orders.map(order => {
                const orderId = order.orderId || order._id?.slice(-8).toUpperCase() || '';
                const name = `"${(order.user?.name || order.posCustomer?.name || 'Guest').replace(/"/g, '""')}"`;
                const phone = order.user?.phone || order.posCustomer?.phone || '';
                const date = new Date(order.createdAt).toLocaleDateString();
                const paymentStatus = order.paymentStatus || '';
                const paymentMethod = order.paymentMethod || '';
                const status = order.status || '';
                const total = order.totalAmount || 0;

                return [
                    orderId,
                    name,
                    phone,
                    date,
                    paymentStatus,
                    paymentMethod,
                    status,
                    total
                ].join(',');
            })
        ];

        // Create Blob and download trigger with UTF-8 BOM
        const csvString = csvRows.join('\n');
        // Prepend UTF-8 BOM (0xEF, 0xBB, 0xBF) to the CSV content for proper Excel rendering of special characters
        const bomCsvString = '\uFEFF' + csvString;
        const fileName = `orders_export_${new Date().toISOString().split('T')[0]}.csv`;
        downloadCSV(bomCsvString, fileName);
        toast.success('Orders exported successfully in CSV format!');
    };

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const location = useLocation();
    const [statusFilter, setStatusFilter] = useState(location.state?.statusFilter || '');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [deliverySlotFilter, setDeliverySlotFilter] = useState('');
    const [orderSourceFilter, setOrderSourceFilter] = useState('');
    const [deliverySlots, setDeliverySlots] = useState([]);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const source = searchParams.get('source');
        setOrderSourceFilter(source || '');
        if (source) setPage(1);
    }, [searchParams]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        const fetchSlots = async () => {
            try {
                const data = await getDeliverySlots();
                setDeliverySlots(data);
            } catch (error) {
                console.error('Failed to fetch delivery slots:', error);
            }
        };
        fetchSlots();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const params = {
                page,
                limit,
                search: debouncedSearch,
                status: statusFilter,
                paymentMethod: paymentMethodFilter,
                paymentStatus: paymentStatusFilter,
                startDate,
                endDate,
                orderSource: orderSourceFilter,
                ...(deliverySlotFilter && deliverySlotFilter !== 'immediate' ? { deliverySlotId: deliverySlotFilter } : {}),
                ...(deliverySlotFilter === 'immediate' ? { isImmediate: 'true' } : {})
            };
            const data = await getAllOrdersAdmin(params);
            if (data && data.orders) {
                setOrders(data.orders);
                setPagination(data.pagination);
            } else if (Array.isArray(data)) {
                setOrders(data);
                setPagination({ total: data.length, totalPages: 1, limit, page: 1 });
            }
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            toast.error(t('common:error_occurred'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [page, limit, debouncedSearch, statusFilter, paymentMethodFilter, paymentStatusFilter, startDate, endDate, deliverySlotFilter, orderSourceFilter]);

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
    }, [page, limit, debouncedSearch, statusFilter, paymentMethodFilter, paymentStatusFilter, startDate, endDate, deliverySlotFilter, orderSourceFilter]);

    const handleFilterChange = (setter) => (e) => {
        setter(e.target.value);
        setPage(1);
    };

    const clearFilters = () => {
        setStatusFilter('');
        setPaymentMethodFilter('');
        setPaymentStatusFilter('');
        setStartDate('');
        setEndDate('');
        setSearchTerm('');
        setDeliverySlotFilter('');
        setOrderSourceFilter('');
        setPage(1);
        setShowFilterMenu(false);
    };

    const activeFiltersCount = [statusFilter, paymentMethodFilter, paymentStatusFilter, startDate, endDate, deliverySlotFilter, orderSourceFilter].filter(Boolean).length;

    const handleShowDetails = (order) => {
        setSelectedOrder(order);
        setShowModal(true);
    };

    const handleDeleteOrder = async (orderId) => {
        const result = await showDeleteConfirmation(
            t('actions.delete_confirm_title'),
            `${t('actions.delete_confirm_text', { id: orderId })} ${t('actions.delete_warning', { defaultValue: 'This action cannot be undone.' })}`
        );

        if (result.isConfirmed) {
            try {
                await deleteOrder(orderId);
                toast.success(t('actions.delete_success'));
                setSelectedIds((prev) => prev.filter(id => id !== orderId));
                fetchOrders();
            } catch (error) {
                toast.error(error.response?.data?.message || t('common:error_occurred'));
            }
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const allSelected = orders.length > 0 && orders.every(o => selectedIds.includes(o._id));

    const toggleSelectAll = () => {
        if (allSelected) {
            const currentIds = orders.map(o => o._id);
            setSelectedIds((prev) => prev.filter(id => !currentIds.includes(id)));
        } else {
            setSelectedIds((prev) => Array.from(new Set([...prev, ...orders.map(o => o._id)])));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;

        const result = await showDeleteConfirmation(
            t('actions.bulk_delete_confirm_title', { defaultValue: 'Delete selected orders?' }),
            `${t('actions.bulk_delete_confirm_text', { count: selectedIds.length, defaultValue: `Are you sure you want to delete ${selectedIds.length} selected order(s)?` })} ${t('actions.delete_warning', { defaultValue: 'This action cannot be undone.' })}`
        );

        if (result.isConfirmed) {
            try {
                await bulkDeleteOrders(selectedIds);
                toast.success(t('actions.bulk_delete_success', { count: selectedIds.length, defaultValue: `${selectedIds.length} order(s) deleted` }));
                setSelectedIds([]);
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
                
                Swal.getConfirmButton().addEventListener('click', () => {
                    Swal.close();
                    Swal.fire({ didClose: () => { Swal.fire({ icon: 'success', title: 'Status Updated!', timer: 1500, showConfirmButton: false }); } });
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
                        <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
                        <PageInfoTooltip data={pageInfoData.allOrders} />
                        <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                            {t('total_count', { count: pagination.total })}
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm">{t('subtitle')}</p>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={handleExportOrders}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
                    >
                        <Download size={16} /> {t('export')}
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                <div className="w-full flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={t('search_placeholder')}
                        className="w-full bg-slate-50 border border-slate-100 rounded-lg py-2 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
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
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase">From Date</label>
                                            <input type="date" max={new Date().toISOString().split('T')[0]} className="filter-select-simple w-full text-xs" value={startDate} onChange={handleFilterChange(setStartDate)} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase">To Date</label>
                                            <input type="date" max={new Date().toISOString().split('T')[0]} className="filter-select-simple w-full text-xs" value={endDate} onChange={handleFilterChange(setEndDate)} />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase">{t('filters.status.label')}</label>
                                        <select className="filter-select-simple" value={statusFilter} onChange={handleFilterChange(setStatusFilter)}>
                                            <option value="">{t('filters.status.all')}</option>
                                            {Object.keys(t('filters.status', { returnObjects: true })).filter(k => k !== 'label' && k !== 'all').map(key => (
                                                <option key={key} value={key}>{t(`filters.status.${key}`)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase">{t('filters.payment.label')}</label>
                                            <select className="filter-select-simple" value={paymentMethodFilter} onChange={handleFilterChange(setPaymentMethodFilter)}>
                                                <option value="">{t('filters.payment.all')}</option>
                                                <option value="cod">{t('filters.payment.cod')}</option>
                                                <option value="online">{t('filters.payment.online')}</option>
                                                <option value="wallet">{t('filters.payment.wallet')}</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase">{t('filters.p_status.label')}</label>
                                            <select className="filter-select-simple" value={paymentStatusFilter} onChange={handleFilterChange(setPaymentStatusFilter)}>
                                                <option value="">{t('filters.p_status.all')}</option>
                                                <option value="pending">{t('filters.p_status.pending')}</option>
                                                <option value="paid">{t('filters.p_status.paid')}</option>
                                                <option value="failed">{t('filters.p_status.failed')}</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setShowFilterMenu(false)}
                                        className="w-full py-2 bg-slate-900 text-white font-bold text-sm rounded-lg hover:bg-slate-800 transition-colors mt-2"
                                    >
                                        {t('filters.apply')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedIds.length > 0 && (
                <div className="bg-blue-600 text-white rounded-xl px-4 py-3 mb-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold">{selectedIds.length} {t('selected', { defaultValue: 'selected' })}</span>
                        <button onClick={() => setSelectedIds([])} className="text-xs font-medium text-blue-100 hover:text-white underline">
                            {t('clear_selection', { defaultValue: 'Clear' })}
                        </button>
                    </div>
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={16} /> {t('actions.delete', { defaultValue: 'Delete' })}
                    </button>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="px-6 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                                    />
                                </th>
                                <th className="px-6 py-4">{t('table.id')}</th>
                                <th className="px-6 py-4">{t('table.customer')}</th>
                                <th className="px-6 py-4">{t('table.date')}</th>
                                <th className="px-6 py-4">Delivery Time</th>
                                <th className="px-6 py-4">{t('table.payment')}</th>
                                <th className="px-6 py-4">{t('table.status')}</th>
                                <th className="px-6 py-4 text-right">{t('table.amount')}</th>
                                <th className="px-6 py-4 text-center">{t('table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="9" className="px-6 py-4"><div className="h-10 bg-slate-50 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : orders.length > 0 ? (
                                orders.map((order) => (
                                    <tr key={order._id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(order._id) ? 'bg-blue-50/40' : ''}`}>
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(order._id)}
                                                onChange={() => toggleSelect(order._id)}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                #{order.orderId || order._id}
                                            </span>
                                            {(order.deliveryInstructions?.chips?.length > 0 || order.deliveryInstructions?.customNote) && (
                                                <div className="mt-1">
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded" title={order.deliveryInstructions.customNote || order.deliveryInstructions.chips?.join(', ')}>
                                                        📝 Instructions
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900">{order.user?.name || order.posCustomer?.name || 'Guest'}</div>
                                                <div className="text-xs text-slate-400">{order.user?.phone || order.posCustomer?.phone || ''}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600 flex items-center gap-1.5">
                                                <Calendar size={14} className="text-slate-400" />
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-slate-700">
                                                {order.isImmediate ? 'Immediate' : (order.deliveryWindowSnapshot?.label || order.deliverySlotId?.label || order.deliverySlot || 'Not specified')}
                                            </div>
                                            {!order.isImmediate && (order.deliveryWindowSnapshot?.startTime || order.deliverySlotId?.startTime) && (
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    {order.deliveryWindowSnapshot?.startTime || order.deliverySlotId?.startTime} - {order.deliveryWindowSnapshot?.endTime || order.deliverySlotId?.endTime}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs">
                                                <span className={`font-bold ${order.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {order.paymentStatus?.toUpperCase()}
                                                </span>
                                                <p className="text-slate-400 font-medium mt-0.5">{order.paymentMethod?.toUpperCase()}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button onClick={() => handleUpdateStatus(order._id, order.status)} className="hover:opacity-80 transition-opacity" title="Update Status">
                                                <OrderStatusBadge status={order.status} t={t} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-bold text-slate-900">₹{order.totalAmount?.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-1">
                                                {order.status === 'pending' && (
                                                    <button onClick={() => acceptOrder(order._id)} title="Accept Order" className="p-2 hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600 rounded-lg transition-colors">
                                                        <CheckCircle size={16} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleShowDetails(order)} title="View Details" className="p-2 hover:bg-slate-100 hover:text-slate-900 rounded-lg text-slate-400 transition-colors"><Eye size={16} /></button>
                                                <button onClick={() => handlePrintReceipt(order)} title="Print Receipt" className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-400 transition-colors"><Printer size={16} /></button>
                                                <button onClick={() => handleDeleteOrder(order._id)} title="Delete Order" className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="9" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center text-slate-300">
                                            <Truck size={64} strokeWidth={1.5} />
                                            <p className="mt-4 text-sm font-bold text-slate-400">{t('empty.title')}</p>
                                        </div>
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

export default AllOrders;

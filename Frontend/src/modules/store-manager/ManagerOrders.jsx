import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, Eye, Box, Truck, CheckCircle, RefreshCcw, DollarSign, Loader2, ChevronDown, Check, XCircle, ArrowRight, ShoppingBag } from 'lucide-react';
import Swal from 'sweetalert2';
import OrderDetailsModal from '../../common/components/orders/OrderDetailsModal';
import { getAllOrdersAdmin, updateOrderStatus } from '../../common/api/orderApi';
import { useStoreManagerAuth } from './context/StoreManagerAuthContext';

const ManagerOrders = () => {
    const [searchParams] = useSearchParams();
    const initialStatus = searchParams.get('status') || 'All';
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState(initialStatus);
    const [showModal, setShowModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);

    const { managerUser } = useStoreManagerAuth();

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const data = await getAllOrdersAdmin({ limit: 1000 });
            setOrders(data.orders || []);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            Swal.fire('Error', 'Could not load branch orders', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        const handleFirebaseMessage = (event) => {
            const payload = event.detail;
            const type = payload?.data?.type || '';
            const title = payload?.notification?.title || payload?.data?.title || '';
            
            // If it's related to an order update, a new order, or delivery status change, refresh the list
            if (type.includes('order') || title.toLowerCase().includes('order') || type === 'delivery_status_update') {
                fetchOrders();
            }
        };

        window.addEventListener('firebaseMessage', handleFirebaseMessage);
        return () => window.removeEventListener('firebaseMessage', handleFirebaseMessage);
    }, [statusFilter, searchTerm]);

    const handleStatusUpdate = async (id, newStatus) => {
        setActiveDropdown(null);
        try {
            await updateOrderStatus(id, newStatus);
            Swal.fire({
                title: 'Status Updated',
                text: `Order status changed to ${newStatus.replace(/_/g, ' ')}`,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                confirmButtonColor: '#2563eb'
            });
            fetchOrders();
        } catch (error) {
            Swal.fire('Error', error.response?.data?.message || 'Update failed', 'error');
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'confirmed': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'preparing': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
            case 'ready_for_pickup': return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'out_for_delivery': return 'bg-teal-50 text-teal-700 border-teal-200';
            case 'delivered': return 'bg-green-50 text-green-700 border-green-200';
            case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
            case 'returned': return 'bg-slate-100 text-slate-700 border-slate-300';
            default: return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    const toggleDropdown = (id) => {
        if (activeDropdown === id) setActiveDropdown(null);
        else setActiveDropdown(id);
    };

    const trimmedSearchTerm = searchTerm.trim().toLowerCase();

        const filteredOrders = Array.isArray(orders)
            ? orders.filter(order => {
                const orderId = order.orderId || order._id;
                const customerName = order.posCustomer?.name || order.user?.name || 'Guest';
                return (orderId.toLowerCase().includes(trimmedSearchTerm) ||
                    customerName.toLowerCase().includes(trimmedSearchTerm)) &&
                    (statusFilter === 'All' || order.status === statusFilter);
            })
            : [];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <OrderDetailsModal show={showModal} onHide={() => setShowModal(false)} order={selectedOrder} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Manage Orders</h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">Branch: <span className="font-bold text-blue-600 truncate">{managerUser?.branchId?.name || 'Assigned Branch'}</span></p>
                </div>
                <button 
                    onClick={fetchOrders} 
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                    <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh List
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between bg-slate-50/50">
                    <div className="relative w-full lg:max-w-md group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search by Order ID or Customer..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100/50 font-medium transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value.trimStart())}
                        />
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <select 
                                className="appearance-none w-full md:w-56 bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-10 text-xs outline-none focus:border-blue-400 font-bold text-slate-600 cursor-pointer shadow-sm transition-all"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="All">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="preparing">Preparing</option>
                                <option value="ready_for_pickup">Ready for Pickup</option>
                                <option value="out_for_delivery">Out for Delivery</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[450px]">
                    <table className="w-full text-left">
                        <thead className="bg-white border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Order ID</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Customer Details</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Items</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Total Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-20">
                                        <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-4">Loading Orders...</p>
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-24">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <ShoppingBag size={24} className="text-slate-300" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No matching orders found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr key={order._id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-5 text-center">
                                            <span className="font-bold text-blue-600 text-sm">#{order.orderId || order._id}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors uppercase">{order.posCustomer?.name || order.user?.name || 'Guest'}</div>
                                                {order.orderSource === 'pos' && (
                                                    <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">POS</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">{new Date(order.createdAt).toLocaleDateString()} • {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                                                    {order.paymentMethod === 'cod' ? 'COD' : 'ONLINE'}
                                                </span>
                                                {order.isImmediate && (
                                                    <span className="bg-green-50 text-[#0c831f] border border-green-200 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                                                        ⚡ Express
                                                    </span>
                                                )}
                                                {(order.deliveryInstructions?.chips?.length > 0 || order.deliveryInstructions?.customNote) && (
                                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-black px-1.5 py-0.5 rounded uppercase" title={order.deliveryInstructions.customNote || order.deliveryInstructions.chips?.join(', ')}>
                                                        📝 Instructions
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="text-sm font-bold text-slate-700 px-2 py-0.5 bg-slate-100 rounded-lg">{order.items?.length || 0}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-base font-black text-slate-900">₹{order.totalAmount.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold border tracking-wider uppercase inline-flex items-center gap-1.5 ${getStatusStyle(order.status)}`}>
                                                <span className="w-1 h-1 rounded-full bg-current opacity-70"></span>
                                                {order.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right relative">
                                            <div className="flex items-center justify-end gap-2.5">
                                                <button 
                                                    onClick={() => { setSelectedOrder(order); setShowModal(true); }}
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white border border-slate-200 bg-white rounded-xl transition-all shadow-sm active:scale-95"
                                                    title="View Details"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                
                                                {order.orderSource !== 'pos' && (
                                                <div className="relative">
                                                    <button 
                                                        onClick={() => toggleDropdown(order._id)}
                                                        className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 shadow-sm ${activeDropdown === order._id ? 'bg-slate-900 border-slate-900 text-white shadow-slate-200' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400'}`}
                                                    >
                                                        Manage <ChevronDown size={14} className={`transition-transform duration-200 ${activeDropdown === order._id ? 'rotate-180' : ''}`} />
                                                    </button>
                                                    
                                                    {activeDropdown === order._id && (
                                                        <>
                                                            <div className="fixed inset-0 z-10" onClick={() => setActiveDropdown(null)}></div>
                                                            <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                                <div className="p-2 border-b border-slate-50 bg-slate-50 flex items-center justify-between">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase px-2">Update Status</span>
                                                                    <RefreshCcw size={10} className="text-slate-300" />
                                                                </div>
                                                                <div className="p-1">
                                                                    {order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'returned' ? (
                                                                        <>
                                                                            {['pending', 'confirmed'].includes(order.status) && (
                                                                                <button onClick={() => handleStatusUpdate(order._id, 'preparing')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 rounded-xl transition-colors">
                                                                                    <Box size={14} /> Mark as Preparing
                                                                                </button>
                                                                            )}
                                                                            {order.status === 'preparing' && (
                                                                                <button onClick={() => handleStatusUpdate(order._id, 'ready_for_pickup')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-green-600 flex items-center gap-2 rounded-xl transition-colors">
                                                                                    <CheckCircle size={14} /> Ready for Pickup
                                                                                </button>
                                                                            )}
                                                                            <div className="border-t border-slate-100 my-1"></div>
                                                                            <button onClick={() => handleStatusUpdate(order._id, 'cancelled')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 rounded-xl transition-colors">
                                                                                <XCircle size={14} /> Cancel Order
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <div className="px-4 py-4 text-center">
                                                                            <RefreshCcw size={16} className="mx-auto text-slate-200 mb-2" />
                                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">No Manual Actions</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ManagerOrders;

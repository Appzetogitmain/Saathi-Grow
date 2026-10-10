import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ShoppingCart, Package, Users, IndianRupee, TrendingUp, TrendingDown,
    Eye, ChevronRight, Calendar
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { useAdminAuth } from '../context/AdminAuthContext';
import { getDashboardStats } from '../api/adminApi';
import OrderDetailsModal from '../../../common/components/orders/OrderDetailsModal';
import PageInfoTooltip from '../../../common/components/modals/PageInfoTooltip';
import { pageInfoData } from '../../../common/data/pageInfoData';
import OutOfStockWidget from '../components/OutOfStockWidget';

const Dashboard = () => {
    const { t } = useTranslation(['admin_dashboard', 'common']);
    const { adminUser } = useAdminAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getDashboardStats(adminUser.token);
                if (data.success) {
                    setStats(data);
                }
            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };

        if (adminUser?.token) fetchStats();
    }, [adminUser.token]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-500 font-medium">{t('common:loading')}</p>
            </div>
        );
    }

    const { stats: apiStats, recentOrders: apiOrders, revenueData: apiRevenueData, channels } = stats || {};

    const pieData = [
        { name: 'POS', value: channels?.pos || 0, color: '#1e293b' },
        { name: 'Online', value: channels?.online || 0, color: '#3b82f6' }
    ];

    const handleViewOrder = (order) => {
        setSelectedOrder({ _id: order.id, ...order });
        setShowModal(true);
    };

    return (
        <div className="container-fluid px-0">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <h1 className="text-sm font-bold tracking-tight text-slate-900 uppercase tracking-[0.05em]">{t('operational_command_center')}</h1>
                        <PageInfoTooltip data={pageInfoData.dashboard} />
                    </div>
                    <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">{t('monitoring_global_operations')}</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 text-slate-600 text-sm font-medium">
                    <Calendar size={16} />
                    <span>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { label: t('revenue'), value: `₹${apiStats?.totalRevenue?.toLocaleString() || 0}`, icon: IndianRupee, trend: apiStats?.revenueGrowth, color: 'text-blue-600', bg: 'bg-blue-50', to: '/admin/analytics/revenue' },
                    { label: t('order_flow'), value: apiStats?.totalOrders || 0, icon: ShoppingCart, trend: apiStats?.orderGrowth, color: 'text-emerald-600', bg: 'bg-emerald-50', to: '/admin/orders' },
                    { label: t('processing'), value: apiStats?.pendingOrders || 0, icon: Package, color: 'text-amber-600', bg: 'bg-amber-50', to: '/admin/orders', state: { statusFilter: 'pending' } },
                    { label: t('active_market'), value: apiStats?.totalUsers || 0, icon: Users, color: 'text-slate-600', bg: 'bg-slate-100', to: '/admin/customers' }
                ].map((item, i) => (
                    <Link key={i} to={item.to} state={item.state} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-blue-500/30 group block no-underline">
                        <div className="flex justify-between items-center mb-4">
                            <div className={`p-2 rounded-lg ${item.bg} ${item.color} group-hover:scale-110 transition-transform duration-300`}>
                                <item.icon size={20} />
                            </div>
                            {item.trend !== undefined && (
                                <div className={`flex items-center gap-1 text-xs font-bold ${item.trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {item.trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                    {Math.abs(item.trend)}%
                                </div>
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{item.value}</h3>
                        <p className="text-slate-400 text-xs font-semibold uppercase mt-1 tracking-wide">{item.label}</p>
                    </Link>
                ))}
            </div>

            {/* Out of Stock Action Widget */}
            <OutOfStockWidget />

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-800">{t('performance_trajectory')}</h3>
                        <p className="text-xs text-slate-400 font-medium">Sales data for the last 7 days</p>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={apiRevenueData || []}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">{t('channel_split')}</h3>
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                                        {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full mt-6 space-y-3">
                            {pieData.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm py-2 px-3 bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }}></div>
                                        <span className="text-slate-600 font-medium">{item.name}</span>
                                    </div>
                                    <span className="font-bold text-slate-900">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Orders Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">{t('live_order_stream')}</h3>
                    <Link to="/admin/orders" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                        {t('view_all_history')} <ChevronRight size={14} />
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                                <th className="px-6 py-3">Order ID</th>
                                <th className="px-6 py-3">Customer</th>
                                <th className="px-6 py-3">Amount</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {apiOrders?.map((order, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-medium text-slate-900">#{order.orderId || order.id || order._id}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-slate-700">{order.customer || 'Unknown'}</div>
                                        <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase mt-1 inline-block">
                                            {order.paymentMethod === 'cod' ? 'COD' : 'ONLINE'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-bold text-slate-900">₹{order.amount?.toLocaleString()}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                            order.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' :
                                            order.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                                            'bg-slate-50 text-slate-500'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => handleViewOrder(order)} 
                                            className="p-1 px-2 bg-slate-50 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <OrderDetailsModal
                show={showModal}
                onHide={() => setShowModal(false)}
                order={selectedOrder}
            />
        </div>
    );
};

export default Dashboard;

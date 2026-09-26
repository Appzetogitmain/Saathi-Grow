import React, { useState, useEffect } from 'react';
import { Bell, ShoppingBag, Tag, Info, ArrowLeft, Loader2, CheckCircle2, XCircle, TicketCheck, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../../../config/apiConfig';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const getNotificationStyle = (type) => {
    switch (type) {
        case 'resolution':
        case 'ticket_closed':
            return {
                icon: <CheckCircle2 size={20} />,
                bg: 'bg-emerald-50 border-emerald-100 text-emerald-600',
                dot: 'bg-emerald-500'
            };
        case 'store_response':
            return {
                icon: <TicketCheck size={20} />,
                bg: 'bg-blue-50 border-blue-100 text-blue-600',
                dot: 'bg-blue-500'
            };
        case 'complaint':
        case 'escalation':
            return {
                icon: <XCircle size={20} />,
                bg: 'bg-rose-50 border-rose-100 text-rose-500',
                dot: 'bg-rose-500'
            };
        case 'order':
        case 'order_update':
            return {
                icon: <ShoppingBag size={20} />,
                bg: 'bg-violet-50 border-violet-100 text-violet-600',
                dot: 'bg-violet-500'
            };
        case 'admin_broadcast':
        case 'individual':
        case 'admin_message':
            return {
                icon: <MessageSquare size={20} />,
                bg: 'bg-amber-50 border-amber-100 text-amber-600',
                dot: 'bg-amber-500'
            };
        default:
            return {
                icon: <Bell size={20} />,
                bg: 'bg-blue-50 border-blue-100 text-blue-600',
                dot: 'bg-blue-500'
            };
    }
};

const NotificationsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { token } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAndMarkRead = async () => {
            if (!token) return;
            try {
                const res = await axios.get(`${API_BASE_URL}/notifications/my`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    setNotifications(res.data.notifications);
                    // Auto mark all as read when page opens
                    await axios.put(`${API_BASE_URL}/notifications/read-all`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    window.dispatchEvent(new Event('onNotificationsRead'));
                }
            } catch (error) {
                console.error('Error fetching notifications:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAndMarkRead();
    }, [token]);

    const markAllAsRead = async () => {
        try {
            await axios.put(`${API_BASE_URL}/notifications/read-all`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            window.dispatchEvent(new Event('onNotificationsRead'));
        } catch (error) {
            console.error('Error marking all read:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-r from-[#e8f5e9] to-[#ffffff] md:bg-white dark:from-[#141414] dark:to-[#141414] transition-colors duration-300 pb-20">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="hidden md:flex items-center gap-3 mb-8 p-4">
                    <button
                        onClick={() => {
                            const from = location.state?.from || '/';
                            const noMenuPages = ['/settings', '/profile'];
                            const shouldOpenMenu = !noMenuPages.includes(from);
                            navigate(from, { state: { openMenu: shouldOpenMenu } });
                        }}
                        className="p-1.5 bg-gray-50 dark:bg-[#141414] rounded-full shadow-sm"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Notifications</h1>
                </div>

                {/* Notifications List */}
                <div className="px-0 md:px-4 pt-6 border-t border-transparent md:pt-0">
                    <div className="flex justify-between items-center mb-4 px-4 md:px-2">
                        <p className="text-sm font-semibold text-slate-500">Recently Received</p>
                        {notifications.some(n => !n.isRead) && (
                            <button onClick={markAllAsRead} className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
                                Mark all as read
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 size={24} className="animate-spin text-[#0c831f]" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-0 md:gap-3">
                            {notifications.map((item) => {
                                const style = getNotificationStyle(item.type);
                                return (
                                    <div
                                        key={item._id}
                                        className={`w-full py-4 px-4 flex items-start gap-4 transition-all border-b border-slate-100 dark:border-white/5 md:border md:rounded-2xl md:shadow-sm ${item.isRead ? 'bg-transparent opacity-75' : 'bg-white dark:bg-slate-900'}`}
                                    >
                                        {/* Icon */}
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${item.isRead ? 'bg-slate-50 border-slate-100 text-slate-400' : style.bg}`}>
                                            {style.icon}
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className={`text-base font-semibold leading-tight flex items-center gap-2 ${item.isRead ? 'text-slate-600' : 'text-slate-800 dark:text-slate-100'}`}>
                                                    {item.title}
                                                    {/* Unread dot */}
                                                    {!item.isRead && (
                                                        <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                                                    )}
                                                </h4>
                                                <span className="text-xs text-slate-400 font-medium whitespace-nowrap ml-2">
                                                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                                </span>
                                            </div>
                                            <p className={`text-sm leading-relaxed ${item.isRead ? 'text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {item.body}
                                            </p>

                                            {/* Type badge */}
                                            {(item.type === 'resolution' || item.type === 'ticket_closed') && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit mt-1">
                                                    <CheckCircle2 size={10} />
                                                    {item.type === 'ticket_closed' ? 'Ticket Closed' : 'Complaint Resolved'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {!loading && notifications.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <Bell size={32} className="text-slate-300" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">All caught up!</h2>
                        <p className="text-sm text-slate-500 font-medium">No new notifications to show right now.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;

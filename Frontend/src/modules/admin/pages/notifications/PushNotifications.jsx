import React, { useState, useEffect, useCallback } from 'react';
import { Send, Bell, User, Clock, Search, Users, Shield, Truck, Store, Trash2, Smartphone, ChevronLeft, ChevronRight, Loader2, Info, RefreshCw, CheckCircle, Package, Tag, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PageInfoTooltip from '../../../../common/components/modals/PageInfoTooltip';
import { pageInfoData } from '../../../../common/data/pageInfoData';
import { sendNotification, getNotificationHistory, searchRecipients, deleteNotifications } from '../../api/notificationApi';
import { getCategories } from '../../api/categoryApi';
import { getProducts } from '../../api/productApi';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { showDeleteConfirmation } from '../../../../common/utils/alertUtils';

const PushNotifications = () => {
    const { t } = useTranslation('admin_notifications');
    const { adminUser } = useAdminAuth();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [targetType, setTargetType] = useState('broadcast');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dispatching, setDispatching] = useState(false);

    // Destination / Click Action state
    const [clickActionType, setClickActionType] = useState('home'); // 'home' | 'product' | 'category' | 'custom'
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [productResults, setProductResults] = useState([]);
    const [productLoading, setProductLoading] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [customLink, setCustomLink] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Individual selection state
    const [searchQuery, setSearchQuery] = useState('');
    const [recipientType, setRecipientType] = useState('User');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [selectedRecipient, setSelectedRecipient] = useState(null);

    const fetchHistory = useCallback(async (page = 1) => {
        if (!adminUser?.token) return;
        try {
            setLoading(true);
            const res = await getNotificationHistory(adminUser.token, page, 10);
            if (res.success) {
                setHistory(res.notifications);
                setTotalPages(res.pagination.totalPages);
                setCurrentPage(res.pagination.page);
                setTotalItems(res.pagination.total);
            }
        } catch (error) {
            console.error('History fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [adminUser?.token]);

    useEffect(() => {
        fetchHistory(1);
    }, [fetchHistory]);

    // Fetch categories when category destination is selected
    useEffect(() => {
        if (clickActionType === 'category' && categories.length === 0 && adminUser?.token) {
            setCategoriesLoading(true);
            getCategories(adminUser.token)
                .then(res => {
                    const list = Array.isArray(res) ? res : (res?.categories || []);
                    setCategories(list);
                    if (list.length > 0 && !selectedCategory) {
                        setSelectedCategory(list[0].slug || list[0].name.toLowerCase().split(' ').join('-'));
                    }
                })
                .catch(err => console.error('Categories load error:', err))
                .finally(() => setCategoriesLoading(false));
        }
    }, [clickActionType, categories.length, adminUser?.token, selectedCategory]);

    // Load initial products when Product tab is selected
    useEffect(() => {
        if (clickActionType === 'product' && productResults.length === 0 && !selectedProduct && adminUser?.token) {
            setProductLoading(true);
            getProducts(adminUser.token, { limit: 10 })
                .then(res => setProductResults(res?.products || []))
                .catch(err => console.error('Initial product load error:', err))
                .finally(() => setProductLoading(false));
        }
    }, [clickActionType]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleProductSearch = async (val) => {
        setProductSearch(val);
        if (!val || val.trim().length < 1) {
            // Show initial products list when search is cleared
            if (adminUser?.token) {
                setProductLoading(true);
                getProducts(adminUser.token, { limit: 10 })
                    .then(res => setProductResults(res?.products || []))
                    .catch(err => console.error('Product load error:', err))
                    .finally(() => setProductLoading(false));
            }
            return;
        }
        try {
            setProductLoading(true);
            const res = await getProducts(adminUser.token, { search: val.trim(), limit: 12 });
            setProductResults(res?.products || []);
        } catch (error) {
            console.error('Product search error:', error);
        } finally {
            setProductLoading(false);
        }
    };

    const handleSearch = async (val) => {
        setSearchQuery(val);
        if (val.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            setSearchLoading(true);
            const res = await searchRecipients(adminUser.token, val, recipientType);
            if (res.success) {
                setSearchResults(res.results);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSend = async () => {
        if (!title || !message) {
            toast.error(t('push.fill_required', { defaultValue: 'Connection Error' }));
            return;
        }

        if (targetType === 'individual' && !selectedRecipient) {
            toast.error('Select a recipient first');
            return;
        }

        if (clickActionType === 'product' && !selectedProduct) {
            toast.error('Please search and select a target product');
            return;
        }

        if (clickActionType === 'category' && !selectedCategory) {
            toast.error('Please select a target category');
            return;
        }

        if (clickActionType === 'custom' && !customLink.trim()) {
            toast.error('Please enter a destination URL or path (e.g. /offers)');
            return;
        }

        try {
            setDispatching(true);
            const payload = {
                title,
                body: message,
                targetType,
                group: targetType === 'broadcast' ? selectedGroup : undefined,
                recipientId: targetType === 'individual' ? selectedRecipient._id : undefined,
                recipientType: targetType === 'individual' ? recipientType : undefined,
                clickActionType,
                productId: clickActionType === 'product' ? selectedProduct._id : undefined,
                categorySlug: clickActionType === 'category' ? selectedCategory : undefined,
                customLink: clickActionType === 'custom' ? customLink.trim() : undefined,
            };

            const res = await sendNotification(adminUser.token, payload);
            if (res.success) {
                toast.success(t('push.dispatch_success'));
                setTitle('');
                setMessage('');
                setSelectedRecipient(null);
                setSearchQuery('');
                setSelectedProduct(null);
                setProductSearch('');
                setCustomLink('');
                fetchHistory(1);
            }
        } catch (error) {
            toast.error(error.message || 'Failed to send');
        } finally {
            setDispatching(false);
        }
    };

    const handleDelete = async (id) => {
        const result = await showDeleteConfirmation(
            t('push.delete_confirm_title', { defaultValue: 'Delete notification?' }),
            t('push.delete_record_confirm')
        );
        if (!result.isConfirmed) return;
        try {
            const res = await deleteNotifications(adminUser.token, [id]);
            if (res.success) {
                toast.success(t('push.delete_success'));
                fetchHistory(currentPage);
            }
        } catch (error) {
            toast.error(t('common.error', { ns: 'common' }));
        }
    };

    const getTargetEntityIcon = (n) => {
        if (n.isBroadcast) return <Users size={12} />;
        switch (n.recipientModel) {
            case 'Vendor': return <Store size={12} />;
            case 'DeliveryPartner': return <Truck size={12} />;
            case 'Admin': return <Shield size={12} />;
            default: return <User size={12} />;
        }
    };

    const getTargetEntityName = (n) => {
        if (n.isBroadcast) {
            const g = n.targetGroup || 'all';
            return t(`push.${g === 'all' ? 'all_nodes' : g}`);
        }
        return n.recipient?.name || t('push.unknown_recipient');
    };

    return (
        <div className="container-fluid py-6 bg-slate-50/30 min-h-screen px-4 md:px-6 max-w-7xl mx-auto font-sans text-slate-800">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('push.title')}</h1>
                        <PageInfoTooltip data={pageInfoData.pushNotifications} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start mb-8">
                {/* Send Form */}
                <div className="xl:col-span-8">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md">
                                <Send size={20} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{t('push.initialize')}</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{t('push.transmission_protocol')}</label>
                                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100 font-bold">
                                        <button
                                            onClick={() => setTargetType('broadcast')}
                                            className={`py-2 px-3 rounded-lg text-xs transition-all ${targetType === 'broadcast' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}
                                        >
                                            {t('push.mass_broadcast')}
                                        </button>
                                        <button
                                            onClick={() => setTargetType('individual')}
                                            className={`py-2 px-3 rounded-lg text-xs transition-all ${targetType === 'individual' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}
                                        >
                                            {t('push.direct_signal')}
                                        </button>
                                    </div>
                                </div>

                                {targetType === 'broadcast' ? (
                                    <div className="space-y-2 animate-in fade-in duration-200">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{t('push.strategic_audience')}</label>
                                        <select
                                            value={selectedGroup}
                                            onChange={(e) => setSelectedGroup(e.target.value)}
                                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-xs font-bold text-slate-700 shadow-sm"
                                        >
                                            <option value="all">{t('push.all_nodes')}</option>
                                            <option value="users">{t('push.premium_users')}</option>
                                            <option value="vendors">{t('push.vendor_network')}</option>
                                            <option value="delivery_partners">{t('push.logistics_partners')}</option>
                                            <option value="staff">{t('push.internal_staff')}</option>
                                            <option value="branch_managers">{t('push.regional_managers')}</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{t('push.entity_type')}</label>
                                            <select
                                                value={recipientType}
                                                onChange={(e) => {
                                                    setRecipientType(e.target.value);
                                                    setSelectedRecipient(null);
                                                    setSearchQuery('');
                                                }}
                                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-xs font-bold text-slate-700 shadow-sm"
                                            >
                                                <option value="User">{t('push.premium_users', { defaultValue: 'Customers' })}</option>
                                                <option value="Vendor">{t('push.vendor_network', { defaultValue: 'Vendors' })}</option>
                                                <option value="DeliveryPartner">{t('push.logistics_partners', { defaultValue: 'Delivery Partners' })}</option>
                                                <option value="Staff">{t('push.internal_staff', { defaultValue: 'Staff Members' })}</option>
                                                <option value="Store Manager">{t('push.regional_managers', { defaultValue: 'Branch Managers' })}</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2 relative">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{t('push.locate_recipient')}</label>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder={t('push.locate_recipient', { defaultValue: 'Find User' })}
                                                    value={selectedRecipient ? selectedRecipient.name : searchQuery}
                                                    onChange={(e) => handleSearch(e.target.value)}
                                                    readOnly={!!selectedRecipient}
                                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-xs font-bold text-slate-700 shadow-sm"
                                                />
                                                {selectedRecipient && (
                                                    <button onClick={() => setSelectedRecipient(null)} className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-500 bg-rose-50 px-2 py-1 rounded-lg text-[9px] font-bold uppercase">Cancel</button>
                                                )}
                                                {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-600" size={16} />}
                                            </div>
                                            {searchResults.length > 0 && !selectedRecipient && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 shadow-xl rounded-xl z-50 py-2 font-bold">
                                                    {searchResults.map(res => (
                                                        <button key={res._id} onClick={() => { setSelectedRecipient(res); setSearchResults([]); }} className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-[11px] uppercase tracking-tight">
                                                            <span className="text-slate-700">{res.name}</span>
                                                            <span className="text-slate-400">{res.phone}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Notification Click Destination Selector */}
                                <div className="space-y-2 pt-3 border-t border-slate-100">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight flex items-center justify-between">
                                        <span>Action On Tap</span>
                                        <span className="text-[10px] text-blue-600 font-semibold lowercase">tap opens</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-100 font-bold">
                                        <button
                                            type="button"
                                            onClick={() => setClickActionType('home')}
                                            className={`py-1.5 px-2 rounded-lg text-[11px] transition-all flex items-center justify-center gap-1.5 ${clickActionType === 'home' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
                                        >
                                            <span>🏠</span> App Home
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setClickActionType('product')}
                                            className={`py-1.5 px-2 rounded-lg text-[11px] transition-all flex items-center justify-center gap-1.5 ${clickActionType === 'product' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
                                        >
                                            <Package size={12} /> Product
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setClickActionType('category')}
                                            className={`py-1.5 px-2 rounded-lg text-[11px] transition-all flex items-center justify-center gap-1.5 ${clickActionType === 'category' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
                                        >
                                            <Tag size={12} /> Category
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setClickActionType('custom')}
                                            className={`py-1.5 px-2 rounded-lg text-[11px] transition-all flex items-center justify-center gap-1.5 ${clickActionType === 'custom' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
                                        >
                                            <Link2 size={12} /> Custom URL
                                        </button>
                                    </div>

                                    {/* Product Selector */}
                                    {clickActionType === 'product' && (
                                        <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                                            {selectedProduct ? (
                                                <div className="flex items-center justify-between p-2.5 bg-blue-50/60 border border-blue-200/80 rounded-xl">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <img
                                                            src={selectedProduct.image || selectedProduct.images?.[0] || '/assets/logo_fav.png'}
                                                            alt=""
                                                            className="w-9 h-9 object-cover rounded-lg bg-white border border-blue-100 flex-shrink-0"
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-800 truncate">{selectedProduct.name}</p>
                                                            <p className="text-[10px] text-blue-700 font-semibold">
                                                                ₹{selectedProduct.basePrice || selectedProduct.variants?.[0]?.price || 0}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedProduct(null); setProductSearch(''); }}
                                                        className="text-rose-500 hover:text-rose-700 text-[10px] font-bold uppercase p-1"
                                                    >
                                                        Change
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                    <input
                                                        type="text"
                                                        placeholder="Search product by name or SKU..."
                                                        value={productSearch}
                                                        onChange={(e) => handleProductSearch(e.target.value)}
                                                        className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-xs font-bold text-slate-700 shadow-sm"
                                                    />
                                                    {productLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-600" size={14} />}
                                                    {productResults.length > 0 && !selectedProduct && (
                                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-50 z-50">
                                                            {productResults.map(p => (
                                                                <button
                                                                    key={p._id}
                                                                    type="button"
                                                                    onClick={() => { setSelectedProduct(p); setProductResults([]); setProductSearch(''); }}
                                                                    className="w-full p-2 text-left hover:bg-blue-50/50 flex items-center gap-2.5 transition"
                                                                >
                                                                    <img
                                                                        src={p.image || p.images?.[0] || '/assets/logo_fav.png'}
                                                                        alt=""
                                                                        className="w-7 h-7 object-cover rounded bg-slate-100 border flex-shrink-0"
                                                                    />
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                                                                        <p className="text-[10px] text-slate-400">₹{p.basePrice || p.variants?.[0]?.price || 0}</p>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Category Selector */}
                                    {clickActionType === 'category' && (
                                        <div className="space-y-1 pt-1 animate-in fade-in duration-200">
                                            <select
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-xs font-bold text-slate-700 shadow-sm"
                                            >
                                                {categoriesLoading && <option value="">Loading categories...</option>}
                                                {!categoriesLoading && categories.length === 0 && <option value="">No categories found</option>}
                                                {categories.map(cat => {
                                                    const slug = cat.slug || cat.name?.toLowerCase().split(' ').join('-');
                                                    return (
                                                        <option key={cat._id || slug} value={slug}>
                                                            {cat.name}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    )}

                                    {/* Custom URL Selector */}
                                    {clickActionType === 'custom' && (
                                        <div className="space-y-1 pt-1 animate-in fade-in duration-200">
                                            <input
                                                type="text"
                                                placeholder="e.g. /offers or /profile/orders or https://..."
                                                value={customLink}
                                                onChange={(e) => setCustomLink(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-xs font-bold text-slate-700 shadow-sm"
                                            />
                                            <p className="text-[10px] text-slate-400">Enter internal path like <code className="text-blue-600 font-bold">/offers</code> or external URL</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{t('push.signal_title')}</label>
                                    <input
                                        type="text"
                                        placeholder="Note title..."
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-xs font-bold text-slate-700 shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{t('push.protocol_msg')}</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Write message here..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-xs font-bold text-slate-700 shadow-sm resize-none"
                                    />
                                </div>
                                <button
                                    onClick={handleSend}
                                    disabled={dispatching}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {dispatching ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
                                    {t('push.dispatch_signal')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Card */}
                <div className="xl:col-span-4 space-y-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 h-full flex flex-col items-center justify-center min-h-[300px]">
                        <div className="bg-white rounded-2xl p-4 shadow-xl border border-slate-100 w-full max-w-[240px] animate-in slide-in-from-bottom duration-300">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                                        <Bell size={10} className="text-white" />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-900 uppercase">Saathi-Grow</span>
                                </div>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Now</span>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-[11px] font-bold text-slate-800 leading-tight">{title || t('push.signal_title')}</h4>
                                <p className="text-[10px] font-bold text-slate-500 leading-relaxed overflow-hidden line-clamp-3 opacity-80">
                                    {message || t('push.preview_instruction')}
                                </p>
                                {/* Destination Indicator Badge */}
                                <div className="pt-2 mt-2 border-t border-slate-100 flex items-center gap-1.5 text-[9px] font-bold text-blue-600">
                                    <span>🎯</span>
                                    <span className="truncate">
                                        {clickActionType === 'product' && selectedProduct
                                            ? `Product: ${selectedProduct.name}`
                                            : clickActionType === 'category' && selectedCategory
                                            ? `Category: ${selectedCategory}`
                                            : clickActionType === 'custom' && customLink
                                            ? `Link: ${customLink}`
                                            : 'Opens App Home'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('push.preview')}</p>
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-tight">{t('push.total_dispatched')}</span>
                        <p className="text-2xl font-bold text-slate-900">{totalItems.toLocaleString()}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <Send size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-tight">{t('push.response_rate')}</span>
                        <p className="text-2xl font-bold text-emerald-600">18.5%</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                        <Smartphone size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-tight">{t('push.protocol_health')}</span>
                        <p className="text-2xl font-bold text-blue-600">98.8%</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <Shield size={24} />
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
                    <h5 className="mb-0 text-sm font-bold uppercase tracking-tight text-slate-800">{t('push.history')}</h5>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 font-bold text-slate-500 uppercase text-[11px]">
                                <th className="px-6 py-4">{t('push.signal_content')}</th>
                                <th className="px-4 py-4 text-center">{t('push.target_entity')}</th>
                                <th className="px-4 py-4 text-center">{t('push.dispatch_time')}</th>
                                <th className="px-4 py-4 text-center">{t('push.protocol_state')}</th>
                                <th className="px-6 py-4 text-right">{t('admin_inbox.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && history.length === 0 ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="px-6 py-6">
                                            <div className="h-10 bg-slate-50 rounded-lg w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center text-slate-400">{t('admin_inbox.empty_title')}</td>
                                </tr>
                            ) : (
                                history.map((n) => (
                                    <tr key={n._id} className="hover:bg-slate-50/50 transition-colors font-medium">
                                        <td className="px-6 py-5">
                                            <div className="font-bold text-slate-800 text-xs uppercase tracking-tight">{n.title}</div>
                                            <div className="text-[11px] text-slate-400 font-bold line-clamp-1">{n.body}</div>
                                            {n.data && (n.data.productId || n.data.categorySlug || n.data.customLink) && (
                                                <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                                    <span>🎯</span>
                                                    {n.data.productId ? 'Product' : n.data.categorySlug ? `Category: ${n.data.categorySlug}` : 'Custom Link'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase">
                                                {getTargetEntityIcon(n)}
                                                {getTargetEntityName(n)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            <div className="flex items-center justify-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase">
                                                <Clock size={12} />
                                                {new Date(n.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-4 py-5 text-center font-bold">
                                            <span className="px-3 py-1 bg-emerald-600 text-white text-[9px] rounded-lg uppercase">{t('push.sent')}</span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button onClick={() => { setTitle(n.title); setMessage(n.body); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Reuse"><RefreshCw size={16} /></button>
                                                <button onClick={() => handleDelete(n._id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Delete"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-6 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 mx-auto">
                            <button onClick={() => fetchHistory(currentPage - 1)} disabled={currentPage === 1} className="p-2 border rounded-xl disabled:opacity-30"><ChevronLeft size={16} /></button>
                            <span className="text-xs font-bold text-slate-500">{currentPage} of {totalPages}</span>
                            <button onClick={() => fetchHistory(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 border rounded-xl disabled:opacity-30"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PushNotifications;

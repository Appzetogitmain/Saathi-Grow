import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PackageX, AlertTriangle, RefreshCw, ChevronRight, CheckCircle2, Sparkles, Building2, ArrowUpRight } from 'lucide-react';
import { getLowStockAlerts } from '../api/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import { subscribeToEvent } from '../../../services/socketService';
import QuickRestockModal from './QuickRestockModal';

const OutOfStockWidget = () => {
    const { adminUser } = useAdminAuth();
    const [items, setItems] = useState([]);
    const [itemCount, setItemCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isRestockOpen, setIsRestockOpen] = useState(false);

    const fetchItems = useCallback(async () => {
        if (!adminUser?.token) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const res = await getLowStockAlerts(adminUser.token, { severity: 'Critical', limit: 6 });
            if (res.success && Array.isArray(res.data)) {
                setItems(res.data);
                setItemCount(Number(res.pagination?.total) || 0);
            }
        } catch (err) {
            console.warn('Failed to fetch out of stock widget items:', err);
        } finally {
            setLoading(false);
        }
    }, [adminUser?.token]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    // Real-time synchronization via Socket.IO & local window events
    useEffect(() => {
        const unsubscribeStockOut = subscribeToEvent('PRODUCT_OUT_OF_STOCK', () => {
            fetchItems();
        });

        const unsubscribeRestocked = subscribeToEvent('PRODUCT_RESTOCKED', () => {
            fetchItems();
        });

        const handleLocalRestock = () => {
            fetchItems();
        };
        window.addEventListener('onProductRestocked', handleLocalRestock);

        return () => {
            if (unsubscribeStockOut) unsubscribeStockOut();
            if (unsubscribeRestocked) unsubscribeRestocked();
            window.removeEventListener('onProductRestocked', handleLocalRestock);
        };
    }, [fetchItems]);

    const handleRestock = (item) => {
        setSelectedProduct(item);
        setIsRestockOpen(true);
    };

    if (items.length === 0 && !loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 mb-8 shadow-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                        <CheckCircle2 size={20} />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Inventory Health Status</h4>
                        <p className="text-xs text-slate-500 mt-0.5">All products are adequately stocked across active branches.</p>
                    </div>
                </div>
                <Link
                    to="/admin/products"
                    className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1 shrink-0 no-underline transition-colors"
                >
                    View All Products <ChevronRight size={14} />
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border-2 border-rose-100 shadow-sm overflow-hidden mb-8">
            {/* Header */}
            <div className="px-6 py-4 bg-linear-to-r from-rose-50/80 via-white to-amber-50/30 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20 shrink-0">
                        <AlertTriangle size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black uppercase tracking-wider text-rose-950">
                                Action Required: Out of Stock Products
                            </h3>
                            <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-full shadow-xs">
                                {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                            Customers cannot purchase these products until inventory is restocked.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={fetchItems}
                        disabled={loading}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl border border-slate-200 bg-white/80 transition-all cursor-pointer shadow-xs"
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <Link
                        to="/admin/products?status=Out of Stock"
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 no-underline"
                    >
                        View All <ArrowUpRight size={13} />
                    </Link>
                </div>
            </div>

            {/* Product Cards Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => {
                    const pImage = item.image || (item.gallery && item.gallery[0]) || '';
                    const pName = item.productName || item.name || 'Product';
                    const branchTitle = item.branchName || item.storeName || 'Main Store';

                    return (
                        <div
                            key={item._id || item.productId}
                            className="p-4 rounded-xl border border-rose-100/80 bg-rose-50/20 hover:bg-rose-50/40 transition-all flex flex-col justify-between gap-3 group relative"
                        >
                            <div className="flex items-start gap-3">
                                {pImage ? (
                                    <img
                                        src={pImage}
                                        alt={pName}
                                        className="w-14 h-14 rounded-xl object-contain bg-white border border-slate-200/80 p-1 shrink-0 group-hover:scale-105 transition-transform"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs shrink-0">
                                        IMG
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className="text-[9px] font-black uppercase text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded">
                                            0 in stock
                                        </span>
                                        {item.category && (
                                            <span className="text-[9px] font-semibold text-slate-500 truncate">
                                                {item.category}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-900 truncate" title={pName}>
                                        {pName}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 truncate">
                                        <Building2 size={11} className="shrink-0 text-slate-400" />
                                        <span className="truncate">{branchTitle}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-rose-100/60 flex items-center justify-between gap-2">
                                <div className="text-[10px] text-slate-400 font-mono uppercase truncate">
                                    {item.sku ? `SKU: ${item.sku}` : ''}
                                </div>
                                <button
                                    onClick={() => handleRestock(item)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer shrink-0"
                                >
                                    <Sparkles size={12} />
                                    Quick Restock
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Restock Modal */}
            <QuickRestockModal
                isOpen={isRestockOpen}
                onClose={() => setIsRestockOpen(false)}
                product={selectedProduct}
                onSuccess={() => {
                    fetchItems();
                }}
            />
        </div>
    );
};

export default OutOfStockWidget;

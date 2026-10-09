import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageX, AlertTriangle, RefreshCw, ChevronRight, CheckCircle2, Sparkles, Building2 } from 'lucide-react';
import { getLowStockAlerts } from '../api/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import { subscribeToEvent } from '../../../services/socketService';
import QuickRestockModal from './QuickRestockModal';

const InventoryAlertDropdown = () => {
    const { adminUser } = useAdminAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isRestockOpen, setIsRestockOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const fetchAlerts = useCallback(async () => {
        if (!adminUser?.token) return;
        try {
            setLoading(true);
            const res = await getLowStockAlerts(adminUser.token, { severity: 'Critical', limit: 8 });
            if (res.success && Array.isArray(res.data)) {
                setAlerts(res.data);
            }
        } catch (err) {
            console.warn('Failed to fetch stock alerts:', err);
        } finally {
            setLoading(false);
        }
    }, [adminUser?.token]);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    // Socket and Window Event Listeners for Real-time sync
    useEffect(() => {
        const unsubscribeStockOut = subscribeToEvent('PRODUCT_OUT_OF_STOCK', (data) => {
            console.log('⚡ [Header Alert] New Out of stock item:', data);
            fetchAlerts();
        });

        const unsubscribeRestocked = subscribeToEvent('PRODUCT_RESTOCKED', (data) => {
            console.log('⚡ [Header Alert] Product restocked:', data);
            fetchAlerts();
        });

        const handleLocalRestock = () => {
            fetchAlerts();
        };
        window.addEventListener('onProductRestocked', handleLocalRestock);

        return () => {
            if (unsubscribeStockOut) unsubscribeStockOut();
            if (unsubscribeRestocked) unsubscribeRestocked();
            window.removeEventListener('onProductRestocked', handleLocalRestock);
        };
    }, [fetchAlerts]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleRestockClick = (item) => {
        setSelectedProduct(item);
        setIsRestockOpen(true);
        setIsOpen(false);
    };

    const outOfStockCount = alerts.length;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Header Icon Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border relative ${
                    outOfStockCount > 0
                        ? 'text-rose-600 bg-rose-50/80 border-rose-200/80 hover:bg-rose-100 hover:border-rose-300'
                        : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 border-transparent hover:border-slate-100'
                }`}
                title="Critical Stock Alerts"
            >
                <PackageX size={19} />
                {outOfStockCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
                        {outOfStockCount > 9 ? '9+' : outOfStockCount}
                    </span>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-84 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                                <AlertTriangle size={16} />
                            </div>
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-white">Stock Alerts</h4>
                                <p className="text-[10px] text-slate-300">
                                    {outOfStockCount} {outOfStockCount === 1 ? 'item' : 'items'} need immediate restocking
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={fetchAlerts}
                            disabled={loading}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {/* Alert List */}
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                        {loading && alerts.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
                                <RefreshCw size={20} className="animate-spin mb-2 text-blue-500" />
                                <span>Checking inventory...</span>
                            </div>
                        ) : alerts.length === 0 ? (
                            <div className="py-10 px-4 text-center">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-100">
                                    <CheckCircle2 size={24} />
                                </div>
                                <h5 className="text-xs font-bold text-slate-800">All Stock Levels Healthy</h5>
                                <p className="text-[11px] text-slate-400 mt-0.5">No products are currently out of stock.</p>
                            </div>
                        ) : (
                            alerts.map((item) => {
                                const pImage = item.image || (item.gallery && item.gallery[0]) || '';
                                return (
                                    <div key={item._id || item.productId} className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center gap-3">
                                        {pImage ? (
                                            <img
                                                src={pImage}
                                                alt={item.productName}
                                                className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs shrink-0">
                                                IMG
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <h6 className="text-xs font-bold text-slate-900 truncate" title={item.productName}>
                                                    {item.productName}
                                                </h6>
                                                <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 shrink-0">
                                                    0 Left
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                                                <span className="flex items-center gap-0.5 font-medium truncate">
                                                    <Building2 size={10} />
                                                    {item.branchName || item.storeName || 'Store'}
                                                </span>
                                                {item.variants && item.variants.length > 0 && (
                                                    <span className="text-amber-700 bg-amber-50 px-1 py-0.2 rounded font-semibold border border-amber-100 text-[9px]">
                                                        {item.variants.length} Variants
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRestockClick(item)}
                                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                                        >
                                            <Sparkles size={11} />
                                            Restock
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-medium">Real-time inventory monitor</span>
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                navigate('/admin/products?status=Out of Stock');
                            }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                        >
                            View All Products <ChevronRight size={13} />
                        </button>
                    </div>
                </div>
            )}

            {/* Quick Restock Modal */}
            <QuickRestockModal
                isOpen={isRestockOpen}
                onClose={() => setIsRestockOpen(false)}
                product={selectedProduct}
                onSuccess={() => {
                    fetchAlerts();
                }}
            />
        </div>
    );
};

export default InventoryAlertDropdown;

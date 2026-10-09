import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Sparkles, Building2, PackageX } from 'lucide-react';
import { subscribeToEvent } from '../../../services/socketService';
import QuickRestockModal from './QuickRestockModal';

const OutOfStockToast = () => {
    const [alerts, setAlerts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        // 1. Listen for Socket.IO event
        const unsubscribeStockOut = subscribeToEvent('PRODUCT_OUT_OF_STOCK', (data) => {
            console.log('⚡ [SOCKET] Real-time Out of Stock alert received:', data);
            if (!data) return;

            const newAlert = {
                id: `${data.productId}_${data.variant || 'base'}_${Date.now()}`,
                productId: data.productId,
                productName: data.name,
                image: data.image,
                sku: data.sku,
                branchId: data.branchId,
                branchName: data.branchName || 'Main Store',
                variant: data.variant,
                time: new Date()
            };

            setAlerts((prev) => [newAlert, ...prev]);

            // Auto dismiss after 25 seconds
            setTimeout(() => {
                removeAlert(newAlert.id);
            }, 25000);
        });

        // 2. Listen for Socket.IO restocked event to dismiss any matching toast
        const unsubscribeRestocked = subscribeToEvent('PRODUCT_RESTOCKED', (data) => {
            if (data?.productId) {
                setAlerts((prev) => prev.filter((a) => a.productId !== data.productId));
            }
        });

        // 3. Listen for internal window restocked event
        const handleWindowRestocked = (e) => {
            const pId = e.detail?.productId;
            if (pId) {
                setAlerts((prev) => prev.filter((a) => a.productId !== pId));
            }
        };
        window.addEventListener('onProductRestocked', handleWindowRestocked);

        return () => {
            if (unsubscribeStockOut) unsubscribeStockOut();
            if (unsubscribeRestocked) unsubscribeRestocked();
            window.removeEventListener('onProductRestocked', handleWindowRestocked);
        };
    }, []);

    const removeAlert = (id) => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
    };

    const handleOpenRestock = (alertItem) => {
        setSelectedProduct(alertItem);
        setIsModalOpen(true);
    };

    return (
        <>
            <div className="fixed top-20 right-6 z-[9998] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
                <AnimatePresence>
                    {alerts.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: 50, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 50, scale: 0.95 }}
                            className="pointer-events-auto bg-white border-2 border-rose-500 rounded-2xl shadow-2xl p-4 overflow-hidden relative"
                        >
                            {/* Top decorative gradient bar */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-rose-500 via-red-500 to-amber-500" />

                            <div className="flex items-start justify-between gap-3 mb-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-2.5 w-2.5 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                                    </span>
                                    <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 flex items-center gap-1">
                                        <PackageX size={13} />
                                        Out of Stock Alert!
                                    </span>
                                </div>
                                <button
                                    onClick={() => removeAlert(item.id)}
                                    className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="flex items-center gap-3 mb-3">
                                {item.image ? (
                                    <img
                                        src={item.image}
                                        alt={item.productName}
                                        className="w-12 h-12 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1 shrink-0"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-100">
                                        <AlertTriangle size={20} />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <h5 className="text-xs font-bold text-slate-900 truncate" title={item.productName}>
                                        {item.productName}
                                    </h5>
                                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                        {item.variant && (
                                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">
                                                {item.variant}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                            <Building2 size={10} />
                                            {item.branchName}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-rose-500">
                                    0 items left
                                </span>
                                <button
                                    onClick={() => handleOpenRestock(item)}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Sparkles size={12} />
                                    Quick Restock
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Restock Modal */}
            <QuickRestockModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                product={selectedProduct}
                onSuccess={() => {
                    if (selectedProduct) {
                        removeAlert(selectedProduct.id);
                    }
                }}
            />
        </>
    );
};

export default OutOfStockToast;

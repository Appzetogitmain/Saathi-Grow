import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, PackageCheck, AlertCircle, Loader2, Sparkles, Building2 } from 'lucide-react';
import { quickRestockProduct } from '../api/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';

const QuickRestockModal = ({ isOpen, onClose, product, onSuccess }) => {
    const { adminUser } = useAdminAuth();
    const [amount, setAmount] = useState(20);
    const [selectedVariant, setSelectedVariant] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (product) {
            setError('');
            setAmount(20);
            // A product level alert does not identify a variant. Never silently
            // add the incoming quantity to the first variant in the list.
            setSelectedVariant(product.variantValue || product.variant || '');
        }
    }, [product]);

    if (!isOpen || !product) return null;

    const productId = product.productId || product._id || product.id;
    const productName = product.productName || product.name || 'Product';
    const productImage = product.image || (product.gallery && product.gallery[0]) || '';
    const branchName = product.branchName || product.storeName || 'Main Store';
    const branchId = product.branchId || null;
    const variants = product.variants || [];

    const handlePreset = (val) => {
        setAmount(prev => (Number(prev) || 0) + val);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const num = Number(amount);
        if (!num || num <= 0) {
            setError('Please enter a valid stock quantity greater than 0');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const payload = {
                branchId: branchId,
                amount: num,
                variantValue: selectedVariant || undefined,
                reason: 'Quick Restock via Dashboard/Alert'
            };

            const res = await quickRestockProduct(adminUser?.token, productId, payload);

            if (res.success) {
                // Dispatch window event so other components update their counts
                window.dispatchEvent(new CustomEvent('onProductRestocked', { 
                    detail: { productId, branchId, variant: selectedVariant, amount: num } 
                }));

                if (onSuccess) {
                    onSuccess(res.product || res);
                }
                onClose();
            } else {
                setError(res.message || 'Failed to restock product');
            }
        } catch (err) {
            setError(err.message || 'Something went wrong while restocking');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10"
                >
                    {/* Header */}
                    <div className="bg-linear-to-r from-slate-900 to-slate-800 px-6 py-4 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                                <PackageCheck size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold tracking-tight">Quick Restock</h3>
                                <p className="text-[11px] text-slate-300">Add inventory instantly</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Product Summary Card */}
                    <div className="p-6 pb-2">
                        <div className="flex items-center gap-3.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl mb-4">
                            {productImage ? (
                                <img
                                    src={productImage}
                                    alt={productName}
                                    className="w-14 h-14 rounded-lg object-contain bg-white border border-slate-200 p-1 shrink-0"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-lg bg-slate-200 text-slate-400 flex items-center justify-center font-bold text-xs shrink-0">
                                    IMG
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-slate-900 truncate mb-0.5" title={productName}>
                                    {productName}
                                </h4>
                                {product.sku && (
                                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                                        SKU: {product.sku}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                                        <Building2 size={10} />
                                        {branchName}
                                    </span>
                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                                        Current: {Number(product.stock) || 0} units
                                    </span>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl mb-4 animate-shake">
                                <AlertCircle size={15} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Variant Selector (if applicable) */}
                            {variants.length > 0 && (
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                        Select Variant to Restock
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {variants.map((v, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setSelectedVariant(v.value)}
                                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                                    selectedVariant === v.value
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                {v.value}
                                                {v.stock !== undefined && (
                                                    <span className={`ml-1.5 text-[10px] opacity-80 ${v.stock <= 0 ? 'text-rose-300' : ''}`}>
                                                        ({v.stock})
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Stock Quantity Input */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                    Units to Add
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-base focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-center"
                                        placeholder="Enter quantity"
                                        autoFocus
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                                        units
                                    </span>
                                </div>
                            </div>

                            {/* Quick Presets */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                    Quick Quantity Presets
                                </p>
                                <div className="grid grid-cols-4 gap-2">
                                    {[10, 25, 50, 100].map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => handlePreset(preset)}
                                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-slate-200/80 rounded-lg text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1"
                                        >
                                            <Plus size={11} /> {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 pb-2 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-2.5 px-4 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Restocking...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={14} />
                                            Confirm Restock (+{amount})
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default QuickRestockModal;

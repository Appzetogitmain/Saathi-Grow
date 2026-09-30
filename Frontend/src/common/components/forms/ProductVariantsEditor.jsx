import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export const createEmptyVariant = () => ({
    type: 'Weight',
    value: '',
    price: '',
    mrp: '',
    stock: '',
});

export const normalizeVariantsForSubmit = (variants = [], fallbackPrice = 0) =>
    variants
        .filter((variant) => variant.value?.trim())
        .map((variant) => ({
            type: variant.type || 'Weight',
            value: variant.value.trim(),
            price: Number(variant.price) || Number(fallbackPrice) || 0,
            mrp: variant.mrp != null && variant.mrp !== '' && !isNaN(Number(variant.mrp)) ? Number(variant.mrp) : null,
            stock: Number(variant.stock) || 0,
        }));

const ProductVariantsEditor = ({ variants = [], onChange, fallbackPrice = 0 }) => {
    const updateVariant = (index, field, value) => {
        onChange(variants.map((variant, i) => (i === index ? { ...variant, [field]: value } : variant)));
    };

    const addVariant = () => onChange([...variants, createEmptyVariant()]);

    const removeVariant = (index) => onChange(variants.filter((_, i) => i !== index));

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-500">
                Add multiple unit options like <span className="font-semibold text-slate-700">500 g</span> or <span className="font-semibold text-slate-700">2 x 500 g</span>. You can optionally specify an MRP for each variant to show discount savings.
            </p>

            {variants.map((variant, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/60">
                    <div className="md:col-span-3 space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Unit Label</label>
                        <input
                            type="text"
                            value={variant.value}
                            onChange={(e) => updateVariant(index, 'value', e.target.value)}
                            className="form-input-simple"
                            placeholder="e.g. 500 g"
                        />
                    </div>
                    <div className="md:col-span-3 space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Price (₹)</label>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={variant.price}
                            onChange={(e) => updateVariant(index, 'price', e.target.value)}
                            onWheel={(e) => e.target.blur()}
                            className="form-input-simple"
                            placeholder={fallbackPrice ? String(fallbackPrice) : 'Price'}
                        />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">MRP (₹)</label>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={variant.mrp ?? ''}
                            onChange={(e) => updateVariant(index, 'mrp', e.target.value)}
                            onWheel={(e) => e.target.blur()}
                            className="form-input-simple"
                            placeholder="Optional"
                        />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Stock</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={variant.stock}
                            onChange={(e) => updateVariant(index, 'stock', e.target.value)}
                            onWheel={(e) => e.target.blur()}
                            className="form-input-simple"
                            placeholder="0"
                        />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                        <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="w-full py-2.5 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
                        >
                            <Trash2 size={14} />
                            Remove
                        </button>
                    </div>
                </div>
            ))}

            <button
                type="button"
                onClick={addVariant}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40 transition-all text-sm font-bold"
            >
                <Plus size={16} />
                Add Variant
            </button>
        </div>
    );
};

export default ProductVariantsEditor;

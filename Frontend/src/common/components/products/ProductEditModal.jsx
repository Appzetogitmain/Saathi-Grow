import React, { useState, useEffect } from 'react';
import { Save, X, Camera, Plus, Sparkles, RefreshCw, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { getCategories } from '../../api/categoryApi';
import { getSubCategories } from '../../api/subcategoryApi';
import { getBrands } from '../../api/brandApi';
import { getBranches } from '../../api/branchApi';
import { getVendors } from '../../api/vendorApi';
import { useAdminAuth } from '../../../modules/admin/context/AdminAuthContext';
import { useStaffAuth } from '../../../modules/staff/context/StaffAuthContext';
import { useStoreManagerAuth } from '../../../modules/store-manager/context/StoreManagerAuthContext';
import { getAISuggestions } from '../../api/productApi';
import { getAvailableAdminLocations } from '../../../modules/admin/api/physicalLocationApi';
import { toast } from 'react-toastify';
import { brandMatchesCategory } from '../../utils/brandUtils';
import ProductVariantsEditor, { normalizeVariantsForSubmit } from '../forms/ProductVariantsEditor';

const mapProductVariants = (variants = []) =>
    (variants || []).map((variant) => ({
        type: variant.type || 'Weight',
        value: variant.value || '',
        price: variant.price ?? '',
        mrp: variant.mrp ?? '',
        stock: variant.stock ?? '',
    }));

const ProductEditModal = ({ show, onHide, product, onSave }) => {
    const { t } = useTranslation('admin_products');
    const adminContext = useAdminAuth();
    const staffContext = useStaffAuth();
    const managerContext = useStoreManagerAuth();

    const adminUser = adminContext?.adminUser || staffContext?.staffUser || managerContext?.managerUser || null;
    const [loading, setLoading] = useState(false);
    
    // Master Data
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [filteredSubCategories, setFilteredSubCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [filteredBrands, setFilteredBrands] = useState([]);
    const [branches, setBranches] = useState([]);
    const [branchStocks, setBranchStocks] = useState([]);
    const [aiLoading, setAiLoading] = useState({ description: false, tags: false });
    const [availableLocations, setAvailableLocations] = useState([]);

    const [formData, setFormData] = useState({
        name: '', brandName: '', category: '', subCategory: '', basePrice: 0, mrp: 0, purchasePrice: 0, hsnCode: '',
        isVeg: true, sku: '', status: 'Active', physicalLocation: '', unitType: 'pcs',
        unitValue: 1, description: '', tags: [], isSaathigro: false, stock: 0, lowStockThreshold: 10,
        // --- New Fields ---
        reorderThreshold: 10, maxCapacityPerSku: 0, isStockAutoSync: false,
        weightCategory: 'Light', isFragile: false, temperatureType: 'Normal',
        pickPriority: 0, pickingZone: 'Other',
        variantGroupId: '', pickSequence: 0,
        variants: []
    });

    const [imagePreview, setImagePreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [existingGallery, setExistingGallery] = useState([]);
    const [galleryPreviews, setGalleryPreviews] = useState([]);
    const [galleryFiles, setGalleryFiles] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const isVendorProduct = Boolean(product?.vendor);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [cats, subCats, brnds, brnchs] = await Promise.all([
                    getCategories(adminUser.token), getSubCategories(adminUser.token),
                    getBrands(adminUser.token), getBranches(adminUser.token)
                ]);
                setCategories(cats.filter(c => c.status === 'Active'));
                setSubCategories(subCats.filter(sc => sc.status === 'Active'));
                setBrands(brnds.filter(b => b.status === 'Active'));
                setBranches(brnchs.filter(b => b.isActive));
            } catch (error) { console.error('Error fetching data:', error); }
        };
        if (show && adminUser?.token) fetchData();
    }, [show, adminUser]);

    useEffect(() => {
        if (product && show) {
            setFormData({
                name: product.name || '', brandName: product.brandName || '', category: product.category || '',
                subCategory: product.subCategory || '', basePrice: product.basePrice || 0, mrp: product.mrp || 0,
                purchasePrice: product.purchasePrice || '', hsnCode: product.hsnCode || '',
                isVeg: product.isVeg !== undefined ? product.isVeg : true,
                sku: product.sku || '', status: product.status || 'Active',
                physicalLocation: product.physicalLocation || '', unitType: product.unitType || 'pcs',
                unitValue: product.unitValue || 1, description: product.description || '',
                tags: Array.isArray(product.tags) ? product.tags : (product.tags ? product.tags.split(',') : []),
                isSaathigro: product.isSaathigro || false,
                stock: product.stock || 0, lowStockThreshold: product.lowStockThreshold || 10,
                // --- New Fields ---
                reorderThreshold: product.reorderThreshold || 10,
                maxCapacityPerSku: product.maxCapacityPerSku || 0,
                isStockAutoSync: product.isStockAutoSync || false,
                weightCategory: product.weightCategory || 'Light',
                isFragile: product.isFragile || false,
                temperatureType: product.temperatureType || 'Normal',
                pickPriority: product.pickPriority || 0,
                pickingZone: product.pickingZone || 'Other',
                variantGroupId: product.variantGroupId || '',
                pickSequence: product.pickSequence || 0,
                variants: mapProductVariants(product.variants)
            });
            const activeStocks = (product.branchStocks || []).map(bs => {
                const bid = bs.branchId?._id || bs.branchId;
                return {
                    branchId: bid, name: bs.branchId?.name || branches.find(b => b._id === bid)?.name || 'Branch',
                    stock: bs.stock, lowStockThreshold: bs.lowStockThreshold
                };
            });
            setBranchStocks(activeStocks);
            setImagePreview(product.image || null);
            setExistingGallery(product.gallery || []);
            setGalleryPreviews([]);
            setGalleryFiles([]);

            // Fetch available locations for the first branch of this product
            if (adminUser?.token && !product.vendor) {
                const firstBranchId = (product.branchStocks || [])[0]?.branchId?._id || (product.branchStocks || [])[0]?.branchId;
                if (firstBranchId) {
                    getAvailableAdminLocations(adminUser.token, firstBranchId.toString(), product._id)
                        .then(data => setAvailableLocations(Array.isArray(data) ? data : []))
                        .catch(() => setAvailableLocations([]));
                }
            }
        }
    }, [product, show, branches]);

    useEffect(() => {
        if (formData.category) {
            setFilteredBrands(brands.filter(b => brandMatchesCategory(b, formData.category)));
            setFilteredSubCategories(subCategories.filter(sc => sc.categoryName === formData.category || sc.category?.name === formData.category));
        } else {
            setFilteredBrands([]);
            setFilteredSubCategories([]);
        }
    }, [formData.category, brands, subCategories]);

    const handleBranchToggle = (branch) => {
        const isSelected = branchStocks.some(bs => bs.branchId === branch._id);
        if (isSelected) setBranchStocks(prev => prev.filter(bs => bs.branchId !== branch._id));
        else setBranchStocks(prev => [...prev, { branchId: branch._id, name: branch.name, stock: 0, lowStockThreshold: 10 }]);
    };

    const handleBranchStockChange = (branchId, field, value) => {
        setBranchStocks(prev => prev.map(bs => bs.branchId === branchId ? { ...bs, [field]: value === '' ? '' : Number(value) } : bs));
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (['basePrice', 'mrp', 'purchasePrice', 'unitValue', 'stock', 'lowStockThreshold'].includes(name) ? (value === '' ? '' : Number(value)) : value)
        }));
    };

    const handleAISuggestion = async (type) => {
        if (!formData.name) return toast.warning('Product name required');
        setAiLoading(prev => ({ ...prev, [type]: true }));
        try {
            const data = await getAISuggestions(adminUser.token, formData.name, type);
            if (type === 'description') setFormData(prev => ({ ...prev, description: data.suggestion }));
            else {
                const newTags = data.suggestion.split(',').map(t => t.trim()).filter(t => t);
                setFormData(prev => ({ ...prev, tags: [...new Set([...prev.tags, ...newTags])] }));
            }
        } catch (error) { toast.error('AI error occurred'); }
        finally { setAiLoading(prev => ({ ...prev, [type]: false })); }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleGalleryChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (existingGallery.length + galleryFiles.length + files.length > 10) {
            toast.warning('Max 10 images allowed in gallery');
            return;
        }

        const newPreviews = files.map(f => URL.createObjectURL(f));
        setGalleryPreviews(prev => [...prev, ...newPreviews]);
        setGalleryFiles(prev => [...prev, ...files]);
        
        e.target.value = '';
    };

    const removeExistingGalleryImage = (index) => {
        setExistingGallery(prev => prev.filter((_, i) => i !== index));
    };

    const removeGalleryImage = (index) => {
        setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
        setGalleryFiles(prev => prev.filter((_, i) => i !== index));
    };

    const commitTagsFromInput = (rawValue, { keepRemainder = false } = {}) => {
        const value = String(rawValue ?? '');
        if (!value.trim() && !value.includes(',')) return;

        if (keepRemainder) {
            const parts = value.split(',');
            const remainder = parts.pop() ?? '';
            const newTags = parts.map((t) => t.trim()).filter(Boolean);
            if (newTags.length > 0) {
                setFormData((prev) => ({
                    ...prev,
                    tags: [...new Set([...prev.tags, ...newTags])]
                }));
            }
            setTagInput(remainder);
            return;
        }

        const newTags = value.split(',').map((t) => t.trim()).filter(Boolean);
        if (newTags.length > 0) {
            setFormData((prev) => ({
                ...prev,
                tags: [...new Set([...prev.tags, ...newTags])]
            }));
        }
        setTagInput('');
    };

    const handleTagInputChange = (e) => {
        const value = e.target.value;
        if (value.includes(',')) {
            commitTagsFromInput(value, { keepRemainder: true });
        } else {
            setTagInput(value);
        }
    };

    const addTag = () => {
        commitTagsFromInput(tagInput, { keepRemainder: false });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = new FormData();
            const isAll = !isVendorProduct && branchStocks.length === branches.length;
            
            Object.keys(formData).forEach(key => {
                if (key === 'variants') return;
                if (key === 'tags') data.append(key, Array.isArray(formData.tags) ? formData.tags.join(',') : formData.tags);
                else data.append(key, formData[key]);
            });

            data.append('variants', JSON.stringify(normalizeVariantsForSubmit(formData.variants, formData.basePrice)));

            if (!isVendorProduct) {
                data.append('specificBranches', branchStocks.map(bs => bs.branchId).join(','));
                data.append('branchStocks', JSON.stringify(branchStocks));
                data.append('isAllBranches', isAll);
            } else {
                data.append('branchStocks', JSON.stringify([]));
                data.append('specificBranches', '');
                data.append('isAllBranches', false);
            }

            if (imageFile) data.append('image', imageFile);
            data.append('existingGallery', JSON.stringify(existingGallery));
            galleryFiles.forEach(f => data.append('gallery', f));
            
            await onSave(data);
        } catch (error) { toast.error(error.message); }
        finally { setLoading(false); }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white px-8">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{t('form.update')}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{product?.name}</p>
                    </div>
                    <button onClick={onHide} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 md:px-10 space-y-8 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2 space-y-8">
                            {/* Core Info */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">{t('fields.name')}<span className="text-red-500 ml-1">*</span></label>
                                    <input type="text" name="name" value={formData.name} onChange={handleChange} required className="form-input-simple" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">{t('fields.category')}<span className="text-red-500 ml-1">*</span></label>
                                        <select name="category" value={formData.category} onChange={handleChange} required className="form-input-simple">
                                            <option value="">Select {t('fields.category')}</option>
                                            {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">{t('fields.sub_category')}</label>
                                        <select name="subCategory" value={formData.subCategory} onChange={handleChange} className="form-input-simple" disabled={!formData.category}>
                                            <option value="">Select {t('fields.sub_category')}</option>
                                            {filteredSubCategories.map(sc => <option key={sc._id} value={sc.name}>{sc.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">{t('fields.brand')}<span className="text-red-500 ml-1">*</span></label>
                                        <select name="brandName" value={formData.brandName} onChange={handleChange} required className="form-input-simple pr-10" disabled={!formData.category}>
                                            <option value="">Select {t('fields.brand')}</option>
                                            {filteredBrands.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">{t('fields.base_price')}<span className="text-red-500 ml-1">*</span></label>
                                        <input type="number" onWheel={(e) => e.target.blur()} name="basePrice" value={formData.basePrice} onChange={handleChange} required className="form-input-simple font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">{t('fields.mrp')}<span className="text-red-500 ml-1">*</span></label>
                                        <input type="number" onWheel={(e) => e.target.blur()} name="mrp" value={formData.mrp} onChange={handleChange} required className="form-input-simple font-bold text-slate-400" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Purchase Price</label>
                                        <input type="number" onWheel={(e) => e.target.blur()} name="purchasePrice" value={formData.purchasePrice} onChange={handleChange} className="form-input-simple font-bold text-slate-400" placeholder="Optional" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">HSN Code</label>
                                        <input type="text" name="hsnCode" value={formData.hsnCode} onChange={handleChange} className="form-input-simple font-bold text-slate-400" placeholder="Optional" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">{t('fields.unit_type')}</label>
                                        <select name="unitType" value={formData.unitType} onChange={handleChange} className="form-input-simple">
                                            <option value="pcs">pcs</option><option value="kg">kg</option><option value="ltr">ltr</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">{t('fields.unit_value')}</label>
                                        <input type="number" onWheel={(e) => e.target.blur()} name="unitValue" value={formData.unitValue} onChange={handleChange} step="0.01" className="form-input-simple" />
                                    </div>
                                    {!isVendorProduct && (
                                        <div className="space-y-2 col-span-2 lg:col-span-4">
                                            <label className="text-sm font-semibold text-slate-700">Physical Location</label>
                                            {availableLocations.length > 0 ? (
                                                <select name="physicalLocation" value={formData.physicalLocation} onChange={handleChange} className="form-input-simple">
                                                    <option value="">— Not Assigned —</option>
                                                    {availableLocations.map(loc => (
                                                        <option key={loc._id} value={loc.label}>{loc.label}{loc.description ? ` (${loc.description})` : ''}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input type="text" name="physicalLocation" value={formData.physicalLocation} onChange={handleChange}
                                                    placeholder="No locations set up — type manually" className="form-input-simple" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Inventory */}
                            {!isVendorProduct && (
                                <div className="space-y-4 pt-6 border-t border-slate-50">
                                    <label className="text-sm font-semibold text-slate-700">{t('fields.allocate_branches')}</label>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {branches.map(b => {
                                            const isSelected = branchStocks.some(bs => bs.branchId === b._id);
                                            return (
                                                <button key={b._id} type="button" onClick={() => handleBranchToggle(b)} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                    {b.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        {branchStocks.map(bs => (
                                            <div key={bs.branchId} className="flex flex-col gap-3 p-5 bg-slate-50 border border-slate-100 rounded-3xl group transition-all hover:bg-white hover:border-blue-100 hover:shadow-sm">
                                                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">{bs.name}</div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Stock Qty</label>
                                                        <input type="number" onWheel={(e) => e.target.blur()} value={bs.stock} onChange={e => handleBranchStockChange(bs.branchId, 'stock', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-blue-500 font-bold text-slate-800 shadow-sm" placeholder="0" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Alert Limit</label>
                                                        <input type="number" onWheel={(e) => e.target.blur()} value={bs.lowStockThreshold} onChange={e => handleBranchStockChange(bs.branchId, 'lowStockThreshold', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-red-500 font-bold text-red-500 shadow-sm" placeholder="10" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Section 4: Inventory Intelligence */}
                            <div className="space-y-6 pt-6 border-t border-slate-50">
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                                    Inventory Intelligence
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Reorder Threshold</label>
                                        <input type="number" onWheel={(e) => e.target.blur()} name="reorderThreshold" value={formData.reorderThreshold} onChange={handleChange} className="form-input-simple" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Max Capacity per SKU</label>
                                        <input type="number" onWheel={(e) => e.target.blur()} name="maxCapacityPerSku" value={formData.maxCapacityPerSku} onChange={handleChange} className="form-input-simple" />
                                    </div>
                                    <div className="md:col-span-2 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <input type="checkbox" id="editStockAutoSync" checked={formData.isStockAutoSync} onChange={(e) => setFormData(p => ({...p, isStockAutoSync: e.target.checked}))} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                                        <label htmlFor="editStockAutoSync" className="text-xs font-semibold text-slate-700 cursor-pointer">Auto-sync current stock per shelf</label>
                                    </div>
                                </div>
                            </div>

                            {/* Section 5: Physical Handling */}
                            <div className="space-y-6 pt-6 border-t border-slate-50">
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-orange-400 rounded-full"></span>
                                    Physical Handling
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Weight Category</label>
                                        <select name="weightCategory" value={formData.weightCategory} onChange={handleChange} className="form-input-simple">
                                            <option value="Light">Light</option>
                                            <option value="Medium">Medium</option>
                                            <option value="Heavy">Heavy</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Temperature Type</label>
                                        <select name="temperatureType" value={formData.temperatureType} onChange={handleChange} className="form-input-simple">
                                            <option value="Normal">Normal</option>
                                            <option value="Cold">Cold</option>
                                            <option value="Frozen">Frozen</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Is Fragile?</label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setFormData(p => ({...p, isFragile: true}))} className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${formData.isFragile ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Yes</button>
                                            <button type="button" onClick={() => setFormData(p => ({...p, isFragile: false}))} className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${!formData.isFragile ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>No</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 6: Picking Optimization */}
                            <div className="space-y-6 pt-6 border-t border-slate-50">
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                                    Picking Optimization
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Pick Priority</label>
                                        <select name="pickPriority" value={formData.pickPriority} onChange={handleChange} className="form-input-simple">
                                            <option value={0}>Normal (Default)</option>
                                            <option value={1}>High (Fast-moving)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Storage Zone</label>
                                        <select name="pickingZone" value={formData.pickingZone} onChange={handleChange} className="form-input-simple">
                                            <option value="Other">Other / Default</option>
                                            <option value="Food">Food Zone</option>
                                            <option value="Non-food">Non-food Zone</option>
                                            <option value="Mixed Restricted">Mixed Restricted</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 7: Product Variants */}
                            <div className="space-y-6 pt-6 border-t border-slate-50">
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-rose-400 rounded-full"></span>
                                    Product Variants
                                </h4>
                                <ProductVariantsEditor
                                    variants={formData.variants}
                                    onChange={(variants) => setFormData((prev) => ({ ...prev, variants }))}
                                    fallbackPrice={formData.basePrice}
                                />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Variant Group ID</label>
                                        <input type="text" name="variantGroupId" value={formData.variantGroupId} onChange={handleChange} className="form-input-simple" placeholder="E.g. COCO-OIL-01" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Pick Sequence</label>
                                        <input type="number" onWheel={(e) => e.target.blur()} name="pickSequence" value={formData.pickSequence} onChange={handleChange} className="form-input-simple" />
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="space-y-4 pt-6 border-t border-slate-50">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-semibold text-slate-700">{t('fields.description')}<span className="text-red-500 ml-1">*</span></label>
                                    <button type="button" onClick={() => handleAISuggestion('description')} disabled={aiLoading.description} className="text-xs font-bold text-blue-600 flex items-center gap-1">
                                        {aiLoading.description ? '...' : <><Sparkles size={14} /> {t('form.ai_write')}</>}
                                    </button>
                                </div>
                                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="form-input-simple" />
                                
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">{t('fields.tags')}</label>
                                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                                        {formData.tags.map(tag => (
                                            <span key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-[11px] font-medium text-slate-600">
                                                {tag} <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setFormData(p => ({...p, tags: p.tags.filter(t => t !== tag)}))} />
                                            </span>
                                        ))}
                                        <input 
                                            type="text" 
                                            placeholder="Add tags, separate with comma..." 
                                            value={tagInput} 
                                            onChange={handleTagInputChange}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ',') {
                                                    e.preventDefault();
                                                    addTag();
                                                }
                                            }}
                                            onBlur={() => { if (tagInput.trim()) addTag(); }}
                                            className="plain-input text-xs flex-1 min-w-[100px] py-1" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Side Panels */}
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <label className="text-sm font-semibold text-slate-700 block text-center">{t('form.images')} (Main)</label>
                                <div className="relative group aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-400">
                                    {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <Camera size={32} className="text-slate-300" />}
                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageChange} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-semibold text-slate-700 block text-center">Gallery Images</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {existingGallery.map((img, index) => (
                                        <div key={`exist-${index}`} className="relative aspect-square bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group">
                                            <img src={img} className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => removeExistingGalleryImage(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"><X size={12} strokeWidth={3} /></button>
                                        </div>
                                    ))}
                                    {galleryPreviews.map((img, index) => (
                                        <div key={`new-${index}`} className="relative aspect-square bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group">
                                            <img src={img} className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => removeGalleryImage(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"><X size={12} strokeWidth={3} /></button>
                                        </div>
                                    ))}
                                    {(existingGallery.length + galleryPreviews.length) < 10 && (
                                        <label className="relative aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-slate-100 transition-all">
                                            <Plus size={20} className="text-slate-400" />
                                            <input type="file" multiple accept="image/*" className="hidden" onChange={handleGalleryChange} />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('fields.registry_sku')}</span>
                                <QRCodeSVG value={formData.sku || 'N/A'} size={120} />
                                <span className="text-xs font-mono font-bold text-slate-600 uppercase">{formData.sku || 'N/A'}</span>
                            </div>

                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setFormData(p => ({...p, isVeg: true}))} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${formData.isVeg ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Veg</button>
                                    <button type="button" onClick={() => setFormData(p => ({...p, isVeg: false}))} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${!formData.isVeg ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Non-Veg</button>
                                </div>

                                <div 
                                    className={`p-4 rounded-2xl border flex items-center gap-4 cursor-pointer transition-all ${formData.isSaathigro ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60 grayscale'}`}
                                    onClick={() => setFormData(p => ({...p, isSaathigro: !p.isSaathigro}))}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${formData.isSaathigro ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}><Sparkles size={18} /></div>
                                    <div className="flex-1">
                                        <span className="text-xs font-bold text-slate-900 block leading-none">{t('fields.saathi_premium')}</span>
                                        <span className="text-[9px] text-slate-400 font-medium mt-1 inline-block">Extra visibility</span>
                                    </div>
                                    {formData.isSaathigro && <Check size={18} className="text-blue-600" />}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 px-10">
                    <button onClick={onHide} className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-all">{t('form.cancel')}</button>
                    <button onClick={handleSubmit} disabled={loading} className="px-10 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-100 flex items-center gap-2 hover:bg-blue-700 active:scale-95">
                        {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                        {t('form.update')}
                    </button>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
                .form-input-simple { 
                    width: 100%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; 
                    padding: 0.65rem 1rem; outline: none; transition: all 0.2s; font-size: 13px; font-weight: 600;
                }
                .form-input-simple:focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.05); }
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}} />
        </div>
    );
};

export default ProductEditModal;



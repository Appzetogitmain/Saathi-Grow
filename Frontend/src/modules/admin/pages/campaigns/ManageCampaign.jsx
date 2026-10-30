import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, ArrowLeft, Eye, Sparkles, LayoutGrid, TrendingDown, PartyPopper, Loader2, ChevronLeft, ChevronRight, Shield, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createCampaign, updateCampaign, getCampaignById } from '../../api/campaignApi';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { toast } from 'react-toastify';
import ProductPickerModal from '../../../../common/components/forms/ProductPickerModal';
import PageInfoTooltip from '../../../../common/components/modals/PageInfoTooltip';
import { pageInfoData } from '../../../../common/data/pageInfoData';

const ManageCampaign = () => {
    const { t } = useTranslation('admin_campaigns');
    const { id } = useParams();
    const navigate = useNavigate();
    const { adminUser } = useAdminAuth();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(id ? true : false);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [showPicker, setShowPicker] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        highlightText: 'Limited Time!',
        displayType: 'festive',
        bgColor: '#FFEBEF',
        textColor: '#D81B60',
        accentColor: '#E91E63',
        isActive: true
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (id) {
                    const campaign = await getCampaignById(adminUser.token, id);
                    setFormData({
                        title: campaign.title || '',
                        subtitle: campaign.subtitle || '',
                        highlightText: campaign.highlightText || 'Limited Time!',
                        displayType: campaign.displayType || 'festive',
                        bgColor: campaign.bgColor || '#FFEBEF',
                        textColor: campaign.textColor || '#D81B60',
                        accentColor: campaign.accentColor || '#E91E63',
                        isActive: campaign.isActive !== undefined ? campaign.isActive : true
                    });
                    setSelectedProducts((campaign.products || []).filter(p => p && p.productId).map(p => ({
                        productId: p.productId?._id || p.productId,
                        name: p.productId?.name,
                        image: p.productId?.image,
                        mrp: p.productId?.mrp || p.productId?.basePrice,
                        basePrice: p.basePrice || p.productId?.basePrice
                    })));
                }
            } catch (error) {
                // toast.error(t('messages.fetch_error'));
            } finally {
                setFetching(false);
            }
        };
        if (adminUser?.token) fetchData();
    }, [id, adminUser, t]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handlePickerSelect = (newProducts) => {
        const formatted = newProducts.map(product => ({
            productId: product._id,
            name: product.name,
            image: product.image,
            mrp: product.mrp || product.basePrice,
            basePrice: product.currentPrice || product.basePrice
        }));
        setSelectedProducts([...selectedProducts, ...formatted]);
    };

    const removeProduct = (productId) => {
        setSelectedProducts(selectedProducts.filter(p => p.productId !== productId));
    };

    const handlePriceChange = (productId, price) => {
        setSelectedProducts(selectedProducts.map(p =>
            p.productId === productId ? { ...p, basePrice: price === '' ? '' : Number(price) } : p
        ));
    };

    const paginatedProducts = selectedProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const totalPages = Math.ceil(selectedProducts.length / itemsPerPage);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (selectedProducts.length === 0) {
            return toast.error('Please add at least one product');
        }

        setLoading(true);
        try {
            const payload = {
                ...formData,
                products: selectedProducts.filter(p => p && p.productId).map(p => ({
                    productId: p.productId,
                    basePrice: p.basePrice
                }))
            };

            if (id) {
                await updateCampaign(adminUser.token, id, payload);
                toast.success(t('messages.update_success'));
            } else {
                await createCampaign(adminUser.token, payload);
                toast.success(t('messages.create_success'));
            }
            navigate('/admin/campaigns');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="flex justify-center items-center py-24 min-h-[400px]">
                <Loader2 size={40} className="text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container-fluid py-6 bg-slate-50/20 min-h-screen px-4 md:px-6 max-w-7xl mx-auto font-sans text-slate-800">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate('/admin/campaigns')}
                    className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors mb-4 group font-semibold"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] uppercase tracking-wider">{t('form.cancel')}</span>
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">
                            {id ? t('form.edit_title') : t('form.add_title')}
                        </h1>
                        <p className="text-slate-500 text-xs font-medium mt-0.5">{t('title')}</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start mb-24">
                <div className="xl:col-span-5 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{t('form.basic_info')}</h3>
                        </div>

                        {/* Theme Toggle */}
                        <div className="space-y-3">
                             <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight ml-1">{t('form.display_type')}</label>
                             <div className="grid grid-cols-2 gap-4">
                                <div
                                    onClick={() => setFormData(p => ({ ...p, displayType: 'festive' }))}
                                    className={`p-4 rounded-2xl border-2 transition-all text-center group cursor-pointer ${formData.displayType === 'festive' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center mb-2 transition-transform group-hover:scale-110 ${formData.displayType === 'festive' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                        <PartyPopper size={20} />
                                    </div>
                                    <div className={`text-[10px] font-bold uppercase tracking-tight ${formData.displayType === 'festive' ? 'text-blue-700' : 'text-slate-500'}`}>{t('types.festive')}</div>
                                </div>
                                <div
                                    onClick={() => setFormData(p => ({ ...p, displayType: 'lowest_prices' }))}
                                    className={`p-4 rounded-2xl border-2 transition-all text-center group cursor-pointer ${formData.displayType === 'lowest_prices' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center mb-2 transition-transform group-hover:scale-110 ${formData.displayType === 'lowest_prices' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                        <TrendingDown size={20} />
                                    </div>
                                    <div className={`text-[10px] font-bold uppercase tracking-tight ${formData.displayType === 'lowest_prices' ? 'text-emerald-700' : 'text-slate-500'}`}>{t('types.lowest_prices')}</div>
                                </div>
                             </div>
                        </div>

                        {/* Fields */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4 shadow-inner">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight ml-1">{t('form.title_label')}</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    placeholder={t('form.title_placeholder')}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-700 shadow-sm"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight ml-1">{t('form.subtitle_label')}</label>
                                <input
                                    type="text"
                                    name="subtitle"
                                    value={formData.subtitle}
                                    onChange={handleChange}
                                    placeholder={t('form.subtitle_placeholder')}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-700 shadow-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight ml-1">{t('form.highlight_label')}</label>
                                <input
                                    type="text"
                                    name="highlightText"
                                    value={formData.highlightText}
                                    onChange={handleChange}
                                    placeholder={t('form.highlight_placeholder')}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all text-sm font-bold text-slate-700 shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Visual Branding Section */}
                        {formData.displayType === 'festive' && (
                             <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6 ring-4 ring-slate-50 transition-all">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles size={16} className="text-blue-500" />
                                    <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{t('form.visual_settings')}</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                     <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{t('form.bg_color')}</span>
                                        <input type="color" name="bgColor" value={formData.bgColor} onChange={handleChange} className="w-8 h-8 rounded-lg border-none shadow-sm cursor-pointer p-0" />
                                     </div>
                                     <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{t('form.text_color')}</span>
                                        <input type="color" name="textColor" value={formData.textColor} onChange={handleChange} className="w-8 h-8 rounded-lg border-none shadow-sm cursor-pointer p-0" />
                                     </div>
                                     <div className="flex items-center justify-between col-span-2 border-t border-slate-50 pt-3 mt-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Accent Color</span>
                                        <input type="color" name="accentColor" value={formData.accentColor} onChange={handleChange} className="w-8 h-8 rounded-lg border-none shadow-sm cursor-pointer p-0" />
                                     </div>
                                </div>
                             </div>
                        )}

                        {/* Preview */}
                        <div className="space-y-3">
                             <div className="flex items-center gap-2 px-1">
                                <Eye size={12} className="text-slate-400" />
                                <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Live Preview</h6>
                             </div>
                             
                             {formData.displayType === 'festive' ? (
                                <div className="p-6 rounded-3xl shadow-xl border border-white/20" style={{ backgroundColor: formData.bgColor }}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="px-3 py-1 rounded-full text-[9px] font-bold uppercase text-white" style={{ backgroundColor: formData.accentColor }}>
                                            {formData.highlightText}
                                        </div>
                                    </div>
                                    <h4 className="text-lg font-bold tracking-tight mb-1" style={{ color: formData.textColor }}>{formData.title || 'Campaign Title'}</h4>
                                    <p className="text-[11px] font-medium opacity-80" style={{ color: formData.textColor }}>{formData.subtitle || 'Browse products below'}</p>
                                </div>
                             ) : (
                                <div className="p-6 rounded-3xl shadow-xl border border-emerald-100 bg-white relative overflow-hidden">
                                     <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16"></div>
                                     <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                                            <TrendingDown size={22} />
                                        </div>
                                        <h4 className="text-sm font-bold text-emerald-900 uppercase">{formData.title || 'Lowest Prices'}</h4>
                                     </div>
                                     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold uppercase">
                                        🔥 {formData.highlightText}
                                     </div>
                                </div>
                             )}
                        </div>

                        <div className="bg-slate-900 rounded-2xl p-6 text-white flex items-center justify-between shadow-lg">
                            <div className="flex items-center gap-3">
                                <Shield size={18} className="text-blue-400" />
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-tight text-white">{t('form.isActive')}</h4>
                                    <p className="text-[9px] text-slate-300 font-medium uppercase">{formData.isActive ? 'Active' : 'Offline'}</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                                />
                                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Products Section */}
                <div className="xl:col-span-7 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 flex flex-col min-h-[600px]">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-6">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{t('form.products_section')}</h3>
                            <button 
                                type="button"
                                onClick={() => setShowPicker(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase shadow-lg shadow-blue-100 flex items-center gap-2 transition-all active:scale-95"
                            >
                                <Plus size={14} /> Add Products
                            </button>
                        </div>

                        <div className="flex-grow">
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {paginatedProducts.length > 0 ? (
                                    paginatedProducts.map((p) => (
                                        <div key={p.productId} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl group hover:border-blue-200 transition-all relative flex flex-col">
                                            <div className="flex items-start gap-3 mb-4">
                                                <div className="w-12 h-12 rounded-xl border border-slate-200 bg-white p-1 overflow-hidden shrink-0 shadow-sm">
                                                    <img src={p.image} className="w-full h-full object-cover" alt="" />
                                                </div>
                                                <div className="min-w-0 pr-6">
                                                    <div className="text-[11px] font-bold text-slate-800 uppercase truncate max-w-full">{p.name}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] text-slate-400 font-bold">MRP: ₹{p.mrp}</span>
                                                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black">-{Math.round(((p.mrp - p.basePrice) / p.mrp) * 100)}%</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeProduct(p.productId)}
                                                    className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition-all"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            
                                            <div className="mt-auto pt-4 border-t border-slate-200/50 flex flex-col gap-1.5">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Offer Price</span>
                                                    <span className="text-[9px] font-bold text-emerald-600 uppercase">Save ₹{p.mrp - p.basePrice}</span>
                                                </div>
                                                <div className="relative">
                                                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 font-bold text-xs">₹</span>
                                                     <input
                                                        type="number"
                                                        value={p.basePrice}
                                                        onChange={(e) => handlePriceChange(p.productId, e.target.value)}
                                                        className="w-full pl-7 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-blue-700 outline-none focus:ring-1 ring-blue-500/20 shadow-sm"
                                                     />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-24 flex flex-col items-center justify-center gap-3 opacity-30">
                                        <LayoutGrid size={48} className="text-slate-300" />
                                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">No products added yet</p>
                                    </div>
                                )}
                             </div>

                             {selectedProducts.length > itemsPerPage && (
                                <div className="mt-auto pt-10 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button"
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(prev => prev - 1)}
                                            className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="text-[10px] font-bold text-slate-600 px-2">{currentPage} / {totalPages}</span>
                                        <button 
                                            type="button"
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(prev => prev + 1)}
                                            className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pr-2">
                                        Total Items: {selectedProducts.length}
                                    </span>
                                </div>
                             )}
                        </div>
                    </div>
                </div>
            </form>

            {/* Float Command Bar */}
            <div className="bg-white/95 border-t border-slate-200 fixed bottom-0 left-0 right-0 z-[60] ml-0 lg:ml-[260px] p-4 px-8 flex items-center justify-between shadow-lg backdrop-blur-sm">
                <div className="hidden md:flex items-center gap-3 pl-4">
                     <div className={`w-3 h-3 rounded-full ${formData.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                     <div>
                        <div className="text-[11px] font-bold uppercase tracking-tight text-slate-900">
                            {formData.isActive ? 'System Ready' : 'Draft Mode'}
                        </div>
                     </div>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button 
                        onClick={() => navigate('/admin/campaigns')}
                        className="px-8 py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 rounded-xl"
                    >
                        {t('form.cancel')}
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 md:flex-none px-12 py-3 bg-blue-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95 border-none outline-none"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {id ? t('form.update') : t('form.save')}
                    </button>
                </div>
            </div>

            <ProductPickerModal
                show={showPicker}
                onHide={() => setShowPicker(false)}
                onSelect={handlePickerSelect}
                existingProductIds={selectedProducts.map(p => p.productId)}
                token={adminUser?.token}
            />
        </div>
    );
};

export default ManageCampaign;

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Upload, Edit, Trash2, QrCode, Filter, Store, Sparkles, ChevronLeft, ChevronRight, History, X, Download, FileText, ArrowUpDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import ProductEditModal from '../../../../common/components/products/ProductEditModal';
import RestockModal from '../../../../common/components/products/RestockModal';
import ProductReorderModal from '../../components/products/ProductReorderModal';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { getProducts, deleteProduct, bulkDeleteProducts, updateProduct } from '../../../../common/api/productApi';
import { bulkUploadProductsJson } from '../../api/productApi';
import { getCategories } from '../../api/categoryApi';
import { getBrands } from '../../api/brandApi';
import { showDeleteConfirmation, showSuccessAlert, showErrorAlert } from '../../../../common/utils/alertUtils';
import { toast } from 'react-toastify';
import PageInfoTooltip from '../../../../common/components/modals/PageInfoTooltip';
import { pageInfoData } from '../../../../common/data/pageInfoData';
import * as XLSX from 'xlsx';

const ProductStatusBadge = ({ status }) => {
    const { t } = useTranslation('admin_products');
    const variants = {
        Active: 'bg-green-100 text-green-700 border-green-200',
        'Low Stock': 'bg-red-100 text-red-700 border-red-200',
        'Out of Stock': 'bg-gray-100 text-gray-500 border-gray-200',
        Draft: 'bg-blue-100 text-blue-700 border-blue-200',
        'Pending Approval': 'bg-orange-100 text-orange-700 border-orange-200'
    };
    
    const statusKey = status?.toLowerCase().replace(/\s+/g, '_');
    const translatedStatus = t(`status.${statusKey}`, { defaultValue: status });

    return (
        <span className={`inline-flex items-center whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-semibold border ${variants[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {translatedStatus}
        </span>
    );
};

const AllProducts = () => {
    const { t } = useTranslation('admin_products');
    const navigate = useNavigate();
    const { adminUser } = useAdminAuth();

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const searchTerm = searchParams.get('search') || '';
    const selectedCategory = searchParams.get('category') || '';
    const selectedBrand = searchParams.get('brand') || '';
    const selectedStatus = searchParams.get('status') || '';
    const sourceFilter = searchParams.get('source') || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = 10;

    const [totalPages, setTotalPages] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);
    const [localSearch, setLocalSearch] = useState(searchTerm);

    const [showQR, setShowQR] = useState(null);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showRestockModal, setShowRestockModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showReorderModal, setShowReorderModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkMode, setBulkMode] = useState('excel');
    const [bulkFile, setBulkFile] = useState(null);
    const [jsonInput, setJsonInput] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    const downloadExcelTemplate = () => {
        const headers = [
            'name', 'category', 'subCategory', 'brandName', 'basePrice', 'mrp',
            'unitType', 'unitValue', 'description', 'tags', 'sku', 'stock', 'status', 'displayOrder'
        ];
        const example = [
            'Amul Butter 100g', 'Dairy Bread & Eggs', '', 'Amul', 52, 55,
            'g', 100, 'Fresh Amul butter 100g pack', 'dairy,butter,amul', 'DAI-AMU-XXXXX', 50, 'Active', 1
        ];
        
        const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
        XLSX.writeFile(workbook, 'Saathigro_bulk_product_template.xlsx');
    };

    const resetBulkModal = () => {
        setShowBulkModal(false);
        setBulkMode('excel');
        setBulkFile(null);
        setJsonInput('');
    };

    const showBulkUploadResult = (data) => {
        const created = data.created || 0;
        const updated = data.updated || 0;
        const skipped = data.skipped || 0;
        const errors = data.errors || [];
        const summary = `${created} created, ${updated} updated${skipped > 0 ? `, ${skipped} skipped` : ''}`;

        if (created + updated > 0) {
            toast.success(summary, { autoClose: 5000 });
        } else if (skipped > 0) {
            toast.warning(summary, { autoClose: 5000 });
        } else {
            toast.info(summary, { autoClose: 5000 });
        }

        if (errors.length > 0) {
            const preview = errors.slice(0, 5);
            const remaining = errors.length - preview.length;
            toast.warning(
                <div className="text-sm">
                    <p className="font-bold mb-1">{errors.length} issue{errors.length > 1 ? 's' : ''}</p>
                    <ul className="list-disc pl-4 space-y-0.5 max-h-40 overflow-y-auto">
                        {preview.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                    {remaining > 0 && <p className="mt-1 text-xs opacity-80">…and {remaining} more</p>}
                </div>,
                { autoClose: 12000 }
            );
        }
    };

    const downloadJsonTemplate = () => {
        const template = [
            {
                name: 'Amul Butter 100g',
                category: 'Dairy Bread & Eggs',
                subCategory: '',
                brandName: 'Amul',
                basePrice: 52,
                mrp: 55,
                unitType: 'g',
                unitValue: 100,
                description: 'Fresh Amul butter 100g pack',
                tags: ['dairy', 'butter', 'amul'],
                sku: 'DAI-AMU-XXXXX',
                stock: 50,
                status: 'Active',
                displayOrder: 1
            }
        ];
        const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Saathigro_bulk_product_template.json';
        link.click();
        URL.revokeObjectURL(url);
    };

    const parseJsonProducts = (raw) => {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed?.products)) return parsed.products;
        throw new Error('JSON must be an array of products or { "products": [...] }');
    };

    const handleBulkUpload = async () => {
        if (!bulkFile) return toast.warning('Please select an Excel file first');
        setBulkLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', bulkFile);
            const axios = (await import('axios')).default;
            const { API_BASE_URL } = await import('../../../../config/apiConfig');
            const { data } = await axios.post(
                `${API_BASE_URL}/admin/products/bulk-upload`,
                formData,
                { headers: { Authorization: `Bearer ${adminUser.token}`, 'Content-Type': 'multipart/form-data' } }
            );
            showBulkUploadResult(data);
            resetBulkModal();
            fetchData();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Bulk upload failed. Check your Excel format.');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkJsonUpload = async () => {
        if (!jsonInput.trim()) return toast.warning('Please paste JSON or upload a .json file');
        setBulkLoading(true);
        try {
            const products = parseJsonProducts(jsonInput.trim());
            if (products.length === 0) {
                toast.warning('JSON must contain at least one product');
                return;
            }
            const data = await bulkUploadProductsJson(adminUser.token, products);
            showBulkUploadResult(data);
            resetBulkModal();
            fetchData();
        } catch (err) {
            toast.error(err?.message || 'Bulk JSON upload failed. Check your JSON format.');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleJsonFileSelect = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => setJsonInput(e.target.result || '');
        reader.onerror = () => toast.error('Failed to read JSON file');
        reader.readAsText(file);
    };

    const updateParams = useCallback((newParams) => {
        setSearchParams(prev => {
            Object.entries(newParams).forEach(([key, value]) => {
                if (value && value !== 'all') prev.set(key, value);
                else prev.delete(key);
            });
            return prev;
        });
    }, [setSearchParams]);

    const fetchData = useCallback(async () => {
        if (!adminUser?.token) return;
        setLoading(true);
        try {
            const params = {
                page, limit, search: searchTerm, category: selectedCategory, brand: selectedBrand, status: selectedStatus,
                source: sourceFilter === 'all' ? '' : sourceFilter
            };
            const [productsData, categoriesData, brandsData] = await Promise.all([
                getProducts(adminUser.token, params),
                getCategories(adminUser.token, { status: 'Active' }),
                getBrands(adminUser.token)
            ]);

            // Robust extraction logic to handle various response structures
            const extractData = (payload, key) => {
                if (Array.isArray(payload)) return payload;
                if (payload && typeof payload === 'object') {
                    if (Array.isArray(payload[key])) return payload[key];
                    if (Array.isArray(payload.data)) return payload.data;
                    if (payload.data && Array.isArray(payload.data[key])) return payload.data[key];
                }
                return [];
            };

            setProducts(productsData?.products || productsData?.data?.products || productsData || []);
            setTotalPages(productsData?.pages || productsData?.data?.pages || 1);
            setTotalProducts(productsData?.total || productsData?.data?.total || 0);
            
            setCategories(extractData(categoriesData, 'categories'));
            setBrands(extractData(brandsData, 'brands'));
        } catch (error) {
            console.error('Failed to fetch products or master data:', error);
            // toast.error(t('messages.load_failed'));
        } finally {
            setLoading(false);
        }
    }, [adminUser?.token, page, limit, searchTerm, selectedCategory, selectedBrand, selectedStatus, sourceFilter, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (localSearch !== searchTerm) updateParams({ search: localSearch, page: 1 });
        }, 500);
        return () => clearTimeout(timeout);
    }, [localSearch, searchTerm, updateParams]);

    const getTotalStock = (p) => {
        if (p.vendor) return p.stock || 0;
        if (!p.branchStocks || p.branchStocks.length === 0) return 0;
        return p.branchStocks.reduce((sum, bs) => sum + bs.stock, 0);
    };

    const handleDelete = async (id, name) => {
        const result = await showDeleteConfirmation(t('messages.delete_confirm_title'), t('messages.delete_confirm_text', { name }));
        if (result.isConfirmed) {
            try {
                await deleteProduct(adminUser.token, id);
                setProducts(products.filter(p => p._id !== id));
                setSelectedIds((prev) => prev.filter((x) => x !== id));
                showSuccessAlert(t('messages.delete_success'));
            } catch (error) {
                showErrorAlert('Error', error.message);
            }
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const allSelected = products.length > 0 && products.every((p) => selectedIds.includes(p._id));

    const toggleSelectAll = () => {
        if (allSelected) {
            const currentIds = products.map((p) => p._id);
            setSelectedIds((prev) => prev.filter((id) => !currentIds.includes(id)));
        } else {
            setSelectedIds((prev) => Array.from(new Set([...prev, ...products.map((p) => p._id)])));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        const result = await showDeleteConfirmation(
            t('messages.bulk_delete_confirm_title'),
            t('messages.bulk_delete_confirm_text', { count: selectedIds.length })
        );
        if (result.isConfirmed) {
            try {
                const data = await bulkDeleteProducts(adminUser.token, selectedIds);
                toast.success(t('messages.bulk_delete_success', { count: data.deletedCount ?? selectedIds.length }));
                setSelectedIds([]);
                fetchData();
            } catch (error) {
                showErrorAlert('Error', error.message);
            }
        }
    };

    const handleSave = async (data) => {
        try {
            await updateProduct(adminUser.token, selectedProduct._id, data);
            toast.success(t('messages.save_success'));
            setShowEditModal(false);
            fetchData();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const activeFiltersCount = [selectedCategory, selectedBrand].filter(Boolean).length;

    const getPageNumbers = () => {
        const pages = [];
        const maxButtons = 5;
        if (totalPages <= maxButtons) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
            return pages;
        }
        let start = Math.max(1, page - 2);
        let end = Math.min(totalPages, start + maxButtons - 1);
        start = Math.max(1, end - maxButtons + 1);
        if (start > 1) pages.push(1, start > 2 ? '...' : 2);
        for (let i = start; i <= end; i++) {
            if (!pages.includes(i)) pages.push(i);
        }
        if (end < totalPages) pages.push(end < totalPages - 1 ? '...' : totalPages - 1, totalPages);
        return [...new Set(pages)];
    };

    const startItem = totalProducts === 0 ? 0 : (page - 1) * limit + 1;
    const endItem = Math.min(page * limit, totalProducts);

    return (
        <div className="container-fluid py-8 bg-slate-50/30 min-h-screen">
            {/* Simple Card Header */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2">
                             <h1 className="text-sm font-bold tracking-tight text-slate-900 uppercase tracking-[0.05em]">{t('title')}</h1>
                             <PageInfoTooltip data={pageInfoData.allProducts} />
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5 font-semibold uppercase tracking-wider">{t('meta.sku_count', { count: totalProducts })}</p>
                    </div>

                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder={t('search_placeholder')}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setShowFilterMenu(!showFilterMenu)}
                                className={`px-5 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${showFilterMenu || activeFiltersCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                <Filter size={18} />
                                {t('filter_btn')}
                                {activeFiltersCount > 0 && <span className="ml-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>}
                            </button>

                            {showFilterMenu && (
                                <div className="absolute top-full right-0 mt-2 z-50 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-6">
                                    <h6 className="font-bold text-slate-900 mb-4 text-sm">{t('filters.options')}</h6>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase">{t('table.category')}</label>
                                            <select className="w-full text-sm py-2" value={selectedCategory} onChange={(e) => updateParams({ category: e.target.value, page: 1 })}>
                                                <option value="">{t('filters.all_categories')}</option>
                                                {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase">{t('table.brand')}</label>
                                            <select className="w-full text-sm py-2" value={selectedBrand} onChange={(e) => updateParams({ brand: e.target.value, page: 1 })}>
                                                <option value="">{t('filters.all_brands')}</option>
                                                {brands.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
                                            </select>
                                        </div>
                                        {activeFiltersCount > 0 && (
                                            <button onClick={() => { updateParams({ category: '', brand: '', page: 1 }); setShowFilterMenu(false); }} className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold mt-2 hover:bg-red-100 transition-all">
                                                {t('filters.clear')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {adminUser?.role === 'Admin' && (
                            <>
                                <button
                                    onClick={() => setShowReorderModal(true)}
                                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-sm active:scale-95"
                                >
                                    <ArrowUpDown size={18} /> {t('reorder_btn', 'Reorder Sequence')}
                                </button>
                                <button
                                    onClick={() => setShowBulkModal(true)}
                                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                                >
                                    <Upload size={18} /> Bulk Upload
                                </button>
                                <Link to="/admin/products/add" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-100">
                                    <Plus size={20} /> {t('add_product')}
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {selectedIds.length > 0 && (
                <div className="bg-blue-600 text-white rounded-xl px-4 py-3 mb-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold">{t('selection.selected', { count: selectedIds.length })}</span>
                        <button onClick={() => setSelectedIds([])} className="text-xs font-medium text-blue-100 hover:text-white underline">
                            {t('selection.clear')}
                        </button>
                    </div>
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={16} /> {t('selection.delete')}
                    </button>
                </div>
            )}

            {/* Simple Table Content */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                                        aria-label="Select all products on this page"
                                    />
                                </th>
                                <th className="px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-16">{t('table.seq', 'Seq')}</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('table.product')}</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">{t('table.category')}</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">{t('table.price')}</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">{t('table.stock')}</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Location</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">{t('table.status')}</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">{t('table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="py-20 text-center">
                                        <div className="saathi-spinner mx-auto mb-4"></div>
                                        <p className="text-slate-400 text-sm">{t('meta.syncing')}</p>
                                    </td>
                                </tr>
                            ) : products.length > 0 ? (
                                products.map((p) => (
                                    <tr key={p._id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(p._id) ? 'bg-blue-50/40' : ''}`}>
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(p._id)}
                                                onChange={() => toggleSelect(p._id)}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                                                aria-label={`Select ${p.name}`}
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {p.displayOrder !== null && p.displayOrder !== undefined && p.displayOrder >= 0 ? (
                                                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold font-mono">
                                                    #{p.displayOrder}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-300 font-mono font-medium">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link to={`/admin/products/${p._id}`} className="flex items-center gap-4 group/item">
                                                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center p-1 border group-hover/item:border-blue-400 transition-all shadow-sm">
                                                    {p.image ? <img src={p.image} className="w-full h-full object-contain group-hover/item:scale-110 transition-transform" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/assets/logo_fav.png'; }} /> : <img src="/assets/logo_fav.png" alt="" className="w-full h-full object-contain" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-slate-900 truncate group-hover/item:text-blue-600 transition-colors">{p.name}</div>
                                                    <div className="text-[10px] font-medium text-slate-400 font-mono mt-0.5 uppercase tracking-tight">{p.sku}</div>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-xs text-slate-600 font-medium">{p.category}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-sm font-bold text-slate-900">₹{p.basePrice?.toFixed(0)}</div>
                                            {p.mrp > p.basePrice && <div className="text-[10px] text-slate-300 line-through">₹{p.mrp.toFixed(0)}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-xs font-bold ${getTotalStock(p) <= 10 ? 'text-red-600' : 'text-slate-600'}`}>{getTotalStock(p)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {p.physicalLocation ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-violet-50 text-violet-700 border border-violet-100 rounded-lg text-[10px] font-semibold uppercase tracking-wide">
                                                    <Store size={11} /> {p.physicalLocation}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-medium">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <ProductStatusBadge status={p.status} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setShowQR(showQR === p._id ? null : p._id)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="View QR"><QrCode size={18} /></button>
                                                <button onClick={() => navigate(`/admin/products/${p._id}/inventory-logs`)} className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all" title="Logs"><History size={18} /></button>
                                                {!p.vendor && (
                                                    <button onClick={() => { setSelectedProduct(p); setShowRestockModal(true); }} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" title="Restock"><Plus size={18} /></button>
                                                )}
                                                <button onClick={() => { setSelectedProduct(p); setShowEditModal(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit"><Edit size={18} /></button>
                                                <button onClick={() => handleDelete(p._id, p.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 size={18} /></button>
                                            </div>
                                            {showQR === p._id && (
                                                <div className="absolute right-12 z-50 bg-white shadow-2xl p-6 w-64 rounded-xl border border-slate-200 mt-2 flex flex-col animate-in fade-in duration-200">
                                                    <div className="flex justify-between items-center mb-4 w-full">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Product Details QR</span>
                                                        <button onClick={() => setShowQR(null)} className="text-slate-300 hover:text-red-500"><X size={16} /></button>
                                                    </div>
                                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-center mb-4 w-full">
                                                        <QRCodeSVG 
                                                            id={`qr-admin-${p._id}`}
                                                            value={`${window.location.origin}/product/${p._id}`} 
                                                            size={140} 
                                                            level="M" 
                                                        />
                                                    </div>
                                                    <div className="space-y-1 w-full text-center mb-4">
                                                        <div className="text-xs font-black text-slate-900 truncate" title={p.name}>{p.name}</div>
                                                        <div className="text-[9px] text-slate-500 font-bold uppercase">{p.category} | ₹{p.basePrice}</div>
                                                        <div className="text-[10px] font-black text-slate-900 font-mono tracking-widest uppercase bg-slate-50 py-2 rounded-lg border border-slate-200 mt-2">{p.sku?.slice(-12)}</div>
                                                    </div>
                                                    <button 
                                                        onClick={() => {
                                                            const svg = document.getElementById(`qr-admin-${p._id}`);
                                                            const svgData = new XMLSerializer().serializeToString(svg);
                                                            const canvas = document.createElement('canvas');
                                                            const ctx = canvas.getContext('2d');
                                                            const img = new Image();
                                                            img.onload = () => {
                                                                canvas.width = img.width;
                                                                canvas.height = img.height;
                                                                ctx.drawImage(img, 0, 0);
                                                                const pngFile = canvas.toDataURL('image/png');
                                                                const downloadLink = document.createElement('a');
                                                                downloadLink.download = `${p.sku}_qr.png`;
                                                                downloadLink.href = `${pngFile}`;
                                                                downloadLink.click();
                                                            };
                                                            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                                                        }}
                                                        className="w-full py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        <Download size={14} /> Download QR
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="py-20 text-center">
                                        <p className="text-slate-400 text-sm font-medium">{t('meta.no_products')}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && totalProducts > 0 && (
                    <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <span className="text-xs text-slate-500 font-medium">
                            {t('meta.showing_range', {
                                start: startItem,
                                end: endItem,
                                total: totalProducts,
                                defaultValue: `Showing ${startItem}–${endItem} of ${totalProducts}`
                            })}
                        </span>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => updateParams({ page: page - 1 })}
                                    disabled={page === 1}
                                    className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                {getPageNumbers().map((p, i) => (
                                    p === '...' ? (
                                        <span key={`dots-${i}`} className="px-2 text-slate-400 text-sm">…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => updateParams({ page: p })}
                                            className={`min-w-[34px] h-[34px] px-2 rounded-lg text-sm font-semibold transition-all ${
                                                p === page
                                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-100'
                                                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                ))}
                                <button
                                    onClick={() => updateParams({ page: page + 1 })}
                                    disabled={page === totalPages}
                                    className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ProductEditModal show={showEditModal} onHide={() => setShowEditModal(false)} product={selectedProduct} onSave={handleSave} />
            <RestockModal show={showRestockModal} onHide={() => setShowRestockModal(false)} product={selectedProduct} onRestockSuccess={fetchData} />

            {/* Bulk Upload Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col max-h-[88vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">Bulk Product Upload</h2>
                                    <p className="text-xs text-slate-400 font-medium">Upload products via Excel or JSON</p>
                                </div>
                            </div>
                            <button onClick={resetBulkModal} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 pt-4">
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setBulkMode('excel')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${bulkMode === 'excel' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    Excel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBulkMode('json')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${bulkMode === 'json' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    JSON
                                </button>
                            </div>
                        </div>

                        {/* Modal Body - scrollable */}
                        <div className="p-4 space-y-4 overflow-y-auto flex-1">
                            {bulkMode === 'excel' ? (
                                <>
                            {/* Step 1: Download Template */}
                            <div className="p-4 bg-blue-50 rounded-2xl flex items-center gap-4">
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-800">Step 1: Download Template</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Fill in this Excel file with your products</p>
                                </div>
                                <button
                                    onClick={downloadExcelTemplate}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition-all shadow-sm"
                                >
                                    <Download size={14} /> Download Excel
                                </button>
                            </div>

                            {/* Required Columns Info */}
                            <div className="bg-slate-50 rounded-2xl p-4">
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Required Excel Columns</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {['name*', 'category*', 'basePrice*', 'mrp*', 'unitType', 'unitValue', 'brandName', 'description', 'tags', 'sku', 'stock', 'status'].map(col => (
                                        <span key={col} className={`text-[10px] px-2 py-1 rounded-lg font-bold text-center ${col.includes('*') ? 'bg-rose-100 text-rose-600' : 'bg-white text-slate-500 border border-slate-200'}`}>
                                            {col}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-[10px] text-rose-500 font-semibold mt-2">* Required fields</p>
                                <p className="text-[10px] text-slate-500 mt-1.5">Product image is <span className="font-bold">optional</span> — if missing, SG logo is used by default.</p>
                            </div>

                            {/* Step 2: Upload File */}
                            <div>
                                <p className="text-sm font-bold text-slate-800 mb-2">Step 2: Upload Your Excel</p>
                                <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${bulkFile ? 'border-green-400 bg-green-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'}`}>
                                    <div className="flex flex-col items-center gap-2">
                                        {bulkFile ? (
                                            <>
                                                <FileText size={24} className="text-green-500" />
                                                <p className="text-sm font-bold text-green-700">{bulkFile.name}</p>
                                                <p className="text-xs text-slate-400">Click to change file</p>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={24} className="text-slate-400" />
                                                <p className="text-sm font-bold text-slate-600">Click to select Excel file</p>
                                                <p className="text-xs text-slate-400">Only .xlsx and .xls files supported</p>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                        onChange={(e) => setBulkFile(e.target.files[0] || null)}
                                    />
                                </label>
                            </div>
                                </>
                            ) : (
                                <>
                            <div className="p-4 bg-blue-50 rounded-2xl flex items-center gap-4">
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-800">Step 1: Download JSON Template</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Use this sample format for your products</p>
                                </div>
                                <button
                                    onClick={downloadJsonTemplate}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition-all shadow-sm"
                                >
                                    <Download size={14} /> Download JSON
                                </button>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-4">
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Required JSON Fields</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {['name*', 'category*', 'basePrice*', 'mrp*', 'unitType', 'unitValue', 'brandName', 'description', 'tags', 'sku', 'stock', 'status'].map(col => (
                                        <span key={col} className={`text-[10px] px-2 py-1 rounded-lg font-bold text-center ${col.includes('*') ? 'bg-rose-100 text-rose-600' : 'bg-white text-slate-500 border border-slate-200'}`}>
                                            {col}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-[10px] text-rose-500 font-semibold mt-2">* Required fields</p>
                                <p className="text-[10px] text-slate-500 mt-1.5">Paste a JSON array or use <span className="font-mono">{`{ "products": [...] }`}</span>. Tags can be an array or comma-separated string.</p>
                            </div>

                            <div>
                                <p className="text-sm font-bold text-slate-800 mb-2">Step 2: Paste or Upload JSON</p>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder='[{"name":"Tomato 1Kg","category":"Vegetables","basePrice":40,"mrp":80}]'
                                    className="w-full h-40 p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
                                />
                                <label className="mt-3 flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-2xl cursor-pointer transition-all border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Upload size={18} />
                                        <span className="text-xs font-semibold">Or upload a .json file</span>
                                    </div>
                                    <input
                                        type="file"
                                        accept=".json,application/json"
                                        className="hidden"
                                        onChange={(e) => handleJsonFileSelect(e.target.files[0] || null)}
                                    />
                                </label>
                            </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex gap-3 p-6 border-t border-slate-100">
                            <button onClick={resetBulkModal} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all">
                                Cancel
                            </button>
                            <button
                                onClick={bulkMode === 'excel' ? handleBulkUpload : handleBulkJsonUpload}
                                disabled={(bulkMode === 'excel' ? !bulkFile : !jsonInput.trim()) || bulkLoading}
                                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-blue-100"
                            >
                                {bulkLoading ? <><span className="saathi-spinner !w-4 !h-4 !border-2"></span> Uploading...</> : <><Upload size={16} /> Upload Products</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Display Sequence Modal */}
            <ProductReorderModal
                show={showReorderModal}
                onHide={() => setShowReorderModal(false)}
                token={adminUser?.token}
                onSuccess={fetchData}
                categories={categories}
            />
            
            <style dangerouslySetInnerHTML={{ __html: `
                .saathi-spinner {
                    width: 32px; height: 32px; border: 3px solid #f3f3f3; border-top: 3px solid #3b82f6; border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                input, select { outline: none !important; }
            `}} />
        </div>
    );
};

export default AllProducts;

import React, { useState, useEffect, useRef } from 'react';
import { Save, Globe, Settings, Smartphone, Mail, Settings2, Loader, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '../../context/AdminAuthContext';
import * as settingApi from '../../api/settingApi';
import { toast } from 'react-toastify';
import PageInfoTooltip from '../../../../common/components/modals/PageInfoTooltip';
import { pageInfoData } from '../../../../common/data/pageInfoData';
import { buildAppSettingsUpdate } from '../../utils/appPopupUtils';

const AppSettings = () => {
    const { t } = useTranslation('admin_settings');
    const { adminUser } = useAdminAuth();
    const token = adminUser?.token;
    const initialPopup = useRef(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState({
        supportEmail: '',
        supportPhone: '',
        offerStripText: '',
        isOfferStripEnabled: false
    });

    useEffect(() => {
        if (token) {
            fetchSettings();
        }
    }, [token]);

    const fetchSettings = async () => {
        try {
            const data = await settingApi.getAdminSettings(token);
            initialPopup.current = data.appPopup;
            setSettings(prev => ({ ...prev, ...data }));
        } catch (error) {
            toast.error('Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePopupChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            appPopup: {
                ...(prev.appPopup || {}),
                [field]: value
            }
        }));
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updated = await settingApi.updateAdminSettings(token, buildAppSettingsUpdate(settings, initialPopup.current));
            initialPopup.current = updated.appPopup;
            setSettings(updated);
            toast.success('Settings saved successfully!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-40">
                <Loader className="animate-spin text-blue-600" size={40} />
            </div>
        );
    }

    return (
        <div className="container-fluid py-6 bg-slate-50/30 min-h-screen px-4 md:px-6 max-w-7xl mx-auto font-sans text-slate-800">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-200 pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Settings2 size={16} className="text-blue-600" />
                        <span className="text-sm font-semibold text-blue-600">{t('app_settings.title')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-slate-800">{t('app_settings.title')}</h1>
                        <PageInfoTooltip data={pageInfoData.appSettings} />
                    </div>
                    <p className="text-slate-500 text-sm mt-1">{t('app_settings.subtitle')}</p>
                </div>
                <button

                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all transform active:scale-95 ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20'}`}
                >
                    <Save size={16} className={isSaving ? 'animate-pulse' : ''} />
                    <span>{isSaving ? t('common.saving') : t('app_settings.save_all')}</span>
                </button>
            </div>

            <div className="space-y-6">
                {/* General Identity */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-white px-6 md:px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                                <Globe size={20} />
                            </div>
                            <h3 className="text-base font-semibold text-slate-800">{t('app_settings.general')}</h3>
                        </div>
                    </div>
                    <div className="p-6 md:p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                <label className="text-xs font-medium ml-1">{t('app_settings.name')}</label>
                                <input
                                    type="text"
                                    defaultValue="Saathigro"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                <label className="text-xs font-medium ml-1">{t('app_settings.slogan')}</label>
                                <input
                                    type="text"
                                    defaultValue="Organic Excellence at Your Doorstep"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                <label className="text-xs font-medium ml-1">{t('app_settings.support_email')}</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="email"
                                        name="supportEmail"
                                        value={settings.supportEmail || ''}
                                        onChange={handleInputChange}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                <label className="text-xs font-medium ml-1">{t('app_settings.contact')}</label>
                                <div className="relative">
                                    <Smartphone size={16} className="absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        name="supportPhone"
                                        value={settings.supportPhone || ''}
                                        onChange={handleInputChange}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors mt-6">
                            <label className="text-xs font-medium ml-1">{t('app_settings.address')}</label>
                            <textarea
                                rows={2}
                                defaultValue="123 Agro Plaza, Fresh Valley, MP 452001"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all resize-y"
                            />

                        </div>
                    </div>
                </div>

                {/* System Configuration */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-50 to-white px-6 md:px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700 shadow-inner">
                                <Settings size={20} />
                            </div>
                            <h3 className="text-base font-semibold text-slate-800">{t('app_settings.system')}</h3>
                        </div>
                    </div>
                    <div className="p-6 md:p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                <label className="text-xs font-medium ml-1">{t('app_settings.currency')}</label>
                                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer">
                                    <option value="INR">INR (₹)</option>
                                    <option value="USD">USD ($)</option>
                                </select>
                            </div>
                            <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                <label className="text-xs font-medium ml-1">{t('app_settings.timezone')}</label>
                                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer">

                                    <option>(GMT+05:30) Mumbai, Kolkata, New Delhi</option>
                                    <option>(GMT-05:00) Eastern Time</option>
                                    <option>(GMT+00:00) UTC</option>
                                </select>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <h4 className="text-base font-semibold text-slate-700 mb-4 ml-1">{t('app_settings.maintenance')}</h4>
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                                <div className="flex items-center gap-3">
                                    <div className="relative inline-block w-12 mr-2 align-middle select-none">
                                        <input type="checkbox" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 transition-transform duration-200 ease-in-out" style={{ top: '2px', left: '2px' }} />
                                        <label className="toggle-label block overflow-hidden h-7 rounded-full bg-slate-300 cursor-pointer"></label>
                                    </div>
                                    <span className="text-sm text-slate-700">{t('app_settings.maintenance_desc')}</span>
                                </div>

                            </div>
                        </div>

                        {/* Offer Strip Settings */}
                        <div className="pt-6 border-t border-slate-100">
                            <h4 className="text-base font-semibold text-slate-700 mb-4 ml-1">Top Offer Strip (Header)</h4>
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800">Enable Static Offer Strip</span>
                                        <span className="text-[11px] text-slate-500">If enabled, this text will replace the scrolling "Banner Deals" at the top of the app.</span>
                                    </div>
                                    <div className="relative inline-block w-12 align-middle select-none">
                                        <input
                                            type="checkbox"
                                            name="isOfferStripEnabled"
                                            checked={settings.isOfferStripEnabled}
                                            onChange={handleInputChange}
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 transition-transform duration-200 ease-in-out" style={{ top: '2px', left: '2px' }}
                                        />
                                        <label className={`toggle-label block overflow-hidden h-7 rounded-full cursor-pointer transition-colors ${settings.isOfferStripEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}></label>
                                    </div>
                                </div>
                                <div className={`transition-opacity duration-300 ${!settings.isOfferStripEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <label className="text-xs font-medium ml-1 text-slate-500 mb-1.5 block">Offer Strip Custom Text</label>
                                    <input
                                        type="text"
                                        name="offerStripText"
                                        value={settings.offerStripText || ''}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Free Delivery on all orders above ₹500!"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* App-Open Festival / Announcement Popup */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-50 to-white px-6 md:px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-slate-800">App-Open Festival / Offer Popup</h3>
                                <p className="text-xs text-slate-500">Card modal displayed with a close (X) button when users open the app or website</p>
                            </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${settings.appPopup?.isEnabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                            {settings.appPopup?.isEnabled ? 'Active' : 'Disabled'}
                        </span>
                    </div>

                    <div className="p-6 md:p-8 space-y-6">
                        {/* Enable Toggle */}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-800">Enable Popup on App/Web Open</span>
                                <span className="text-[11px] text-slate-500">Shows the campaign once per browser until dismissed. Changing or publishing a campaign lets it appear again.</span>
                            </div>
                            <div className="relative inline-block w-12 align-middle select-none shrink-0">
                                <input
                                    type="checkbox"
                                    id="app-popup-enabled"
                                    aria-label="Enable app-open announcement"
                                    name="popupEnabled"
                                    checked={Boolean(settings.appPopup?.isEnabled)}
                                    onChange={(e) => handlePopupChange('isEnabled', e.target.checked)}
                                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-300 transition-transform duration-200 ease-in-out" style={{ top: '2px', left: '2px' }}
                                />
                                <label htmlFor="app-popup-enabled" className={`toggle-label block overflow-hidden h-7 rounded-full cursor-pointer transition-colors ${settings.appPopup?.isEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}></label>
                            </div>
                        </div>

                        {/* Responsive Inputs */}
                        <div className={`space-y-5 transition-opacity duration-300 ${!settings.appPopup?.isEnabled ? 'opacity-60' : ''}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                    <label className="text-xs font-semibold ml-1">Popup Headline / Title</label>
                                    <input
                                        type="text"
                                        value={settings.appPopup?.title || ''}
                                        onChange={(e) => handlePopupChange('title', e.target.value)}
                                        placeholder="e.g. Diwali Dhamaka Sale! 🪔"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                    <label className="text-xs font-semibold ml-1">CTA Button Label</label>
                                    <input
                                        type="text"
                                        value={settings.appPopup?.buttonText || ''}
                                        onChange={(e) => handlePopupChange('buttonText', e.target.value)}
                                        placeholder="e.g. Shop Festive Deals (Default: Shop Now)"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                <label className="text-xs font-semibold ml-1">Poster / Banner Image URL</label>
                                <input
                                    type="url"
                                    value={settings.appPopup?.imageUrl || ''}
                                    onChange={(e) => handlePopupChange('imageUrl', e.target.value)}
                                    placeholder="https://... (High quality festive banner / promotional poster)"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                />
                                <p className="text-[10px] text-slate-400 ml-1">Recommended size: 800x600 or 1200x800 for best mobile presentation. If empty, a festive gradient card will be shown.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                    <label className="text-xs font-semibold ml-1">Click Action Destination</label>
                                    <select
                                        value={settings.appPopup?.actionType || 'home'}
                                        onChange={(e) => handlePopupChange('actionType', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer"
                                    >
                                        <option value="home">Home Page (/)</option>
                                        <option value="category">Specific Category</option>
                                        <option value="product">Specific Product</option>
                                        <option value="custom">Custom Link / URL</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                    <label className="text-xs font-semibold ml-1">
                                        {settings.appPopup?.actionType === 'category'
                                            ? 'Category Slug (e.g. sweets-and-snacks)'
                                            : settings.appPopup?.actionType === 'product'
                                            ? 'Product ID'
                                            : settings.appPopup?.actionType === 'custom'
                                            ? 'Custom Route or URL (e.g. /lowest-prices)'
                                            : 'Destination (Disabled for Home)'}
                                    </label>
                                    <input
                                        type="text"
                                        disabled={settings.appPopup?.actionType === 'home' || !settings.appPopup?.actionType}
                                        value={settings.appPopup?.actionTarget || ''}
                                        onChange={(e) => handlePopupChange('actionTarget', e.target.value)}
                                        placeholder={
                                            settings.appPopup?.actionType === 'category' ? 'e.g. sweets-and-snacks' :
                                            settings.appPopup?.actionType === 'product' ? 'e.g. 64f1234abcd...' :
                                            settings.appPopup?.actionType === 'custom' ? 'e.g. /lowest-prices' : 'Opens Home Page'
                                        }
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all disabled:opacity-50 disabled:bg-slate-100"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 focus-within:text-blue-600 text-slate-500 transition-colors">
                                <label className="text-xs font-semibold ml-1">Offer Details / Message</label>
                                <textarea
                                    rows={3}
                                    value={settings.appPopup?.message || ''}
                                    onChange={(e) => handlePopupChange('message', e.target.value)}
                                    placeholder="e.g. Enjoy up to 50% discount on festive sweets, chocolates, and dry fruits. Limited time offer!"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all resize-y"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppSettings;

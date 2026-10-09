import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminSidebar from './components/AdminSidebar';
import { Bell, Menu, User, Settings, LogOut, ChevronDown, Languages, Check } from 'lucide-react';
import { adminSidebarMenu } from './data/sidebarMenu';
import { useAdminAuth } from './context/AdminAuthContext';
import FirebaseNotificationHandler from '../../common/components/FirebaseNotificationHandler';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import NewOrderPopup from './components/NewOrderPopup';
import OutOfStockToast from './components/OutOfStockToast';
import InventoryAlertDropdown from './components/InventoryAlertDropdown';

const AdminLayout = () => {
    const { t, i18n: i18nInstance } = useTranslation(['admin_sidebar', 'common']);
    const { adminLogout, adminUser, unreadCount, refreshUnreadCount } = useAdminAuth();
    const adminToken = adminUser?.token;
    const navigate = useNavigate();
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showLanguageMenu, setShowLanguageMenu] = useState(false);
    const location = useLocation();

    const handleLogout = () => {
        adminLogout();
        navigate('/admin/login');
    };

    const changeLanguage = (lng) => {
        i18nInstance.changeLanguage(lng);
        setShowLanguageMenu(false);
    };

    useEffect(() => {
        if (adminToken) {
            refreshUnreadCount();
        }
    }, [adminToken, location.pathname, refreshUnreadCount]);


    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <FirebaseNotificationHandler token={adminToken} role="admin" />
            <OutOfStockToast />
            {adminUser?.role === 'Admin' && <NewOrderPopup />}
            <AdminSidebar
                showMobile={showMobileSidebar}
                onClose={() => setShowMobileSidebar(false)}
            />

            <div className="lg:ml-[270px] min-h-screen flex flex-col">
                <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <button
                            className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg border border-slate-200"
                            onClick={() => setShowMobileSidebar(true)}
                        >
                            <Menu size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        {/* Language Selection */}
                        <div className="relative">
                            <button
                                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100"
                            >
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Languages size={18} />
                                </div>
                                <div className="hidden sm:block text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Locale</p>
                                    <p className="text-xs font-black text-slate-900 uppercase">{i18nInstance.language === 'en' ? 'English' : 'Hindi'}</p>
                                </div>
                                <ChevronDown size={14} className={`text-slate-300 transition-transform ${showLanguageMenu ? 'rotate-180' : ''}`} />
                            </button>
                            {showLanguageMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowLanguageMenu(false)}></div>
                                    <div className="absolute right-0 mt-3 w-40 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                        <button onClick={() => changeLanguage('en')} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest ${i18nInstance.language === 'en' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                                            English {i18nInstance.language === 'en' && <Check size={14} />}
                                        </button>
                                        <button onClick={() => changeLanguage('hi')} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest ${i18nInstance.language === 'hi' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                                            Hindi {i18nInstance.language === 'hi' && <Check size={14} />}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Critical Stock Alerts */}
                        <InventoryAlertDropdown />

                        {/* Notifications */}
                        <button 
                            onClick={() => navigate('/admin/notifications/inbox')}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all border border-transparent hover:border-slate-100 relative"
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
                            )}
                        </button>

                        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

                        {/* User Profile */}
                        <div className="relative">
                            <button
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                                    {(adminUser?.name?.charAt(0) || 'A').toUpperCase()}
                                </div>
                                <div className="text-left hidden md:block leading-tight">
                                    <p className="text-sm font-bold text-slate-900">{adminUser?.name || 'Admin'}</p>
                                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{adminUser?.role || 'Manager'}</p>
                                </div>
                                <ChevronDown size={12} className={`text-slate-400 hidden md:block ${showProfileMenu ? 'rotate-180 transition-transform' : 'transition-transform'}`} />
                            </button>

                            {showProfileMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50">
                                        <div className="px-3 py-2 border-b border-slate-50 mb-2">
                                            <p className="text-xs font-bold text-slate-900 truncate">{adminUser?.name}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{adminUser?.email}</p>
                                        </div>
                                        <button onClick={() => { navigate('/admin/settings/profile'); setShowProfileMenu(false); }} className="profile-menu-item">
                                            <User size={16} /> <span>Profile Settings</span>
                                        </button>
                                        <button onClick={() => { navigate('/admin/settings/app'); setShowProfileMenu(false); }} className="profile-menu-item">
                                            <Settings size={16} /> <span>App Preferences</span>
                                        </button>
                                        <div className="h-px bg-slate-100 my-1"></div>
                                        <button onClick={handleLogout} className="profile-menu-item text-red-600 hover:bg-red-50">
                                            <LogOut size={16} /> <span>Sign Out</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6 md:p-8">
                    <Outlet />
                </main>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .profile-menu-item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #475569; transition: all 0.2s; text-align: left; }
                .profile-menu-item:hover { background: #f8fafc; color: #0f172a; }
                
                @media (max-width: 1023px) { .hidden-mobile { display: none !important; } }
            `}} />
        </div>
    );
};

export default AdminLayout;

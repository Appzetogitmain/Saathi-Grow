import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { managerSidebarMenu } from '../data/managerSidebarMenu';
import { useStoreManagerAuth } from '../context/StoreManagerAuthContext';
import logo from '../../../assets/logo_fav.png';

const StoreManagerSidebar = ({ showMobile, onClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { managerUser, managerLogout } = useStoreManagerAuth();
    const [openSubmenus, setOpenSubmenus] = useState({});

    const hasAccess = (permissionCode) => {
        if (!managerUser) return false;
        if (managerUser.role === 'Admin') return true; // Super Admin bypasses
        if (!permissionCode || permissionCode === 'VIEW_DASHBOARD') return true;
        
        const permissions = Array.isArray(managerUser.permissions) ? managerUser.permissions : [];
        return permissions.includes(permissionCode);
    };

    const toggleSubmenu = (title) => {
        setOpenSubmenus((prev) => ({
            ...prev,
            [title]: !prev[title],
        }));
    };

    const handleLogout = () => {
        managerLogout();
        navigate('/store-manager/login');
    };

    const renderIcon = (iconName, isActive) => {
        const Icon = Icons[iconName] || Icons.Circle;
        return <Icon size={18} className={`transition-all ${isActive ? 'scale-110' : 'opacity-70'}`} />;
    };

    return (
        <>
            {/* Sidebar Overlay */}
            <div
                className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-all duration-300 ${showMobile ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            <aside
                className={`fixed top-0 left-0 h-full w-[240px] bg-[#0f172a] text-slate-400 z-50 transition-all duration-300 shadow-2xl
                ${showMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} border-r border-slate-800 flex flex-col`}
            >
                {/* Branding */}
                <div className="h-24 flex items-center px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center shrink-0">
                            <img src={logo} className="w-full h-full object-contain brightness-0 invert" alt="SaathiGro" />
                        </div>
                        <div className="font-black text-xl tracking-tighter text-white flex flex-col leading-none">
                            <span>saathi<span className="text-blue-500">Gro</span></span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-2 font-bold">Store Manager</span>
                        </div>
                    </div>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto px-4 space-y-8 py-6 custom-scrollbar">
                    <nav className="space-y-1">
                        {managerSidebarMenu.map((item, index) => {
                            if (!hasAccess(item.permission)) return null;
                            const isMenuOpen = openSubmenus[item.title];
                            const isPathActive = location.pathname === item.path || (item.submenu?.some(sub => location.pathname === sub.path));

                            return (
                                <div key={index} className="space-y-1">
                                    {item.submenu ? (
                                        <>
                                            <button
                                                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-bold transition-all
                                                ${isPathActive ? 'text-white' : 'hover:text-white hover:bg-slate-800/50'}`}
                                                onClick={() => toggleSubmenu(item.title)}
                                            >
                                                <div className={`${isPathActive ? 'text-blue-500' : 'text-slate-500'}`}>
                                                    {renderIcon(item.icon, isPathActive)}
                                                </div>
                                                <span className="flex-1 text-left">{item.title}</span>
                                                <Icons.ChevronDown
                                                    size={14}
                                                    className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : 'opacity-50'}`}
                                                />
                                            </button>

                                            <div className={`overflow-hidden transition-all duration-300 ${isMenuOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                                                <div className="space-y-1 ml-4 border-l border-slate-800 pl-4 py-1">
                                                    {item.submenu.map((sub, sIdx) => {
                                                        if (sub.permission && !hasAccess(sub.permission)) return null;
                                                        const isSubActive = location.pathname === sub.path;
                                                        return (
                                                            <NavLink
                                                                key={sIdx}
                                                                to={sub.path}
                                                                className={({ isActive }) =>
                                                                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-bold transition-all
                                                                    ${isActive ? 'text-blue-400 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300'}`
                                                                }
                                                                onClick={() => showMobile && onClose()}
                                                            >
                                                                <span className={`w-1 h-1 rounded-full ${isSubActive ? 'bg-blue-500 scale-125' : 'bg-slate-700'} transition-all`}></span>
                                                                {sub.title}
                                                            </NavLink>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <NavLink
                                            to={item.path}
                                            className={({ isActive }) =>
                                                `flex items-center gap-3.5 px-3 py-3 rounded-xl transition-all text-sm font-bold
                                                ${isActive
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                                    : 'hover:text-white hover:bg-slate-800/50'}`
                                            }
                                            onClick={() => showMobile && onClose()}
                                        >
                                            <div className="shrink-0">
                                                {renderIcon(item.icon, location.pathname === item.path)}
                                            </div>
                                            <span>{item.title}</span>
                                        </NavLink>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                </div>

                {/* Footer Section */}
                <div className="p-4 bg-slate-900/50 border-t border-slate-800 mt-auto">
                    <div className="flex items-center gap-3 mb-4 p-2 bg-slate-800/50 rounded-2xl border border-slate-800">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center font-black text-white text-xs border border-slate-700 shadow-inner uppercase overflow-hidden ring-2 ring-slate-800 ring-offset-2 ring-offset-[#0f172a]">
                            {managerUser?.profileImage ? (
                                <img src={managerUser.profileImage} alt="profile" className="w-full h-full object-cover" />
                            ) : (
                                (managerUser?.name || 'M').charAt(0)
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">{managerUser?.name || 'Manager'}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">{managerUser?.role || 'Staff'}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-3 text-xs font-bold text-slate-500 hover:text-white hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all uppercase tracking-widest border border-transparent hover:border-red-500/20 group"
                    >
                        <Icons.LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
            `}} />
        </>
    );
};

export default StoreManagerSidebar;

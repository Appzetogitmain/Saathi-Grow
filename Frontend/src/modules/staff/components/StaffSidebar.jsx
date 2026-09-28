import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { staffSidebarMenu } from '../data/staffSidebarMenu';
import { useStaffAuth } from '../context/StaffAuthContext';
import { hasStaffPermission } from '../utils/staffPermissions';
import logo from '../../../assets/logo_fav.png';

const StaffSidebar = ({ showMobile, onClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { staffUser, staffLogout } = useStaffAuth();
    const [openSubmenus, setOpenSubmenus] = useState({});

    const hasAccess = (item) => {
        if (!staffUser) return false;
        if (staffUser.role === 'Admin') return true;

        const permissions = Array.isArray(staffUser.permissions) ? staffUser.permissions : [];
        if (item.title === 'Manage Staff') {
            return staffUser.role === 'Store Manager' || hasStaffPermission(permissions, 'MANAGE_STAFF');
        }

        const permissionCode = item.permission;
        if (!permissionCode) return true;

        // Show parent menu if any submenu item is accessible
        if (item.submenu?.length) {
            return item.submenu.some((sub) => hasStaffPermission(permissions, sub.permission));
        }

        return hasStaffPermission(permissions, permissionCode);
    };

    useEffect(() => {
        staffSidebarMenu.forEach(item => {
            if (item.submenu?.some(sub => location.pathname === sub.path)) {
                setOpenSubmenus(prev => ({ ...prev, [item.title]: true }));
            }
        });
    }, [location.pathname]);

    const toggleSubmenu = (title) => {
        setOpenSubmenus((prev) => ({
            ...prev,
            [title]: !prev[title],
        }));
    };

    const handleLogout = () => {
        staffLogout();
        navigate('/staff/login');
    };

    const renderIcon = (iconName) => {
        const Icon = Icons[iconName] || Icons.Circle;
        return <Icon size={18} className="mr-3 shrink-0" />;
    };

    return (
        <>
            <div
                className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1045] lg:hidden transition-opacity duration-500 ${showMobile ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
                onClick={onClose}
            />

            <aside
                className={`fixed top-0 left-0 h-full w-[260px] bg-slate-950 text-slate-300 overflow-y-auto z-[1050] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] scrollbar-hide
                ${showMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} border-r border-white/5 shadow-2xl`}
            >
                {/* Branding */}
                <div className="h-[70px] flex items-center px-6 gap-3 mb-6 sticky top-0 bg-slate-950/80 backdrop-blur-md z-10 transition-all border-b border-transparent group-hover:bg-slate-950">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-2 shadow-lg shadow-white/5 border border-white/10 shrink-0">
                        <img src={logo} alt="SaathiGro" className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-white font-black text-sm uppercase tracking-tighter leading-none">saathi<span className="text-blue-500">Gro</span></h2>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Staff Portal</p>
                    </div>
                </div>

                <nav className="px-4 space-y-1 pb-10">
                    {staffSidebarMenu.map((item, index) => {
                        if (!hasAccess(item)) return null;

                        const hasChildActive = item.submenu?.some(sub => location.pathname === sub.path);
                        const isMenuOpen = openSubmenus[item.title];
                        const isActive = location.pathname === item.path;

                        return (
                            <div key={index} className="relative">
                                {item.submenu ? (
                                    <>
                                        <button
                                            className={`w-full flex items-center px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300 group
                                            ${hasChildActive ? 'bg-white/5 text-white' : 'hover:bg-white/5 hover:text-white text-slate-500'}`}
                                            onClick={() => toggleSubmenu(item.title)}
                                        >
                                            <div className={`${hasChildActive ? 'text-blue-500 scale-110' : 'text-slate-500 group-hover:text-blue-400 group-hover:scale-110'} transition-all duration-300`}>
                                                {renderIcon(item.icon)}
                                            </div>
                                            <span className="flex-grow text-[11px] font-black uppercase tracking-widest text-left">{item.title}</span>
                                            <Icons.ChevronDown
                                                size={14}
                                                className={`transition-transform duration-500 ${isMenuOpen ? 'rotate-180 text-blue-500' : 'text-slate-600'}`}
                                            />
                                        </button>

                                        <div className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isMenuOpen ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                                            <div className="bg-slate-900/40 rounded-2xl py-2 ml-4 border-l border-white/5">
                                                {item.submenu.map((subItem, subIndex) => {
                                                    if (!hasAccess(subItem)) return null;
                                                    const isSubActive = location.pathname === subItem.path;
                                                    return (
                                                        <NavLink
                                                            key={subIndex}
                                                            to={subItem.path}
                                                            className={() =>
                                                                `flex items-center pl-8 pr-4 py-2.5 my-0.5 mx-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 group/sub
                                                                ${isSubActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 translate-x-1' : 'text-slate-500 hover:text-white hover:bg-white/5'}`
                                                            }
                                                            onClick={() => showMobile && onClose()}
                                                        >
                                                            <div className={`w-1.5 h-1.5 rounded-full mr-3 transition-all ${isSubActive ? 'bg-white scale-125' : 'bg-slate-700 group-hover/sub:bg-blue-400'}`}></div>
                                                            {subItem.title}
                                                        </NavLink>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <NavLink
                                        to={item.path}
                                        className={() =>
                                            `flex items-center px-4 py-3 rounded-2xl transition-all duration-300 group
                                            ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`
                                        }
                                        onClick={() => showMobile && onClose()}
                                    >
                                        <div className={`${isActive ? 'text-white scale-110' : 'text-slate-500 group-hover:text-blue-400 group-hover:scale-110'} transition-all duration-300`}>
                                            {renderIcon(item.icon)}
                                        </div>
                                        <span className="text-[11px] font-black uppercase tracking-widest">{item.title}</span>
                                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]"></div>}
                                    </NavLink>
                                )}
                            </div>
                        );
                    })}
                </nav>

                <div className="sticky bottom-0 bg-slate-950 p-4 border-t border-white/5 mt-auto">
                    <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3 border border-white/5 hover:bg-white/[0.08] transition-colors group">
                        <div className="w-10 h-10 bg-slate-800 rounded-xl overflow-hidden border border-white/10 shrink-0">
                            {staffUser?.profileImage ? (
                                <img src={staffUser.profileImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center font-black text-slate-400 uppercase">
                                    {staffUser?.name?.charAt(0) || 'S'}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <p className="text-[11px] font-black text-white uppercase truncate">{staffUser?.name || 'Staff User'}</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter truncate">{staffUser?.role || 'Associate'}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                            title="Logout"
                        >
                            <Icons.LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>
            <style dangerouslySetInnerHTML={{
                __html: `
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </>
    );
};

export default StaffSidebar;

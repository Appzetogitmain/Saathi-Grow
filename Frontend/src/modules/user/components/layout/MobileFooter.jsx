import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, LayoutGrid, User, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../../../../config/apiConfig';

const MobileFooter = ({ setIsMenuOpen, isBottomSheetOpen }) => {
    const { user, token, showLoginModal } = useAuth();
    const location = useLocation();
    const [isKeyboardOpen, setIsKeyboardOpen] = React.useState(false);
    const [unreadCount, setUnreadCount] = React.useState(0);

    React.useEffect(() => {
        const fetchUnreadCount = async () => {
            const activeToken = token || user?.token || localStorage.getItem('saathigro_token');
            if (!activeToken) {
                setUnreadCount(0);
                return;
            }
            try {
                const res = await axios.get(`${API_BASE_URL}/notifications/unread-count`, {
                    headers: { Authorization: `Bearer ${activeToken}` }
                });
                if (res.data.success) {
                    setUnreadCount(res.data.count);
                }
            } catch (err) {
                console.error('Error fetching unread notifications in footer:', err);
            }
        };

        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);

        const handleFirebaseMessage = (e) => {
            setUnreadCount(prev => prev + 1);
        };

        const handleNotificationsRead = () => {
            setUnreadCount(0);
        };

        window.addEventListener('onFirebaseMessage', handleFirebaseMessage);
        window.addEventListener('onNotificationsRead', handleNotificationsRead);
        return () => {
            clearInterval(interval);
            window.removeEventListener('onFirebaseMessage', handleFirebaseMessage);
            window.removeEventListener('onNotificationsRead', handleNotificationsRead);
        };
    }, [token, user?.token, location.pathname]);

    React.useEffect(() => {
        let timeoutId;
        const MIN_KEYBOARD_HEIGHT = 150; // Minimum height to be considered a keyboard
        const initialHeight = window.innerHeight;

        const handleFocusIn = (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                clearTimeout(timeoutId);
                setIsKeyboardOpen(true);
            }
        };

        const handleFocusOut = () => {
            timeoutId = setTimeout(() => {
                setIsKeyboardOpen(false);
            }, 100);
        };

        const handleResize = () => {
            // Fallback for visual viewport or standard resize
            const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            // If height decreased significantly, keyboard is likely open
            if (initialHeight - currentHeight > MIN_KEYBOARD_HEIGHT) {
                clearTimeout(timeoutId);
                setIsKeyboardOpen(true);
            } else if (currentHeight >= initialHeight - MIN_KEYBOARD_HEIGHT) {
                // Height returned to normal
                setIsKeyboardOpen(false);
            }
        };

        window.addEventListener('focusin', handleFocusIn);
        window.addEventListener('focusout', handleFocusOut);
        window.addEventListener('resize', handleResize);
        
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
        }

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('focusin', handleFocusIn);
            window.removeEventListener('focusout', handleFocusOut);
            window.removeEventListener('resize', handleResize);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleResize);
            }
        };
    }, []);

    // Do not show on auth pages, checkout, or tracking
    const hideOnPages = ['/login', '/register', '/checkout', '/order-success'];
    const isTrackingPage = location.pathname.includes('/tracking');
    const isComplaintPage = location.pathname.includes('/complaint') || location.pathname.includes('/support/raise-ticket');
    const isReturnPage = location.pathname.includes('/return');
    const isCategoryPage = location.pathname.startsWith('/category');
    const isActuallyHidden = hideOnPages.includes(location.pathname) || isTrackingPage || isComplaintPage || isReturnPage || showLoginModal || (isKeyboardOpen && !isCategoryPage);

    const navItems = [
        { path: '/', label: 'Home', icon: Home },
        { path: '/orders', label: 'Order', icon: ShoppingBag },
        { path: '/category', label: 'Categories', icon: LayoutGrid },
        { path: '/profile', label: 'Profile', icon: User }
    ];

    return (
        <div className={`md:hidden fixed bottom-0 left-0 right-0 bg-[#f8f9fa] dark:bg-[#0a0a0a] border-t border-gray-100 dark:border-white/10 z-[999] px-6 py-3 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] pb-safe user-footer-safe transition-all duration-500 transform ${isBottomSheetOpen || isActuallyHidden ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
            <div className="flex items-center justify-between">
                {navItems.map((item, index) => (
                    item.action ? (
                        <button
                            key={index}
                            onClick={item.action}
                            className="flex flex-col items-center gap-1.5 text-[#0c831f] dark:text-[#0c831f] transition-all duration-300"
                        >
                            <item.icon
                                size={22}
                                strokeWidth={2}
                                className="transition-transform duration-300"
                            />
                            <span className="text-[9px] font-bold tracking-tight font-medium">
                                {item.label}
                            </span>
                        </button>
                    ) : (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `flex flex-col items-center gap-1.5 transition-all duration-300 ${isActive ? 'text-[#556b2f] dark:text-[#a3c26b]' : 'text-gray-400 dark:text-zinc-500'}`}
                        >
                            {({ isActive }) => (
                                <>
                                    <div className="relative">
                                        <item.icon
                                            size={22}
                                            strokeWidth={isActive ? 2.5 : 2}
                                            className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}
                                            fill={isActive && item.label !== 'Categories' && item.label !== 'Order' ? "currentColor" : "none"}
                                        />
                                        {item.label === 'Profile' && unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-black animate-pulse" />
                                        )}
                                    </div>
                                    <span className={`text-[9px] font-bold tracking-tight ${isActive ? 'font-black' : 'font-medium'}`}>
                                        {item.label}
                                    </span>
                                </>
                            )}
                        </NavLink>
                    )
                ))}
            </div>
        </div>
    );
};

export default MobileFooter;

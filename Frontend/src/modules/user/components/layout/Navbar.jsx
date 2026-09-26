import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { ShoppingCart, ShoppingBag, Search, User, LogOut, ChevronDown, MapPin, X, Menu, Settings, Bell, HelpCircle, Sun, Moon, Map, Mic, Globe, AlertCircle, Star, Flame, Clock, Zap } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { useSearch } from '../../context/SearchContext';
import { useTheme } from '../../context/ThemeContext';
import { useShop } from '../../context/ShopContext';
import { useStore } from '../../context/StoreContext';
import { searchProducts } from '../../api/shopApi';
import { ASSET_URLS } from '../../../../constants/assetUrls';
const logo = ASSET_URLS.logo;
import axios from 'axios';
import { API_BASE_URL } from '../../../../config/apiConfig';

const Navbar = ({ isMenuOpen, setIsMenuOpen, customTheme }) => {
  const { cartCount, cartTotal, toggleCart } = useCart();
  const { user, token, logout, protectAction } = useAuth();
  const { location, openLocationModal } = useLocation();
  const { searchQuery, setSearchQuery, isSearchOverlayOpen, setIsSearchOverlayOpen, setStartVoiceSearch } = useSearch();
  const { isDarkMode, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const { activeStore, isStoreOutOfRange, isStoreSelectorOpen, setIsStoreSelectorOpen } = useStore();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();

  const [isScrolled, setIsScrolled] = useState(false);

  // Notification count logic
  useEffect(() => {
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
          setUnreadCount(res.data.count); // API returns 'count' not 'unreadCount'
        }
      } catch (err) {
        console.error('Error fetching unread notifications:', err);
      }
    };

    fetchUnreadCount();
    // Poll every 30 seconds so bell badge updates when complaint resolved or notification arrives
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
  }, [token, user?.token, routerLocation.pathname]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        navigate(`/category?search=${transcript}`);
      };

      recognitionRef.current = recognition;
    }
  }, [navigate, setSearchQuery]);

  useEffect(() => {
    if (routerLocation.state?.openMenu) {
      setIsMenuOpen(true);
      window.history.replaceState({ ...routerLocation.state, openMenu: false }, '');
    }
  }, [routerLocation.state, setIsMenuOpen]);

  const renderLocation = () => {
    const fullAddress = (location.fullAddress || '').toString().trim();
    const addr = (location.address || '').toString().trim();
    const city = (location.city || '').toString().trim();

    // Prefer the most detailed address available.
    if (fullAddress) return fullAddress;

    if (addr) {
      if (city && !addr.toLowerCase().includes(city.toLowerCase())) {
        return `${addr}, ${city}`;
      }
      return addr;
    }

    // Keep label as fallback only (e.g. "Home", "Office").
    if (location.label) return location.label;
    return city || 'Select Location';
  };

  return (
    <div className="z-50 transition-colors duration-300" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* MOBILE LAYOUT (App Native Experience) */}
      <div className="md:hidden w-full relative z-[100] glass-header">
        {/* Row 1: Brand & Actions (Collapsible) */}
        <div
          className={`px-4 flex items-center justify-between relative transition-all duration-300 ease-in-out ${isScrolled ? 'h-0 opacity-0 pointer-events-none' : 'h-[52px] pt-3 pb-1'}`}
          style={{
            background: (!isDarkMode && customTheme) ? customTheme.bgColor : undefined,
            backgroundColor: isDarkMode ? '#000' : (customTheme?.bgColor || '#fff')
          }}
        >
          <Link to="/" className="active:scale-95 transition-transform">
            <img
              src={logo}
              alt="saathigro"
              onError={(e) => { e.target.onerror = null; e.target.src = ASSET_URLS.logoCloudinary; }}
              className="h-8 w-auto object-contain"
              style={isDarkMode ? { filter: 'brightness(0) invert(1)' } : {}}
            />
          </Link>

          <Link to="/notifications" className="relative p-2.5 bg-black/5 dark:bg-white/5 rounded-full shadow-sm border border-black/5 active:scale-90 transition-transform">
            <Bell size={18} className="text-[#0c831f]" strokeWidth={2.5} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white dark:border-black flex items-center justify-center text-[9px] text-white font-bold leading-none shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>

        {/* Row 1.5/2: Location (Collapsible) */}
        <div
          className={`px-4 flex items-center justify-between gap-4 transition-all duration-300 ease-in-out ${isScrolled ? 'h-0 opacity-0 py-0 pointer-events-none' : 'h-[36px] py-1 border-t border-black/5'}`}
          style={{ backgroundColor: isDarkMode ? '#000' : (customTheme?.bgColor || '#fff') }}
        >
          {/* Location Pillar */}
          <div
            onClick={openLocationModal}
            className={`flex-1 flex flex-col items-start cursor-pointer transition-all ${isStoreOutOfRange ? 'bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-100' : ''}`}
          >
            <div className="flex items-center gap-1 max-w-full">
              <span className={`text-[13px] font-medium tracking-tight truncate ${isStoreOutOfRange ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                {renderLocation()}
              </span>
              <ChevronDown size={11} strokeWidth={3} className={isStoreOutOfRange ? 'text-red-500' : 'text-[#0c831f]'} />
            </div>
          </div>
        </div>

        {/* Row 3: Search Bar (Always fixed via Parent) */}
        <div
          className={`pb-3 transition-all duration-300 ${isScrolled ? 'px-2 pt-2' : 'px-4 pt-1'} ${isDarkMode ? 'bg-black' : 'bg-white/80'} backdrop-blur-md border-b border-black/5 shadow-sm`}
          style={{ backgroundColor: isDarkMode ? '#000' : (customTheme?.bgColor ? `${customTheme.bgColor}cc` : '#ffffffcc') }}
        >
          <div
            onClick={() => setIsSearchOverlayOpen(true)}
            className={`flex items-center gap-3 px-4 py-2 bg-[#f3f9f4] dark:bg-[#151515] border border-black/5 rounded-xl shadow-inner active:scale-[0.98] transition-all`}
          >
            <Search className="text-[#0c831f]" size={18} strokeWidth={2.5} />
            <span className="text-[14px] font-medium text-gray-500 flex-1 truncate" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
              Search "dal", "milk" or "bread"...
            </span>
            <div
              onClick={(e) => {
                e.stopPropagation();
                setStartVoiceSearch(true);
                setIsSearchOverlayOpen(true);
              }}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer flex items-center justify-center"
            >
              <Mic className="text-[#0c831f]" size={18} strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP LAYOUT (Hidden on Mobile) */}
      <nav className={`hidden md:block border-b border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 relative ${isDarkMode ? 'bg-black' : 'bg-white/95 backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4">
            {/* Left Desktop */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex-shrink-0 flex items-center group">
                <img
                  src={logo}
                  alt="saathigro Logo"
                  className="h-10 w-auto object-contain hover:scale-105 transition-transform"
                  style={isDarkMode ? { filter: 'brightness(0) invert(1)' } : {}}
                />
              </Link>
              <div className={`flex items-center gap-4 px-4 py-1.5 rounded-xl border transition-all ${isStoreOutOfRange ? 'bg-red-50 border-red-200' : 'bg-gray-50 dark:bg-white/5 border-transparent'}`}>
                <div onClick={openLocationModal} className="flex flex-col items-start leading-none cursor-pointer h-10 justify-center">
                  <span className={`text-[10px] uppercase font-black tracking-widest flex items-center gap-1 ${isStoreOutOfRange ? 'text-red-500' : 'text-[#0c831f]'}`}>
                    Delivery at <ChevronDown size={10} strokeWidth={3} />
                  </span>
                  <span
                    className="text-[14px] font-medium text-gray-800 dark:text-white max-w-[320px] truncate block"
                    title={renderLocation()}
                  >
                    {renderLocation()}
                  </span>
                </div>
              </div>
            </div>

            {/* Center Desktop */}
            <div className="flex-1 max-w-xl relative mx-8 group">
              <div
                onClick={() => setIsSearchOverlayOpen(true)}
                className="w-full pl-11 pr-10 py-2.5 bg-gray-100 dark:bg-[#1c1c1c] rounded-full font-medium text-gray-400 shadow-inner cursor-pointer" style={{ fontSize: '14px', fontFamily: "'Inter', system-ui, sans-serif" }}
              >
                Search categories...
              </div>
              <Search className="absolute left-4 top-3 text-[#0c831f]" size={18} strokeWidth={2.5} />
            </div>

            {/* Right Desktop */}
            <div className="flex items-center gap-3">
              <button onClick={toggleTheme} className="p-2.5 text-gray-400 hover:text-[#0c831f] transition-colors">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div className="relative flex items-center justify-center">
                <Link to="/notifications" className="flex items-center justify-center w-[38px] h-[38px] bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-[#0c831f] rounded-full hover:bg-[#0c831f] hover:text-white transition-all">
                  <Bell size={18} />
                </Link>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white dark:border-black shadow-lg font-bold leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              {user ? (
                <Link to="/profile" className="flex items-center gap-2 px-1 py-1 pr-3 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-all">
                  <div className="w-8 h-8 rounded-full bg-[#f0fff4] flex items-center justify-center text-[#0c831f]">
                    {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full rounded-full" /> : <User size={16} />}
                  </div>
                  <span className="font-semibold text-gray-700 dark:text-gray-200" style={{ fontSize: '14px' }}>{user.name?.split(' ')[0]}</span>
                </Link>
              ) : (
                <Link to="/login" className="px-4 py-2 bg-gray-900 text-white font-black uppercase tracking-widest rounded-xl" style={{ fontSize: '11px' }}>Login</Link>
              )}
              <div className="relative flex items-center justify-center">
                <button onClick={() => protectAction(toggleCart)} className="flex items-center justify-center w-[38px] h-[38px] bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-[#0c831f] rounded-full hover:bg-[#0c831f] hover:text-white transition-all">
                  <ShoppingBag size={18} />
                </button>
                {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-[#0c831f] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-black shadow-lg">{cartCount}</span>}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;

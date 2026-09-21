import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './modules/user/context/AuthContext';
import { CartProvider } from './modules/user/context/CartContext';
import { LocationProvider } from './modules/user/context/LocationContext';
import { StoreProvider } from './modules/user/context/StoreContext';
import { SearchProvider } from './modules/user/context/SearchContext';
import { ThemeProvider } from './modules/user/context/ThemeContext';
import { ReturnRequestsProvider } from './common/contexts/ReturnRequestsContext';
import { WishlistProvider } from './modules/user/context/WishlistContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { motion } from 'framer-motion';

// Lazy Load Module Routes
const UserRoutes = lazy(() => import('./modules/user/routes/UserRoutes'));
const VendorRoutes = lazy(() => import('./modules/vendor/routes/VendorRoutes'));
const StaffRoutes = lazy(() => import('./modules/staff/routes/StaffRoutes'));
const AdminRoutes = lazy(() => import('./modules/admin/routes/AdminRoutes'));
const StoreManagerRoutes = lazy(() => import('./modules/store-manager/routes/StoreManagerRoutes'));
const DeliveryRoutes = lazy(() => import('./modules/delivery/routes/DeliveryRoutes'));



const GlobalLoading = () => (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center gap-10">
            <div className="relative w-24 h-24 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full animate-spin duration-[1.2s]">
                    <g transform="rotate(-90 50 50)">
                        <circle cx="50" cy="50" r="44" stroke="#1a1c24" strokeWidth="4.5" fill="transparent" />
                        <circle
                            cx="50" cy="50" r="44" stroke="#CCFF00" strokeWidth="4.5" fill="transparent"
                            strokeDasharray="276.46" strokeDashoffset={276.46 * 0.72} 
                        />
                    </g>
                </svg>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-[18px] font-black tracking-[0.45em] text-[#CCFF00] uppercase">SAATHIGRO</span>
                <div className="w-24 h-[4.5px] bg-[#f2f4f7] mt-5 rounded-full overflow-hidden relative">
                    <motion.div 
                        className="absolute inset-0 bg-[#CCFF00]"
                        animate={{ x: [-96, 96] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                    />
                </div>
            </div>
        </div>
    </div>
);



/**
 * Listens for postMessage from firebase-messaging-sw.js (NOTIFICATION_CLICK_NAVIGATE)
 * and Firebase compat SDK (notification-clicked), then uses React Router
 * to navigate without a full page reload. Must be inside <BrowserRouter>.
 */
function SWNavigationListener() {
    const navigate = useNavigate();
    useEffect(() => {
        const handleMessage = (event) => {
            const data = event.data || {};
            let targetUrl = null;

            if (data.type === 'NOTIFICATION_CLICK_NAVIGATE' && data.url) {
                targetUrl = data.url;
            } else if (data.messageType === 'notification-clicked' || data.isFirebaseMessaging) {
                const fcmData = data.data || {};
                const fcmOptions = data.fcmOptions || {};
                targetUrl = fcmOptions.link || fcmData.link || fcmData.url || fcmData.click_action;
                if (!targetUrl && fcmData.productId) targetUrl = `/product/${fcmData.productId}`;
                if (!targetUrl && fcmData.categorySlug) targetUrl = `/category/${fcmData.categorySlug}`;
                if (!targetUrl && fcmData.orderId) targetUrl = `/orders/${fcmData.orderId}`;
                if (!targetUrl && fcmData.customLink) targetUrl = fcmData.customLink;
            }

            if (targetUrl) {
                try {
                    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
                        const parsed = new URL(targetUrl);
                        if (parsed.origin === window.location.origin) {
                            navigate(parsed.pathname + parsed.search + parsed.hash);
                        } else {
                            window.location.href = targetUrl;
                        }
                    } else {
                        navigate(targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`);
                    }
                } catch (e) {
                    navigate(targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`);
                }
            }
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleMessage);
        }
        window.addEventListener('message', handleMessage);

        return () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handleMessage);
            }
            window.removeEventListener('message', handleMessage);
        };
    }, [navigate]);
    return null;
}

function App() {
    return (
        <BrowserRouter>
            <SWNavigationListener />
            <ThemeProvider>
                <AuthProvider>
                    <LocationProvider>
                        <StoreProvider>
                            <SearchProvider>
                                <CartProvider>
                                    <WishlistProvider>
                                        <ReturnRequestsProvider>
                                            <Suspense fallback={<GlobalLoading />}>
                                                <Routes>
                                                    <Route path="/staff/*" element={<StaffRoutes />} />
                                                    <Route path="/admin/*" element={<AdminRoutes />} />
                                                    <Route path="/store-manager/*" element={<StoreManagerRoutes />} />
                                                    <Route path="/vendor/*" element={<VendorRoutes />} />
                                                    <Route path="/delivery/*" element={<DeliveryRoutes />} />
                                                    <Route path="/*" element={<UserRoutes />} />
                                                </Routes>

                                                <ToastContainer
                                                    position="top-center"
                                                    autoClose={2000}
                                                    hideProgressBar={true}
                                                    newestOnTop={false}
                                                    closeOnClick
                                                    rtl={false}
                                                    pauseOnFocusLoss
                                                    draggable
                                                    pauseOnHover
                                                    theme="light"
                                                    toastClassName="premium-toast"
                                                    style={{ zIndex: 99999 }}
                                                />
                                            </Suspense>
                                        </ReturnRequestsProvider>
                                    </WishlistProvider>
                                </CartProvider>
                            </SearchProvider>
                        </StoreProvider>
                    </LocationProvider>
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}

export default App;


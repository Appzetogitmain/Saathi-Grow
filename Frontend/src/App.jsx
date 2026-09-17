import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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



function App() {
    return (
        <BrowserRouter>
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


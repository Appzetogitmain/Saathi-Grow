import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Zap, Sparkles, MapPin, ArrowRight, QrCode, Star } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { isWebView, isInstalledApp } from '../../../../utils/deviceUtils';
import { useShop } from '../../context/ShopContext';
import appLogo from '../../../../assets/logo_fav.png';

const MODAL_DISMISS_KEY = 'saathigro_app_modal_dismissed_at';
const PILL_DISMISS_KEY = 'saathigro_app_pill_dismissed_session';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function AppDownloadPrompt() {
  const { settings } = useShop();
  const location = useLocation();

  const [showModal, setShowModal] = useState(false);
  const [showPill, setShowPill] = useState(false);
  const [platform, setPlatform] = useState('desktop'); // 'android' | 'ios' | 'desktop'

  // Suppress during checkout, auth, order-success, or live tracking flows
  const isSuppressedRoute = useMemo(() => {
    const suppressedPrefixes = ['/checkout', '/login', '/register', '/logout-confirmation', '/order-success', '/download-app', '/app'];
    return suppressedPrefixes.some(path => location.pathname.startsWith(path)) || location.pathname.includes('/tracking');
  }, [location.pathname]);

  // If already running inside WebView / APK / PWA / Installed Web App, do not display prompt
  const isInApp = useMemo(() => {
    try {
      return isInstalledApp() || isWebView();
    } catch {
      return false;
    }
  }, []);

  // Configure store URLs directly from Admin Settings (with fallback to env/defaults)
  const playStoreUrl =
    settings?.playStoreUrl ||
    import.meta.env.VITE_PLAY_STORE_URL ||
    'https://play.google.com/store/apps/details?id=com.saathigro.app';

  const appStoreUrl =
    settings?.appStoreUrl ||
    import.meta.env.VITE_APP_STORE_URL ||
    '';

  // Primary URL based on detected mobile platform
  const primaryDownloadUrl = useMemo(() => {
    if (platform === 'ios' && appStoreUrl) return appStoreUrl;
    return playStoreUrl;
  }, [platform, playStoreUrl, appStoreUrl]);

  // Detect platform on mount
  useEffect(() => {
    if (isInApp) return;

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua) && !window.MSStream;

    if (isAndroid) {
      setPlatform('android');
    } else if (isIOS) {
      setPlatform('ios');
    } else {
      setPlatform('desktop');
    }

    // Check localStorage dismissal
    const dismissedAt = localStorage.getItem(MODAL_DISMISS_KEY);
    const now = Date.now();
    const isModalDismissed = dismissedAt && (now - parseInt(dismissedAt, 10)) < DISMISS_DURATION_MS;

    const isPillDismissed = sessionStorage.getItem(PILL_DISMISS_KEY) === 'true';

    if (!isModalDismissed) {
      // Show modal after small delay
      const timer = setTimeout(() => {
        setShowModal(true);
      }, 2400);
      return () => clearTimeout(timer);
    } else if (!isPillDismissed) {
      // Show floating pill directly
      setShowPill(true);
    }
  }, [isInApp]);

  // Listen for native PWA installation event to immediately dismiss and persist
  useEffect(() => {
    const handleAppInstalled = () => {
      try {
        localStorage.setItem('saathigro_app_installed', 'true');
      } catch {
        // ignore storage errors
      }
      setShowModal(false);
      setShowPill(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  if (isInApp || isSuppressedRoute) return null;

  const handleCloseModal = () => {
    setShowModal(false);
    localStorage.setItem(MODAL_DISMISS_KEY, Date.now().toString());

    // Check if session pill dismissed
    const isPillDismissed = sessionStorage.getItem(PILL_DISMISS_KEY) === 'true';
    if (!isPillDismissed) {
      setShowPill(true);
    }
  };

  const handleClosePill = (e) => {
    e.stopPropagation();
    setShowPill(false);
    sessionStorage.setItem(PILL_DISMISS_KEY, 'true');
  };

  const handlePillClick = () => {
    if (platform === 'desktop') {
      // On desktop, re-open modal to show QR codes
      setShowModal(true);
    } else {
      // On mobile, navigate straight to store
      window.open(primaryDownloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      {/* 1. WELCOME MODAL POPUP */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 border border-slate-100"
            >
              {/* Decorative top gradient header */}
              <div className="bg-gradient-to-r from-[#0c831f] via-[#0ea328] to-[#12b32d] px-6 pt-6 pb-8 text-white relative">
                {/* Close Button */}
                <button
                  onClick={handleCloseModal}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close popup"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center flex-shrink-0">
                    <img src={appLogo} alt="SaathiGro App" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/20 text-[#CCFF00] text-[11px] font-bold tracking-wide uppercase">
                      Official Mobile App
                    </div>
                    <h3 className="text-xl font-black text-white mt-1 leading-tight">
                      Experience SaathiGro on App
                    </h3>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 text-xs text-white/90">
                  <div className="flex items-center gap-1 bg-white/15 px-2 py-0.5 rounded-md font-medium">
                    <Star size={12} className="fill-[#CCFF00] text-[#CCFF00]" />
                    <span>4.8 Rating</span>
                  </div>
                  <div className="font-medium">• 10,000+ Downloads</div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {/* Value Props */}
                <div className="grid grid-cols-3 gap-2.5 mb-5 text-center">
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-2.5 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0c831f] flex items-center justify-center mb-1">
                      <Zap size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-800">10-Min</span>
                    <span className="text-[10px] text-slate-500">Fast Delivery</span>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-2.5 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0c831f] flex items-center justify-center mb-1">
                      <Sparkles size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-800">App Deals</span>
                    <span className="text-[10px] text-slate-500">Extra Savings</span>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-2.5 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0c831f] flex items-center justify-center mb-1">
                      <MapPin size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Live Track</span>
                    <span className="text-[10px] text-slate-500">Order Updates</span>
                  </div>
                </div>

                {/* Platform Specific Action */}
                {platform === 'desktop' ? (
                  /* DESKTOP VIEW: DIRECT QR CODES SIDE BY SIDE */
                  <div className="mb-5">
                    <p className="text-xs text-slate-500 font-medium text-center mb-3">
                      Scan with your phone camera to download directly:
                    </p>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {/* Android / Google Play Card */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-col items-center text-center">
                        <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100 flex items-center justify-center mb-2">
                          <QRCodeSVG
                            value={playStoreUrl}
                            size={100}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-800">For Android</span>
                        <a
                          href={playStoreUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 w-full py-1.5 px-2 rounded-xl bg-[#0c831f] hover:bg-[#0a701a] text-white text-[11px] font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Smartphone size={13} />
                          <span>Google Play</span>
                        </a>
                      </div>

                      {/* iOS / App Store Card */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-col items-center text-center">
                        {appStoreUrl ? (
                          <>
                            <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100 flex items-center justify-center mb-2">
                              <QRCodeSVG
                                value={appStoreUrl}
                                size={100}
                                level="M"
                                includeMargin={false}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-800">For iPhone</span>
                            <a
                              href={appStoreUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 w-full py-1.5 px-2 rounded-xl bg-slate-900 hover:bg-black text-white text-[11px] font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                            >
                              <Smartphone size={13} />
                              <span>App Store</span>
                            </a>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full py-6 text-slate-400">
                            <Smartphone size={24} className="mb-2 opacity-50" />
                            <span className="text-[11px] font-bold text-slate-700">For iPhone</span>
                            <span className="text-[10px] text-slate-400 mt-1 italic">Coming soon</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* MOBILE VIEW (ANDROID / IOS): 1-TAP DOWNLOAD BUTTON */
                  <div className="mb-5 space-y-2.5">
                    <a
                      href={primaryDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl bg-[#0c831f] hover:bg-[#0a701a] text-white text-sm font-bold shadow-lg shadow-emerald-700/25 transition-all active:scale-[0.98]"
                    >
                      <Smartphone size={18} />
                      <span>
                        {platform === 'ios'
                          ? (appStoreUrl ? 'Download on App Store' : 'Get SaathiGro App')
                          : 'Download on Google Play'}
                      </span>
                      <ArrowRight size={16} />
                    </a>

                    {platform === 'android' && appStoreUrl && (
                      <a
                        href={appStoreUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                      >
                        Also available on iOS App Store
                      </a>
                    )}
                  </div>
                )}

                {/* Secondary Dismiss Action */}
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-2.5 text-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  Continue browsing website
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. SUBTLE FLOATING PILL / MINI BANNER (Appears after modal dismissal) */}
      <AnimatePresence>
        {showPill && !showModal && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            className="fixed bottom-20 md:bottom-6 right-3 md:right-6 z-[9990] flex items-center"
          >
            <div
              onClick={handlePillClick}
              role="button"
              tabIndex={0}
              className="group flex items-center gap-2.5 pl-2.5 pr-3 py-2 bg-slate-900/95 backdrop-blur-md text-white rounded-full shadow-[0_8px_25px_rgba(0,0,0,0.25)] border border-white/15 hover:bg-black transition-all cursor-pointer select-none"
            >
              {/* App Icon */}
              <div className="w-7 h-7 rounded-full bg-white p-1 flex items-center justify-center flex-shrink-0 shadow-sm">
                <img src={appLogo} alt="SaathiGro" className="w-full h-full object-contain" />
              </div>

              {/* Text */}
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-black tracking-tight text-white leading-tight">
                  SaathiGro App
                </span>
                <span className="text-[9px] text-slate-300 font-medium leading-tight">
                  {platform === 'desktop' ? 'Scan & Install' : '10-Min Delivery'}
                </span>
              </div>

              {/* CTA Badge */}
              <div className="ml-1 bg-[#0c831f] hover:bg-[#0a701a] text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 transition">
                {platform === 'desktop' ? (
                  <>
                    <QrCode size={11} /> Scan
                  </>
                ) : (
                  <>
                    <span>Install</span>
                    <ArrowRight size={10} />
                  </>
                )}
              </div>

              {/* Close mini button */}
              <button
                type="button"
                onClick={handleClosePill}
                aria-label="Dismiss app prompt"
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition ml-0.5 cursor-pointer"
              >
                <X size={11} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

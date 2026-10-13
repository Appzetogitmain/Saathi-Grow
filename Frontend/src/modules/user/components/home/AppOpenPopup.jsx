import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ArrowRight, Tag } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import usePromotionSlot from '../../hooks/usePromotionSlot';
import { popupVersion, isPopupDismissed, dismissPopup, isPopupSuppressedPath, resolvePopupDestination } from '../../utils/appPopupUtils';
import { trapDialogFocus } from '../../utils/dialogFocus';

/**
 * AppOpenPopup
 * Displays a promotional / festival announcement popup card when a customer
 * visits the website or opens the app, featuring a prominent top-corner close (X) button.
 */
const AppOpenPopup = ({ blocked = false }) => {
    const { settings, settingsRefreshing } = useShop();
    const location = useLocation();
    const navigate = useNavigate();
    const dialogRef = useRef(null);
    const [openVersion, setOpenVersion] = useState(null);
    const [failedImage, setFailedImage] = useState('');
    const [dismissedVersion, setDismissedVersion] = useState(null);
    const popupData = settings?.appPopup;
    const currentVersion = popupVersion(popupData);
    const isSuppressedRoute = isPopupSuppressedPath(location.pathname);
    const eligible = Boolean(popupData?.isEnabled && !blocked && !settingsRefreshing && !isSuppressedRoute);

    useEffect(() => {
        if (!eligible || dismissedVersion === currentVersion || isPopupDismissed(currentVersion)) {
            setOpenVersion(null);
            return;
        }
        const timer = setTimeout(() => setOpenVersion(currentVersion), 900);
        return () => clearTimeout(timer);
    }, [eligible, currentVersion, dismissedVersion]);

    const visible = usePromotionSlot('announcement', eligible && openVersion === currentVersion && !isPopupDismissed(currentVersion));
    const handleClose = useCallback(() => {
        dismissPopup(currentVersion);
        setDismissedVersion(currentVersion);
        setOpenVersion(null);
    }, [currentVersion]);

    useEffect(() => {
        if (visible) return trapDialogFocus(dialogRef.current, handleClose);
    }, [visible, handleClose]);

    const destination = resolvePopupDestination(popupData);
    const handleAction = () => {
        if (!destination) return;
        handleClose();
        if (destination.external) window.location.assign(destination.to);
        else navigate(destination.to);
    };
    // Remove the outgoing promotion immediately before another dialog claims the slot.
    if (!popupData || !visible) return null;
    const imageKey = `${currentVersion}:${popupData.imageUrl || ''}`;
    const hasImage = Boolean(popupData.imageUrl && popupData.imageUrl.trim() && failedImage !== imageKey);
    // Strictly require a poster / banner image - no fallback gradient banner
    if (!hasImage) return null;
    const title = popupData.title?.trim() || 'Special Festival Offer! 🎉';
    const message = popupData.message?.trim() || 'Discover special discounts and festive savings available for a limited time!';
    const buttonText = popupData.buttonText?.trim() || 'Shop Now';

    return (
        <AnimatePresence>
            {visible && (
                <div 
                    className="fixed inset-0 z-[99998] flex items-center justify-center p-3 sm:p-4"
                    data-promotion-dialog="announcement"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="app-open-popup-title"
                >
                    {/* Backdrop Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
                    />

                    {/* Popup Card */}
                    <motion.div
                        ref={dialogRef}
                        tabIndex={-1}
                        initial={{ opacity: 0, scale: 0.88, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                        className="relative flex flex-col min-w-0 w-full max-w-[390px] sm:max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden z-10 border border-slate-100 dark:border-zinc-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Top-Right Corner Close Button (X) */}
                        <button
                            type="button"
                            onClick={handleClose}
                            className="absolute top-3 right-3 z-30 w-11 h-11 shrink-0 rounded-full bg-black/50 hover:bg-black/75 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg backdrop-blur-md"
                            aria-label="Close offer popup"
                        >
                            <X size={17} strokeWidth={2.5} />
                        </button>

                        <div className="min-h-0 overflow-y-auto overscroll-contain [overflow-wrap:anywhere]">
                        {/* Poster Banner Image */}
                        <div className="relative w-full max-h-56 sm:max-h-64 overflow-hidden bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                            <img
                                src={popupData.imageUrl}
                                alt={title}
                                onError={() => setFailedImage(imageKey)}
                                className="w-full h-full max-h-56 sm:max-h-64 object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
                        </div>

                        {/* Card Body */}
                        <div className="p-5 sm:p-6 text-left">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#0c831f] dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-2.5">
                                    <Tag size={11} />
                                    <span>Special Offer</span>
                                </div>

                            <h3 
                                    id="app-open-popup-title"
                                    className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight tracking-tight mb-2"
                                >
                                    {title}
                                </h3>

                            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed font-normal mb-5">
                                {message}
                            </p>

                            {/* Action Button */}
                            <button
                                type="button"
                                onClick={handleAction}
                                disabled={!destination}
                                className="w-full min-h-11 min-w-0 py-3.5 px-4 rounded-2xl bg-[#0c831f] hover:bg-[#0a701a] active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                            >
                                <span className="min-w-0">{buttonText}</span>
                                <ArrowRight size={16} className="shrink-0" />
                            </button>

                            {/* Subtle Dismiss text */}
                            <button
                                type="button"
                                onClick={handleClose}
                                className="w-full py-2.5 mt-1 text-center text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition cursor-pointer"
                            >
                                Continue browsing
                            </button>
                        </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AppOpenPopup;

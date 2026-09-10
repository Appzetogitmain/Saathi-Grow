import React, { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { useLocation } from '../../context/LocationContext';

const LocationPermissionModal = () => {
    const { 
        showPermissionModal, 
        setShowPermissionModal, 
        setShowLocationModal, 
        reverseGeocode, 
        updateLocation 
    } = useLocation();
    
    const [detecting, setDetecting] = useState(false);

    React.useEffect(() => {
        if (showPermissionModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showPermissionModal]);

    if (!showPermissionModal) return null;

    const handleAllowAccess = () => {
        setDetecting(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const coords = [longitude, latitude];
                    const geoData = await reverseGeocode(coords);

                    updateLocation({
                        address: geoData?.street || geoData?.address || 'Detected Location',
                        city: geoData?.city || 'Indore',
                        coordinates: coords,
                        fullAddress: geoData?.address
                    });
                    setDetecting(false);
                    setShowPermissionModal(false);
                },
                (error) => {
                    console.error('Location detection error:', error);
                    alert('Unable to retrieve your location. Please enter it manually.');
                    setDetecting(false);
                    // Fallback to manual selection modal
                    setShowPermissionModal(false);
                    setShowLocationModal(true);
                },
                {
                    enableHighAccuracy: false,
                    timeout: 5000,
                    maximumAge: 300000
                }
            );
        } else {
            alert('Geolocation is not supported by this browser.');
            setDetecting(false);
            setShowPermissionModal(false);
            setShowLocationModal(true);
        }
    };

    const handleEnterManually = () => {
        try {
            sessionStorage.setItem('saathigro_location_permission_prompted', 'true');
        } catch {}
        setShowPermissionModal(false);
        setShowLocationModal(true);
    };

    const handleClose = () => {
        try {
            sessionStorage.setItem('saathigro_location_permission_prompted', 'true');
        } catch {}
        setShowPermissionModal(false);
    };

    return (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4 font-sans">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
                onClick={handleClose}
            />

            {/* Modal Card */}
            <div className="bg-white dark:bg-[#111111] w-full max-w-[360px] relative z-10 overflow-hidden rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/5 p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Close"
                >
                    <X size={20} className="text-gray-400 dark:text-gray-500" />
                </button>

                {/* Pin Circle Icon */}
                <div className="w-20 h-20 bg-[#0c831f]/10 dark:bg-[#0c831f]/20 rounded-full flex items-center justify-center mb-6">
                    <div className="w-14 h-14 bg-[#0c831f]/20 dark:bg-[#0c831f]/30 rounded-full flex items-center justify-center">
                        <MapPin size={28} className="text-[#0c831f]" />
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">
                    Location Access Required
                </h3>

                {/* Description */}
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8 px-2">
                    We need your location to show you products available near you and enable delivery services. Location access is required to continue.
                </p>

                {/* Action Buttons */}
                <div className="w-full space-y-3">
                    <button
                        onClick={handleAllowAccess}
                        disabled={detecting}
                        className="w-full py-4 bg-[#0c831f] hover:bg-[#0b721b] disabled:opacity-50 text-white font-extrabold rounded-2xl transition-all shadow-md active:scale-[0.98] text-sm"
                    >
                        {detecting ? 'Detecting Location...' : 'Allow Location Access'}
                    </button>
                    
                    <button
                        onClick={handleEnterManually}
                        className="w-full py-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200 font-extrabold rounded-2xl transition-all active:scale-[0.98] text-sm"
                    >
                        Enter Location Manually
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LocationPermissionModal;

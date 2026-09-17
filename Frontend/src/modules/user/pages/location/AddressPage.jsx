import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, Search, ArrowLeft, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLocation } from '../../context/LocationContext';

const AddressPage = () => {
    const { updateLocation } = useLocation();
    const navigate = useNavigate();
    const [searchText, setSearchText] = useState('');
    const [detecting, setDetecting] = useState(false);

    const handleDetectLocation = () => {
        setDetecting(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // Mock Reverse Geocoding
                    setTimeout(() => {
                        updateLocation({
                            address: '123, Green Street, Civil Lines',
                            city: 'Current Location'
                        });
                        setDetecting(false);
                        navigate('/'); // Navigate to home after selection
                    }, 1000);
                },
                (error) => {
                    setDetecting(false);
                    if (error.code === 1) {
                        toast.error("Please turn on Location and allow access in your browser settings.", { autoClose: 5000 });
                    } else if (error.code === 2) {
                        toast.error("📍 Device GPS is turned off. Please swipe down your notification panel, turn ON Location, and tap Detect again.", { autoClose: 6000 });
                    } else if (error.code === 3) {
                        toast.warn("Location request timed out. Please select your city below.", { autoClose: 5000 });
                    } else {
                        toast.error("Unable to retrieve your location. Please select your city manually.", { autoClose: 5000 });
                    }
                },
                {
                    enableHighAccuracy: false,
                    timeout: 15000,
                    maximumAge: 300000
                }
            );
        } else {
            toast.error('Geolocation is not supported by this browser.');
            setDetecting(false);
        }
    };

    const handleManualSelect = (city) => {
        updateLocation({
            address: `${city}, India`,
            city: city
        });
        navigate('/'); // Navigate to home after selection
    };

    const suggestions = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Udaipur', 'Lucknow', 'Indore', 'Bhopal', 'Chandigarh', 'Noida', 'Gurgaon'].filter(
        city => city.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div className="relative min-h-[calc(100vh-64px)] flex items-start md:items-center justify-center py-4 md:py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#e8f5e9] to-[#ffffff] dark:from-[#141414] dark:to-[#141414] md:bg-none md:bg-white md:dark:bg-black transition-colors duration-300">
            {/* Background Image with Blur - Hidden on mobile */}
            <div
                className="absolute inset-0 bg-cover bg-center z-0 hidden md:block"
                style={{
                    backgroundImage: 'url("https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2574&auto=format&fit=crop")',
                    filter: 'blur(8px)',
                    transform: 'scale(1.1)'
                }}
            ></div>
            {/* Overlay - Hidden on mobile */}
            <div className="absolute inset-0 bg-black/30 z-0 hidden md:block"></div>

            <div className="w-full max-w-2xl bg-white dark:bg-black rounded-lg shadow-xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300 my-auto p-6 md:p-8 border border-transparent dark:border-white/10">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white">Change Location</h1>
                    <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                        <X size={24} className="text-gray-600" />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 relative">
                    {/* Detect Button */}
                    <button
                        onClick={handleDetectLocation}
                        className="w-full md:w-auto bg-[#0c831f] text-white px-6 py-3.5 rounded-md font-bold text-sm md:text-base hover:bg-[#0a6b19] transition-colors whitespace-nowrap z-10 shadow-sm flex items-center justify-center gap-2"
                    >
                        {detecting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Detecting...
                            </>
                        ) : (
                            "Detect my location"
                        )}
                    </button>

                    {/* OR Divider */}
                    <div className="flex items-center justify-center gap-3 w-full md:w-auto">
                        <div className="h-[1px] bg-gray-200 dark:bg-gray-800 w-full md:w-6 hidden md:block"></div>
                        <div className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-center text-[10px] md:text-xs text-gray-400 font-bold shrink-0 z-10">
                            OR
                        </div>
                        <div className="h-[1px] bg-gray-200 dark:bg-gray-800 w-full md:w-6 hidden md:block"></div>
                    </div>

                    {/* Search Input */}
                    <div className="relative flex-1 w-full">
                        <input
                            type="text"
                            placeholder="search delivery location"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            className="w-full pl-4 pr-10 py-3.5 border border-gray-200 dark:border-gray-800 rounded-md focus:outline-none focus:border-[#0c831f] bg-white dark:bg-gray-900 text-gray-700 dark:text-white placeholder-gray-400 transition-colors shadow-sm"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />

                        {/* Search Results Dropdown (Minimal) */}
                        {searchText.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-lg rounded-b-md mt-1 z-50 max-h-60 overflow-y-auto">
                                {suggestions.map((city) => (
                                    <button
                                        key={city}
                                        onClick={() => handleManualSelect(city)}
                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-gray-700 dark:text-white border-b border-gray-50 dark:border-gray-800 last:border-0 flex items-center gap-2"
                                    >
                                        <MapPin size={14} className="text-gray-400" />
                                        {city}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddressPage;

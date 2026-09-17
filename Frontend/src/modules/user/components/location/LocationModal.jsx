import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Navigation as NavIcon, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLocation } from '../../context/LocationContext';

const LocationModal = () => {
    const { showLocationModal, closeLocationModal, updateLocation, savedAddresses, mapLoaded, reverseGeocode } = useLocation();
    const [searchText, setSearchText] = useState('');
    const [detecting, setDetecting] = useState(false);
    const [placeSuggestions, setPlaceSuggestions] = useState([]);
    const [locationError, setLocationError] = useState(null);
    const searchRef = useRef(null);
    const autocompleteServiceRef = useRef(null);
    const placesServiceRef = useRef(null);
    const placesServiceNodeRef = useRef(null);

    useEffect(() => {
        if (showLocationModal) {
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.style.height = '100vh';
        } else {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.height = '';
        }
        return () => {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.height = '';
        };
    }, [showLocationModal]);

    // Google Places service init (for custom dropdown suggestions under input)
    useEffect(() => {
        if (mapLoaded && showLocationModal && window.google && !autocompleteServiceRef.current) {
            autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
            if (placesServiceNodeRef.current) {
                placesServiceRef.current = new window.google.maps.places.PlacesService(placesServiceNodeRef.current);
            }
        }
    }, [mapLoaded, showLocationModal]);

    useEffect(() => {
        if (!showLocationModal) {
            setSearchText('');
            setPlaceSuggestions([]);
            return;
        }
        if (!autocompleteServiceRef.current || !searchText.trim() || searchText.trim().length < 2) {
            setPlaceSuggestions([]);
            return;
        }

        const debounceId = setTimeout(() => {
            autocompleteServiceRef.current.getPlacePredictions(
                {
                    input: searchText.trim(),
                    componentRestrictions: { country: 'in' },
                    types: ['geocode']
                },
                (predictions, status) => {
                    if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
                        setPlaceSuggestions([]);
                        return;
                    }
                    setPlaceSuggestions(predictions.slice(0, 6));
                }
            );
        }, 250);

        return () => clearTimeout(debounceId);
    }, [searchText, showLocationModal]);

    const applyGooglePlace = (place) => {
        if (!place?.geometry?.location) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        let street = "";
        let area = "";
        let city = "";
        let state = "";
        let zipCode = "";

        (place.address_components || []).forEach(component => {
            if (component.types.includes("sublocality_level_1") || component.types.includes("route")) {
                street = component.long_name;
            }
            if (component.types.includes("sublocality_level_2") || component.types.includes("neighborhood")) {
                area = component.long_name;
            }
            if (component.types.includes("locality")) {
                city = component.long_name;
            }
            if (component.types.includes("administrative_area_level_1")) {
                state = component.long_name;
            }
            if (component.types.includes("postal_code")) {
                zipCode = component.long_name;
            }
        });

        const displayArea = street || area || place.address_components?.[0]?.long_name || "Unknown Area";

        updateLocation({
            address: displayArea,
            city: city || "Indore",
            state,
            zipCode,
            coordinates: [lng, lat],
            fullAddress: place.formatted_address
        }, true);
    };

    const handlePlaceSuggestionSelect = (prediction) => {
        if (!placesServiceRef.current || !prediction?.place_id) return;
        placesServiceRef.current.getDetails(
            {
                placeId: prediction.place_id,
                fields: ["address_components", "geometry", "formatted_address"]
            },
            (place, status) => {
                if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) return;
                setSearchText(prediction.description || '');
                setPlaceSuggestions([]);
                applyGooglePlace(place);
            }
        );
    };

    const handleDetectLocation = () => {
        setDetecting(true);
        setLocationError(null);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const coords = [longitude, latitude];
                    const geoData = await reverseGeocode(coords);

                    updateLocation({
                        address: geoData?.street || geoData?.address || 'Detected Location',
                        city: geoData?.city || 'Indore',
                        state: geoData?.state || '',
                        zipCode: geoData?.zipCode || '',
                        coordinates: coords,
                        fullAddress: geoData?.address
                    }, true);
                    setDetecting(false);
                    setLocationError(null);
                },
                (error) => {
                    setDetecting(false);
                    if (error.code === 1) {
                        setLocationError({
                            title: "Location Permission Blocked",
                            message: "Please turn on Location and allow access in your browser settings, then tap Detect again."
                        });
                        toast.error("Please turn on Location and allow access in your browser settings.", {
                            autoClose: 5000
                        });
                    } else if (error.code === 2 || error.code === 3) {
                        // On Android, when device GPS toggle is OFF, Chrome returns either code 2 or times out (code 3)
                        setLocationError({
                            title: "Device GPS is Turned Off",
                            message: "Please swipe down your notification panel, turn ON Location (GPS), and tap Detect again."
                        });
                        toast.error("📍 Device GPS is turned off. Please swipe down your notification panel, turn ON Location, and tap Detect again.", {
                            autoClose: 6000
                        });
                    } else {
                        setLocationError({
                            title: "Location Detection Failed",
                            message: "Unable to retrieve your location. Please enter your address or select a city below."
                        });
                        toast.error("Unable to retrieve your location. Please select your city or search address.", {
                            autoClose: 5000
                        });
                    }
                },
                {
                    enableHighAccuracy: false,
                    timeout: 8000,
                    maximumAge: 300000
                }
            );
        } else {
            setLocationError({
                title: "Geolocation Not Supported",
                message: "Geolocation is not supported by this browser. Please select your city manually."
            });
            toast.error('Geolocation is not supported by this browser. Please select your city manually.', {
                autoClose: 5000
            });
            setDetecting(false);
        }
    };

    if (!showLocationModal) return null;

    const handleAddressSelect = (addr) => {
        updateLocation({
            address: addr.address,
            city: addr.city,
            state: addr.state || '',
            zipCode: addr.zipCode || '',
            fullAddress: addr.fullAddress || [addr.address, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', '),
            coordinates: addr.coordinates,
            label: addr.type || addr.label
        }, true);
    };

    const cityCoords = {
        'Indore': [75.8577, 22.7196],
        'Bhopal': [77.4126, 23.2599],
        'Udaipur': [73.7125, 24.5854],
        'Mumbai': [72.8777, 19.0760],
        'Delhi': [77.1025, 28.7041],
        'Bangalore': [77.5946, 12.9716]
    };

    const handleManualSelect = (city) => {
        updateLocation({
            address: city,
            city: city,
            state: '',
            zipCode: '',
            fullAddress: `${city}, India`,
            coordinates: cityCoords[city] || [75.8577, 22.7196] // Default to Indore if unknown
        }, true);
    };

    const suggestions = Object.keys(cityCoords).concat(['Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Chandigarh', 'Noida', 'Gurgaon']).filter(
        city => city.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[10010] flex justify-center items-start pt-[6vh] px-4 pointer-events-none font-sans">
            {/* Darkened Overlay */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto transition-opacity"
                onClick={closeLocationModal}
            ></div>

            {/* Modal Box */}
            <div className="bg-gradient-to-br from-[#f0faf1] to-[#ffffff] dark:from-[#111111] dark:to-[#080808] w-full max-w-[500px] relative z-10 overflow-hidden animate-in slide-in-from-top-3 fade-in duration-300 pointer-events-auto rounded-[32px] shadow-[0_30px_70px_rgba(0,0,0,0.25)] border border-white/50 dark:border-white/5 p-5 md:p-6 h-auto max-h-[82vh] flex flex-col">
                <button
                    onClick={closeLocationModal}
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors md:flex"
                >
                    <X size={20} className="text-gray-400" />
                </button>

                <div className="flex flex-col h-full min-h-0">
                    <h2 className="text-base md:text-lg font-black text-gray-900 dark:text-gray-100 mb-6 text-left tracking-tight">Select Delivery Location</h2>

                    {/* blinkit-style input row */}
                    <div className="flex flex-col md:flex-row items-center gap-4 mb-4 shrink-0 overflow-visible">
                        {/* Detect Location Button */}
                        <button
                            onClick={handleDetectLocation}
                            className="w-full md:w-auto bg-[#0c831f] text-white px-6 py-2.5 rounded-lg hover:bg-[#0b721b] transition-colors font-bold text-xs md:text-sm h-[42px] whitespace-nowrap shadow-sm active:scale-95 flex items-center justify-center gap-2"
                        >
                            <NavIcon size={14} fill="currentColor" />
                            {detecting ? 'Detecting...' : 'Detect location'}
                        </button>

                        {/* Search Input */}
                        <div className="w-full md:flex-1 relative overflow-visible z-40">
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search delivery location"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="w-full h-[42px] pl-9 pr-4 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#0c831f] dark:focus:border-[#0c831f] transition-colors placeholder:text-gray-400 text-gray-700 dark:text-white text-xs md:text-sm bg-gray-50 dark:bg-white/5"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <Search size={14} />
                            </div>
                            {searchText.trim().length >= 2 && (
                                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white dark:bg-[#101010] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                                    {placeSuggestions.length > 0 ? (
                                        placeSuggestions.map((prediction) => (
                                            <button
                                                key={prediction.place_id}
                                                onClick={() => handlePlaceSuggestionSelect(prediction)}
                                                className="w-full text-left px-3 py-2.5 hover:bg-green-50 dark:hover:bg-[#0c831f]/10 border-b border-gray-100 dark:border-white/5 last:border-b-0"
                                            >
                                                <span className="text-xs md:text-sm text-gray-700 dark:text-gray-200 font-medium line-clamp-2">
                                                    {prediction.description}
                                                </span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                                            No suggestions found. Try a broader keyword.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* In-Modal Alert Banner if GPS is off or detection failed */}
                    {locationError && (
                        <div className="mb-4 p-3.5 rounded-2xl bg-amber-50/95 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in slide-in-from-top-1 shrink-0">
                            <span className="text-lg leading-none shrink-0 mt-0.5">📍</span>
                            <div className="flex-1 text-left">
                                <p className="font-bold text-xs text-amber-950 dark:text-amber-100">{locationError.title}</p>
                                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">{locationError.message}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLocationError(null)}
                                className="text-amber-600 hover:text-amber-800 dark:text-amber-400 p-1 shrink-0 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    )}

                    {/* Content Area - Scrollable */}
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 scrollbar-hide">
                        {/* Saved Addresses Section */}
                        {searchText.length === 0 && savedAddresses.length > 0 && (
                            <div className="mb-6">
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Saved Addresses</p>
                                <div className="space-y-3">
                                    {savedAddresses.map((addr) => (
                                        <button
                                            key={addr.id}
                                            onClick={() => handleAddressSelect(addr)}
                                            className="w-full text-left bg-gray-50 hover:bg-green-50 dark:bg-white/5 dark:hover:bg-[#0c831f]/10 p-3 rounded-xl border border-transparent hover:border-green-200 dark:hover:border-[#0c831f]/20 transition-all group active:scale-[0.99]"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-center text-[#0c831f] shrink-0">
                                                    <MapPin size={14} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-xs font-black text-gray-900 dark:text-gray-100">{addr.type}</span>
                                                        {addr.isDefault && (
                                                            <span className="px-1.5 py-0.5 bg-[#0c831f]/10 text-[#0c831f] text-[8px] font-bold rounded">DEFAULT</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-snug">
                                                        {addr.fullAddress || [addr.address, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* City Suggestions */}
                        {(searchText.length > 0 || savedAddresses.length === 0) && (
                            <div>
                                {searchText.length === 0 && (
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Popular Cities</p>
                                )}
                                {suggestions.map((city) => (
                                    <button
                                        key={city}
                                        onClick={() => handleManualSelect(city)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors group border-b border-gray-50 dark:border-white/5 last:border-0"
                                    >
                                        <MapPin size={14} className="text-gray-400 group-hover:text-[#0c831f]" />
                                        <span className="text-xs md:text-sm text-gray-700 dark:text-gray-200 font-medium">{city}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div ref={placesServiceNodeRef} className="hidden" />
        </div>
    );
};

export default LocationModal;

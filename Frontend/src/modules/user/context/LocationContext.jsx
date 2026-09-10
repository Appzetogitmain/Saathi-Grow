import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import * as addressApi from '../api/userAddressApi';
import * as shopApi from '../api/shopApi';

const LocationContext = createContext();

export const useLocation = () => useContext(LocationContext);

export const LocationProvider = ({ children }) => {
    const mapAddressFromApi = (addr) => {
        const cityPart = addr.city || '';
        const statePart = addr.state || '';
        const zipPart = addr.zipCode || '';
        const fullAddress = [addr.street, cityPart, statePart, zipPart].filter(Boolean).join(', ');
        return {
            id: addr._id,
            type: addr.label,
            name: addr.name,
            phone: addr.phone,
            address: addr.street || addr.city,
            city: cityPart,
            state: statePart,
            zipCode: zipPart,
            fullAddress: fullAddress || addr.street || addr.city || '',
            isDefault: addr.isDefault,
            coordinates: addr.location?.coordinates || null
        };
    };

    const [location, setLocation] = useState(() => {
        const saved = localStorage.getItem('saathigro_location');
        return saved ? JSON.parse(saved) : { address: 'Select Location', city: '', coordinates: null };
    });

    const [savedAddresses, setSavedAddresses] = useState(() => {
        const saved = localStorage.getItem('saathigro_saved_addresses');
        return saved ? JSON.parse(saved) : [];
    });

    const { token, user } = useAuth();
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);

    // Optimized Google Maps Loader
    useEffect(() => {
        import('../../../utils/googleMapsLoader').then(({ loadGoogleMaps }) => {
            loadGoogleMaps()
                .then(() => setMapLoaded(true))
                .catch(err => console.error("Google Maps load failed", err));
        });
    }, []);

    const reverseGeocode = async (coords) => {
        // 1. High Performance Backend Priority
        try {
            const backendResult = await shopApi.getReverseGeocode(coords[1], coords[0]);
            if (backendResult) return backendResult;
        } catch (error) {
            console.warn("Backend reverse geocode unavailable, trying SDK...", error.message);
        }

        // 2. Fallback to SDK - Wait for it to be ready if it's not yet
        if (!window.google && !mapLoaded) {
            console.log("Waiting for Google Maps SDK to load for reverse geocoding...");
            // Wait up to 3 seconds for it to load
            await new Promise((resolve) => {
                const check = setInterval(() => {
                    if (window.google) {
                        clearInterval(check);
                        resolve();
                    }
                }, 200);
                setTimeout(() => { clearInterval(check); resolve(); }, 3000);
            });
        }

        if (!window.google) {
            console.error("Google Maps SDK not available for fallback");
            return null;
        }

        const geocoder = new window.google.maps.Geocoder();
        const latlng = { lat: coords[1], lng: coords[0] };

        return new Promise((resolve) => {
            geocoder.geocode({ location: latlng }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const place = results[0];
                    let street = "";
                    let area = "";
                    let city = "";
                    let state = "";
                    let zipCode = "";
                    
                    place.address_components.forEach(component => {
                        const types = component.types;
                        if (types.includes("sublocality_level_1") || types.includes("route")) {
                            street = component.long_name;
                        }
                        if (types.includes("sublocality_level_2") || types.includes("neighborhood")) {
                            area = component.long_name;
                        }
                        if (types.includes("locality")) {
                            city = component.long_name;
                        }
                        if (types.includes("administrative_area_level_1")) {
                            state = component.long_name;
                        }
                        if (types.includes("postal_code")) {
                            zipCode = component.long_name;
                        }
                    });

                    const displayArea = street || area || place.address_components[0]?.long_name || "Unknown Area";

                    resolve({
                        address: place.formatted_address,
                        street: displayArea,
                        city: city || "Indore",
                        state,
                        zipCode
                    });
                } else {
                    console.warn(`SDK Geocoder failed: ${status}`);
                    resolve(null);
                }
            });
        });
    };

    // Fetch user addresses from the backend on mount or when token changes
    useEffect(() => {
        const fetchRemoteAddresses = async () => {
            if (token) {
                try {
                    const data = await addressApi.getAddresses(token);
                    // Map backend data format to LocationContext unified format if needed
                    // The backend stores: { _id, label, street, city, state, zipCode, isDefault }
                    const formatted = data.map(mapAddressFromApi);
                    setSavedAddresses(formatted);

                    // If user has saved addresses and current location is unselected, auto-select default address
                    const hasLocation = Boolean(
                        location?.coordinates?.length === 2 ||
                        (location?.address && location.address !== 'Select Location')
                    );
                    if (!hasLocation && formatted.length > 0) {
                        const defaultAddr = formatted.find(a => a.isDefault) || formatted[0];
                        if (defaultAddr) {
                            setLocation({
                                address: defaultAddr.address || defaultAddr.fullAddress || 'Saved Address',
                                city: defaultAddr.city || 'Indore',
                                state: defaultAddr.state || '',
                                zipCode: defaultAddr.zipCode || '',
                                coordinates: defaultAddr.coordinates,
                                fullAddress: defaultAddr.fullAddress
                            });
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch user addresses:', err);
                }
            }
        };
        fetchRemoteAddresses();
    }, [token]);

    useEffect(() => {
        localStorage.setItem('saathigro_location', JSON.stringify(location));
    }, [location]);

    useEffect(() => {
        // Only save to localStorage offline sync if user is NOT logged in.
        // Or keep sync active, since it safely overwrites on remote fetch
        if (!token) {
            localStorage.setItem('saathigro_saved_addresses', JSON.stringify(savedAddresses));
        }
    }, [savedAddresses, token]);

    // Automatically prompt for location permission modal ONLY if user has no location set yet
    useEffect(() => {
        if (token) {
            const hasLocation = Boolean(
                location?.coordinates?.length === 2 ||
                (location?.address && location.address !== 'Select Location')
            );
            const alreadyPrompted = sessionStorage.getItem('saathigro_location_permission_prompted');

            // If user already gave location or selected an address, NEVER prompt on reopen
            if (!hasLocation && !alreadyPrompted) {
                sessionStorage.setItem('saathigro_location_permission_prompted', 'true');
                const timer = setTimeout(() => {
                    setShowPermissionModal(true);
                }, 600);
                return () => clearTimeout(timer);
            }
        }
    }, [token, location]);

    const updateLocation = (newLocation) => {
        setLocation(newLocation);
        setShowLocationModal(false);
    };
    const addAddress = async (address) => {
        if (token) {
            try {
                // Translate frontend format { type, address, city } to backend { label, street, city }
                const resData = await addressApi.addAddress(token, {
                    label: address.type,
                    name: address.name,
                    phone: address.phone,
                    street: address.address,
                    city: address.city,
                    state: address.state || '',
                    zipCode: address.zipCode || '',
                    isDefault: address.isDefault !== undefined ? address.isDefault : savedAddresses.length === 0,
                    location: address.coordinates ? { type: 'Point', coordinates: address.coordinates } : undefined
                });
                // Refresh
                const formatted = resData.map(mapAddressFromApi);
                setSavedAddresses(formatted);
            } catch (error) {
                console.error("Add remote address failed", error);
            }
        } else {
            const newAddress = { ...address, id: Date.now(), isDefault: address.isDefault !== undefined ? address.isDefault : savedAddresses.length === 0 };
            if (newAddress.isDefault) {
                setSavedAddresses([...savedAddresses.map(a => ({ ...a, isDefault: false })), newAddress]);
            } else {
                setSavedAddresses([...savedAddresses, newAddress]);
            }
        }
    };

    const editAddress = async (id, updatedAddress) => {
        if (token) {
            try {
                const resData = await addressApi.updateAddress(token, id, {
                    label: updatedAddress.type,
                    name: updatedAddress.name,
                    phone: updatedAddress.phone,
                    street: updatedAddress.address,
                    city: updatedAddress.city,
                    state: updatedAddress.state || '',
                    zipCode: updatedAddress.zipCode || '',
                    isDefault: updatedAddress.isDefault,
                    location: updatedAddress.coordinates ? { type: 'Point', coordinates: updatedAddress.coordinates } : undefined
                });
                const formatted = resData.map(mapAddressFromApi);
                setSavedAddresses(formatted);
            } catch (error) {
                console.error("Update remote address failed", error);
            }
        } else {
            setSavedAddresses(savedAddresses.map(addr => {
                if (String(addr.id) === String(id)) return { ...addr, ...updatedAddress };
                if (updatedAddress.isDefault) return { ...addr, isDefault: false };
                return addr;
            }));
        }
    };

    const deleteAddress = async (id) => {
        if (token) {
            try {
                const resData = await addressApi.deleteAddress(token, id);
                const formatted = resData.addresses.map(mapAddressFromApi);
                setSavedAddresses(formatted);
            } catch (error) {
                console.error("Delete remote address failed", error);
            }
        } else {
            setSavedAddresses(savedAddresses.filter(addr => String(addr.id) !== String(id)));
        }
    };

    const openLocationModal = () => setShowLocationModal(true);
    const closeLocationModal = () => setShowLocationModal(false);

    const detectLocation = () => {
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
                    });
                },
                (error) => {
                    console.error('Location detection error:', error);
                    // Fallback to manual location modal if user denies or error occurs
                    setShowLocationModal(true);
                },
                {
                    enableHighAccuracy: false,
                    timeout: 5000,
                    maximumAge: 300000
                }
            );
        } else {
            setShowLocationModal(true);
        }
    };

    return (
        <LocationContext.Provider
            value={{
                location,
                updateLocation,
                savedAddresses,
                addAddress,
                editAddress,
                deleteAddress,
                showLocationModal,
                setShowLocationModal,
                showPermissionModal,
                setShowPermissionModal,
                openLocationModal,
                closeLocationModal,
                detectLocation,
                mapLoaded,
                reverseGeocode
            }}
        >
            {children}
        </LocationContext.Provider>
    );
};


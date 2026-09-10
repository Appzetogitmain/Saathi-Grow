import { useEffect, useRef } from 'react';
import useDeliveryStore from '../store/deliveryStore';
import { db } from '../../../config/firebase';
import { ref, update } from 'firebase/database';

const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const Math_PI = Math.PI;
    const dLon = (lon2 - lon1) * Math_PI / 180;
    lat1 = lat1 * Math_PI / 180;
    lat2 = lat2 * Math_PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let bearing = Math.atan2(y, x) * 180 / Math_PI;
    return (bearing + 360) % 360;
};

const useLocationTracking = (token, isActive, activeOrderId = null) => {
    const updateLocation = useDeliveryStore((state) => state.updateLocation);
    const setLocalLocation = useDeliveryStore((state) => state.setLocalLocation);
    const profile = useDeliveryStore((state) => state.profile);
    const prevLocation = useRef(null);
    const lastDbUpdateTime = useRef(0);
    const wakeLock = useRef(null);

    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLock.current = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.error(`Wake Lock error: ${err.name}, ${err.message}`);
        }
    };

    const releaseWakeLock = () => {
        if (wakeLock.current !== null) {
            wakeLock.current.release()
                .then(() => {
                    wakeLock.current = null;
                })
                .catch(console.error);
        }
    };

    useEffect(() => {
        let watchId;

        if (isActive) {
            if (activeOrderId) requestWakeLock();

            if (navigator.geolocation) {
                watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        const { longitude, latitude, speed, accuracy } = position.coords;
                        const now = Date.now();
                        let heading = position.coords.heading || 0;
                        if (prevLocation.current && (!heading || heading === 0)) {
                            heading = calculateBearing(prevLocation.current.latitude, prevLocation.current.longitude, latitude, longitude);
                        }
                        prevLocation.current = { latitude, longitude };

                        // 1. UPDATE THE UI LOCALLY AND INSTANTLY (Smooth Animations for Rider View)
                        setLocalLocation(longitude, latitude);

                        // Keep admin tracking current without sending every GPS sample.
                        if (now - lastDbUpdateTime.current > 30000) {
                            updateLocation(token, longitude, latitude, accuracy, heading);
                            lastDbUpdateTime.current = now;
                        }

                        if (activeOrderId || profile?._id) {
                            // Firebase RTDB handles high-frequency updates efficiently
                            const trackingPayload = {
                                location: { lat: latitude, lng: longitude },
                                heading: heading,
                                speed: speed || 0,
                                updatedAt: now
                            };
                            if (activeOrderId) {
                                update(ref(db, `active_trackings/${activeOrderId}`), trackingPayload).catch(e => console.error("Firebase update failed", e));
                            }
                            if (profile?._id && profile._id !== activeOrderId) {
                                update(ref(db, `active_trackings/${profile._id}`), trackingPayload).catch(() => {});
                            }
                        }
                    },
                    (error) => {
                        console.error('Location tracking error:', error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 0
                    }
                );
            }
        } else {
            releaseWakeLock();
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
            releaseWakeLock();
        };
    }, [isActive, token, updateLocation, setLocalLocation, activeOrderId, profile?._id]);
};

export default useLocationTracking;

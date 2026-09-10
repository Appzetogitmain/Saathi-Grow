import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GoogleMap, MarkerF, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { db } from '../../../../config/firebase';
import { ref, onValue, off } from 'firebase/database';
import polylineUtil from '@mapbox/polyline';
import { Phone, ChevronLeft, Star, Clock, AlertCircle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import * as orderApi from '../../api/orderApi';
import { useAuth } from '../../context/AuthContext';
import { ASSET_URLS } from '../../../../constants/assetUrls';

const bikeImg = ASSET_URLS.bike;
const houseImg = ASSET_URLS.house;
const storeImg = ASSET_URLS.store;

const GOOGLE_MAPS_LIBRARIES = ['places', 'visualization'];

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  gestureHandling: 'greedy',
  styles: [
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e9e9e9' }, { lightness: 17 }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }, { lightness: 20 }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }, { lightness: 17 }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }, { lightness: 18 }] },
    { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#ffffff' }, { lightness: 16 }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }, { lightness: 21 }] },
  ],
};

// ── Distance helper ────────────────────────────────────────────────────────────
function getDistanceInMeters(a, b) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const NON_TRACKABLE = ['delivered', 'cancelled', 'returned', 'return_requested', 'return_pickup_scheduled', 'return_picked_up'];

const LastUpdatedBadge = ({ lastUpdated, waitingForRider }) => {
  const [secondsAgo, setSecondsAgo] = useState(null);

  useEffect(() => {
    if (!lastUpdated) return;
    setSecondsAgo(Math.round((Date.now() - lastUpdated.getTime()) / 1000));
    const interval = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  if (waitingForRider) {
    return (
      <div className="mt-1 bg-white/90 dark:bg-[#2d2d2d]/90 backdrop-blur-sm text-gray-900 dark:text-white px-3 py-1 rounded-full flex items-center gap-1.5 text-[9px] font-bold whitespace-nowrap shadow-sm border border-gray-100 dark:border-transparent">
        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        Waiting for rider...
      </div>
    );
  }

  if (secondsAgo === null) return null;

  return (
    <div className="mt-1 bg-white/80 dark:bg-[#2d2d2d]/80 backdrop-blur-sm text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full flex items-center gap-1 text-[9px] font-bold whitespace-nowrap shadow-sm border border-gray-100 dark:border-transparent">
      <Clock size={9} />
      {secondsAgo < 5 ? 'Live' : `Updated ${secondsAgo}s ago`}
    </div>
  );
};

const OrderTrackingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [isExpanded, setIsExpanded] = useState(true);
  const [sheetHeight, setSheetHeight] = useState(window.innerHeight * 0.75);
  useEffect(() => {
    const handleResize = () => {
      setSheetHeight(window.innerHeight * 0.75);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dragRange = sheetHeight - 110;
  const dragControls = useDragControls();

  // ── Load Google Maps via useJsApiLoader (same as delivery LiveTracking.jsx) ──
  const { isLoaded: mapLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const mapCenterRef = useRef(null);
  const mapZoomRef = useRef(15);

  const [map, setMap] = useState(null);
  const onMapLoad = useCallback((m) => {
    setMap(m);
    if (m) {
      mapCenterRef.current = { lat: m.getCenter().lat(), lng: m.getCenter().lng() };
      mapZoomRef.current = m.getZoom();
    }
  }, []);
  const onMapUnmount = useCallback(() => setMap(null), []);

  const handleCenterChanged = useCallback(() => {
    if (map) {
      const c = map.getCenter();
      mapCenterRef.current = { lat: c.lat(), lng: c.lng() };
    }
  }, [map]);

  const handleZoomChanged = useCallback(() => {
    if (map) {
      mapZoomRef.current = map.getZoom();
      setIsFOLLOWING(false);
    }
  }, [map]);

  const sheetRef = useRef(null);

  useEffect(() => {
    const sheetEl = sheetRef.current;
    if (!sheetEl) return;

    let touchStartY = 0;

    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      const scrollableEl = sheetEl.querySelector('.overflow-y-auto');
      const currentY = e.touches[0].clientY;
      const diffY = currentY - touchStartY;

      // If touch target is inside the scrollable container
      if (scrollableEl && (e.target === scrollableEl || scrollableEl.contains(e.target))) {
        // If at the top and pulling down, prevent browser default (pull-to-refresh)
        if (scrollableEl.scrollTop <= 0 && diffY > 0) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
        return; // Allow standard native scrolling in other directions
      }

      // For any touchmove on non-scrollable parts of the bottom sheet (drag handle, header, collapsed card):
      // Prevent browser default pull-to-refresh reload gesture
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    sheetEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    sheetEl.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      sheetEl.removeEventListener('touchstart', handleTouchStart);
      sheetEl.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  const [order, setOrder] = useState(null);
  const [riderLocation, setRiderLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trackingError, setTrackingError] = useState(null);
  const [waitingForRider, setWaitingForRider] = useState(true);
  const [isFOLLOWING, setIsFOLLOWING] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [trimmedRoute, setTrimmedRoute] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [etaMins, setEtaMins] = useState(null);
  const [distanceText, setDistanceText] = useState(null);

  const storeMarkerIcon = useMemo(() => {
    if (!mapLoaded || !window.google) return null;
    return {
      url: storeImg,
      scaledSize: new window.google.maps.Size(40, 40),
      anchor: new window.google.maps.Point(20, 20),
    };
  }, [mapLoaded]);

  const destMarkerIcon = useMemo(() => {
    if (!mapLoaded || !window.google) return null;
    return {
      url: houseImg,
      scaledSize: new window.google.maps.Size(40, 40),
      anchor: new window.google.maps.Point(20, 20),
    };
  }, [mapLoaded]);

  const riderMarkerIcon = useMemo(() => {
    if (!mapLoaded || !window.google) return null;
    return {
      url: bikeImg,
      scaledSize: new window.google.maps.Size(45, 45),
      anchor: new window.google.maps.Point(22.5, 22.5),
    };
  }, [mapLoaded]);

  // Billing-safe route throttle
  const lastRouteFetchRef = useRef({ time: 0, location: null });

  function shouldFetchRoute(loc) {
    const now = Date.now();
    const last = lastRouteFetchRef.current;
    if (!last.location) return true;
    return getDistanceInMeters(last.location, loc) > 150 || now - last.time > 90_000;
  }

  // Helper to fallback to MongoDB last-known driver coordinates
  const syncDriverFallbackLocation = (data) => {
    if (data?.deliveryPartnerId?.currentLocation?.coordinates?.length === 2) {
      const [lng, lat] = data.deliveryPartnerId.currentLocation.coordinates;
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
        setRiderLocation((prev) => prev || { lat, lng });
        setWaitingForRider(false);
        if (data.deliveryPartnerId.locationUpdatedAt) {
          setLastUpdated((prev) => prev || new Date(data.deliveryPartnerId.locationUpdatedAt));
        }
      }
    }
  };

  // ── Load order & Realtime Polling ──────────────────────────────────────────
  useEffect(() => {
    if (!token || !id) return;
    
    const load = async () => {
      try {
        const data = await orderApi.fetchOrderDetails(token, id);
        setOrder(data);
        syncDriverFallbackLocation(data);
        if (NON_TRACKABLE.includes(data.status)) {
          setTrackingError(`Tracking not available for status: ${data.status.replace(/_/g, ' ')}`);
        }
      } catch (err) {
        setTrackingError('Failed to load order details.');
      } finally {
        setIsLoading(false);
      }
    };

    load();

    // Realtime polling every 5 seconds for order status updates
    const intervalId = setInterval(async () => {
      try {
        const data = await orderApi.fetchOrderDetails(token, id);
        syncDriverFallbackLocation(data);
        setOrder((prev) => {
          if (!prev) return data;
          // Trigger state update only if status, deliveryRunId, or deliveryPartnerId changed
          if (
            prev.status !== data.status ||
            prev.deliveryRunId !== data.deliveryRunId ||
            prev.deliveryPartnerId?._id !== data.deliveryPartnerId?._id
          ) {
            if (NON_TRACKABLE.includes(data.status)) {
              clearInterval(intervalId);
              setTrackingError(`Tracking not available for status: ${data.status.replace(/_/g, ' ')}`);
            }
            return data;
          }
          return prev;
        });
      } catch (err) {
        console.warn('[TRACKING] Realtime poll update failed:', err);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [token, id]);

  // ── Firebase real-time listener ────────────────────────────────────────────
  useEffect(() => {
    if (!order) return;
    const trackingIds = [
      order.deliveryRunId?.toString?.() || order.deliveryRunId,
      order.deliveryPartnerId?._id?.toString?.() || order.deliveryPartnerId?._id,
      order._id?.toString?.() || order._id
    ].filter(Boolean);

    const uniqueTrackingIds = [...new Set(trackingIds)];
    if (!uniqueTrackingIds.length) return;

    const unsubscribers = uniqueTrackingIds.map((tid) => {
      const trackingRef = ref(db, `active_trackings/${tid}`);
      return onValue(trackingRef, (snapshot) => {
        const data = snapshot.val();
        if (!data?.location) return;
        const { lat, lng } = data.location;
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;
        setRiderLocation({ lat, lng });
        setWaitingForRider(false);
        setLastUpdated(data.updatedAt ? new Date(data.updatedAt) : new Date());
      });
    });

    return () => {
      uniqueTrackingIds.forEach((tid, idx) => {
        const trackingRef = ref(db, `active_trackings/${tid}`);
        off(trackingRef, 'value', unsubscribers[idx]);
      });
    };
  }, [order?.deliveryRunId, order?.deliveryPartnerId?._id, order?._id]);

  // ── Route fetch (billing-safe throttle) ───────────────────────────────────
  useEffect(() => {
    if (!riderLocation || !id || !token) return;
    if (!shouldFetchRoute(riderLocation)) return;

    lastRouteFetchRef.current = { time: Date.now(), location: riderLocation };

    const fetchRoute = async () => {
      try {
        const response = await orderApi.fetchOrderRoute(token, id, riderLocation.lat, riderLocation.lng);
        if (response.routes?.length > 0) {
          const route = response.routes[0];
          if (route.overview_polyline?.points) {
            const decoded = polylineUtil.decode(route.overview_polyline.points).map((p) => ({ lat: p[0], lng: p[1] }));
            setRouteCoordinates(decoded);
          }
          const leg = route.legs?.[0];
          if (leg) {
            setDistanceText(leg.distance?.text || null);
            setEtaMins(leg.duration?.value ? Math.max(1, Math.round(leg.duration.value / 60)) : null);
          }
        }
      } catch (err) {
        console.warn('[TRACKING] Route fetch failed:', err.message);
      }
    };
    fetchRoute();
  }, [riderLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trim route to rider position ───────────────────────────────────────────
  useEffect(() => {
    if (!routeCoordinates.length || !riderLocation) { setTrimmedRoute([]); return; }

    const dest = routeCoordinates[routeCoordinates.length - 1];
    if (getDistanceInMeters(riderLocation, dest) < 150) { setTrimmedRoute([]); return; }

    let minDist = Infinity, closestIdx = 0;
    routeCoordinates.forEach((p, i) => {
      const d = getDistanceInMeters(riderLocation, p);
      if (d < minDist) { minDist = d; closestIdx = i; }
    });

    const newPath = [riderLocation, ...routeCoordinates.slice(closestIdx)];
    setTrimmedRoute(newPath);

    if (map && isFOLLOWING && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      newPath.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { top: 120, bottom: 260, left: 50, right: 50 });
    }
  }, [riderLocation, routeCoordinates, map, isFOLLOWING]);

  // ── Pan to rider when following ────────────────────────────────────────────
  useEffect(() => {
    if (map && riderLocation && isFOLLOWING && !trimmedRoute.length) {
      map.panTo(riderLocation);
    }
  }, [riderLocation, map, isFOLLOWING, trimmedRoute.length]);



  // ── Derived map center ─────────────────────────────────────────────────────
  const destCoords = order?.shippingAddress?.location?.coordinates;
  const destPos = useMemo(() => destCoords ? { lat: destCoords[1], lng: destCoords[0] } : null, [destCoords]);
  const storeCoords = order?.branchId?.address?.location?.coordinates || order?.vendor?.address?.location?.coordinates;
  const storePos = useMemo(() => storeCoords ? { lat: storeCoords[1], lng: storeCoords[0] } : null, [storeCoords]);
  const mapCenter = riderLocation || destPos || { lat: 22.7196, lng: 75.8577 };

  const handleRecenter = useCallback(() => {
    setIsFOLLOWING(true);
    if (map && riderLocation) { map.panTo(riderLocation); map.setZoom(15); }
  }, [map, riderLocation]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading || (!mapLoaded && !loadError)) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 text-gray-900 dark:text-white">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Syncing Pilot...</p>
      </div>
    );
  }

  // ── Delivered Success ──────────────────────────────────────────────────────
  if (order?.status === 'delivered') {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-emerald-500 text-white px-8 text-center">
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-black mb-2 uppercase tracking-tight">Delivered!</h1>
        <p className="text-emerald-100 font-bold mb-8 text-lg">Your order has been successfully delivered.</p>
        <button onClick={() => navigate('/')} className="px-8 py-4 bg-white text-emerald-600 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-xl active:scale-95">
          Back to Home Page
        </button>
      </div>
    );
  }

  // ── Cancelled State ────────────────────────────────────────────────────────
  if (order?.status === 'cancelled') {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-red-500 text-white px-8 text-center">
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6">
          <XCircle size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-black mb-2 uppercase tracking-tight">Cancelled</h1>
        <p className="text-red-100 font-bold mb-8 text-lg">Your order has been cancelled.</p>
        <button onClick={() => navigate(-1)} className="px-8 py-4 bg-white text-red-600 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-red-50 transition-all shadow-xl active:scale-95">
          Go Back
        </button>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (trackingError) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 text-gray-900 dark:text-white px-8 text-center">
        <AlertCircle size={40} className="text-red-400 mb-4" />
        <p className="text-base font-black mb-2">Tracking Unavailable</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{trackingError}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-200 dark:bg-white/10 rounded-xl text-sm font-bold hover:bg-gray-300 dark:hover:bg-white/20 transition-all text-gray-900 dark:text-white">
          Go Back
        </button>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-[200] w-full h-full bg-slate-50 dark:bg-zinc-950 text-gray-900 dark:text-white font-sans overflow-hidden flex flex-col">
      {/* ── Map fills entire screen ── */}
      <div 
        className="flex-1 w-full h-full relative"
        onMouseDown={() => setIsFOLLOWING(false)}
        onTouchStart={() => setIsFOLLOWING(false)}
      >
        {mapLoaded && window.google ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={isFOLLOWING ? mapCenter : (mapCenterRef.current || mapCenter)}
            zoom={isFOLLOWING ? 15 : mapZoomRef.current}
            onLoad={onMapLoad}
            onUnmount={onMapUnmount}
            options={mapOptions}
            onDragStart={() => setIsFOLLOWING(false)}
            onCenterChanged={handleCenterChanged}
            onZoomChanged={handleZoomChanged}
          >
            {/* Store marker */}
            {storePos && order.status !== 'out_for_delivery' && storeMarkerIcon && (
              <MarkerF
                position={storePos}
                icon={storeMarkerIcon}
              />
            )}

            {/* Destination marker */}
            {destPos && destMarkerIcon && (
              <MarkerF
                position={destPos}
                icon={destMarkerIcon}
              />
            )}

            {/* Rider marker */}
            {riderLocation && riderMarkerIcon && (
              <MarkerF
                position={riderLocation}
                icon={riderMarkerIcon}
                zIndex={10}
              />
            )}

            {/* Route polyline — 3 layers like delivery app */}
            {trimmedRoute.length > 0 && (
              <>
                <Polyline path={trimmedRoute} options={{ strokeColor: '#000000', strokeOpacity: 0.1, strokeWeight: 8, lineCap: 'round' }} />
                <Polyline path={trimmedRoute} options={{ strokeColor: '#0c831f', strokeOpacity: 0.7, strokeWeight: 6, lineCap: 'round' }} />
                <Polyline path={trimmedRoute} options={{ strokeColor: '#bef264', strokeOpacity: 1, strokeWeight: 2, lineCap: 'round' }} />
              </>
            )}
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-zinc-900 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
              <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white">Map View Offline</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1 font-medium">
              Live map preview is currently unavailable. Your delivery status, PIN, and driver contact are active below.
            </p>
          </div>
        )}
      </div>

      {/* ── Top Bar ── */}
      <div className="absolute top-6 left-4 right-4 z-[1000] flex justify-between items-center">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-white shadow-xl active:scale-95 transition-all rounded-none"
        >
          <ChevronLeft size={20} strokeWidth={3} />
        </button>

        <div className="flex flex-col items-center justify-center flex-1 mx-2">
          <div className="bg-white dark:bg-[#2d2d2d] w-[110px] h-[44px] rounded-[100px] shadow-2xl flex items-center justify-center relative px-4 border border-gray-100 dark:border-white/5">
            <div className="absolute left-3 w-1 h-3 bg-[#00c982] rounded-full animate-pulse shadow-[0_0_8px_#00c982]" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-900 dark:text-white leading-none mb-0.5">Delivery</span>
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-900 dark:text-white leading-none">Mission</span>
            </div>
          </div>
          <div className="mt-1">
            <div className="bg-white/80 dark:bg-gray-400/40 backdrop-blur-md px-4 py-0.5 rounded-full shadow-sm">
              <span className="text-[7.5px] font-black text-gray-700 dark:text-[#2d2d2d] uppercase tracking-widest leading-none">
                #{order.orderId || id}
              </span>
            </div>
          </div>
          <LastUpdatedBadge lastUpdated={lastUpdated} waitingForRider={waitingForRider} />
        </div>

        <div className="w-10 h-10" />
      </div>

      {/* ── Bottom Sheet ── */}
      <div className="absolute bottom-0 left-0 right-0 z-[1001]">
        <motion.div
          ref={sheetRef}
          initial={{ y: '100%' }}
          animate={{ y: isExpanded ? 0 : dragRange }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-white dark:bg-[#1a1a1a] rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-2xl w-full max-w-2xl mx-auto border-t border-gray-100 dark:border-white/5 flex flex-col overflow-hidden"
          data-lenis-prevent
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: dragRange }}
          dragElastic={0.15}
          dragMomentum={false}
          onDragEnd={(event, info) => {
            if (info.offset.y > 100 || info.velocity.y > 100) {
              setIsExpanded(false);
            } else if (info.offset.y < -100 || info.velocity.y < -100) {
              setIsExpanded(true);
            }
          }}
          style={{ height: '75vh' }}
        >
          <div 
            className="w-full pt-4 pb-2 flex justify-center flex-shrink-0 cursor-pointer"
            onPointerDown={(e) => dragControls.start(e)}
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ touchAction: 'none' }}
          >
            <div className="w-12 h-1 bg-gray-200 dark:bg-white/10 rounded-full" />
          </div>

          <div 
            className="px-6 pb-8 pt-2 overflow-y-auto custom-scrollbar flex-1" 
            data-lenis-prevent
          >
            <div className="flex items-end justify-between gap-4 mb-6">
              <div className="flex-1">
                <p className="text-[#00c982] font-black text-[10px] uppercase tracking-[0.2em] mb-1.5">
                  PHASE: {order.status === 'out_for_delivery' ? 'DELIVERING' : 'PREPARING'}
                </p>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">
                  {order.status === 'out_for_delivery' ? 'Out for Delivery' : 'Assigning Rider'}
                </h2>
                {(etaMins || distanceText) && (
                  <p className="text-gray-500 dark:text-gray-400 font-bold text-xs mt-1 uppercase tracking-widest">
                    {distanceText && `${distanceText} · `}{etaMins && `~${etaMins} min away`}
                  </p>
                )}
              </div>

              {order.deliveryOTP && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 text-gray-900 dark:text-white rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-0.5">PIN</span>
                  <span className="text-xl font-black tracking-widest leading-none">{order.deliveryOTP}</span>
                </div>
              )}
            </div>

            {/* Rider Card */}
            <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-zinc-800 border-2 border-white dark:border-white/10 flex-shrink-0">
                <img
                  src={order.deliveryPartnerId?.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${order.deliveryPartnerId?._id || 'rider'}`}
                  alt="Rider"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-gray-900 dark:text-white text-base leading-tight mb-0.5 truncate">
                  {order.deliveryPartnerId?.name || 'Locating Partner...'}
                </h4>
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-400">
                    <Star size={10} fill="currentColor" /> {order.deliveryPartnerId?.rating || '4.9'}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest truncate">
                    Verified Driver
                  </span>
                </div>
              </div>
              {order.deliveryPartnerId?.phone && (
                <a
                  href={`tel:${order.deliveryPartnerId.phone}`}
                  className="w-12 h-12 rounded-2xl bg-[#00c982] flex items-center justify-center text-white shadow-lg shadow-green-500/20 active:scale-95 transition-all flex-shrink-0"
                >
                  <Phone size={20} strokeWidth={3} />
                </a>
              )}
            </div>

            {/* Order Details Dropdown/Section */}
            <div className="mt-4 bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/10">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-black text-gray-900 dark:text-white text-xs uppercase tracking-widest">Order Details</h4>
                <div className="px-2 py-0.5 bg-gray-200 dark:bg-white/10 rounded uppercase text-[8px] font-black tracking-widest text-gray-600 dark:text-gray-300">
                  {order.items?.length || 0} ITEMS
                </div>
              </div>
              <div className="max-h-[25vh] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {order.items?.map((item, idx) => (
                  <div key={item._id || idx} className="flex justify-between items-center">
                    <div className="flex gap-3 items-center flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 overflow-hidden flex-shrink-0 border border-gray-100 dark:border-white/5">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-[10px] text-[#00c982] font-black tracking-widest mt-0.5">QTY: {item.quantity}</p>
                      </div>
                    </div>
                    <div className="text-sm font-black text-gray-900 dark:text-white whitespace-nowrap pl-2">
                      ₹{item.price * item.quantity}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-white/10 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">
                  <span>Payment Method</span>
                  <span className="text-gray-900 dark:text-white">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online / Wallet'}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">
                  <span>Delivery Address</span>
                  <span className="text-gray-900 dark:text-white truncate max-w-[150px]">{order.shippingAddress?.street || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-black uppercase tracking-widest">Total Amount</span>
                  <span className="text-base font-black text-[#00c982]">₹{order.totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Cancel Order Action */}
            {order.status === 'pending' && (
              <button
                onClick={() => navigate(`/orders/${order._id || id}/cancel`)}
                className="w-full mt-4 py-3.5 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-2xl border border-red-100 dark:border-red-500/10 font-black uppercase tracking-widest text-[11px] flex justify-center items-center gap-2 hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-[0.98] transition-all"
              >
                <AlertCircle size={15} />
                Cancel Order
              </button>
            )}

          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default OrderTrackingPage;

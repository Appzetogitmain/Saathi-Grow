import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, MarkerF, Polyline } from '@react-google-maps/api';
import polylineUtil from '@mapbox/polyline';
import {
    Navigation,
    Phone,
    ChevronLeft,
    Loader2,
    MapPin,
    Star,
    ArrowRight,
    Check,
    FileText
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, useDragControls } from 'framer-motion';
import useDeliveryStore from '../store/deliveryStore';
import { getDeliveryDetail, updateDeliveryStatus, getRouteDirections } from '../services/deliveryService';
import { useLocation } from '../../user/context/LocationContext';
import { toast } from 'react-toastify';
import { useTheme } from '../../user/context/ThemeContext';
import './live-tracking.css';
import { ASSET_URLS } from '../../../constants/assetUrls';

const bikeImgUrl = ASSET_URLS.bike;
const storeImgUrl = ASSET_URLS.store;
const houseImgUrl = ASSET_URLS.house;

const mapContainerStyle = {
    width: '100%',
    height: '100%'
};
const defaultMapCenter = { lat: 22.9734, lng: 78.6569 };

const lightMapStyles = [
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e9e9e9" }, { "lightness": 17 }] },
    { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }, { "lightness": 20 }] },
    { "featureType": "road.highway", "elementType": "geometry.fill", "stylers": [{ "color": "#ffffff" }, { "lightness": 17 }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }, { "lightness": 21 }] }
];

const darkMapStyles = [
    { "elementType": "geometry", "stylers": [{ "color": "#1d1d1d" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d1d1d" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#2c2c2c" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212121" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#242424" }] },
    { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#1a1a1a" }] }
];

const buildMapOptions = (isDarkMode) => ({
    disableDefaultUI: true,
    zoomControl: false,
    styles: isDarkMode ? darkMapStyles : lightMapStyles,
    gestureHandling: 'greedy',
    tilt: 45,
    heading: 0,
    mapId: '90f87356964870ad'
});

const getDistance = (pos1, pos2) => {
    if (!pos1 || !pos2) return 0;
    const R = 6371e3;
    const f1 = pos1.lat * Math.PI / 180;
    const f2 = pos2.lat * Math.PI / 180;
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.abs(R * c);
};

// Professional Navigation Controller for Google Maps
const MapController = ({ map, center, destination, routeCoords, isFOLLOWING }) => {
    // Helper to calculate bearing between two points
    const calculateBearing = (start, end) => {
        if (!start || !end) return 0;
        const startLat = start.lat * Math.PI / 180;
        const startLng = start.lng * Math.PI / 180;
        const endLat = end.lat * Math.PI / 180;
        const endLng = end.lng * Math.PI / 180;
        const dLng = endLng - startLng;
        const y = Math.sin(dLng) * Math.cos(endLat);
        const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
        let bearing = Math.atan2(y, x);
        return (bearing * 180 / Math.PI + 360) % 360;
    };

    // Professional Navigation Follow Mode (Forward Orientation)
    useEffect(() => {
        if (map && center && isFOLLOWING) {
            // Pick a point significantly ahead to stabilize rotation
            let lookAheadIndex = Math.min(12, routeCoords.length - 1);
            let nextPoint = (routeCoords && routeCoords.length > 3) ? routeCoords[lookAheadIndex] : destination;
            
            const forwardBearing = calculateBearing(center, nextPoint);

            // Using setOptions for atomic update of all projection parameters
            map.setOptions({
                heading: forwardBearing,
                tilt: 50, // Balanced perspective 
                zoom: 15.5, // Zoomed out for more route context
                center: center // Centered strictly on the rider
            });
            
            // Offset removed to keep driver in the dead center as requested
        } else if (map && !isFOLLOWING) {
            map.setOptions({
                tilt: 0,
                heading: 0,
                zoom: 15
            });
        }
    }, [map, center, destination, routeCoords, isFOLLOWING]);

    return null;
};

const LiveTracking = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { isDarkMode } = useTheme();
    const { token, profile, fetchProfile } = useDeliveryStore();
    const [run, setRun] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [trimmedRoute, setTrimmedRoute] = useState([]);
    const [isFOLLOWING, setIsFOLLOWING] = useState(true);
    const [otpInput, setOtpInput] = useState('');
    const [codCollected, setCodCollected] = useState({});
    const [map, setMap] = useState(null);
    const { mapLoaded } = useLocation();
    const mapOptions = useMemo(() => buildMapOptions(isDarkMode), [isDarkMode]);

    const [sheetHeight, setSheetHeight] = useState(window.innerHeight * 0.65);
    useEffect(() => {
        const handleResize = () => {
            setSheetHeight(window.innerHeight * 0.65);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const dragRange = sheetHeight - 100;
    const dragControls = useDragControls();

    const onLoad = useCallback(m => setMap(m), []);
    const onUnmount = useCallback(() => setMap(null), []);

    useEffect(() => {
        if (map) {
            map.setOptions(mapOptions);
        }
    }, [map, mapOptions]);


    const fetchDetail = async () => {
        if (!token || !id) return;
        try {
            const data = await getDeliveryDetail(token, id);
            setRun(data);
        } catch (error) {
            toast.error('Failed to load mission details');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchDetail(); }, [id, token]);

    const handleAction = async (type, stopOrderId = null, stopStatus = null, otp = '') => {
        setActionLoading(true);
        try {
            if (type === 'start') {
                await updateDeliveryStatus(token, id, 'in_progress');
                toast.success('Mission Started!');
            } else if (type === 'complete') {
                await updateDeliveryStatus(token, id, 'completed');
                toast.success('Mission Accomplished!');
                await fetchProfile();
                navigate('/delivery/dashboard');
            } else if (type === 'stop') {
                const response = await updateDeliveryStatus(token, id, run.status, stopOrderId, stopStatus, otp);
                toast.success('Task Updated');
                setOtpInput('');
                if (response && (response.status === 'completed' || response.status === 'partial_complete')) {
                    toast.success(isReturn ? 'Returns Finalized!' : 'Mission Accomplished!');
                    await fetchProfile();
                    navigate('/delivery/dashboard');
                    return;
                }
            }
            fetchDetail();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Operation failed');
        } finally {
            setActionLoading(false);
        }
    };

    const partnerPos = useMemo(() => {
        const coordinates = profile?.currentLocation?.coordinates;
        if (!coordinates || coordinates.length !== 2 || (coordinates[0] === 0 && coordinates[1] === 0)) return null;
        return { lat: coordinates[1], lng: coordinates[0] };
    }, [profile]);

    const runDestinationPos = useMemo(() => {
        const coordinates = run?.branchId?.address?.location?.coordinates || run?.branchId?.location?.coordinates;
        return coordinates?.length === 2 ? { lat: coordinates[1], lng: coordinates[0] } : null;
    }, [run]);

    const currentStop = run?.orders?.find(s => run.runType === 'return' ? s.status === 'pending' : (s.status === 'pending' || s.status === 'out_for_delivery'));
    const currentStopPos = useMemo(() => {
        const coords = currentStop?.order?.shippingAddress?.location?.coordinates;
        return coords ? { lat: coords[1], lng: coords[0] } : null;
    }, [currentStop]);

    // Fetch Route Path
    useEffect(() => {
        const fetchRoute = async () => {
            if (!id || !token || !partnerPos) return;
            const dest = (run?.status === 'in_progress' && currentStopPos) ? currentStopPos : runDestinationPos;
            if (!dest) return;

            try {
                const response = await getRouteDirections(token, [partnerPos.lat, partnerPos.lng], [dest.lat, dest.lng]);
                if (response.routes?.length > 0) {
                    const decoded = polylineUtil.decode(response.routes[0].overview_polyline.points).map(p => ({ lat: p[0], lng: p[1] }));
                    setRouteCoordinates(decoded);
                }
            } catch {}
        };
        fetchRoute();
    }, [id, run?.status, run?.runType, partnerPos?.lat, partnerPos?.lng, currentStopPos, runDestinationPos, token]);

    // Trimming & Auto-fit
    useEffect(() => {
        if (!routeCoordinates.length || !partnerPos) return;
        const dest = routeCoordinates[routeCoordinates.length - 1];
        if (getDistance(partnerPos, dest) < 150) { setTrimmedRoute([]); return; }
        let minD = Infinity, idx = 0;
        routeCoordinates.forEach((p, i) => { const d = getDistance(partnerPos, p); if (d < minD) { minD = d; idx = i; } });
        const newPath = [partnerPos, ...routeCoordinates.slice(idx)];
        setTrimmedRoute(newPath);

        // Re-calculate route path and bounds only if overview mode
        if (map && isFOLLOWING) {
            // Navigation handled by MapController
        } else if (map && !isFOLLOWING && newPath.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            newPath.forEach(p => bounds.extend(p));
            map.fitBounds(bounds, { top: 120, bottom: 250, left: 50, right: 50 });
        }
    }, [partnerPos, routeCoordinates, map, isFOLLOWING]);

    if (isLoading || !mapLoaded) return <div className="h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white"><Loader2 className="animate-spin text-emerald-500 mb-4" size={48} /><p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Syncing Pilot...</p></div>;

    const isReturn = run.runType === 'return';
    const allStopsDone = run.orders.every(o => isReturn ? o.status === 'picked_up' : (o.status === 'delivered' || o.status === 'failed'));

    return (
        <div className="fixed inset-0 w-full h-full z-[100] bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans overflow-hidden flex flex-col">
            <div className={`flex-1 w-full h-full relative transition-all duration-500 ${isExpanded ? 'opacity-40 scale-105' : 'opacity-100'}`}>
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={partnerPos || currentStopPos || runDestinationPos || defaultMapCenter}
                    zoom={15}
                    onLoad={onLoad}
                    onUnmount={onUnmount}
                    options={mapOptions}
                >
                    <MapController 
                        map={map}
                        center={partnerPos || currentStopPos || runDestinationPos || defaultMapCenter}
                        destination={currentStopPos || runDestinationPos} 
                        routeCoords={trimmedRoute}
                        isFOLLOWING={isFOLLOWING} 
                    />
                    {partnerPos && <MarkerF
                        position={partnerPos}
                        icon={{
                            url: bikeImgUrl,
                            scaledSize: new window.google.maps.Size(45, 45),
                            anchor: new window.google.maps.Point(22.5, 22.5)
                        }}
                    />}
                    
                    {isReturn ? (
                        <>
                             {currentStopPos && <MarkerF position={currentStopPos} icon={{ url: houseImgUrl, scaledSize: new window.google.maps.Size(40,40), anchor: new window.google.maps.Point(20,20) }} />}
                             <MarkerF position={runDestinationPos} icon={{ url: storeImgUrl, scaledSize: new window.google.maps.Size(40,40), anchor: new window.google.maps.Point(20,20) }} />
                        </>
                    ) : (
                        <>
                            <MarkerF position={runDestinationPos} icon={{ url: storeImgUrl, scaledSize: new window.google.maps.Size(40,40), anchor: new window.google.maps.Point(20,20) }} />
                            {currentStopPos && <MarkerF position={currentStopPos} icon={{ url: houseImgUrl, scaledSize: new window.google.maps.Size(40,40), anchor: new window.google.maps.Point(20,20) }} />}
                        </>
                    )}

                    {trimmedRoute.length > 0 && (
                        <>
                            <Polyline path={trimmedRoute} options={{ strokeColor: "#000", strokeOpacity: 0.1, strokeWeight: 8, lineCap: "round" }} />
                            <Polyline path={trimmedRoute} options={{ strokeColor: isReturn ? '#10b981' : '#0c831f', strokeOpacity: 0.7, strokeWeight: 5, lineCap: "round" }} />
                            <Polyline path={trimmedRoute} options={{ strokeColor: isReturn ? '#6ee7b7' : '#bef264', strokeOpacity: 1, strokeWeight: 2, lineCap: "round" }} />
                        </>
                    )}
                </GoogleMap>
            </div>

            {/* Overlays - Mission Style */}
            <div className="absolute top-6 left-4 right-4 z-[1000] flex justify-between items-center">
                <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white shadow-xl active:scale-95 transition-all rounded-none border border-slate-200 dark:border-white/10">
                    <ChevronLeft size={20} strokeWidth={3} />
                </button>

                <div className="flex flex-col items-center justify-center flex-1 mx-2">
                    <div className="bg-white dark:bg-[#2d2d2d] w-[110px] h-[44px] rounded-[100px] shadow-2xl flex items-center justify-center relative px-4 border border-slate-200 dark:border-white/5">
                        <div className={`absolute left-3 w-1.5 h-3.5 ${isReturn ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-[#00c982] shadow-[0_0_8px_#00c982]'} rounded-full animate-pulse`}></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-900 dark:text-white leading-none mb-0.5">{isReturn ? 'Return' : 'Delivery'}</span>
                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-900 dark:text-white leading-none">Mission</span>
                        </div>
                    </div>
                    <div className="mt-1">
                        <div className="bg-gray-400/40 dark:bg-white/20 backdrop-blur-md px-4 py-0.5 rounded-full flex items-center justify-center">
                            <span className="text-[7.5px] font-black text-[#2d2d2d] dark:text-white uppercase tracking-widest leading-none">#{run.runId}</span>
                        </div>
                    </div>
                </div>

                <div className="w-10 h-10"></div>
            </div>

            {/* Bottom Sheet */}
            <motion.div
                className="absolute bottom-0 left-0 right-0 z-[100]"
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: dragRange }}
                dragElastic={0.15}
                dragMomentum={false}
                animate={{
                    y: isExpanded ? 0 : dragRange
                }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                onDragEnd={(event, info) => {
                    if (info.offset.y > 100 || info.velocity.y > 100) {
                        setIsExpanded(false);
                    } else if (info.offset.y < -100 || info.velocity.y < -100) {
                        setIsExpanded(true);
                    }
                }}
                style={{ height: '65vh' }}
            >
                <div className="bg-white dark:bg-[#1a1a1a] rounded-t-[2.5rem] shadow-2xl border-t border-slate-200 dark:border-white/5 w-full h-full flex flex-col relative overflow-hidden">
                    <div 
                        className="w-full h-10 flex items-center justify-center cursor-pointer flex-shrink-0" 
                        onPointerDown={(e) => dragControls.start(e)}
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{ touchAction: 'none' }}
                    >
                        <div className="w-12 h-1 bg-slate-200 dark:bg-white/10 rounded-full" />
                    </div>

                    <div className="px-6 pb-6 pt-2 flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex items-center justify-between gap-4 mb-5 flex-shrink-0">
                            <div className="flex-1">
                                <p className="text-[#00c982] font-black text-[9px] uppercase tracking-[0.2em] mb-1">
                                    PHASE: {run.status.replace(/_/g, ' ')}
                                </p>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none capitalize">
                                    {run.status === 'assigned' ? 'New Batch' : run.status === 'in_progress' ? 'On Mission' : 'Finishing'}
                                </h2>
                            </div>
                            {run.status === 'assigned' ? (
                                <button onClick={() => handleAction('start')} className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"><span>Start Mission</span><ArrowRight size={12} strokeWidth={3} /></button>
                            ) : allStopsDone && (
                                <button onClick={() => handleAction('complete')} className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">{isReturn ? 'Finalize Returns' : 'Complete Batch'}</button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3 pb-6">
                            {run.orders.map((stop, i) => {
                                const isActive = (isReturn ? stop.status === 'pending' : (stop.status === 'pending' || stop.status === 'out_for_delivery')) && !run.orders.slice(0, i).some(prev => isReturn ? prev.status === 'pending' : (prev.status === 'pending' || prev.status === 'out_for_delivery'));
                                const isDone = isReturn ? stop.status === 'picked_up' : stop.status === 'delivered';
                                
                                return (
                                    <div key={stop._id} className={`p-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-slate-50 dark:bg-white/5 shadow-xl border border-slate-200 dark:border-white/10' : 'opacity-20'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDone ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-gray-400'}`}>
                                                    {isDone ? <Check size={18} strokeWidth={3} /> : <span className="font-black text-sm">{i + 1}</span>}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-sm text-slate-900 dark:text-white">{stop.order?.user?.name}</h4>
                                                    <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold">{stop.order?.user?.phone}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <p className="font-black text-[13px] text-slate-800 dark:text-white tracking-tight leading-none">₹{stop.order?.totalAmount}</p>
                                                {stop.order?.paymentMethod === 'cod' ? (
                                                    <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-black uppercase mt-1.5">COD: Collect Cash</span>
                                                ) : (
                                                    <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase mt-1.5">PREPAID</span>
                                                )}
                                                <p className="text-[7.5px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mt-1.5">{stop.status.replace(/_/g, ' ')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 text-slate-500 dark:text-gray-400 mb-4 bg-slate-100 dark:bg-white/5 p-2.5 rounded-xl">
                                            <MapPin size={12} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                                            <p className="text-[10px] font-bold leading-relaxed">{stop.order?.shippingAddress?.street}, {stop.order?.shippingAddress?.city}</p>
                                        </div>
                                        {(stop.order?.deliveryInstructions?.chips?.length > 0 || stop.order?.deliveryInstructions?.customNote) && (
                                            <div className="mb-3.5 p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-xl">
                                                <div className="flex items-center gap-1.5 mb-1.5">
                                                    <FileText size={11} className="text-amber-600 dark:text-amber-400" />
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                                        Delivery Instructions
                                                    </span>
                                                </div>
                                                {stop.order.deliveryInstructions.chips?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mb-1.5">
                                                        {stop.order.deliveryInstructions.chips.map((chip, cIdx) => (
                                                            <span key={cIdx} className="px-2 py-0.5 bg-white dark:bg-zinc-800 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-700/50 rounded-full text-[10px] font-bold">
                                                                ✓ {chip}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {stop.order.deliveryInstructions.customNote && (
                                                    <p className="text-[11px] text-amber-950 dark:text-amber-100 font-semibold bg-white/90 dark:bg-black/30 p-2 rounded-lg border border-amber-100 dark:border-white/5">
                                                        "{stop.order.deliveryInstructions.customNote}"
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {isActive && run.status === 'in_progress' && (
                                            <div className="flex gap-2">
                                                {isReturn ? (
                                                    <div className="flex-1 flex flex-col gap-2">
                                                        <input type="text" maxLength={4} placeholder="Enter OTP Code" className="otp-input-field" value={otpInput} onChange={e => setOtpInput(e.target.value)} />
                                                        <button onClick={() => handleAction('stop', stop.order._id, 'picked_up', otpInput)} disabled={!otpInput} className="w-full h-11 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-30 transition-all">Verify & Collect</button>
                                                    </div>
                                                ) : (
                                                    stop.status === 'pending' ? (
                                                            <button onClick={() => handleAction('stop', stop.order._id, 'out_for_delivery')} className="flex-1 h-10 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95">Go to Customer</button>
                                                    ) : (
                                                            stop.order?.paymentMethod === 'cod' && !codCollected[stop.order._id] ? (
                                                                <div className="flex-1 flex flex-col gap-2 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                                                                    <p className="text-center text-[9px] font-black text-amber-500 uppercase tracking-widest leading-tight">Please collect ₹{stop.order?.totalAmount} in cash from customer</p>
                                                                    <button onClick={() => setCodCollected({...codCollected, [stop.order._id]: true})} className="w-full h-10 bg-amber-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">Cash Collected</button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex-1 flex flex-col gap-2">
                                                                    {stop.order?.paymentMethod === 'cod' && <p className="text-center text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-[-4px]">COD Collected ✓</p>}
                                                                    <input type="text" maxLength={4} placeholder="Enter OTP Code" className="otp-input-field" value={otpInput} onChange={e => setOtpInput(e.target.value)} />
                                                                    <button onClick={() => handleAction('stop', stop.order._id, 'delivered', otpInput)} disabled={!otpInput} className="w-full h-11 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-30 transition-all">Verify & Deliver</button>
                                                                </div>
                                                            )
                                                    )
                                                )}
                                                <a href={`tel:${stop.order?.user?.phone}`} className="h-10 w-10 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl text-slate-500 dark:text-gray-300 flex items-center justify-center active:scale-95"><Phone size={16} /></a>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default LiveTracking;

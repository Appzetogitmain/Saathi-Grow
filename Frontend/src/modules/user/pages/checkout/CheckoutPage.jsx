import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    MapPin,
    CheckCircle,
    ShoppingBag,
    Clock,
    ShieldCheck,
    ArrowRight,
    Truck,
    AlertCircle,
    Star,
    PartyPopper,
    Sparkles,
    Lock,
    Wallet,
    Loader2,
    Calendar,
    Ticket,
    Gift
} from 'lucide-react';

import { useLocation as useGlobalLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import * as orderApi from '../../api/orderApi';
import * as walletApi from '../../api/walletApi';
import { fetchDeliverySlots, fetchAvailableDeliveryDays } from '../../api/orderApi';
import { toast } from 'react-toastify';
import { getPublicSettings } from '../../../../common/api/settingApi';

const loadRazorpaySDK = () => {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

const CheckoutPage = () => {
    const { cartTotal = 0, clearCart, cartCount = 0, cart = [] } = useCart();
    const { location: globalLocation, openLocationModal, savedAddresses, updateLocation, addAddress } = useGlobalLocation();
    const { user, token } = useAuth();
    const { activeStore, isStoreOutOfRange, isStoreInactive, openStoreSelector } = useStore();
    const [isPlacing, setIsPlacing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cod');
    const [walletBalance, setWalletBalance] = useState(0);
    const [onlineMethod, setOnlineMethod] = useState('phonepe');
    const [billDetails, setBillDetails] = useState(null);
    const [isCalculating, setIsCalculating] = useState(true);
    const [deliverySlots, setDeliverySlots] = useState([]);
    const [selectedSlotId, setSelectedSlotId] = useState(null);   // ObjectId of chosen slot
    const [selectedSlotLabel, setSelectedSlotLabel] = useState(null); // Display label
    const [isImmediate, setIsImmediate] = useState(true);          // Default = Immediate
    const [loadingSlots, setLoadingSlots] = useState(true);
    const [deliverySettings, setDeliverySettings] = useState({ immediateDeliveryEnabled: true });

    // Phase 8: Multi-Day Slots & Address Persistence States
    const [availableDaysData, setAvailableDaysData] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(null);
    const [saveAddressToProfile, setSaveAddressToProfile] = useState(true);
    
    // Promo Code States
    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState(null);
    const [isValidatingPromo, setIsValidatingPromo] = useState(false);
    const [availablePromos, setAvailablePromos] = useState([]);
    const [upsellingPromos, setUpsellingPromos] = useState([]);
    const [loadingPromos, setLoadingPromos] = useState(false);

    const [shippingAddressForm, setShippingAddressForm] = useState({
        street: '',
        city: '',
        state: '',
        zipCode: '',
        landmark: ''
    });
    const navigate = useNavigate();
    const location = useLocation();
    const isCityOnlySelection = (loc) => {
        if (!loc) return false;
        const address = (loc.address || '').trim().toLowerCase();
        const city = (loc.city || '').trim().toLowerCase();
        const fullAddress = (loc.fullAddress || '').trim().toLowerCase();
        const hasDetailFields = Boolean((loc.state || '').trim() || (loc.zipCode || '').trim());
        return !hasDetailFields && address && city && address === city && fullAddress === `${city}, india`;
    };
    const cityOnlySelected = isCityOnlySelection(globalLocation);

    useEffect(() => {
        window.scrollTo(0, 0);
        const fetchWallet = async () => {
            if (token) {
                try {
                    const data = await walletApi.fetchWalletData(token);
                    setWalletBalance(data.balance);
                } catch (err) {
                    console.error('Wallet fetch failed', err);
                }
            }
        };
        fetchWallet();

        const loadSlots = async () => {
            try {
                const [availabilityRes, settings] = await Promise.all([
                    fetchAvailableDeliveryDays(5).catch(err => {
                        console.warn('Available days endpoint error, falling back to legacy slots:', err);
                        return null;
                    }),
                    getPublicSettings()
                ]);

                setDeliverySettings(settings || { immediateDeliveryEnabled: true });

                if (availabilityRes && availabilityRes.success && availabilityRes.days?.length > 0) {
                    setAvailableDaysData(availabilityRes);
                    const firstAvailDay = availabilityRes.days.find(d => d.isAvailable) || availabilityRes.days[0];
                    setSelectedDate(firstAvailDay.date);

                    const canImmediate = availabilityRes.immediateDelivery?.enabled ?? settings?.immediateDeliveryEnabled;
                    if (canImmediate && firstAvailDay.isToday) {
                        setIsImmediate(true);
                        setSelectedSlotId(null);
                        setSelectedSlotLabel(null);
                    } else if (firstAvailDay.slots?.length > 0) {
                        setIsImmediate(false);
                        setSelectedSlotId(firstAvailDay.slots[0]._id);
                        setSelectedSlotLabel(firstAvailDay.slots[0].label);
                    } else {
                        setIsImmediate(false);
                        setSelectedSlotId(null);
                        setSelectedSlotLabel(null);
                    }
                    setDeliverySlots(firstAvailDay.slots || []);
                } else {
                    const slots = await fetchDeliverySlots();
                    setDeliverySlots(slots || []);
                    if (!settings?.immediateDeliveryEnabled) {
                        setIsImmediate(false);
                        setSelectedSlotId(slots[0]?._id || null);
                        setSelectedSlotLabel(slots[0]?.label || null);
                    }
                }
            } catch (err) {
                console.error('Slots fetch failed', err);
            } finally {
                setLoadingSlots(false);
            }
        };
        loadSlots();
    }, [token]);

    // PREFILL ADDRESS LOGIC (Phase 8: Enhanced persistence & auto-select)
    useEffect(() => {
        if (!savedAddresses || savedAddresses.length === 0) return;

        // If user already selected a saved address card, keep it
        if (selectedSavedAddressId) {
            const current = savedAddresses.find(a => a.id === selectedSavedAddressId);
            if (current) return;
        }

        let targetAddr = null;
        if (globalLocation?.coordinates?.length === 2) {
            targetAddr = savedAddresses.find((addr) => {
                const c1 = addr.coordinates || [];
                const c2 = globalLocation.coordinates || [];
                return c1.length === 2 && c2.length === 2 && String(c1[0]) === String(c2[0]) && String(c1[1]) === String(c2[1]);
            });
        }

        // Fallback: pick default or first saved address even if coordinates don't match!
        if (!targetAddr) {
            targetAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
        }

        if (targetAddr) {
            setSelectedSavedAddressId(targetAddr.id);
            setShippingAddressForm(prev => ({
                ...prev,
                street: targetAddr.address || prev.street,
                city: targetAddr.city || prev.city,
                state: targetAddr.state || prev.state,
                zipCode: targetAddr.zipCode || prev.zipCode
            }));

            if (globalLocation.address === 'Select Location') {
                updateLocation({
                    address: targetAddr.address,
                    city: targetAddr.city,
                    state: targetAddr.state || '',
                    zipCode: targetAddr.zipCode || '',
                    fullAddress: targetAddr.fullAddress || [targetAddr.address, targetAddr.city, targetAddr.state, targetAddr.zipCode].filter(Boolean).join(', '),
                    coordinates: targetAddr.coordinates
                });
            }
        }
    }, [savedAddresses]);

    const handleSelectSavedAddress = (addr) => {
        setSelectedSavedAddressId(addr.id);
        setShippingAddressForm(prev => ({
            ...prev,
            street: addr.address || '',
            city: addr.city || '',
            state: addr.state || '',
            zipCode: addr.zipCode || ''
        }));
        if (addr.coordinates) {
            updateLocation({
                address: addr.address,
                city: addr.city,
                state: addr.state || '',
                zipCode: addr.zipCode || '',
                fullAddress: addr.fullAddress || [addr.address, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', '),
                coordinates: addr.coordinates
            });
        }
    };

    const handleSelectDate = (dateObj) => {
        setSelectedDate(dateObj.date);
        setDeliverySlots(dateObj.slots || []);

        if (dateObj.isHoliday) {
            setIsImmediate(false);
            setSelectedSlotId(null);
            setSelectedSlotLabel(null);
            return;
        }

        const isToday = dateObj.isToday;
        const immediatePossible = isToday && (availableDaysData?.immediateDelivery?.enabled ?? deliverySettings.immediateDeliveryEnabled);

        if (isImmediate && !immediatePossible) {
            setIsImmediate(false);
            if (dateObj.slots?.length > 0) {
                setSelectedSlotId(dateObj.slots[0]._id);
                setSelectedSlotLabel(dateObj.slots[0].label);
            } else {
                setSelectedSlotId(null);
                setSelectedSlotLabel(null);
            }
        } else if (!isImmediate) {
            if (dateObj.slots?.length > 0) {
                const exists = dateObj.slots.find(s => s._id === selectedSlotId);
                if (!exists) {
                    setSelectedSlotId(dateObj.slots[0]._id);
                    setSelectedSlotLabel(dateObj.slots[0].label);
                }
            } else {
                setSelectedSlotId(null);
                setSelectedSlotLabel(null);
            }
        }
    };

    useEffect(() => {
        const fetchBill = async () => {
            if (cart.length === 0) return;
            setIsCalculating(true);
            try {
                const items = cart.map(item => ({
                    product: item.productId || item.id || item._id,
                    quantity: item.quantity,
                    price: item.price,
                    name: item.name,
                    image: item.image,
                    weight: item.weight || item.selectedVariant?.value || null,
                    selectedVariant: item.selectedVariant || null
                }));
                const computed = await orderApi.calculateBill(
                    token,
                    items,
                    {
                        storeId: activeStore?.id,
                        storeType: activeStore?.type
                    },
                    appliedPromo?._id,
                    {
                        isImmediate,
                        deliverySlotId: isImmediate ? null : selectedSlotId
                    }
                );
                setBillDetails(computed);
            } catch (error) {
                console.error(error);
                toast.error("Pricing sync error");
            } finally {
                setIsCalculating(false);
            }
        };
        fetchBill();
    }, [cart, token, appliedPromo, isImmediate, selectedSlotId, activeStore?.id, activeStore?.type]);

    useEffect(() => {
        const fetchPromos = async () => {
            if (!token || cartTotal <= 0) return;
            setLoadingPromos(true);
            try {
                // Fetch applicable and upselling in parallel
                const [applicableRes, upsellingRes] = await Promise.all([
                    orderApi.getApplicablePromos(token, cartTotal),
                    orderApi.getUpsellingPromos(token, cartTotal)
                ]);
                setAvailablePromos(applicableRes.data || []);
                setUpsellingPromos(upsellingRes.data || []);
            } catch (err) {
                console.error("Failed to fetch promos", err);
            } finally {
                setLoadingPromos(false);
            }
        };
        fetchPromos();
    }, [cartTotal, token]);

    const handleApplyPromo = async () => {
        if (appliedPromo) {
            toast.warning("A coupon is already applied. Please remove it first to apply a new one.");
            return;
        }
        if (!promoInput.trim()) return;
        setIsValidatingPromo(true);
        try {
            const result = await orderApi.validatePromoCode(token, promoInput, cartTotal);
            setAppliedPromo(result.promoCode);
            toast.success(`Coupon Applied! Discount: ₹${result.discountAmount}`);
        } catch (error) {
            toast.error(error.message || "Invalid Promo Code");
            setAppliedPromo(null);
        } finally {
            setIsValidatingPromo(false);
        }
    };

    const handleRemovePromo = () => {
        setAppliedPromo(null);
        setPromoInput('');
        toast.info("Promo code removed");
    };

    const handlePlaceOrder = async () => {
        if (cart.length === 0) return;
        if (!globalLocation.address) {
            toast.error("Please select a valid delivery address first.");
            return;
        }

        if (cityOnlySelected) {
            toast.error("Please select exact area from location suggestions for accurate delivery.");
            return;
        }

        if (!shippingAddressForm.street.trim() || !shippingAddressForm.city.trim() || !shippingAddressForm.state.trim() || !shippingAddressForm.zipCode.trim()) {
            toast.error("Please fill full delivery address details.");
            return;
        }

        if (!activeStore || isStoreOutOfRange || isStoreInactive) {
            toast.error(
                isStoreInactive
                    ? 'This store is currently inactive.'
                    : 'We are not serving this area yet. We will be available in your location soon.'
            );
            return;
        }

        // Account Security Guard
        if (user && user.isActive === false) {
            toast.error("Your account is deactivated. You cannot place orders.");
            return;
        }

        const currentSelectedDay = availableDaysData?.days?.find(d => d.date === selectedDate) || null;
        if (currentSelectedDay?.isHoliday) {
            toast.error(`The shop is closed on the selected holiday (${currentSelectedDay.holidayName || 'Holiday'}). Please choose another date.`);
            return;
        }

        if (isImmediate && !(availableDaysData?.immediateDelivery?.enabled ?? deliverySettings.immediateDeliveryEnabled)) {
            toast.error('Immediate delivery is currently unavailable. Please select a delivery slot.');
            return;
        }
        if (!isImmediate && !selectedSlotId) {
            toast.error('Please select an available delivery slot.');
            return;
        }

        const totalToPay = billDetails?.totalAmount || cartTotal;

        if (paymentMethod === 'wallet' && walletBalance < totalToPay) {
            toast.error("Insufficient wallet balance. Please top up or use another method.");
            return;
        }

        setIsPlacing(true);

        const orderData = {
            items: cart.map(item => ({
                product: item.productId || item.id || item._id,
                quantity: item.quantity,
                price: item.price,
                name: item.name,
                image: item.image,
                weight: item.weight || item.selectedVariant?.value || null,
                selectedVariant: item.selectedVariant || null
            })),
            shippingAddress: {
                name: user?.name,
                phone: user?.phone,
                street: shippingAddressForm.street.trim(),
                city: shippingAddressForm.city.trim(),
                state: shippingAddressForm.state.trim(),
                zipCode: shippingAddressForm.zipCode.trim(),
                landmark: shippingAddressForm.landmark?.trim() || '',
                location: globalLocation.coordinates ? { type: 'Point', coordinates: globalLocation.coordinates } : undefined
            },
            totalAmount: totalToPay,
            deliverySlot: isImmediate ? 'Immediate' : selectedSlotLabel,   // legacy label for display
            deliverySlotId: isImmediate ? null : selectedSlotId,            // NEW: ObjectId ref
            scheduledDate: isImmediate ? (availableDaysData?.todayDate || undefined) : selectedDate, // Phase 8 multi-day scheduled date
            isImmediate,                                                     // NEW: flag
            storeId: activeStore?.id,
            storeType: activeStore?.type,
            promoId: appliedPromo?._id
        };

        const maybeSaveAddressAfterOrder = async () => {
            if (!token || !saveAddressToProfile) return;
            const street = shippingAddressForm.street?.trim();
            const city = shippingAddressForm.city?.trim();
            const zipCode = shippingAddressForm.zipCode?.trim();
            if (!street || !city) return;

            const exists = savedAddresses?.some(a =>
                a.address?.trim().toLowerCase() === street.toLowerCase() &&
                a.city?.trim().toLowerCase() === city.toLowerCase()
            );
            if (exists) return;

            try {
                if (typeof addAddress === 'function') {
                    await addAddress({
                        type: 'Home',
                        name: user?.name || '',
                        phone: user?.phone || '',
                        address: street,
                        city: city,
                        state: shippingAddressForm.state?.trim() || '',
                        zipCode: zipCode || '',
                        coordinates: globalLocation?.coordinates || null
                    });
                }
            } catch (saveErr) {
                // Address save failure MUST NEVER affect a successful order
                console.warn('Silent address save warning:', saveErr);
            }
        };

        try {
            if (paymentMethod === 'cod') {
                const res = await orderApi.createCODOrder(token, orderData);
                await maybeSaveAddressAfterOrder();
                clearCart();
                navigate('/order-success', { state: { orderId: res.order._id } });
            } else if (paymentMethod === 'wallet') {
                const res = await orderApi.createWalletOrder(token, orderData);
                await maybeSaveAddressAfterOrder();
                clearCart();
                navigate('/order-success', { state: { orderId: res.order._id } });
            } else {
                // Online Payment Workflow leveraging Razorpay
                const isSdkReady = await loadRazorpaySDK();
                if (!isSdkReady) {
                    toast.error("Network issue: Unable to load secure payment gateway");
                    setIsPlacing(false);
                    return;
                }

                // Call Backend for Order Initiation Payload
                const itemsToCheckout = cart.map(item => ({
                    product: item.productId || item.id || item._id,
                    quantity: item.quantity,
                    price: item.price,
                    name: item.name,
                    image: item.image,
                    weight: item.weight || item.selectedVariant?.value || null,
                    selectedVariant: item.selectedVariant || null
                }));
                const rpPayload = await orderApi.createRazorpayOrder(
                    token, 
                    itemsToCheckout, 
                    appliedPromo?._id,
                    activeStore?.id,
                    activeStore?.type,
                    {
                        deliverySlotId: orderData.deliverySlotId,
                        isImmediate: orderData.isImmediate,
                        scheduledDate: orderData.scheduledDate
                    }
                );

                const options = {
                    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                    amount: rpPayload.amount,
                    currency: rpPayload.currency,
                    name: "Saathigro Rapid",
                    description: "Your Lightning Fast Grocery Checkout",
                    order_id: rpPayload.razorpayOrderId,
                    handler: async function (response) {
                        try {
                            const res = await orderApi.verifyRazorpayPayment(token, {
                                razorpayOrderId: response.razorpay_order_id,
                                razorpayPaymentId: response.razorpay_payment_id,
                                razorpaySignature: response.razorpay_signature,
                                orderData
                            });
                            await maybeSaveAddressAfterOrder();
                            clearCart();
                            navigate('/order-success', { state: { orderId: res.order._id } });
                        } catch (verifyErr) {
                            toast.error("Payment was blocked or untrusted signature failed");
                        }
                    },
                    prefill: {
                        name: user?.name || "Shopper",
                        email: user?.email || "payment@Saathigro.com",
                        contact: user?.phone || "9999999999"
                    },
                    theme: {
                        color: "#0c831f"
                    },
                    modal: {
                        ondismiss: function () {
                            setIsPlacing(false);
                        }
                    }
                };

                const razorpayWindow = new window.Razorpay(options);
                razorpayWindow.on('payment.failed', function (res) {
                    toast.error(res.error.description);
                    setIsPlacing(false);
                });

                razorpayWindow.open();
                return;
            }
        } catch (error) {
            console.error("Failure checking out:", error);
            toast.error(error.message);
        }

        setIsPlacing(false);
    };

    const currentSelectedDay = availableDaysData?.days?.find(d => d.date === selectedDate) || (availableDaysData?.days?.[0] ?? null);

    return (
        <div className="min-h-screen bg-gradient-to-r from-[#e8f5e9] to-[#ffffff] dark:from-[#141414] dark:to-[#141414] md:bg-white md:bg-none md:dark:bg-black transition-colors duration-300 pb-32 pt-0 relative">
            {isPlacing && paymentMethod === 'online' && (
                <div className="fixed inset-0 z-[100] bg-gradient-to-r from-[#e8f5e9] to-[#ffffff] dark:from-[#141414] dark:to-[#141414] md:bg-white md:bg-none md:dark:bg-black flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
                    <div className="w-full max-w-xs flex flex-col items-center">
                        <div className="mb-10 relative">
                            <div className="w-16 h-16 border-4 border-gray-100 dark:border-white/5 border-t-[#0c831f] rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <ShieldCheck size={24} className="text-[#0c831f]" />
                            </div>
                        </div>
                        <img
                            src={onlineMethod === 'phonepe' ? "https://download.logo.wine/logo/PhonePe/PhonePe-Logo.wine.png" : "https://www.gstatic.com/lamda/images/google_pay_logo_stack_64dp.png"}
                            alt="Payment Method"
                            className="h-8 mb-6 object-contain"
                        />
                        <h2 className="text-lg font-black text-gray-900 dark:text-white mb-2">Redirecting to {onlineMethod === 'phonepe' ? 'PhonePe' : 'Google Pay'}</h2>
                        <p className="text-xs text-gray-500 font-medium text-center">Please do not refresh or close this window while we process your secure payment.</p>

                        <div className="mt-12 flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-white/5 rounded-full">
                            <Lock size={12} className="text-[#0c831f]" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Secure 256-bit Encryption</span>
                        </div>
                    </div>
                </div>
            )}
            
            {/* White Header */}
            <div className="sticky top-0 z-50 bg-white dark:bg-black border-b border-gray-100 dark:border-white/5 px-4 py-3 shadow-sm mb-4">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 bg-gray-50 dark:bg-[#141414] rounded-full shadow-sm hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                    >
                        <ArrowLeft size={16} className="text-gray-900 dark:text-white" />
                    </button>
                    <div>
                        <h1 className="!text-[14px] font-black text-gray-900 dark:text-gray-100 tracking-tight capitalize leading-none">Checkout</h1>
                        <p className="!text-[9px] font-bold text-gray-400 mt-0.5 tracking-wider">{cartCount} items ₹{billDetails?.totalAmount || cartTotal}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4">
                {/* Out of Range Banner */}
                {isStoreOutOfRange && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top duration-300">
                        <AlertCircle className="text-red-500 shrink-0" size={20} />
                        <div>
                            <h4 className="text-sm font-black text-red-600 dark:text-red-400">Store out of delivery range</h4>
                            <p className="text-[10px] font-bold text-red-500/80 leading-tight mt-1">
                                {activeStore?.name} cannot deliver to your current address.
                                Please change your delivery address or switch to a closer store.
                            </p>
                            <button
                                onClick={openLocationModal}
                                className="mt-3 text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 underline underline-offset-2"
                            >
                                Change Address
                            </button>
                        </div>
                    </div>
                )}

                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <MapPin size={14} className="text-[#0c831f]" />
                        <h3 className="!text-[10px] font-black text-gray-400 tracking-widest">Delivery address</h3>
                    </div>
                    <div className="w-full px-1">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[7px] font-black bg-gray-50 dark:bg-white/10 text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-widest">Selected Address</span>
                            <button
                                onClick={openLocationModal}
                                className="text-[#0c831f] text-[9px] font-black uppercase tracking-widest"
                            >
                                Change
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-800 dark:text-gray-200 font-bold leading-relaxed mb-3">
                            {globalLocation.fullAddress || globalLocation.address || "Select Address"}
                        </p>
                        {cityOnlySelected && (
                            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-3 py-2">
                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 leading-snug">
                                    Exact delivery area choose karein (search suggestions se) taaki nearby store products sahi dikh sakein.
                                </p>
                            </div>
                        )}

                        {/* Phase 8: Saved Addresses Selection Chips */}
                        {savedAddresses?.length > 0 && (
                            <div className="mb-3.5 pt-1">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Saved Addresses</span>
                                <div className="flex flex-wrap gap-2">
                                    {savedAddresses.map((addr) => {
                                        const isSelected = selectedSavedAddressId === addr.id;
                                        return (
                                            <button
                                                key={addr.id}
                                                type="button"
                                                onClick={() => handleSelectSavedAddress(addr)}
                                                className={`px-3 py-1.5 rounded-xl text-left border text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                                                    isSelected
                                                        ? 'border-[#0c831f] bg-green-50 dark:bg-green-500/10 text-[#0c831f]'
                                                        : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                                                }`}
                                            >
                                                <MapPin size={12} className={isSelected ? 'text-[#0c831f]' : 'text-gray-400'} />
                                                <span>{addr.type || 'Address'}</span>
                                                {addr.isDefault && (
                                                    <span className="text-[8px] bg-green-100 text-[#0c831f] px-1 py-0.2 rounded font-black">DEF</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedSavedAddressId(null);
                                            setShippingAddressForm({ street: '', city: globalLocation.city || '', state: globalLocation.state || '', zipCode: '', landmark: '' });
                                        }}
                                        className="px-3 py-1.5 rounded-xl border border-dashed border-gray-300 dark:border-white/20 text-gray-500 text-[11px] font-bold hover:border-gray-400 transition-all"
                                    >
                                        + Enter New
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="sm:col-span-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Street / House No</label>
                                <input
                                    type="text"
                                    value={shippingAddressForm.street}
                                    onChange={(e) => setShippingAddressForm((prev) => ({ ...prev, street: e.target.value }))}
                                    placeholder="House No, Building, Street"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:border-[#0c831f] transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">City</label>
                                <input
                                    type="text"
                                    value={shippingAddressForm.city}
                                    onChange={(e) => setShippingAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                                    placeholder="City"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:border-[#0c831f] transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Pincode</label>
                                <input
                                    type="text"
                                    value={shippingAddressForm.zipCode}
                                    onChange={(e) => setShippingAddressForm((prev) => ({ ...prev, zipCode: e.target.value }))}
                                    placeholder="Pincode"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:border-[#0c831f] transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">State</label>
                                <input
                                    type="text"
                                    value={shippingAddressForm.state}
                                    onChange={(e) => setShippingAddressForm((prev) => ({ ...prev, state: e.target.value }))}
                                    placeholder="State"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:border-[#0c831f] transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Landmark (optional)</label>
                                <input
                                    type="text"
                                    value={shippingAddressForm.landmark}
                                    onChange={(e) => setShippingAddressForm((prev) => ({ ...prev, landmark: e.target.value }))}
                                    placeholder="Near ..."
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:border-[#0c831f] transition-all"
                                />
                            </div>
                        </div>

                        {/* Phase 8: Save Address to Profile Checkbox */}
                        <label className="flex items-center gap-2.5 mt-3.5 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={saveAddressToProfile}
                                onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                                className="w-4 h-4 rounded text-[#0c831f] focus:ring-[#0c831f] accent-[#0c831f] cursor-pointer"
                            />
                            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                Save this address to my profile for future orders
                            </span>
                        </label>
                    </div>
                </div>

                {/* Delivery Timing Section (Phase 8: Multi-Day Slots & Holidays) */}
                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <Calendar size={14} className="text-[#0c831f]" />
                        <h3 className="!text-[10px] font-black text-gray-400 tracking-widest uppercase">When to Deliver?</h3>
                    </div>

                    {loadingSlots ? (
                        <div className="flex gap-3 px-1 animate-pulse">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-14 w-28 bg-gray-100 dark:bg-white/5 rounded-2xl" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Date Chips Row */}
                            {availableDaysData?.days?.length > 0 && (
                                <div className="px-1">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Select Delivery Date</p>
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                                        {availableDaysData.days.map((d) => {
                                            const isSelected = selectedDate === d.date;
                                            return (
                                                <button
                                                    key={d.date}
                                                    type="button"
                                                    onClick={() => handleSelectDate(d)}
                                                    className={`px-3.5 py-2 rounded-2xl border-2 transition-all flex flex-col items-center shrink-0 min-w-[95px] ${
                                                        isSelected
                                                            ? 'border-[#0c831f] bg-green-50 dark:bg-green-500/10'
                                                            : d.isHoliday
                                                            ? 'border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/20'
                                                            : !d.isAvailable
                                                            ? 'border-gray-200 dark:border-white/5 opacity-60 bg-transparent'
                                                            : 'border-gray-100 dark:border-white/5 bg-transparent hover:border-gray-200'
                                                    }`}
                                                >
                                                    <span className={`text-[11px] font-black ${isSelected ? 'text-[#0c831f]' : d.isHoliday ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-gray-200'}`}>
                                                        {d.isToday ? 'Today' : d.isTomorrow ? 'Tomorrow' : d.dayName}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-gray-400 mt-0.5">
                                                        {d.dateLabel}
                                                    </span>
                                                    {d.isHoliday && (
                                                        <span className="mt-1 text-[8px] font-black uppercase text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.2 rounded-full">
                                                            Closed
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Holiday Notice for Selected Date */}
                            {currentSelectedDay?.isHoliday && (
                                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 flex items-start gap-2.5 mx-1">
                                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black">Shop Closed ({currentSelectedDay.holidayName || 'Holiday'})</p>
                                        <p className="text-[10px] font-medium mt-0.5 text-amber-700/80 dark:text-amber-400/80">
                                            {currentSelectedDay.holidayReason || 'Deliveries are unavailable on this date. Please pick another delivery date above.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Slots for Selected Date */}
                            {!currentSelectedDay?.isHoliday && (
                                <div className="flex flex-wrap gap-2 px-1">
                                    {/* Immediate Delivery Option: ONLY if selected date is today and immediate is enabled */}
                                    {currentSelectedDay?.isToday && (availableDaysData?.immediateDelivery?.enabled ?? deliverySettings.immediateDeliveryEnabled) && (
                                        <div
                                            onClick={() => { setIsImmediate(true); setSelectedSlotId(null); setSelectedSlotLabel(null); }}
                                            className={`px-4 py-2.5 rounded-2xl cursor-pointer border-2 transition-all flex flex-col items-center min-w-[110px] ${
                                                isImmediate
                                                    ? 'border-[#0c831f] bg-green-50 dark:bg-green-500/10'
                                                    : 'border-gray-100 dark:border-white/5 bg-transparent hover:border-gray-200'
                                            }`}
                                        >
                                            <span className={`text-[11px] font-black ${isImmediate ? 'text-[#0c831f]' : 'text-gray-900 dark:text-gray-200'}`}>⚡ Express</span>
                                            <span className="text-[8px] font-bold text-gray-400 mt-0.5 tracking-tight">
                                                {(availableDaysData?.immediateDelivery?.fee ?? deliverySettings.immediateDeliveryFee) > 0
                                                    ? `+₹${availableDaysData?.immediateDelivery?.fee ?? deliverySettings.immediateDeliveryFee} Surcharge`
                                                    : 'ASAP Delivery'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Slot options for this date */}
                                    {deliverySlots.map((slot) => {
                                        const isSlotActive = !isImmediate && selectedSlotId === slot._id;
                                        return (
                                            <div
                                                key={slot._id}
                                                onClick={() => { setIsImmediate(false); setSelectedSlotId(slot._id); setSelectedSlotLabel(slot.label); }}
                                                className={`px-4 py-2.5 rounded-2xl cursor-pointer border-2 transition-all flex flex-col items-center min-w-[110px] ${
                                                    isSlotActive
                                                        ? 'border-[#0c831f] bg-green-50 dark:bg-green-500/10'
                                                        : 'border-gray-100 dark:border-white/5 bg-transparent hover:border-gray-200'
                                                }`}
                                            >
                                                <span className={`text-[10px] font-black ${isSlotActive ? 'text-[#0c831f]' : 'text-gray-900 dark:text-gray-200'}`}>
                                                    {slot.label}
                                                </span>
                                                <span className="text-[8px] font-bold text-gray-400 mt-0.5 tracking-tight">
                                                    {slot.startTime} – {slot.endTime}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {deliverySlots.length === 0 && !isImmediate && (
                                        <p className="text-[10px] text-gray-400 font-medium px-1 pt-1">
                                            {currentSelectedDay?.isToday
                                                ? 'All delivery shifts for today have passed. Please select Tomorrow or another date above.'
                                                : 'No delivery shifts available on this date. Please select another date.'}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Chosen timing summary */}
                            <p className="text-[9px] font-bold text-gray-400 mt-3 px-1 uppercase tracking-wider">
                                {isImmediate && (availableDaysData?.immediateDelivery?.enabled ?? deliverySettings.immediateDeliveryEnabled)
                                    ? '⚡ Your order will be dispatched as soon as it is ready today'
                                    : selectedSlotLabel
                                    ? `🕐 Scheduled for delivery on ${currentSelectedDay?.displayLabel || selectedDate} during: ${selectedSlotLabel}`
                                    : 'Select an available delivery window'
                                }
                            </p>
                        </div>
                    )}
                </div>

                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <Clock size={14} className="text-[#0c831f]" />
                        <h3 className="!text-[10px] font-black text-gray-400 tracking-widest">Payment method</h3>
                    </div>
                    <div className="space-y-3">
                        {/* Wallet Option */}
                        <div
                            onClick={() => setPaymentMethod('wallet')}
                            className={`flex items-center justify-between p-4 rounded-[20px] cursor-pointer transition-all border ${paymentMethod === 'wallet' ? 'bg-green-50/50 dark:bg-green-500/5 border-[#0c831f]' : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border-[4px] bg-white ${paymentMethod === 'wallet' ? 'border-[#0c831f]' : 'border-gray-300'}`}></div>
                                <div className="flex flex-col">
                                    <span className={`text-[11px] font-black capitalize tracking-tight ${paymentMethod === 'wallet' ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>saathigro Wallet</span>
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">Available: ₹{walletBalance.toFixed(2)}</span>
                                </div>
                            </div>
                            <Wallet size={16} className={`${paymentMethod === 'wallet' ? 'text-[#0c831f]' : 'text-gray-300'}`} />
                        </div>

                        {/* COD Option */}
                        <div
                            onClick={() => setPaymentMethod('cod')}
                            className={`flex items-center justify-between p-4 rounded-[20px] cursor-pointer transition-all border ${paymentMethod === 'cod' ? 'bg-green-50/50 dark:bg-green-500/5 border-[#0c831f]' : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border-[4px] bg-white ${paymentMethod === 'cod' ? 'border-[#0c831f]' : 'border-gray-300'}`}></div>
                                <span className={`text-[11px] font-black capitalize tracking-tight ${paymentMethod === 'cod' ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>Cash on delivery</span>
                            </div>
                            {paymentMethod === 'cod' && <ShieldCheck size={14} className="text-[#0c831f]" />}
                        </div>

                        {/* Online Payment Main Option */}
                        <div
                            onClick={() => setPaymentMethod('online')}
                            className={`flex flex-col p-4 rounded-[20px] cursor-pointer transition-all border ${paymentMethod === 'online' ? 'bg-green-50/50 dark:bg-green-500/5 border-[#0c831f]' : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-[4px] bg-white ${paymentMethod === 'online' ? 'border-[#0c831f]' : 'border-gray-300'}`}></div>
                                    <span className={`text-[11px] font-black capitalize tracking-tight ${paymentMethod === 'online' ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>Online payment</span>
                                </div>
                                {paymentMethod === 'online' && <ShieldCheck size={14} className="text-[#0c831f]" />}
                            </div>

                            {/* Sub-options for Online Payment removed as per user request */}
                        </div>
                    </div>
                </div>

                {/* Promo Code Section */}
                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <Ticket size={14} className="text-[#0c831f]" />
                        <h3 className="!text-[10px] font-black text-gray-400 tracking-widest uppercase">Promo Code</h3>
                    </div>
                    
                    {/* Upselling Banners */}
                    {upsellingPromos.length > 0 && (
                        <div className="mb-6 px-1 space-y-3 animate-in fade-in zoom-in duration-500">
                            {upsellingPromos.map((promo) => {
                                const diff = promo.minOrderValue - cartTotal;
                                return (
                                    <div 
                                        key={promo._id} 
                                        onClick={() => navigate('/')}
                                        className="cursor-pointer bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/5 dark:to-emerald-500/5 border border-green-100 dark:border-green-500/20 p-4 rounded-3xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white dark:bg-green-500/20 rounded-2xl flex items-center justify-center text-[#0c831f] shadow-sm shrink-0">
                                                {promo.discountType === 'FreeGift' ? <Gift size={24} strokeWidth={2.5} /> : <Sparkles size={24} strokeWidth={2.5} />}
                                            </div>
                                            <div>
                                                <h4 className="text-[11px] font-black text-[#0c831f] uppercase tracking-wider mb-1">
                                                    {promo.discountType === 'FreeGift' ? '🎁 Claim Your Free Gift!' : '✨ Unlock Special Savings!'}
                                                </h4>
                                                <p className="text-[10px] text-gray-500 font-bold leading-tight">
                                                    Add <span className="text-[#0c831f] text-sm font-black">₹{diff}</span> more to get {promo.discountType === 'FreeGift' ? (promo.freeGift?.title || 'a Free Gift') : promo.description || 'this offer'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 bg-white dark:bg-green-500/20 rounded-full flex items-center justify-center text-[#0c831f] shadow-sm shrink-0">
                                            <ArrowRight size={16} strokeWidth={3} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!appliedPromo ? (
                        <>
                            <div className="flex gap-2 px-1">
                                <div className="relative flex-1">
                                    <input 
                                        type="text"
                                        placeholder="Enter Coupon Code"
                                        value={promoInput}
                                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:border-[#0c831f] transition-all"
                                    />
                                    {isValidatingPromo && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 size={14} className="animate-spin text-[#0c831f]" />
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleApplyPromo}
                                    disabled={isValidatingPromo || !promoInput}
                                    className="bg-[#0c831f] text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                                >
                                    Apply
                                </button>
                            </div>

                            {/* Available Promos List */}
                            {loadingPromos ? (
                                <div className="mt-4 px-1 animate-pulse">
                                    <div className="h-2 w-20 bg-gray-100 dark:bg-white/5 rounded-full mb-3"></div>
                                    <div className="flex flex-col gap-2">
                                        {[1, 2].map(i => (
                                            <div key={i} className="bg-gray-50 dark:bg-white/5 h-14 rounded-2xl border border-gray-100 dark:border-white/10"></div>
                                        ))}
                                    </div>
                                </div>
                            ) : (availablePromos.length > 0 || upsellingPromos.length > 0) && (
                                <div className="mt-4 px-1">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Available Offers</p>
                                    <div className="flex flex-col gap-2">
                                        {/* Applicable Promos */}
                                        {availablePromos.map((promo) => (
                                            <div 
                                                key={promo._id}
                                                onClick={() => {
                                                    if (appliedPromo) {
                                                        toast.warning("A coupon is already applied. Please remove it first.");
                                                        return;
                                                    }
                                                    setPromoInput(promo.code);
                                                    const autoApply = async () => {
                                                        setIsValidatingPromo(true);
                                                        try {
                                                            const result = await orderApi.validatePromoCode(token, promo.code, cartTotal);
                                                            setAppliedPromo(result.promoCode);
                                                            setPromoInput(promo.code);
                                                            toast.success(`Coupon Applied!`);
                                                        } catch (error) {
                                                            toast.error(error.message);
                                                        } finally {
                                                            setIsValidatingPromo(false);
                                                        }
                                                    };
                                                    autoApply();
                                                }}
                                                className="group cursor-pointer bg-white dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-3 flex items-center justify-between hover:border-[#0c831f] transition-all active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center text-[#0c831f] group-hover:bg-[#0c831f] group-hover:text-white transition-colors">
                                                        <Ticket size={14} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tight">{promo.code}</h4>
                                                        <p className="text-[9px] text-gray-400 font-bold">{promo.description || `Save ${promo.discountType === 'Percentage' ? promo.discountValue + '%' : '₹' + promo.discountValue}`}</p>
                                                    </div>
                                                </div>
                                                <div className="text-[#0c831f] text-[9px] font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Apply Code
                                                </div>
                                            </div>
                                        ))}

                                        {/* Upselling / Locked Promos */}
                                        {upsellingPromos.map((promo) => (
                                            <div 
                                                key={promo._id}
                                                onClick={() => navigate('/')}
                                                className="group cursor-pointer bg-gray-50/50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-3 flex items-center justify-between opacity-70 grayscale-[0.5] hover:grayscale-0 transition-all"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center text-gray-400">
                                                        <Lock size={12} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-tight">{promo.code}</h4>
                                                        <p className="text-[9px] text-gray-400 font-bold">Add ₹{promo.minOrderValue - cartTotal} more to unlock</p>
                                                    </div>
                                                </div>
                                                <div className="text-gray-400 text-[8px] font-black uppercase tracking-tighter">
                                                    Locked
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="px-1">
                            <div className="bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 rounded-2xl p-4 flex items-center justify-between animate-in zoom-in-95 duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-[#0c831f] rounded-full flex items-center justify-center text-white">
                                        <Sparkles size={16} />
                                    </div>
                                    <div>
                                        <h4 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tight">'{appliedPromo.code}' Applied!</h4>
                                        <p className="text-[9px] font-bold text-[#0c831f] uppercase tracking-wider">Extra savings unlocked</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleRemovePromo}
                                    className="text-red-500 text-[9px] font-black uppercase tracking-widest"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bill Details */}
                <div className="mb-8 relative min-h-[160px]">
                    {isCalculating && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl">
                            <div className="w-5 h-5 border-2 border-green-200 border-t-[#0c831f] rounded-full animate-spin"></div>
                            <span className="text-[10px] text-gray-500 font-bold mt-2 uppercase tracking-widest">Calculating Securely</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <ShoppingBag size={14} className="text-[#0c831f]" />
                        <h3 className="!text-[10px] font-black text-gray-400 tracking-widest">Bill details</h3>
                    </div>
                    <div className="space-y-3 px-1">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] text-gray-500 font-medium capitalize">Items total</span>
                            <span className="text-[11px] font-black text-gray-900 dark:text-white">₹{cartTotal}</span>
                        </div>
                        {billDetails?.immediateDeliveryFee > 0 ? (
                            <>
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] text-gray-500 font-medium capitalize">Base delivery fee</span>
                                    <span className={`text-[11px] font-black ${Number(billDetails?.baseDeliveryFee) === 0 ? 'text-[#0c831f]' : 'text-gray-900 dark:text-white'}`}>
                                        {Number(billDetails?.baseDeliveryFee) === 0 ? 'Free' : `₹${Number(billDetails?.baseDeliveryFee) || 0}`}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[#0c831f]">
                                    <span className="text-[11px] font-bold capitalize">Express delivery surcharge</span>
                                    <span className="text-[11px] font-black">+₹{billDetails.immediateDeliveryFee}</span>
                                </div>
                            </>
                        ) : (
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] text-gray-500 font-medium capitalize">Delivery fee</span>
                                <span className={`text-[11px] font-black ${Number(billDetails?.deliveryFee) === 0 ? 'text-[#0c831f]' : 'text-gray-900 dark:text-white'}`}>
                                    {Number(billDetails?.deliveryFee) === 0 ? 'Free' : `₹${Number(billDetails?.deliveryFee) || 0}`}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] text-gray-500 font-medium capitalize">Handling fee</span>
                            <span className="text-[11px] font-black text-gray-900 dark:text-white">₹{Number(billDetails?.handlingFee) || 0}</span>
                        </div>

                        {billDetails?.taxAmount > 0 && (
                            <div className="flex justify-between items-center pb-2">
                                <span className="text-[11px] text-gray-500 font-medium capitalize">Taxes (GST)</span>
                                <span className="text-[11px] font-black text-gray-900 dark:text-white">₹{billDetails?.taxAmount}</span>
                            </div>
                        )}

                        {billDetails?.discountAmount > 0 && (
                            <div className="flex justify-between items-center text-[#0c831f] animate-in slide-in-from-left duration-300">
                                <span className="text-[11px] font-bold capitalize">Promo Discount</span>
                                <span className="text-[11px] font-black">−₹{billDetails?.discountAmount}</span>
                            </div>
                        )}

                        {billDetails?.freeGift && (
                            <div className="flex justify-between items-center text-[#0c831f] animate-in slide-in-from-left duration-300 bg-green-50/30 dark:bg-green-500/5 p-2.5 rounded-xl border border-green-100/50 dark:border-green-500/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white dark:bg-green-500/20 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                        <PartyPopper size={18} className="animate-bounce" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black capitalize tracking-tight leading-none mb-0.5">Free Gift Reward</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight leading-tight">{billDetails.freeGift.title}</span>
                                    </div>
                                </div>
                                <span className="text-[10px] font-black uppercase bg-[#0c831f] text-white px-2.5 py-1 rounded-lg shadow-sm">Free</span>
                            </div>
                        )}

                        <div className="pt-5 border-t border-dashed border-gray-100 dark:border-white/10 flex justify-between items-center">
                            <span className="text-[14px] font-black text-gray-900 dark:text-white">To pay</span>
                            <span className="text-[20px] font-black text-gray-900 dark:text-white tracking-tighter">₹{Number(billDetails?.totalAmount) || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-black/95 backdrop-blur-md border-t border-gray-100 dark:border-white/5 p-4 z-50">
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-5 px-1">
                    <div className="flex flex-col">
                        <span className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Total Pay</span>
                        <span className="text-[18px] font-black text-gray-900 dark:text-white tracking-tighter leading-none">₹{Number(billDetails?.totalAmount) || 0}</span>
                    </div>
                    <button
                        onClick={handlePlaceOrder}
                        disabled={isPlacing || isCalculating || cart.length === 0 || isStoreOutOfRange || user?.isActive === false}
                        style={{ borderRadius: '16px' }}
                        className={`flex-1 ${isStoreOutOfRange || user?.isActive === false || isCalculating ? 'bg-gray-400' : 'bg-[#0c831f]'} text-white h-12 font-black text-[12px] uppercase tracking-[0.15em] transition-all shadow-xl shadow-green-500/20 active:scale-[0.98] flex items-center justify-center gap-2`}
                    >
                        {isPlacing || isCalculating ? (
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <span>{isStoreOutOfRange ? 'Out of Range' : (user?.isActive === false ? 'Account Blocked' : 'Place Order')}</span>
                                {!isStoreOutOfRange && user?.isActive !== false && <ArrowRight size={16} strokeWidth={3} />}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutPage;

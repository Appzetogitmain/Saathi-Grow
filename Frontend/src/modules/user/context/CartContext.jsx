import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useStore } from './StoreContext';
import { useNavigate } from 'react-router-dom';
import * as cartApi from '../api/userCartApi';
import { getPublicSettings } from '../api/publicSettingApi';
import { toast } from 'react-toastify';


const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
    // Start with an empty cart — NEVER pre-fill from localStorage on initial render.
    // Authenticated users will get their authoritative cloud cart fetched below.
    // Guest users will get their localStorage cart restored only if not logged in.
    const [cart, setCart] = useState([]);
    const [cartReady, setCartReady] = useState(false); // track if cart has been initialized

    const { token, logout } = useAuth();
    const { activeStore } = useStore();
    const navigate = useNavigate();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [publicSettings, setPublicSettings] = useState({
        baseDeliveryFee: 0,
        handlingFee: 0,
        surgeMultiplier: 1,
        freeDeliveryThreshold: 500,
        immediateDeliveryEnabled: true,
        immediateDeliveryFee: 0
    });

    // Fetch public rules and cart
    useEffect(() => {
        const fetchSettingsAndCart = async () => {
            try {
                const settingsInfo = await getPublicSettings();
                setPublicSettings(settingsInfo);
            } catch (e) {
                console.error("Failed fetching settings rulebook", e);
            }

            if (token) {
                // Authenticated: always use the cloud cart as the source of truth
                try {
                    const data = await cartApi.getCart(token);
                    const formatted = data.map(p => ({
                        ...p,
                        id: p.id || p._id,
                        productId: p.productId || p._id || p.id,
                        price: p.price || p.basePrice || 0,
                        quantity: p.quantity
                    }));
                    // Clear stale localStorage cart and use server version
                    localStorage.removeItem('saathigro_cart');
                    setCart(formatted);
                } catch (err) {
                    console.error('Failed to fetch user cart:', err);
                    // Fallback to localStorage only if server fetch completely fails
                    try {
                        const saved = localStorage.getItem('saathigro_cart');
                        if (saved) setCart(JSON.parse(saved));
                    } catch { }
                }
            } else {
                setCart([]);
                localStorage.removeItem('saathigro_cart');
            }
            setCartReady(true);
        };
        fetchSettingsAndCart();
    }, [token]);

    // Automatically clear cart if activeStore changes (due to automatic store selection on location change)
    const prevStoreIdRef = useRef(activeStore?.id);
    useEffect(() => {
        if (prevStoreIdRef.current && activeStore?.id && prevStoreIdRef.current !== activeStore.id) {
            if (cart.length > 0) {
                setCart([]);
                localStorage.removeItem('saathigro_cart');
                toast.info("Your cart was cleared as the nearest store changed.", { toastId: 'cart-cleared-store-change' });
            }
        }
        prevStoreIdRef.current = activeStore?.id;
    }, [activeStore?.id, cart.length]);

    // Continually backup to Local Storage and optionally Sync to Cloud if authenticated
    // IMPORTANT: only sync AFTER cartReady=true to avoid overwriting the server cart with the initial []
    useEffect(() => {
        if (!cartReady) return; // don't sync until cart has been fetched/initialized

        localStorage.setItem('saathigro_cart', JSON.stringify(cart));

        let timeoutId;
        if (token) {
            // Debounce syncing so dragging counters doesn't spam APIs extremely fast
            timeoutId = setTimeout(() => {
                cartApi.syncCart(token, cart).catch(err => {
                    console.error("Sync Cart Failure: " + err.message);
                    // SECURITY: If user is deactivated/blocked (403), force logout immediately
                    if (err.statusCode === 403 || err.message?.toLowerCase().includes('deactivated')) {
                        toast.error("Your account has been deactivated. Logging out...", { toastId: 'cart-deactivated' });
                        logout();
                        navigate('/');
                    }
                });
            }, 1000);
        }

        return () => clearTimeout(timeoutId);
    }, [cart, token, cartReady]);



    const addToCart = (product, quantityToAdd = 1) => {
        // Enforce Store-First logic: Only add if deliverable from the ACTIVE store
        if (product.isDeliverable === false) {
            toast.error("Not deliverable from this store", { toastId: 'not-deliverable' });
            return;
        }

        if (!activeStore) {
            toast.warning("Please select a store first", { toastId: 'select-store' });
            return;
        }

        const availableStock = product.availableStock ?? 999;
        const maxAllowed = product.maxAllowed ?? availableStock;
        const prodId = product.id || product._id;
        const baseProductId = product.productId || product._id || String(prodId).split('::')[0];

        if (maxAllowed <= 0) {
            toast.error("Safety stock limit reached", { toastId: `stock-limit-${prodId}` });
            return;
        }

        const existingItem = cart.find(item => item.id === prodId);
        if (existingItem && existingItem.quantity >= maxAllowed) {
            toast.warning(`Max ${maxAllowed} units allowed`, { toastId: `stock-limit-${prodId}` });
            return;
        }

        setCart((prevCart) => {
            const priceToUse = product.price || product.basePrice || 0;
            const existing = prevCart.find((item) => item.id === prodId);
            if (existing) {
                return prevCart.map((item) =>
                    item.id === prodId ? { ...item, quantity: item.quantity + quantityToAdd } : item
                );
            }
            return [...prevCart, { ...product, id: prodId, productId: baseProductId, price: priceToUse, quantity: quantityToAdd }];
        });
    };

    const removeFromCart = (id) => {
        setCart((prevCart) => prevCart.filter((item) => item.id !== id));
    };

    const updateQuantity = (id, delta) => {
        if (delta > 0) {
            const item = cart.find(i => i.id === id);
            if (item) {
                const availableStock = item.availableStock ?? 999;
                const maxAllowed = item.maxAllowed ?? availableStock;
                if (item.quantity + delta > maxAllowed) {
                    toast.warning(`Max ${maxAllowed} units allowed`, { toastId: `stock-limit-${id}` });
                    return;
                }
            }
        }

        setCart((prevCart) =>
            prevCart.map((item) => {
                if (item.id === id) {
                    const newQuantity = Math.max(0, item.quantity + delta);
                    return { ...item, quantity: newQuantity };
                }
                return item;
            }).filter(item => item.quantity > 0)
        );
    };

    const clearCart = async () => {
        setCart([]);
        localStorage.removeItem('saathigro_cart');
        // Also wipe on server so items don't come back on next login
        if (token) {
            try {
                await cartApi.clearCartOnServer(token);
            } catch (err) {
                console.error('Failed to clear server cart:', err);
            }
        }
    };

    const toggleCart = () => setIsCartOpen(!isCartOpen);

    const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

    return (
        <CartContext.Provider
            value={{
                cart,
                cartReady,
                addToCart,
                removeFromCart,
                updateQuantity,
                clearCart,
                cartTotal,
                cartCount,
                isCartOpen,
                toggleCart,
                setIsCartOpen,
                publicSettings
            }}
        >
            {children}
        </CartContext.Provider>
    );
};


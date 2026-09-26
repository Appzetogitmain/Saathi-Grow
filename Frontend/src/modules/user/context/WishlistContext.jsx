import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Heart } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useStore } from './StoreContext';
import * as wishlistApi from '../api/userWishlistApi';

const WishlistContext = createContext();

export const useWishlist = () => useContext(WishlistContext);

export const WishlistProvider = ({ children }) => {
    const [wishlist, setWishlist] = useState(() => {
        try {
            const savedWishlist = localStorage.getItem('saathigro_wishlist');
            return savedWishlist ? JSON.parse(savedWishlist) : [];
        } catch (error) {
            console.error('Error loading wishlist from localStorage:', error);
            return [];
        }
    });

    const { token } = useAuth();
    const { activeStore } = useStore();


    // Fetch wishlist from backend on mount or login or store change
    useEffect(() => {
        const fetchRemoteWishlist = async () => {
            if (token) {
                try {
                    const params = activeStore ? { storeId: activeStore.id, storeType: activeStore.type } : {};
                    const data = await wishlistApi.getWishlist(token, params);
                    // the backend returns full populated Product objects
                    // Map to Match frontend expectations (e.g. `_id` to `id`, `name`, `image`)
                    const formatted = data.map(p => ({
                        id: p._id || p.id,
                        name: p.name,
                        image: p.image || (p.gallery && p.gallery.length > 0 ? p.gallery[0] : ''),
                        price: p.basePrice,
                        originalPrice: p.mrp,
                        category: p.category,
                        unitValue: p.unitValue,
                        unitType: p.unitType,
                        isDeliverable: p.isDeliverable
                    }));
                    setWishlist(formatted);
                } catch (err) {
                    console.error('Failed to fetch user wishlist:', err);
                }
            } else {
                setWishlist([]);
                localStorage.removeItem('saathigro_wishlist');
            }
        };
        fetchRemoteWishlist();
    }, [token, activeStore?.id]);

    const addToWishlist = async (product) => {
        if (!isInWishlist(product.id || product._id)) {
            const prodId = product.id || product._id;

            // Optimistic UI update
            setWishlist(prev => [...prev, product]);

            if (token) {
                try {
                    await wishlistApi.addToWishlist(token, prodId);
                } catch (error) {
                    console.error('Failed to add to remote wishlist', error);
                    // Revert on failure
                    setWishlist(prev => prev.filter(item => (item.id || item._id) !== prodId));
                    return;
                }
            }

            toast.success(`${product.name} added to wishlist!`, {
                icon: <Heart size={16} className="text-red-500 fill-red-500" />,
                style: {
                    borderRadius: '14px',
                    background: document.documentElement.classList.contains('dark') ? '#000' : '#fff1f2',
                    color: document.documentElement.classList.contains('dark') ? '#fff' : '#be123c',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: '1px solid #be123c20'
                }
            });
        }
    };

    const removeFromWishlist = async (productId) => {
        if (token) {
            try {
                await wishlistApi.removeFromWishlist(token, productId);
            } catch (error) {
                console.error('Failed to remove from remote wishlist', error);
            }
        }
        setWishlist(prev => prev.filter(item => (item.id || item._id) !== productId));

        toast.info(`Item removed from wishlist`, {
            icon: <Heart size={16} className="text-gray-400" />,
            style: {
                borderRadius: '14px',
                background: document.documentElement.classList.contains('dark') ? '#000' : '#f9fafb',
                color: document.documentElement.classList.contains('dark') ? '#fff' : '#374151',
                fontSize: '12px',
                fontWeight: 'bold',
                border: '1px solid #e5e7eb'
            }
        });
    };

    const isInWishlist = (productId) => {
        return wishlist.some(item => (item.id === productId || item._id === productId));
    };

    const toggleWishlist = (product) => {
        const prodId = product.id || product._id;
        if (isInWishlist(prodId)) {
            removeFromWishlist(prodId);
        } else {
            addToWishlist(product);
        }
    };

    const value = {
        wishlist,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        toggleWishlist
    };

    return (
        <WishlistContext.Provider value={value}>
            {children}
        </WishlistContext.Provider>
    );
};


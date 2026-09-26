import React, {useRef , useState, useEffect}from 'react';
import { User, Mail, Phone, MapPin, Camera, ArrowLeft, ChevronRight, ShoppingBag, CreditCard, LogOut, Shield, Moon, Sun, Bell, HelpCircle, Heart, MessageCircle, Tag, BellRing, Edit2, X, Loader2, Share2, Copy, Check, Send } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'react-toastify';
import { getUserTags } from '../../api/orderApi';
import axios from 'axios';
import { API_BASE_URL } from '../../../../config/apiConfig';
import ImageSourceModal from '../../../../common/components/modals/ImageSourceModal';
import { showDeleteConfirmation, showSuccessAlert, showErrorAlert } from '../../../../common/utils/alertUtils';
import { buildReferralSharePayload } from '../../utils/referralUtils';
import { useShop, useShopUI } from '../../context/ShopContext';

const ProfilePage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const auth = useAuth();
    const { user, updateUser, loading, refreshProfile } = auth;

    const { isDarkMode, toggleTheme } = useTheme();
    const { settings: appSettings } = useShop();
    const { setIsBottomSheetOpen } = useShopUI();
    const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const fileInputRef = React.useRef(null);
    const [userTags, setUserTags] = useState([]);
    const { token } = auth;

    React.useEffect(() => {
        if (typeof refreshProfile === 'function') {
            refreshProfile();
        }
    }, []);

    React.useEffect(() => {
        if (token) {
            getUserTags(token).then(setUserTags).catch(() => {});
        }
    }, [token]);

    const [unreadCount, setUnreadCount] = useState(0);

    React.useEffect(() => {
        const fetchUnreadCount = async () => {
            if (!token) return;
            try {
                const res = await axios.get(`${API_BASE_URL}/notifications/unread-count`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    setUnreadCount(res.data.count);
                }
            } catch (err) {
                console.error('Error fetching unread notifications in profile:', err);
            }
        };

        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);

        const handleFirebaseMessage = (e) => {
            setUnreadCount(prev => prev + 1);
        };

        const handleNotificationsRead = () => {
            setUnreadCount(0);
        };

        window.addEventListener('onFirebaseMessage', handleFirebaseMessage);
        window.addEventListener('onNotificationsRead', handleNotificationsRead);
        return () => {
            clearInterval(interval);
            window.removeEventListener('onFirebaseMessage', handleFirebaseMessage);
            window.removeEventListener('onNotificationsRead', handleNotificationsRead);
        };
    }, [token]);

    // Edit Profile State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');

    useEffect(() => {
        if (showEditModal) {
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
    }, [showEditModal]);

    const handleImageSelect = async (file) => {
        if (file) {
            const formData = new FormData();
            formData.append('image', file);

            try {
                const result = await updateUser(formData);
                if (result.success) {
                    toast.success('Profile picture updated');
                } else {
                    toast.error(result.message || 'Upload failed');
                }
            } catch (error) {
                const msg = error?.response?.data?.message || error?.message || 'Upload failed';
                console.error('Profile image upload error:', error?.response?.data || error);
                toast.error(msg);
            }
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        if (editName.trim()) formData.append('name', editName.trim());
        if (editEmail.trim()) formData.append('email', editEmail.trim());

        const result = await updateUser(formData);
        if (result.success) {
            toast.success('Profile updated successfully');
            setShowEditModal(false);
        }
    };

    const handleDeleteAccount = async () => {
        const result = await showDeleteConfirmation(
            'Delete Account?',
            'This action is permanent and your account data will be permanently deleted from our database.'
        );
        if (result.isConfirmed) {
            try {
                const res = await axios.delete(`${API_BASE_URL}/auth/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    await showSuccessAlert('Deleted!', 'Your account has been deleted.');
                    auth.logout();
                    navigate('/');
                } else {
                    showErrorAlert('Error', res.data.message || 'Could not delete account.');
                }
            } catch (err) {
                console.error('Delete account error:', err);
                showErrorAlert('Error', err.response?.data?.message || 'Server error deleting account.');
            }
        }
    };

    const [showShareModal, setShowShareModal] = useState(false);
    const [showShareApps, setShowShareApps] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [copiedKey, setCopiedKey] = useState(null);

    const sharePayload = user?.referralCode
        ? buildReferralSharePayload(user.referralCode, appSettings || {})
        : null;
    const referralLink = sharePayload?.webLink || '';
    const inviteText = sharePayload?.shareText || referralLink;

    const handleShareApp = async () => {
        let code = user?.referralCode;
        if (!code && typeof refreshProfile === 'function') {
            toast.info('Preparing your invite link...');
            const refreshed = await refreshProfile();
            code = refreshed?.referralCode;
        }

        if (!code) {
            toast.error('Could not load your referral code. Please try again.');
            return;
        }

        // Always show in-app invite sheet (cleaner on Flutter WebView than system share scrapes)
        setShowShareApps(false);
        setShowShareModal(true);
        setIsBottomSheetOpen(true);
    };

    const copyText = async (text, key = 'all') => {
        if (!text) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopiedKey(key);
            setLinkCopied(key === 'all');
            toast.success(key === 'all' ? 'Invite message copied!' : 'Copied!');
            setTimeout(() => {
                setCopiedKey(null);
                setLinkCopied(false);
            }, 2000);
        } catch {
            toast.error('Could not copy');
        }
    };

    const handleCopyReferralLink = () => copyText(inviteText, 'all');

    const openExternalShare = (href) => {
        if (!href) return;
        const a = document.createElement('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const shareViaApp = (app) => {
        if (!inviteText) {
            toast.error('Invite link not ready yet');
            return;
        }
        const text = encodeURIComponent(inviteText);
        const url = encodeURIComponent(referralLink || inviteText);
        const subject = encodeURIComponent('Join me on Saathigro');

        switch (app) {
            case 'whatsapp':
                openExternalShare(`https://wa.me/?text=${text}`);
                break;
            case 'telegram':
                openExternalShare(`https://t.me/share/url?url=${url}&text=${text}`);
                break;
            case 'sms':
                // Works on Android + iOS WebView / mobile browsers
                openExternalShare(`sms:?&body=${text}`);
                break;
            case 'email':
                openExternalShare(`mailto:?subject=${subject}&body=${text}`);
                break;
            default:
                break;
        }
    };

    const handleNativeShare = async () => {
        if (!inviteText) return;

        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            const shareData = { title: 'Saathigro Invite', text: inviteText };
            try {
                if (!navigator.canShare || navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    return;
                }
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
            try {
                await navigator.share({ title: 'Saathigro Invite', text: referralLink || inviteText });
                return;
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
        }

        toast.info('Pick WhatsApp, Telegram, SMS or Email above to share');
        setShowShareApps(true);
    };

    const handleShareViaAppsClick = () => {
        if (!inviteText) {
            toast.error('Invite link not ready yet');
            return;
        }
        // Always show app chooser first (Flutter WebView often lacks a real OS share sheet).
        setShowShareApps((prev) => !prev);
    };

    const closeShareModal = () => {
        setShowShareModal(false);
        setShowShareApps(false);
        setIsBottomSheetOpen(false);
    };

    useEffect(() => {
        if (!showShareModal) return undefined;
        setIsBottomSheetOpen(true);
        return () => setIsBottomSheetOpen(false);
    }, [showShareModal, setIsBottomSheetOpen]);

    const openEditModal = () => {
        setEditName(user?.name || '');
        setEditEmail(user?.email || '');
        setShowEditModal(true);
    };

    const sections = [
        { icon: ShoppingBag, label: "My Orders", subtitle: "Track and manage your orders", path: "/orders" },
        { icon: MessageCircle, label: "My Complaints", subtitle: "Check status of your grievances", path: "/my-complaints" },
        { icon: Bell, label: "Notifications", subtitle: "View your alerts and updates", path: "/notifications" },
        ...userTags.map(t => ({
            icon: Tag,
            label: `${t.tagName.charAt(0).toUpperCase() + t.tagName.slice(1)} (${t.orderCount})`,
            subtitle: `${t.orderCount} tagged order${t.orderCount > 1 ? 's' : ''}`,
            path: `/orders/tagged/${encodeURIComponent(t.tagName)}`
        })),
        { icon: MapPin, label: "Saved Addresses", subtitle: "Manage your delivery locations", path: "/saved-addresses" },
        { icon: Heart, label: "My Wishlist", subtitle: "Your favorite items", path: "/wishlist" },
        { icon: CreditCard, label: "saathigro Wallet", subtitle: `₹${Number(user?.walletBalance || 0).toFixed(2)} Balance available`, path: "/wallet" },
        { icon: Share2, label: "Invite & Share App", subtitle: "Share your referral link with friends", action: "share" },
        { icon: HelpCircle, label: "FAQs & Help Center", subtitle: "Find answers and guides", path: "/help" },
        { icon: MessageCircle, label: "Raise a Complaint", subtitle: "Raise a ticket for any issue", path: "/support/raise-ticket" },
        { icon: Shield, label: "Legal & Policies", subtitle: "Terms, Privacy and more", path: "/settings" }
    ];


    return (
        <div className="min-h-screen bg-gradient-to-r from-[#e8f5e9] to-[#ffffff] dark:from-[#141414] dark:to-[#141414] md:bg-none md:bg-white md:dark:bg-black pt-24 px-0 pb-0 md:p-2 w-full max-w-full">
            <div className="max-w-2xl md:max-w-6xl mx-auto">
                {/* Header */}
                <div className="hidden md:flex items-center gap-3 p-4 md:p-0 mb-0 md:mb-1 bg-gradient-to-br from-[#f6fbf7] to-[#e8f5e9] md:bg-none md:bg-white md:dark:bg-black border-b border-gray-50 md:border-none">
                    <button
                        onClick={() => {
                            if (window.innerWidth >= 768) {
                                navigate('/');
                            } else {
                                const from = location.state?.from || '/';
                                navigate(from);
                            }
                        }}
                        className="p-1.5 md:p-2 bg-white/50 dark:bg-[#141414] rounded-full hover:bg-gray-100 transition-colors md:bg-gray-50"
                    >
                        <ArrowLeft size={16} className="md:w-6 md:h-6" />
                    </button>
                    <h1 className="!text-[16px] md:!text-[18px] font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest flex-1">My Profile</h1>
                    <button 
                        onClick={openEditModal}
                        className="p-1.5 md:p-2 bg-[#eefaf1] text-[#0c831f] rounded-full hover:bg-[#0c831f] hover:text-white transition-colors"
                        title="Edit Profile"
                    >
                        <Edit2 size={16} className="md:w-5 md:h-5" />
                    </button>

                </div>





                <div className="md:grid md:grid-cols-3 md:gap-4">
                    {/* Profile Section - Integrated */}
                    <div className="mb-0 md:bg-white md:dark:bg-black md:rounded-2xl md:border md:border-gray-100 dark:md:border-white/5 md:p-2 bg-transparent md:bg-gradient-to-b md:from-[#f6fbf7] md:to-white dark:md:from-black dark:md:to-black">
                        <div className="flex flex-col items-center pt-1 pb-2 md:py-0">
                            <div className="relative mb-1 md:mb-2">
                                <div className="w-24 h-24 md:w-24 md:h-24 bg-[#eefaf1] dark:bg-[#0c831f]/10 rounded-full flex items-center justify-center border-4 border-white md:border-gray-50 dark:border-white/5 overflow-hidden shadow-sm">
                                    {loading ? (
                                        <Loader2 className="animate-spin text-[#0c831f]" size={30} />
                                    ) : (
                                        user?.profileImage ? (
                                            <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={36} className="text-[#556b2f] md:w-12 md:h-12" />
                                        )
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsImageModalOpen(true)}
                                    disabled={loading}
                                    className="absolute -bottom-1 -right-1 p-2 md:p-2.5 bg-[#556b2f] text-white rounded-full md:rounded-lg shadow-lg border-2 border-white dark:border-[#141414] active:scale-95 transition-transform hover:bg-[#0a6b19] disabled:opacity-50"
                                >
                                    <Camera size={14} className="md:w-5 md:h-5" />
                                </button>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <h2 className="!text-[20px] md:!text-[18px] font-bold text-gray-900 dark:text-gray-100">{user?.name || "Saathi Member"}</h2>
                                <button onClick={openEditModal} className="text-[#0c831f] p-1 rounded-full hover:bg-[#e8f5e9] md:hidden">
                                    <Edit2 size={14} />
                                </button>
                            </div>
                            <p className="!text-[12px] md:!text-xs text-gray-400 font-bold tracking-widest mt-1.5 md:mt-2">{user?.email || (user?.phone ? `+91 ${user.phone}` : "member@saathigro.com")}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-2 md:py-3 border-y border-gray-100 dark:border-white/5 max-w-lg mx-auto md:max-w-none md:mx-0 bg-transparent md:bg-transparent">
                            <div className="text-center">
                                <p className="!text-[16px] md:!text-[18px] font-bold text-gray-900 dark:text-gray-100">{user?.totalOrders || 0}</p>
                                <p className="!text-[9px] md:!text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Orders</p>
                            </div>
                            <div className="text-center">
                                <p className="!text-[16px] md:!text-[18px] font-bold text-gray-900 dark:text-gray-100">₹{Number(user?.walletBalance || 0).toFixed(2)}</p>
                                <p className="!text-[9px] md:!text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Savings</p>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 bg-transparent md:bg-transparent">
                        <div className="space-y-0 md:space-y-1 mb-0 md:mb-2 max-w-none mx-auto md:mx-0">
                            <h3 className="!text-[10px] md:!text-[9px] font-bold text-gray-400 px-6 py-3 md:px-2 md:mb-1 tracking-widest uppercase bg-transparent md:bg-transparent border-t md:border-t-0 border-gray-100 dark:border-white/5">My Information</h3>
                            <div className="divide-y divide-gray-100 dark:divide-white/5 bg-transparent md:bg-white md:dark:bg-black md:rounded-2xl md:border md:border-gray-50 dark:md:border-white/5 overflow-hidden">
                                {sections.map((item, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            if (item.action === 'share') {
                                                handleShareApp();
                                                return;
                                            }
                                            navigate(item.path, { state: { from: '/profile' } });
                                        }}
                                        className="w-full py-3 px-6 md:py-1.5 md:px-4 flex items-center justify-between hover:bg-[#e8f5e9] md:hover:bg-gray-50 dark:hover:bg-white/5 transition-all group"
                                    >
                                        <div className="flex items-center gap-4 md:gap-6">
                                            <div className="w-9 h-9 md:w-9 md:h-9 bg-gray-50/50 md:bg-white dark:bg-white/5 md:border border-gray-100 dark:border-white/10 rounded-full md:rounded-lg flex items-center justify-center text-[#556b2f] md:shadow-sm group-hover:bg-[#eefaf1] transition-colors">
                                                <item.icon size={18} className="md:w-4.5 md:h-4.5" />
                                            </div>
                                            <div className="text-left leading-tight">
                                                <div className="flex items-center gap-2 mb-1 md:mb-1.5">
                                                    <h4 className="!text-[14px] font-semibold text-gray-800 dark:text-gray-100 leading-none">{item.label}</h4>
                                                    {item.label === "Notifications" && unreadCount > 0 && (
                                                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                                    )}
                                                </div>
                                                <p className="!text-[10px] md:!text-[11px] text-gray-400 font-medium">{item.subtitle}</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-300 group-hover:text-[#556b2f] transition-colors md:w-5 md:h-5" />
                                    </button>
                                ))}
                            </div>

                            <h3 className="!text-[10px] md:!text-[9px] font-bold text-gray-400 px-6 py-3 md:px-2 md:mt-1 md:mb-0.5 tracking-widest uppercase bg-transparent md:bg-transparent border-t md:border-t-0 border-gray-100 dark:border-white/5">App Preferences</h3>
                            <div className="divide-y divide-gray-100 dark:divide-white/5 bg-transparent md:bg-white md:dark:bg-black md:rounded-2xl md:border border-gray-50 dark:md:border-white/5 overflow-hidden">
                                {/* Theme Toggle */}
                                <button 
                                    onClick={toggleTheme}
                                    className="w-full py-3 px-6 md:py-1.5 md:px-4 flex items-center justify-between hover:bg-[#e8f5e9] md:hover:bg-gray-50 dark:hover:bg-white/5 transition-all group"
                                >
                                    <div className="flex items-center gap-4 md:gap-6">
                                        <div className="w-9 h-9 md:w-9 md:h-9 bg-purple-50 dark:bg-purple-500/10 md:border border-gray-100 dark:border-white/10 rounded-full md:rounded-lg flex items-center justify-center md:shadow-sm">
                                            {isDarkMode ? <Moon size={18} className="text-purple-600 md:w-4.5 md:h-4.5" /> : <Sun size={18} className="text-orange-500 md:w-4.5 md:h-4.5" />}
                                        </div>
                                        <div className="text-left leading-tight">
                                            <h4 className="!text-[14px] font-semibold text-gray-800 dark:text-gray-100 leading-none mb-0 md:mb-0.5">Dark Mode</h4>
                                            <p className="!text-[10px] md:!text-[11px] text-gray-400 font-medium">Toggle app appearance</p>
                                        </div>
                                    </div>
                                    <div className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 ${isDarkMode ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </button>


                            </div>

                            {/* Logout Button */}
                            <button
                                onClick={() => navigate('/logout-confirmation')}
                                className="w-full py-3 px-6 md:py-1.5 md:px-4 flex items-center justify-between bg-transparent md:bg-white md:dark:bg-black hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group border-t border-gray-100 dark:border-white/5 md:mt-1 md:rounded-2xl md:border"
                            >
                                <div className="flex items-center gap-4 md:gap-6">
                                    <div className="w-9 h-9 md:w-9 md:h-9 bg-red-50 dark:bg-red-900/20 md:border border-red-100 dark:border-red-500/10 rounded-full md:rounded-lg flex items-center justify-center text-red-500 md:shadow-sm">
                                        <LogOut size={18} className="md:w-4.5 md:h-4.5" />
                                    </div>
                                    <div className="text-left">
                                        <h4 className="!text-[14px] font-semibold text-red-600 dark:text-red-400 leading-none mb-1 md:mb-1.5">Log Out</h4>
                                        <p className="!text-[10px] md:!text-sm text-red-400/70 font-medium">Sign out of your account</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-red-200 group-hover:text-red-500 transition-colors md:w-5 md:h-5" />
                            </button>

                            {/* Delete Account Button */}
                            <button
                                onClick={handleDeleteAccount}
                                className="w-full py-3 px-6 md:py-1.5 md:px-4 flex items-center justify-between bg-transparent md:bg-white md:dark:bg-black hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group border-t border-gray-100 dark:border-white/5 md:mt-1 md:rounded-2xl md:border"
                            >
                                <div className="flex items-center gap-4 md:gap-6">
                                    <div className="w-9 h-9 md:w-9 md:h-9 bg-red-50 dark:bg-red-900/20 md:border border-red-100 dark:border-red-500/10 rounded-full md:rounded-lg flex items-center justify-center text-red-500 md:shadow-sm">
                                        <Shield size={18} className="md:w-4.5 md:h-4.5 text-red-500" />
                                    </div>
                                    <div className="text-left">
                                        <h4 className="!text-[14px] font-semibold text-red-600 dark:text-red-400 leading-none mb-1 md:mb-1.5">Delete Account</h4>
                                        <p className="!text-[10px] md:!text-sm text-red-400/70 font-medium">Permanently delete your account</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-red-200 group-hover:text-red-500 transition-colors md:w-5 md:h-5" />
                            </button>
                        </div>

                        {/* Support Info */}
                        <div className="bg-gray-50 dark:bg-zinc-900/50 md:bg-[#eefaf1] md:dark:bg-zinc-900/30 md:rounded-2xl p-4 md:p-2 border-none md:border border-[#0c831f]/10 dark:border-white/5 text-center max-w-none mx-auto md:max-w-none md:mx-0 mt-3 md:mt-2">
                            <p className="text-[10px] md:text-sm text-gray-400 dark:text-zinc-500 md:text-[#0c831f] dark:md:text-[#0c831f] font-bold">saathigro App v1.0.0</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Profile Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#141414] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 dark:border-white/10 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-white/10">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest">Edit Profile</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-red-500 transition-colors bg-gray-50 dark:bg-white/5 p-2 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input 
                                        type="text" 
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-semibold text-gray-900 dark:text-gray-100 focus:border-[#0c831f] focus:ring-1 focus:ring-[#0c831f] outline-none transition-all"
                                        placeholder="Enter your name"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input 
                                        type="email" 
                                        value={editEmail}
                                        onChange={(e) => setEditEmail(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-semibold text-gray-900 dark:text-gray-100 focus:border-[#0c831f] focus:ring-1 focus:ring-[#0c831f] outline-none transition-all"
                                        placeholder="Enter your email"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 opacity-60">
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input 
                                        type="text" 
                                        value={user?.phone ? `+91 ${user.phone}` : ''}
                                        disabled
                                        className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-semibold text-gray-500 dark:text-gray-500 cursor-not-allowed outline-none"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 font-medium ml-1">Phone number cannot be changed.</p>
                            </div>
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full mt-2 py-4 bg-[#0c831f] text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-[#0a6b19] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-[#0c831f]/20 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 size={20} className="animate-spin" /> : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Share / Invite Modal — mobile WebView safe layout */}
            {showShareModal && (
                <div
                    className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
                    onClick={closeShareModal}
                >
                    <div
                        className="bg-white dark:bg-[#141414] rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 dark:border-white/10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col overflow-hidden"
                        style={{
                            maxHeight: 'min(92dvh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)))',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-white/10 shrink-0">
                            <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest">Invite Friends</h3>
                            <button
                                type="button"
                                onClick={closeShareModal}
                                className="text-gray-400 hover:text-red-500 transition-colors bg-gray-50 dark:bg-white/5 p-2 rounded-full"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
                            <p className="text-[12px] sm:text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                                Share your referral code. Friends who join with it are tagged to you.
                            </p>

                            <div className="bg-[#eefaf1] dark:bg-[#0c831f]/10 rounded-2xl px-4 py-3 sm:py-4 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Your code</p>
                                <p className="text-xl sm:text-2xl font-black text-[#0c831f] tracking-[0.2em]">{user?.referralCode || '—'}</p>
                            </div>

                            <div className="space-y-2">
                                {sharePayload?.playStoreLink && (
                                    <div className="flex items-center gap-2.5 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2.5 sm:py-3 min-w-0">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Play Store</p>
                                            <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 truncate">Android app download</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(sharePayload.playStoreLink, 'play')}
                                            className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-[#0c831f]"
                                            aria-label="Copy Play Store link"
                                        >
                                            {copiedKey === 'play' ? <Check size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                )}

                                {sharePayload?.appStoreLink && (
                                    <div className="flex items-center gap-2.5 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2.5 sm:py-3 min-w-0">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">App Store</p>
                                            <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 truncate">iOS app download</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(sharePayload.appStoreLink, 'ios')}
                                            className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-[#0c831f]"
                                            aria-label="Copy App Store link"
                                        >
                                            {copiedKey === 'ios' ? <Check size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center gap-2.5 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2.5 sm:py-3 min-w-0">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Web invite</p>
                                        <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 truncate">{referralLink || '—'}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => copyText(referralLink, 'web')}
                                        className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-[#0c831f]"
                                        aria-label="Copy web invite link"
                                    >
                                        {copiedKey === 'web' ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>

                            {showShareApps && (
                                <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-3 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 text-center">
                                        Choose an app
                                    </p>
                                    <div className="grid grid-cols-4 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => shareViaApp('whatsapp')}
                                            className="flex flex-col items-center gap-1.5 p-1.5 rounded-xl hover:bg-white dark:hover:bg-white/10 transition-colors"
                                        >
                                            <span className="h-11 w-11 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-sm">
                                                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                </svg>
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200">WhatsApp</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => shareViaApp('telegram')}
                                            className="flex flex-col items-center gap-1.5 p-1.5 rounded-xl hover:bg-white dark:hover:bg-white/10 transition-colors"
                                        >
                                            <span className="h-11 w-11 rounded-2xl bg-[#229ED9] text-white flex items-center justify-center shadow-sm">
                                                <Send size={18} strokeWidth={2.25} />
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200">Telegram</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => shareViaApp('sms')}
                                            className="flex flex-col items-center gap-1.5 p-1.5 rounded-xl hover:bg-white dark:hover:bg-white/10 transition-colors"
                                        >
                                            <span className="h-11 w-11 rounded-2xl bg-[#0c831f] text-white flex items-center justify-center shadow-sm">
                                                <MessageCircle size={20} strokeWidth={2.25} />
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200">SMS</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => shareViaApp('email')}
                                            className="flex flex-col items-center gap-1.5 p-1.5 rounded-xl hover:bg-white dark:hover:bg-white/10 transition-colors"
                                        >
                                            <span className="h-11 w-11 rounded-2xl bg-[#EA4335] text-white flex items-center justify-center shadow-sm">
                                                <Mail size={18} strokeWidth={2.25} />
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200">Email</span>
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleNativeShare}
                                        className="w-full py-2.5 rounded-xl text-[12px] font-bold text-[#0c831f] bg-white dark:bg-white/10 border border-[#0c831f]/20 flex items-center justify-center gap-2"
                                    >
                                        <Share2 size={15} />
                                        More apps
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 px-4 sm:px-5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-[#141414]">
                            <button
                                type="button"
                                onClick={handleCopyReferralLink}
                                className="w-full py-3 sm:py-3.5 rounded-2xl font-bold text-center text-white bg-[#0c831f] hover:bg-[#0a6b19] transition-colors flex items-center justify-center gap-2"
                            >
                                {linkCopied ? <Check size={18} /> : <Copy size={18} />}
                                {linkCopied ? 'Copied full invite' : 'Copy full invite'}
                            </button>
                            <button
                                type="button"
                                onClick={handleShareViaAppsClick}
                                className="w-full py-3 sm:py-3.5 rounded-2xl font-bold text-center text-[#0c831f] bg-[#eefaf1] dark:bg-[#0c831f]/15 hover:bg-[#dff5e4] transition-colors flex items-center justify-center gap-2"
                            >
                                <Share2 size={18} />
                                Share via apps
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isImageModalOpen && (
                <ImageSourceModal 
                    isOpen={isImageModalOpen}
                    onClose={() => setIsImageModalOpen(false)}
                    onSelect={handleImageSelect}
                />
            )}
        </div>
    );
};

export default ProfilePage;

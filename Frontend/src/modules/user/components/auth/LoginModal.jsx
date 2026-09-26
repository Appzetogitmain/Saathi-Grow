import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, User, ArrowRight, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as authApi from '../../api/userAuthApi';
import { toast } from 'react-toastify';
import PolicyViewerModal from '../../../../common/components/legal/PolicyViewerModal';
import { useLocation } from '../../context/LocationContext';
import { getStoredReferralCode } from '../../utils/referralUtils';

const LoginModal = () => {
    const navigate = useNavigate();
    const { showLoginModal, closeLoginModal, verifyOtp } = useAuth();
    const { location, openLocationModal } = useLocation();

    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [showOTP, setShowOTP] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [viewPolicy, setViewPolicy] = useState({ isOpen: false, slug: '', title: '' });

    useEffect(() => {
        let timer;
        if (resendTimer > 0) {
            timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [resendTimer]);

    if (!showLoginModal) return null;

    const handleClose = () => {
        closeLoginModal();
        if (window.location.pathname === '/login' || window.location.pathname === '/register') {
            navigate('/');
        }
    };

    const handleSendOTP = async (e) => {
        if (e) e.preventDefault();
        const cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.length !== 10) {
            return toast.error('Please enter a valid 10-digit mobile number');
        }

        setLoading(true);
        try {
            await authApi.requestOTP(cleaned);
            setShowOTP(true);
            setResendTimer(60);
            toast.success('OTP sent successfully');
        } catch (error) {
            toast.error(error.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        if (e) e.preventDefault();
        if (otp.length !== 6) {
            return toast.error('Please enter a 6-digit OTP');
        }

        setLoading(true);
        try {
            const referralCode = getStoredReferralCode();
            const result = await verifyOtp({
                phone: phoneNumber,
                otp,
                referralCode: referralCode || undefined
            });

            if (result.success) {
                closeLoginModal();
                setPhoneNumber('');
                setOtp('');
                setShowOTP(false);

                if (result.isRegistrationComplete === false) {
                    navigate('/register');
                } else {
                    // Check location selection
                    const hasLocation = Boolean(
                        location?.coordinates?.length === 2 ||
                        (location?.address && location.address !== 'Select Location')
                    );
                    if (!hasLocation) {
                        setTimeout(() => {
                            openLocationModal();
                        }, 500);
                    }
                }
            }
        } catch (error) {
            toast.error(error.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        if (resendTimer > 0 || loading) return;
        setLoading(true);
        try {
            await authApi.resendOTP(phoneNumber);
            setResendTimer(60);
            toast.success('OTP resent successfully');
        } catch (error) {
            toast.error(error.message || 'Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-white/30 dark:bg-black/50 backdrop-blur-sm transition-opacity" onClick={handleClose} />
            <div className="bg-white dark:bg-[#121212] border dark:border-white/5 rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors z-20"
                    aria-label="Close"
                >
                    <X size={18} className="text-gray-600 dark:text-gray-400" />
                </button>

                <div className="p-6 md:p-8">
                    <div className="text-center mb-6">
                        <div className="bg-[var(--saathi-green)]/10 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 text-[var(--saathi-green)]">
                            <User size={28} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {showOTP ? 'Verify OTP' : 'Welcome to Saathi-Grow'}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {showOTP ? `Enter OTP sent to +91 ${phoneNumber}` : 'Enter your mobile number to continue'}
                        </p>
                    </div>

                    {!showOTP ? (
                        <form onSubmit={handleSendOTP} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                    Mobile Number
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3.5 text-gray-500 dark:text-gray-400 font-bold text-sm">+91</span>
                                    <input
                                        type="tel"
                                        maxLength="10"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                        className="block w-full pl-12 pr-3 py-3 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-1 focus:ring-[var(--saathi-green)] focus:border-[var(--saathi-green)] outline-none bg-gray-50 dark:bg-white/5 text-sm font-bold text-gray-900 dark:text-white"
                                        placeholder="98765 43210"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || phoneNumber.length !== 10}
                                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-lg shadow-[var(--saathi-green)]/20 text-sm font-black text-white bg-[var(--saathi-green)] hover:bg-[var(--saathi-green-hover)] transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <ArrowRight size={18} className="mr-2" />}
                                Continue
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOTP} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider text-center">
                                    Enter 6-digit OTP
                                </label>
                                <input
                                    type="tel"
                                    maxLength="6"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                    className="block w-full px-3 py-3 border border-gray-200 dark:border-white/10 rounded-xl text-center text-2xl tracking-[0.2em] font-black focus:ring-1 focus:ring-[var(--saathi-green)] focus:border-[var(--saathi-green)] outline-none bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white"
                                    placeholder="••••••"
                                    required
                                    autoFocus
                                />
                                <div className="flex justify-between mt-2">
                                    <button
                                        type="button"
                                        onClick={handleResendOTP}
                                        disabled={resendTimer > 0 || loading}
                                        className="text-xs text-[var(--saathi-green)] font-bold hover:underline disabled:opacity-50"
                                    >
                                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowOTP(false); setOtp(''); }}
                                        className="text-xs text-gray-400 dark:text-gray-500 font-medium hover:underline"
                                    >
                                        Change Number?
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || otp.length !== 6}
                                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-lg shadow-[var(--saathi-green)]/20 text-sm font-black text-white bg-[var(--saathi-green)] hover:bg-[var(--saathi-green-hover)] transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <ShieldCheck size={18} className="mr-2" />}
                                Verify & Proceed
                            </button>
                        </form>
                    )}

                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 text-center">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                            By continuing, you agree to our{' '}
                            <button
                                type="button"
                                onClick={() => setViewPolicy({ isOpen: true, slug: 'terms-and-conditions', title: 'Terms & Conditions' })}
                                className="text-[var(--saathi-green)] underline font-medium"
                            >
                                Terms
                            </button>{' '}
                            and{' '}
                            <button
                                type="button"
                                onClick={() => setViewPolicy({ isOpen: true, slug: 'privacy-policy', title: 'Privacy Policy' })}
                                className="text-[var(--saathi-green)] underline font-medium"
                            >
                                Privacy Policy
                            </button>.
                        </p>
                    </div>
                </div>
            </div>

            <PolicyViewerModal
                isOpen={viewPolicy.isOpen}
                onClose={() => setViewPolicy({ isOpen: false, slug: '', title: '' })}
                policySlug={viewPolicy.slug}
                audience="User"
                title={viewPolicy.title}
            />
        </div>
    );
};

export default LoginModal;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as authApi from '../../api/userAuthApi';
import { toast } from 'react-toastify';
import PolicyViewerModal from '../../../../common/components/legal/PolicyViewerModal';
import { useLocation } from '../../context/LocationContext';
import { getStoredReferralCode } from '../../utils/referralUtils';

const LoginModal = () => {
    const navigate = useNavigate();
    const { showLoginModal, closeLoginModal, login, register, loginView, setLoginView } = useAuth();
    const { location, openLocationModal } = useLocation();

    const handleClose = () => {
        closeLoginModal();
        if (window.location.pathname === '/login' || window.location.pathname === '/register') {
            navigate('/');
        }
    };
    const [phoneNumber, setPhoneNumber] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [showOTP, setShowOTP] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [viewPolicy, setViewPolicy] = useState({ isOpen: false, slug: '', title: '' });

    useEffect(() => {
        let timer;
        if (resendTimer > 0) {
            timer = setInterval(() => setResendTimer(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [resendTimer]);

    if (!showLoginModal) return null;

    const handleSendOTP = async (e) => {
        e.preventDefault();
        if (phoneNumber.length !== 10) {
            return toast.error('Please enter a valid 10-digit number');
        }
        if (loginView === 'register') {
            if (!name) {
                return toast.error('Please enter your name');
            }
            const nameRegex = /^[a-zA-Z\s]+$/;
            if (!nameRegex.test(name.trim())) {
                return toast.error('Full name should only contain letters and spaces, without numbers or special characters');
            }
            if (!agreedToTerms) {
                return toast.error('Please agree to the Terms & Conditions and Privacy Policy to register');
            }
        }

        setLoading(true);
        try {
            await authApi.requestOTP(phoneNumber, loginView);
            setShowOTP(true);
            setResendTimer(60);
            toast.success('OTP sent successfully');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        if (otp.length !== 6) {
            return toast.error('Please enter a 6-digit OTP');
        }

        const credentials = { phone: phoneNumber, otp };
        if (loginView === 'register') {
            credentials.name = name;
            credentials.email = email || undefined;
            const referralCode = getStoredReferralCode();
            if (referralCode) {
                credentials.referralCode = referralCode;
            }
        }

        const result = loginView === 'login'
            ? await login(credentials)
            : await register(credentials);

        if (result.success) {
            // State reset handled by AuthContext closing modal or user refresh
            setPhoneNumber('');
            setName('');
            setEmail('');
            setOtp('');
            setShowOTP(false);
            
            // Ask for location immediately after login/register ONLY if not already selected
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
    };

    const handleResendOTP = async () => {
        if (resendTimer > 0) return;
        setLoading(true);
        try {
            await authApi.resendOTP(phoneNumber);
            setResendTimer(60);
            toast.success('OTP resent successfully');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-white/30 dark:bg-black/50 backdrop-blur-sm transition-opacity" onClick={handleClose}></div>
            <div className="bg-white dark:bg-[#121212] border dark:border-white/5 rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
                <button onClick={handleClose} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors z-20">
                    <X size={20} className="text-gray-600 dark:text-gray-400" />
                </button>

                <div className="p-8">
                    <div className="text-center mb-6">
                        <div className="bg-[var(--saathi-green)]/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--saathi-green)]">
                            <User size={30} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{loginView === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{loginView === 'login' ? 'Login to access your orders' : 'Sign up to start shopping'}</p>
                    </div>

                    {!showOTP ? (
                        <form onSubmit={handleSendOTP} className="space-y-4">
                            {loginView === 'register' && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">Full Name</label>
                                        <input
                                            type="text" value={name} onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                                            className="block w-full px-3 py-3 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-1 focus:ring-[var(--saathi-green)] focus:border-[var(--saathi-green)] outline-none bg-gray-50 dark:bg-white/5 text-sm font-bold text-gray-900 dark:text-white"
                                            placeholder="Your Name" required />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">Email (Optional)</label>
                                        <input
                                            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                            className="block w-full px-3 py-3 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-1 focus:ring-[var(--saathi-green)] focus:border-[var(--saathi-green)] outline-none bg-gray-50 dark:bg-white/5 text-sm font-bold text-gray-900 dark:text-white"
                                            placeholder="email@example.com" />
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">Phone Number</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3.5 text-gray-500 dark:text-gray-400 font-bold text-sm">+91</span>
                                    <input
                                        type="tel" maxLength="10"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                        className="block w-full pl-12 pr-3 py-3 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-1 focus:ring-[var(--saathi-green)] focus:border-[var(--saathi-green)] outline-none bg-gray-50 dark:bg-white/5 text-sm font-bold text-gray-900 dark:text-white"
                                        placeholder="98765 43210" required />
                                </div>
                            </div>
                            
                            {loginView === 'register' && (
                                <div className="flex items-start gap-2 mt-2">
                                    <input 
                                        type="checkbox" 
                                        id="terms" 
                                        checked={agreedToTerms}
                                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                                        className="mt-1 w-4 h-4 text-[var(--saathi-green)] border-gray-300 dark:border-white/10 rounded focus:ring-[var(--saathi-green)] cursor-pointer"
                                    />
                                    <label htmlFor="terms" className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-tight">
                                        I agree to the{' '}
                                        <button 
                                            type="button" 
                                            onClick={() => setViewPolicy({ isOpen: true, slug: 'terms-and-conditions', title: 'Terms and Conditions' })}
                                            className="text-[var(--saathi-green)] font-bold hover:underline"
                                        >
                                            Terms & Conditions
                                        </button>
                                        {' '}and{' '}
                                        <button 
                                            type="button" 
                                            onClick={() => setViewPolicy({ isOpen: true, slug: 'privacy-policy', title: 'Privacy Policy' })}
                                            className="text-[var(--saathi-green)] font-bold hover:underline"
                                        >
                                            Privacy Policy
                                        </button>
                                    </label>
                                </div>
                            )}

                            <button
                                type="submit" disabled={loading}
                                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-lg shadow-[var(--saathi-green)]/20 text-sm font-black text-white bg-[var(--saathi-green)] hover:bg-[var(--saathi-green-hover)] transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <ArrowRight size={18} className="mr-2" />}
                                Send OTP
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOTP} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">Enter OTP</label>
                                <input
                                    type="text" maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                    className="block w-full px-3 py-3 border border-gray-200 dark:border-white/10 rounded-xl text-center text-2xl tracking-[0.2em] font-black focus:ring-1 focus:ring-[var(--saathi-green)] focus:border-[var(--saathi-green)] outline-none bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white"
                                    placeholder="••••••" required />
                                <div className="flex justify-between mt-2">
                                    <button type="button" onClick={handleResendOTP} disabled={resendTimer > 0 || loading} className="text-xs text-[var(--saathi-green)] font-bold hover:underline disabled:opacity-50">
                                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                                    </button>
                                    <button type="button" onClick={() => { setShowOTP(false); setOtp(''); }} className="text-xs text-gray-400 dark:text-gray-500 font-medium hover:underline">Change Number?</button>
                                </div>
                            </div>
                            <button
                                type="submit" disabled={loading || otp.length !== 6}
                                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-lg shadow-[var(--saathi-green)]/20 text-sm font-black text-white bg-[var(--saathi-green)] hover:bg-[var(--saathi-green-hover)] transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading && <Loader2 className="animate-spin mr-2" size={18} />}
                                Verify & Proceed
                            </button>
                        </form>
                    )}
                </div>

                <div className="bg-gray-50 dark:bg-white/5 px-8 py-4 text-center border-t border-gray-100 dark:border-white/5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {loginView === 'login' ? "Don't have an account? " : "Already have an account? "}
                        <button
                            onClick={() => {
                                setLoginView(loginView === 'login' ? 'register' : 'login');
                                setShowOTP(false);
                                setOtp('');
                            }}
                            className="font-bold text-[var(--saathi-green)] hover:text-green-700 underline"
                        >
                            {loginView === 'login' ? 'Register' : 'Login'}
                        </button>
                    </p>
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

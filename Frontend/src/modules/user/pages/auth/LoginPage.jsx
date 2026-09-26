import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, ArrowRight, ArrowLeft, Edit2, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as authApi from '../../api/userAuthApi';
import { toast } from 'react-toastify';
import { captureReferralFromUrl, getStoredReferralCode } from '../../utils/referralUtils';
import PolicyViewerModal from '../../../../common/components/legal/PolicyViewerModal';

const LoginPage = () => {
    const { user, token, verifyOtp, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Destination handling
    const queryParams = new URLSearchParams(location.search);
    const fromLocation = location.state?.from;
    const fromPath = fromLocation
        ? (typeof fromLocation === 'string'
            ? fromLocation
            : `${fromLocation.pathname || ''}${fromLocation.search || ''}${fromLocation.hash || ''}`)
        : null;
    const rawRedirectPath = queryParams.get('redirect') || fromPath || '/';
    const redirectPath = (rawRedirectPath === '/login' || rawRedirectPath === '/register' || rawRedirectPath.startsWith('/login?') || rawRedirectPath.startsWith('/register?'))
        ? '/'
        : rawRedirectPath;

    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState('phone'); // 'phone' | 'otp'
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [policyModal, setPolicyModal] = useState({ isOpen: false, slug: '', title: '' });

    const phoneInputRef = useRef(null);
    const otpInputRef = useRef(null);

    // Capture any referral code present in query parameters
    useEffect(() => {
        captureReferralFromUrl(location.search);
    }, [location.search]);

    // If already authenticated, redirect appropriately
    useEffect(() => {
        if (!authLoading && token && user) {
            if (user.isRegistrationComplete === false) {
                navigate('/register', { state: { from: location.state?.from }, replace: true });
            } else {
                navigate(redirectPath, { replace: true });
            }
        }
    }, [user, token, authLoading, navigate, redirectPath, location.state]);

    // Resend countdown timer
    useEffect(() => {
        let timer;
        if (resendTimer > 0) {
            timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [resendTimer]);

    // Auto focus inputs
    useEffect(() => {
        if (step === 'phone') {
            setTimeout(() => phoneInputRef.current?.focus(), 150);
        } else if (step === 'otp') {
            setTimeout(() => otpInputRef.current?.focus(), 150);
        }
    }, [step]);

    const handlePhoneChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
        setPhoneNumber(val);
    };

    const handleOtpChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
        setOtp(val);
    };

    const handleSendOTP = async (e) => {
        if (e) e.preventDefault();
        const cleanedPhone = phoneNumber.replace(/\D/g, '');
        if (cleanedPhone.length !== 10) {
            return toast.error('Please enter a valid 10-digit mobile number');
        }

        setIsSubmitting(true);
        try {
            await authApi.requestOTP(cleanedPhone);
            setStep('otp');
            setResendTimer(60);
            toast.success('OTP sent successfully');
        } catch (error) {
            toast.error(error.message || 'Failed to send OTP. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        if (e) e.preventDefault();
        if (otp.length !== 6) {
            return toast.error('Please enter a valid 6-digit OTP');
        }

        setIsSubmitting(true);
        try {
            const referralCode = getStoredReferralCode();
            const result = await verifyOtp({
                phone: phoneNumber,
                otp,
                referralCode: referralCode || undefined
            });

            if (result.success) {
                if (result.isRegistrationComplete === false) {
                    navigate('/register', { state: { from: location.state?.from }, replace: true });
                } else {
                    navigate(redirectPath, { replace: true });
                }
            }
        } catch (error) {
            toast.error(error.message || 'Invalid OTP. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendOTP = async () => {
        if (resendTimer > 0 || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await authApi.resendOTP(phoneNumber);
            setResendTimer(60);
            toast.success('OTP resent successfully');
        } catch (error) {
            toast.error(error.message || 'Failed to resend OTP');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-[100dvh] w-full flex items-center justify-center p-4 bg-slate-900 overflow-hidden">
            {/* Background Image with Blur */}
            <div
                className="absolute inset-0 bg-cover bg-center z-0 bg-slate-900"
                style={{
                    backgroundImage: 'url("https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2574&auto=format&fit=crop")',
                    filter: 'blur(8px)',
                    transform: 'scale(1.05)'
                }}
            />
            <div className="absolute inset-0 bg-black/60 z-0 backdrop-blur-xs" />

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#121212] rounded-3xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden transition-all duration-300">
                {/* Header Branding Banner */}
                <div className="bg-gradient-to-r from-[#0c831f] to-[#10a827] px-6 py-6 text-white text-center relative">
                    {step === 'otp' && (
                        <button
                            type="button"
                            onClick={() => {
                                setStep('phone');
                                setOtp('');
                            }}
                            className="absolute left-4 top-6 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                            aria-label="Change phone number"
                        >
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <h1 className="text-2xl font-black tracking-wider uppercase">SaathiGro</h1>
                    <p className="text-xs text-green-100 font-medium mt-1">
                        Fresh Groceries Delivered in Minutes
                    </p>
                </div>

                <div className="p-6 md:p-8">
                    {step === 'phone' ? (
                        /* Step 1: Phone Entry */
                        <form onSubmit={handleSendOTP} className="space-y-6">
                            <div className="text-center space-y-1">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Login or Sign Up
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Enter your 10-digit mobile number to proceed
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Mobile Number
                                </label>
                                <div className="relative flex items-center">
                                    <div className="absolute left-3.5 flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-bold text-sm select-none border-r border-gray-200 dark:border-white/10 pr-2.5">
                                        <Phone size={16} className="text-[#0c831f]" />
                                        <span>+91</span>
                                    </div>
                                    <input
                                        ref={phoneInputRef}
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={10}
                                        value={phoneNumber}
                                        onChange={handlePhoneChange}
                                        placeholder="Enter 10-digit number"
                                        disabled={isSubmitting}
                                        className="w-full pl-24 pr-4 py-3.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-base font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0c831f] focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={phoneNumber.length !== 10 || isSubmitting}
                                className="w-full py-3.5 px-4 bg-[#0c831f] hover:bg-[#0a6d1a] disabled:bg-gray-300 dark:disabled:bg-white/10 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-all"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>Sending OTP...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Continue</span>
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        /* Step 2: OTP Entry */
                        <form onSubmit={handleVerifyOTP} className="space-y-6">
                            <div className="text-center space-y-1">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Verify Mobile Number
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    We sent a 6-digit code to{' '}
                                    <span className="font-bold text-gray-800 dark:text-gray-200">
                                        +91 {phoneNumber}
                                    </span>
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep('phone');
                                        setOtp('');
                                    }}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0c831f] hover:underline mt-1"
                                >
                                    <Edit2 size={12} />
                                    Change mobile number
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-center">
                                    Enter 6-digit OTP
                                </label>
                                <input
                                    ref={otpInputRef}
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    value={otp}
                                    onChange={handleOtpChange}
                                    placeholder="••••••"
                                    disabled={isSubmitting}
                                    className="w-full py-3.5 px-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-2xl font-mono font-bold tracking-[0.5em] text-center text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0c831f] focus:border-transparent transition-all"
                                />
                            </div>

                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500 dark:text-gray-400">
                                    {resendTimer > 0 ? (
                                        <>Resend OTP in <span className="font-bold text-gray-700 dark:text-gray-300">{resendTimer}s</span></>
                                    ) : (
                                        "Didn't receive OTP?"
                                    )}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleResendOTP}
                                    disabled={resendTimer > 0 || isSubmitting}
                                    className="font-bold text-[#0c831f] hover:underline disabled:text-gray-400 dark:disabled:text-gray-600 disabled:no-underline disabled:cursor-not-allowed"
                                >
                                    Resend OTP
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={otp.length !== 6 || isSubmitting}
                                className="w-full py-3.5 px-4 bg-[#0c831f] hover:bg-[#0a6d1a] disabled:bg-gray-300 dark:disabled:bg-white/10 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-all"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>Verifying...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={18} />
                                        <span>Verify & Continue</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Legal Compliance Footer */}
                    <div className="mt-8 pt-4 border-t border-gray-100 dark:border-white/5 text-center">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                            By continuing, you agree to our{' '}
                            <button
                                type="button"
                                onClick={() => setPolicyModal({ isOpen: true, slug: 'terms-and-conditions', title: 'Terms & Conditions' })}
                                className="text-[#0c831f] underline hover:text-[#0a6d1a] font-medium"
                            >
                                Terms & Conditions
                            </button>{' '}
                            and{' '}
                            <button
                                type="button"
                                onClick={() => setPolicyModal({ isOpen: true, slug: 'privacy-policy', title: 'Privacy Policy' })}
                                className="text-[#0c831f] underline hover:text-[#0a6d1a] font-medium"
                            >
                                Privacy Policy
                            </button>.
                        </p>
                    </div>
                </div>
            </div>

            {/* Policy Viewer Modal */}
            <PolicyViewerModal
                isOpen={policyModal.isOpen}
                onClose={() => setPolicyModal({ isOpen: false, slug: '', title: '' })}
                slug={policyModal.slug}
                title={policyModal.title}
            />
        </div>
    );
};

export default LoginPage;

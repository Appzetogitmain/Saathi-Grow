import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Mail, Phone, ShoppingBag, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import PolicyViewerModal from '../../../../common/components/legal/PolicyViewerModal';

const RegisterPage = () => {
    const { user, token, completeRegistration, loading: authLoading } = useAuth();
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

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [policyModal, setPolicyModal] = useState({ isOpen: false, slug: '', title: '' });

    const nameInputRef = useRef(null);

    // If user has already completed registration, redirect directly to destination
    useEffect(() => {
        if (!authLoading && user && user.isRegistrationComplete === true) {
            navigate(redirectPath, { replace: true });
        }
    }, [user, authLoading, navigate, redirectPath]);

    // Autofocus name input on mount
    useEffect(() => {
        setTimeout(() => nameInputRef.current?.focus(), 150);
    }, []);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        const trimmedName = name.trim();
        if (!trimmedName) {
            return toast.error('Please enter your full name');
        }
        if (trimmedName.length < 2) {
            return toast.error('Full name must be at least 2 characters');
        }
        const nameRegex = /^[a-zA-Z\s]+$/;
        if (!nameRegex.test(trimmedName)) {
            return toast.error('Full name should only contain letters and spaces');
        }

        const trimmedEmail = email.trim();
        if (trimmedEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(trimmedEmail)) {
                return toast.error('Please enter a valid email address');
            }
        }

        setIsSubmitting(true);
        try {
            const result = await completeRegistration({
                name: trimmedName,
                email: trimmedEmail || undefined
            });

            if (result.success) {
                // Navigate to original destination or home
                navigate(redirectPath, { replace: true });
            }
        } catch (error) {
            toast.error(error.message || 'Failed to complete registration. Please try again.');
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

            {/* Onboarding Card */}
            <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#121212] rounded-3xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden transition-all duration-300">
                {/* Header Branding Banner */}
                <div className="bg-gradient-to-r from-[#0c831f] to-[#10a827] px-6 py-6 text-white text-center">
                    <h1 className="text-2xl font-black tracking-wider uppercase">Welcome to Saathi-Grow</h1>
                    <p className="text-xs text-green-100 font-medium mt-1">
                        Just one last step to start shopping
                    </p>
                </div>

                <div className="p-6 md:p-8">
                    {/* Verified Mobile Number Badge */}
                    {user?.phone && (
                        <div className="mb-6 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Phone size={16} className="text-[#0c831f]" />
                                <div>
                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                                        Verified Mobile
                                    </span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                                        +91 {user.phone}
                                    </span>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0c831f] bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={12} />
                                Verified
                            </span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Full Name */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <div className="relative flex items-center">
                                <User size={18} className="absolute left-3.5 text-gray-400" />
                                <input
                                    ref={nameInputRef}
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your full name"
                                    disabled={isSubmitting}
                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0c831f] focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Email Address (Optional) */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Email Address
                                </label>
                                <span className="text-[10px] text-gray-400 font-medium">Optional</span>
                            </div>
                            <div className="relative flex items-center">
                                <Mail size={18} className="absolute left-3.5 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    disabled={isSubmitting}
                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0c831f] focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={!name.trim() || isSubmitting}
                            className="w-full py-3.5 px-4 mt-2 bg-[#0c831f] hover:bg-[#0a6d1a] disabled:bg-gray-300 dark:disabled:bg-white/10 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-all"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Saving Profile...</span>
                                </>
                            ) : (
                                <>
                                    <ShoppingBag size={18} />
                                    <span>Start Shopping</span>
                                </>
                            )}
                        </button>
                    </form>

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

export default RegisterPage;

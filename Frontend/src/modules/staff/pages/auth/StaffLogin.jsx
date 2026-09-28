import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { Eye, EyeOff, Lock, Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import logo from '../../../../assets/logo_fav.png';
import PolicyViewerModal from '../../../../common/components/legal/PolicyViewerModal';

const StaffLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [viewPolicy, setViewPolicy] = useState({ isOpen: false, slug: '', title: '' });
    const { staffLogin } = useStaffAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }
        
        if (!agreedToTerms) {
            setError('Please agree to the Terms & Conditions and Privacy Policy.');
            return;
        }

        setLoading(true);

        try {
            await staffLogin(email, password);
            navigate('/staff/dashboard');
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-sans selection:bg-blue-100 selection:text-blue-900 animate-in fade-in duration-500">
            {/* Background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 opacity-30">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-400/20 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-[440px] space-y-8">
                <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-200/60 overflow-hidden p-8 lg:p-12 relative group">
                    {/* Header Branding */}
                    <div className="text-center space-y-6 mb-10">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center shadow-2xl transition-transform duration-500 p-3">
                                <img src={logo} className="w-full h-full object-contain brightness-0 invert" alt="SaathiGro" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Staff Portal</h2>
                            <div className="flex items-center justify-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Officer Login</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="py-3 px-4 bg-red-50 text-red-600 text-[11px] rounded-2xl border border-red-100 text-center font-black uppercase tracking-wider animate-shake">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Mail size={12} className="text-blue-500" /> Email Address
                            </label>
                            <input
                                type="email"
                                required
                                className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all text-sm"
                                placeholder="name@Saathigro.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Lock size={12} className="text-blue-500" /> Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all text-sm"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-1 pr-4 flex items-center text-slate-300 hover:text-blue-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1 mb-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="remember"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="remember" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none">
                                    Remember me
                                </label>
                            </div>
                            <Link to="/staff/forgot-password" className="text-[11px] font-black text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-tighter">
                                Forgot Password?
                            </Link>
                        </div>

                        <div className="flex items-center gap-2 mt-2 px-1">
                            <input 
                                type="checkbox" 
                                id="terms" 
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            <label htmlFor="terms" className="text-xs text-slate-500 font-medium leading-tight">
                                I agree to the{' '}
                                <button 
                                    type="button" 
                                    onClick={() => setViewPolicy({ isOpen: true, slug: 'terms-and-conditions', title: 'Terms and Conditions' })}
                                    className="text-blue-600 font-bold hover:underline"
                                >
                                    Terms & Conditions
                                </button>
                                {' '}and{' '}
                                <button 
                                    type="button" 
                                    onClick={() => setViewPolicy({ isOpen: true, slug: 'privacy-policy', title: 'Privacy Policy' })}
                                    className="text-blue-600 font-bold hover:underline"
                                >
                                    Privacy Policy
                                </button>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full relative group/btn h-14 bg-slate-900 text-white rounded-2xl overflow-hidden transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-75 disabled:pointer-events-none mt-4 shadow-xl shadow-slate-200"
                        >
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-600 transform scale-x-0 group-hover/btn:scale-x-100 transition-transform duration-500 origin-left"></div>
                            {loading ? (
                                <Loader2 size={18} className="animate-spin mx-auto" />
                            ) : (
                                <span className="flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest">
                                    Login <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                                </span>
                            )}
                        </button>
                    </form>
                    
                    <div className="mt-8 text-center pt-6 border-t border-slate-50">
                        <p className="text-[10px] text-slate-500 font-medium uppercase">
                            Need help? <a href="mailto:support@saathigro.in?subject=Staff Portal Support" className="text-blue-600 font-bold hover:underline">Contact Support</a>
                        </p>
                    </div>
                </div>

                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                        <ShieldCheck size={14} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Secure Staff Access</span>
                    </div>
                </div>
            </div>
            
            <PolicyViewerModal 
                isOpen={viewPolicy.isOpen}
                onClose={() => setViewPolicy({ isOpen: false, slug: '', title: '' })}
                policySlug={viewPolicy.slug}
                audience="Staff"
                title={viewPolicy.title}
            />
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake { animation: shake 0.4s ease-in-out 0s 2; }
            `}} />
        </div>
    );
};

export default StaffLogin;

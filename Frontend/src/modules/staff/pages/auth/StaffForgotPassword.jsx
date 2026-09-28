import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import logo from '../../../../assets/logo_fav.png';
import axios from 'axios';
import { toast } from 'react-toastify';

const StaffForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/admin/forgot-password`, { email, portal: 'staff' });
            setSubmitted(true);
            toast.success('Reset link sent to your email');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send reset link');
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
                <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-200/60 overflow-hidden p-8 lg:p-12 text-center group">
                    <div className="flex justify-center mb-8">
                        <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-500 p-3">
                            <img src={logo} className="w-full h-full object-contain brightness-0 invert" alt="SaathiGro" />
                        </div>
                    </div>

                    {!submitted ? (
                        <>
                            <div className="space-y-3 mb-10">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Reset Password</h2>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Enter your email to receive a password reset link.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6 text-left">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Mail size={12} className="text-blue-500" /> Email Address
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all text-sm"
                                        placeholder="Enter your work email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full relative group/btn h-14 bg-slate-900 text-white rounded-2xl overflow-hidden transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-75 disabled:pointer-events-none mt-2 shadow-xl shadow-slate-200"
                                >
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-600 transform scale-x-0 group-hover/btn:scale-x-100 transition-transform duration-500 origin-left"></div>
                                    {loading ? (
                                        <Loader2 size={18} className="animate-spin mx-auto" />
                                    ) : (
                                        <span className="flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest">
                                            Send Reset Link <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                                        </span>
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="py-2 animate-in fade-in zoom-in-95 duration-500">
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Email Sent</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-8 px-4">
                                A secure reset link has been sent to <span className="text-blue-600">{email}</span>. Please check your inbox.
                            </p>
                            <button 
                                onClick={() => navigate('/staff/login')}
                                className="h-14 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 w-full active:scale-95"
                            >
                                Return to Login
                            </button>
                        </div>
                    )}

                    <div className="mt-10 flex justify-center">
                        <Link to="/staff/login" className="inline-flex items-center gap-2 text-[11px] font-black text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-widest">
                            <ArrowLeft size={16} /> Back to Login
                        </Link>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-40">Secure Access</p>
                </div>
            </div>
        </div>
    );
};

export default StaffForgotPassword;

import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Lock, Loader2, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import logo from '../../../../assets/logo_fav.png';
import axios from 'axios';
import { toast } from 'react-toastify';

const StaffResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { token } = useParams();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            return toast.error('Passwords do not match.');
        }

        if (password.length < 8) {
            return toast.error('New password must be at least 8 characters.');
        }

        setLoading(true);

        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/admin/reset-password/${token}`, { password });
            setSuccess(true);
            toast.success('Password updated successfully');
            setTimeout(() => navigate('/staff/login'), 2500);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Invalid or expired reset link');
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

                    {!success ? (
                        <>
                            <div className="space-y-3 mb-10">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Set New Password</h2>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Create a new password for your account.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5 text-left">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Lock size={12} className="text-blue-500" /> New Password
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

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Lock size={12} className="text-blue-500" /> Confirm New Password
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50 transition-all text-sm"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
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
                                            Update Password <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                                        </span>
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="py-2 animate-in fade-in zoom-in-95 duration-500">
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Password Changed</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-8 px-4">
                                Your account password has been successfully updated. Redirecting to login...
                            </p>
                            <div className="flex justify-center">
                                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100">
                                    <Loader2 size={24} className="animate-spin text-blue-600" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-40">Secure Access</p>
                </div>
            </div>
        </div>
    );
};

export default StaffResetPassword;

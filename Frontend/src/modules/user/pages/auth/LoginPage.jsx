import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { captureReferralFromUrl } from '../../utils/referralUtils';

const LoginPage = () => {
    const { openLogin, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Get redirect path from query string or location state from
    const queryParams = new URLSearchParams(location.search);
    const fromLocation = location.state?.from;
    const fromPath = fromLocation
        ? (typeof fromLocation === 'string'
            ? fromLocation
            : `${fromLocation.pathname || ''}${fromLocation.search || ''}${fromLocation.hash || ''}`)
        : null;
    const redirectPath = queryParams.get('redirect') || fromPath || '/';

    useEffect(() => {
        captureReferralFromUrl(location.search);
    }, [location.search]);

    useEffect(() => {
        if (user) {
            navigate(redirectPath, { replace: true });
        } else {
            openLogin();
        }
    }, [user, navigate, redirectPath, openLogin]);

    return (
        <div className="relative h-[100dvh] w-full max-w-full overflow-hidden md:min-h-[calc(100vh-64px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-slate-900">
            {/* Background Image with Blur */}
            <div
                className="absolute inset-0 bg-cover bg-center z-0 bg-slate-900 overflow-hidden"
                style={{
                    backgroundImage: 'url("https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2574&auto=format&fit=crop")',
                    filter: 'blur(8px)',
                    transform: 'scale(1.05)'
                }}
            ></div>
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 z-0"></div>
        </div>
    );
};

export default LoginPage;

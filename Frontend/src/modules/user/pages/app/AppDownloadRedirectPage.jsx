import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, ArrowRight, Loader2, ArrowLeft, Star, ShieldCheck } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import { fetchPublicSettings } from '../../api/shopApi';
import appLogo from '../../../../assets/logo_fav.png';

export default function AppDownloadRedirectPage() {
  const navigate = useNavigate();
  const { settings: contextSettings } = useShop();
  const [settings, setSettings] = useState(contextSettings || null);
  const [redirecting, setRedirecting] = useState(true);
  const [detectedPlatform, setDetectedPlatform] = useState('unknown');

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      let currentSettings = contextSettings;
      if (!currentSettings) {
        try {
          currentSettings = await fetchPublicSettings();
          if (isMounted) setSettings(currentSettings);
        } catch (err) {
          console.error('Failed to fetch settings for redirect:', err);
        }
      }

      const playStore =
        currentSettings?.playStoreUrl ||
        import.meta.env.VITE_PLAY_STORE_URL ||
        'https://play.google.com/store/apps/details?id=com.saathigro.app';

      const appStore =
        currentSettings?.appStoreUrl ||
        import.meta.env.VITE_APP_STORE_URL ||
        '';

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
      const isAndroid = /Android/i.test(ua);

      if (isIOS) {
        setDetectedPlatform('ios');
        const targetUrl = appStore || playStore;
        if (targetUrl) {
          // Redirect iPhone/iPad immediately to App Store
          window.location.replace(targetUrl);
          return;
        }
      } else if (isAndroid) {
        setDetectedPlatform('android');
        if (playStore) {
          // Redirect Android immediately to Google Play Store
          window.location.replace(playStore);
          return;
        }
      } else {
        setDetectedPlatform('desktop');
      }

      setRedirecting(false);
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [contextSettings]);

  const playStoreUrl =
    settings?.playStoreUrl ||
    import.meta.env.VITE_PLAY_STORE_URL ||
    'https://play.google.com/store/apps/details?id=com.saathigro.app';

  const appStoreUrl =
    settings?.appStoreUrl ||
    import.meta.env.VITE_APP_STORE_URL ||
    '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-slate-900 to-black text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
        {/* App Logo */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-white p-2.5 shadow-xl flex items-center justify-center mb-4">
          <img src={appLogo} alt="SaathiGro App" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-2xl font-black text-white mb-1">SaathiGro App</h1>
        <p className="text-xs text-[#CCFF00] font-bold uppercase tracking-wider mb-4">
          10-Minute Grocery Delivery
        </p>

        {redirecting ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <Loader2 className="w-8 h-8 text-[#CCFF00] animate-spin" />
            <p className="text-sm font-medium text-slate-200">
              {detectedPlatform === 'ios'
                ? 'Opening Apple App Store...'
                : detectedPlatform === 'android'
                ? 'Opening Google Play Store...'
                : 'Finding the right app version for your device...'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-300 mb-6">
            Choose your platform below to download the official SaathiGro application:
          </p>
        )}

        {/* Action Buttons (fallback / manual selection) */}
        <div className="space-y-3 w-full">
          {playStoreUrl && (
            <a
              href={playStoreUrl}
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-[#0c831f] hover:bg-[#0a701a] text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98]"
            >
              <span className="flex items-center gap-2.5">
                <Smartphone size={18} />
                <span>Get on Google Play</span>
              </span>
              <ArrowRight size={16} />
            </a>
          )}

          {appStoreUrl ? (
            <a
              href={appStoreUrl}
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-white text-slate-950 font-bold text-sm hover:bg-slate-100 shadow-lg transition-all active:scale-[0.98]"
            >
              <span className="flex items-center gap-2.5">
                <Smartphone size={18} />
                <span>Download on App Store</span>
              </span>
              <ArrowRight size={16} />
            </a>
          ) : (
            <div className="text-xs text-slate-400 py-1 italic">
              Apple App Store version is releasing soon
            </div>
          )}
        </div>

        <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft size={13} /> Return to website
          </button>
          <div className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck size={13} /> Official & Verified
          </div>
        </div>
      </div>
    </div>
  );
}

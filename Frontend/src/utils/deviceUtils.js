export const isWebView = () => {
  return window.navigator.userAgent.includes('Flutter') ||
    window.navigator.userAgent.includes('saathigroApp');
};

export const isInstalledApp = () => {
  if (typeof window === 'undefined') return false;

  // 1. Standalone / PWA / TWA display mode (Android & iOS installed Web Apps)
  try {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
      window.matchMedia?.('(display-mode: minimal-ui)')?.matches ||
      window.navigator?.standalone === true;

    if (isStandalone) return true;
  } catch {
    // Ignore matchMedia errors
  }

  // 2. Android Trusted Web Activity (TWA) launched from an Android package
  try {
    if (document?.referrer && document.referrer.startsWith('android-app://')) {
      return true;
    }
  } catch {
    // Ignore referrer errors
  }

  // 3. Android WebView / In-App browser User Agent indicators
  const ua = window.navigator?.userAgent || '';
  const isAndroidWebView =
    /;\s*wv\b/i.test(ua) ||
    /WebView/i.test(ua) ||
    (/Android/i.test(ua) && /Version\/[0-9.]+/i.test(ua) && /Chrome\/[0-9.]+/i.test(ua));

  if (isAndroidWebView) return true;

  // 4. Injected bridges / Flutter / Custom app User Agent
  if (
    window.Android ||
    window.flutter_inappwebview ||
    window.FlutterDownloader ||
    window.Capacitor ||
    window.cordova ||
    window.ReactNativeWebView ||
    ua.includes('Flutter') ||
    ua.includes('saathigroApp')
  ) {
    return true;
  }

  // 5. Persistent flag set upon app installation
  try {
    if (localStorage.getItem('saathigro_app_installed') === 'true') {
      return true;
    }
  } catch {
    // Ignore storage errors
  }

  return false;
};

export const getEnvironment = () => {
  return isWebView() || isInstalledApp() ? 'apk' : 'web';
};

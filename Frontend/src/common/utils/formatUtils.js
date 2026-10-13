/**
 * formatUtils.js
 * Centralized formatting utilities for dates, currency, and other common patterns.
 */

export const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

export const formatCurrency = (amount) => {
    const val = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    const formatted = new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    }).format(val);
    return `₹${formatted}`;
};

export const formatCompactNumber = (number) => {
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short'
    }).format(number);
};

/**
 * Converts a 24-hour time string (e.g. "06:00", "18:30", "18:00:00") into a 12-hour AM/PM format (e.g. "6:00 AM", "6:30 PM").
 * If the input doesn't match a time format or is invalid, returns the original input safely.
 *
 * @param {string} timeStr - Time string in HH:mm or HH:mm:ss
 * @returns {string} Formatted 12-hour time string
 */
export const formatTo12Hour = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return timeStr || '';
    const match = timeStr.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
    if (!match) return timeStr;
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${period}`;
};

import { API_BASE_URL } from '../../config/apiConfig';

// ─── Environment Detection ──────────────────────────────────────────────────

/**
 * Returns true when running inside a Flutter InAppWebView.
 * flutter_inappwebview is injected by the WebView when javascriptChannels are registered.
 */
const isFlutterWebView = () => {
    if (typeof window === 'undefined') return false;
    return !!(window.flutter_inappwebview || window.FlutterDownloader);
};

const shouldUseProxy = () => {
    if (typeof window === 'undefined' || !window.navigator) return false;
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isWebView = /wv|WebView|FBAN|FBAV|Instagram/i.test(ua) ||
                      (ua.includes('Android') && ua.includes('Version/')) ||
                      (ua.includes('iPhone') && !ua.includes('Safari')) ||
                      window.flutter_inappwebview;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    return !!(isWebView || isMobile);
};

const getApiBase = () => {
    let base = API_BASE_URL || '/api';
    if (!base.startsWith('http')) {
        const origin = window.location.origin;
        base = base.startsWith('/') ? `${origin}${base}` : `${origin}/${base}`;
    }
    return base;
};

const getDownloadUrl = () => `${getApiBase()}/settings/download`;

// ─── Strategy 1: Flutter JS Channel Bridge (best for Flutter InAppWebView) ──
/**
 * Posts a direct download URL to the Flutter JavascriptChannel named "FlutterDownloader".
 *
 * In your Flutter app (flutter_inappwebview), register the channel:
 *
 *   InAppWebView(
 *     ...
 *     onWebViewCreated: (controller) {
 *       controller.addJavaScriptHandler(
 *         handlerName: 'FlutterDownloader',
 *         callback: (args) {
 *           final data = jsonDecode(args[0]);
 *           final url  = data['url']  as String;
 *           final name = data['fileName'] as String;
 *           // Use flutter_downloader or url_launcher to download natively:
 *           FlutterDownloader.enqueue(url: url, savedDir: dir, fileName: name, ...);
 *         },
 *       );
 *     },
 *   )
 *
 * Message payload: JSON string { url: string, fileName: string }
 */
const executeFlutterBridgeDownload = (directUrl, fileName) => {
    try {
        const message = JSON.stringify({ url: directUrl, fileName });
        // Modern InAppWebView API
        if (window.flutter_inappwebview &&
            typeof window.flutter_inappwebview.callHandler === 'function') {
            window.flutter_inappwebview.callHandler('FlutterDownloader', message);
            return true;
        }
        // Legacy JavascriptChannel API (older flutter_inappwebview versions)
        if (window.FlutterDownloader &&
            typeof window.FlutterDownloader.postMessage === 'function') {
            window.FlutterDownloader.postMessage(message);
            return true;
        }
    } catch (e) {
        console.warn('[downloadCSV] Flutter bridge call failed:', e);
    }
    return false;
};

// ─── Strategy 2: Server-side proxy POST form (fallback for mobile browsers) ─
const executeProxyDownload = (contentString, fileName, contentType = 'text/csv', isBase64 = false) => {
    const downloadUrl = getDownloadUrl();
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = downloadUrl;
    form.target = '_self';

    const fields = {
        content: contentString,
        fileName: fileName,
        contentType: contentType,
        isBase64: isBase64 ? 'true' : 'false'
    };

    for (const [key, value] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
};

// ─── Main Export ────────────────────────────────────────────────────────────

/**
 * downloadCSV — Smart CSV download with three strategies:
 *
 *  1. Flutter JS bridge  → sends { url, fileName } to Flutter's native download manager
 *  2. Proxy form POST    → server streams the file back (Android browsers / WebViews)
 *  3. Desktop            → standard data-URI anchor click
 *
 * @param {string|Blob} content    CSV content (with UTF-8 BOM prepended)
 * @param {string}      fileName   e.g. "delivery_history_2024-06-11.csv"
 * @param {string}      [directUrl] Optional direct backend URL for the Flutter bridge
 */
export const downloadCSV = (content, fileName, directUrl = null) => {
    // ── Flutter WebView: Try modern Javascript Channel handler first ──────────
    if (isFlutterWebView() && directUrl) {
        const bridged = executeFlutterBridgeDownload(directUrl, fileName);
        if (bridged) return;
    }

    // ── Mobile WebView / Android browser / Flutter App: Use direct GET URL if available ──
    if (directUrl && (isFlutterWebView() || shouldUseProxy())) {
        // If there's an explicit legacy postMessage bridge, try it first
        try {
            if (window.FlutterDownloader && typeof window.FlutterDownloader.postMessage === 'function') {
                const message = JSON.stringify({ url: directUrl, fileName });
                window.FlutterDownloader.postMessage(message);
                return;
            }
        } catch (e) {
            console.warn('[downloadCSV] Legacy Flutter bridge call failed:', e);
        }

        // Direct GET download triggers the WebView's standard download listener (onDownloadStartRequest)
        // or a mobile browser's standard downloader. Since it's a GET request that returns
        // Content-Disposition: attachment, it won't navigate away from the current page.
        window.location.href = directUrl;
        return;
    }

    // ── Mobile WebView / Android browser: server-side proxy POST fallback ────
    if (shouldUseProxy()) {
        if (content instanceof Blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;
                const base64Data = dataUrl.split(',')[1];
                executeProxyDownload(base64Data, fileName, content.type || 'application/octet-stream', true);
            };
            reader.readAsDataURL(content);
        } else {
            // Text content: send as-is (includes BOM)
            executeProxyDownload(content, fileName, 'text/csv; charset=utf-8', false);
        }
        return;
    }

    // ── Desktop / standard browsers: data-URI anchor click ─────────────────
    if (content instanceof Blob) {
        try {
            const reader = new FileReader();
            reader.onloadend = () => {
                const url = reader.result;
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };
            reader.readAsDataURL(content);
        } catch (e) {
            console.error("Blob FileReader read failed, trying URL fallback:", e);
            const url = URL.createObjectURL(content);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    } else {
        try {
            const base64Content = btoa(unescape(encodeURIComponent(content)));
            const url = `data:text/csv;base64,${base64Content}`;
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Base64 CSV download failed, trying fallback:", e);
            const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
            downloadCSV(blob, fileName);
        }
    }
};

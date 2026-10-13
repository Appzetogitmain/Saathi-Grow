const STORAGE_KEY = 'saathi_app_popup_dismissed_version';
const dismissedThisVisit = new Set();
export const popupVersion = popup => String(popup?.version || '1');
export const isPopupDismissed = version => {
  if (dismissedThisVisit.has(version)) return true;
  try { return localStorage.getItem(STORAGE_KEY) === version; } catch { return false; }
};
export const dismissPopup = version => {
  dismissedThisVisit.add(version);
  try { localStorage.setItem(STORAGE_KEY, version); } catch { /* In-memory dismissal still works. */ }
};
export const isPopupSuppressedPath = pathname =>
  ['/checkout', '/login', '/register', '/logout-confirmation', '/order-success', '/download-app', '/app', '/legal', '/privacy-policy', '/support']
    .some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)) || pathname.includes('/tracking');

export const resolvePopupDestination = popup => {
  const target = typeof popup?.actionTarget === 'string' ? popup.actionTarget.trim() : '';
  if (!popup?.actionType || popup.actionType === 'home') return { to: '/', external: false };
  if (popup.actionType === 'product') return /^[a-f\d]{24}$/i.test(target) ? { to: `/product/${target}`, external: false } : null;
  if (popup.actionType === 'category') return /^[a-z\d]+(?:-[a-z\d]+)*$/.test(target) ? { to: `/category/${target}`, external: false } : null;
  if (popup.actionType !== 'custom' || !target || /[\s\\\u0000-\u001f]/.test(target)) return null;
  if (/^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      return url.hostname && !url.username && !url.password ? { to: url.href, external: true } : null;
    } catch { return null; }
  }
  if (/^\/\/|^[a-z][a-z\d+.-]*:/i.test(target)) return null;
  return { to: target.startsWith('/') ? target : `/${target}`, external: false };
};

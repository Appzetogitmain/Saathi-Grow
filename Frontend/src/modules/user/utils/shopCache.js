export const readShopCache = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};
export const hasShopCache = key => {
  try { return Boolean(localStorage.getItem(key)); } catch { return false; }
};
export const writeShopCache = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Browsing still works without caching. */ }
};

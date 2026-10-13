import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

export class AppPopupError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fields = ['isEnabled', 'title', 'message', 'imageUrl', 'actionType', 'actionTarget', 'buttonText'];
const defaults = { isEnabled: false, title: '', message: '', imageUrl: '', actionType: 'home', actionTarget: '', buttonText: 'Shop Now' };
const limits = { title: 160, message: 6000, imageUrl: 2048, actionTarget: 2048, buttonText: 80 };

export const wantsAppPopup = body => body?.setAsAppPopup === true || body?.setAsAppPopup === 'true';
export const canPublishAppPopup = admin => admin?.role === 'Admin' || admin?.permissions?.includes('MANAGE_SETTINGS') === true;
export const assertAppPopupPublisher = (body, admin) => {
  if (!wantsAppPopup(body)) return;
  if (!canPublishAppPopup(admin)) throw new AppPopupError('MANAGE_SETTINGS permission is required to publish an app popup', 403);
  if (body.targetType !== 'broadcast' || !['users', 'all'].includes(body.group)) {
    throw new AppPopupError('App popups can only be published with a customer or all-users broadcast');
  }
};

export const normalizePopup = (value = {}) => Object.fromEntries(fields.map(field => [field,
  field === 'isEnabled' ? value[field] === true : typeof value[field] === 'string' ? value[field].trim() : defaults[field]
]));
export const popupHasChanged = (incoming, current) => JSON.stringify(normalizePopup(incoming)) !== JSON.stringify(normalizePopup(current));

const validateUrl = (value, httpsOnly = false) => {
  try {
    const url = new URL(value);
    return (httpsOnly ? url.protocol === 'https:' : ['https:', 'http:'].includes(url.protocol)) &&
      Boolean(url.hostname) && !url.username && !url.password && !/[\s\\\u0000-\u001f]/.test(value);
  } catch { return false; }
};

export const validatePopup = async popup => {
  if (!['home', 'category', 'product', 'custom'].includes(popup.actionType)) throw new AppPopupError('Invalid popup action type');
  if (!popup.isEnabled) return; // Disabled campaigns may be saved as drafts.
  if (popup.imageUrl && !validateUrl(popup.imageUrl, true)) throw new AppPopupError('Popup image must be a public HTTPS URL');
  if (!popup.title || (!popup.message && !popup.imageUrl)) throw new AppPopupError('An enabled popup needs a title and a message or image');
  if (popup.actionType === 'product') {
    if (!/^[a-f\d]{24}$/i.test(popup.actionTarget) || !mongoose.isValidObjectId(popup.actionTarget) ||
        !await Product.exists({ _id: popup.actionTarget, status: { $in: ['Active', 'Out of Stock', 'Low Stock'] } })) {
      throw new AppPopupError('Choose an existing published product for the popup');
    }
  } else if (popup.actionType === 'category') {
    if (!/^[a-z\d]+(?:-[a-z\d]+)*$/.test(popup.actionTarget) ||
        !await Category.exists({ slug: popup.actionTarget, status: 'Active' })) {
      throw new AppPopupError('Choose an existing active category for the popup');
    }
  } else if (popup.actionType === 'custom') {
    const target = popup.actionTarget;
    const external = /^https?:\/\//i.test(target);
    if (!target || (external ? !validateUrl(target) :
        /(^\/\/|^[a-z][a-z\d+.-]*:|[\s\\\u0000-\u001f])/i.test(target))) {
      throw new AppPopupError('Popup destination must be a local route or an HTTP(S) URL');
    }
    if (!external && !target.startsWith('/')) popup.actionTarget = `/${target}`;
  } else { popup.actionTarget = ''; }
};

export const preparePopupUpdate = async (incoming, current = {}, { republish = false } = {}) => {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new AppPopupError('Invalid app popup settings');
  if (incoming.isEnabled !== undefined && typeof incoming.isEnabled !== 'boolean') throw new AppPopupError('Popup isEnabled must be a boolean');
  for (const [field, limit] of Object.entries(limits)) {
    if (incoming[field] !== undefined && (typeof incoming[field] !== 'string' || incoming[field].trim().length > limit)) {
      throw new AppPopupError(`Invalid popup ${field} (maximum ${limit} characters)`);
    }
  }
  if (incoming.actionType !== undefined && typeof incoming.actionType !== 'string') throw new AppPopupError('Invalid popup action type');
  const merged = normalizePopup({ ...(current.toObject?.() || current), ...incoming });
  const changed = popupHasChanged(merged, current);
  if (!changed && !republish) return null;
  if (!republish && incoming.version !== undefined && String(incoming.version) !== String(current.version || '1')) {
    throw new AppPopupError('This popup changed in another window. Reload settings before editing it.', 409);
  }
  await validatePopup(merged);
  return { ...merged, version: randomUUID() };
};

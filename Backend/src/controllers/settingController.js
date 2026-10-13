import { uploadBufferToCloudinary } from '../config/cloudinary.js';
import GlobalSetting from '../models/GlobalSetting.js';
import { buildReferralSettings } from '../utils/referralSettings.js';
import { preparePopupUpdate, AppPopupError } from '../services/appPopupService.js';

// @desc    Get Global Settings
// @route   GET /api/admin/settings
// @access  Private (Admin only)
export const getSettings = async (req, res) => {
  try {
    let settings = await GlobalSetting.findOne();

    // Auto-initialize if they don't exist yet
    if (!settings) {
      settings = await GlobalSetting.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings', error: error.message });
  }
};

// @desc    Update Global Settings
// @route   PUT /api/admin/settings
// @access  Private (Admin only)
export const updateSettings = async (req, res) => {
  try {
    let settings = await GlobalSetting.findOne();
    if (!settings) {
      settings = new GlobalSetting();
    }

    // Direct updates (only allow safe fields)
    const updates = { ...req.body };

    // Prevent manual override of the platformWalletBalance from this general settings endpoint
    delete updates.platformWalletBalance;
    // Holidays are managed via dedicated /api/delivery-slots/admin/holidays endpoints
    delete updates.holidays;

    let popupChanged = false;
    const previousPopupVersion = settings.appPopup?.version;
    if (updates.appPopup !== undefined) {
      const popup = await preparePopupUpdate(updates.appPopup, settings.appPopup || {});
      if (popup) { settings.appPopup = popup; popupChanged = true; }
      delete updates.appPopup;
    }

    if (updates.immediateDeliveryFee !== undefined) {
      const fee = Number(updates.immediateDeliveryFee);
      if (!Number.isFinite(fee) || fee < 0) {
        return res.status(400).json({ message: 'Invalid immediateDeliveryFee. Must be a non-negative number.' });
      }
      updates.immediateDeliveryFee = fee;
    }

    Object.assign(settings, updates);

    let updatedSettings;
    if (popupChanged && !settings.isNew) {
      await settings.validate();
      updatedSettings = await GlobalSetting.findOneAndUpdate({
        _id: settings._id,
        ...(previousPopupVersion === '1'
          ? { $or: [{ 'appPopup.version': '1' }, { 'appPopup.version': { $exists: false } }] }
          : { 'appPopup.version': previousPopupVersion ?? { $exists: false } })
      }, settings.getChanges(), { new: true, runValidators: true });
      if (!updatedSettings) throw new AppPopupError('This popup changed while saving. Reload settings and try again.', 409);
    } else { updatedSettings = await settings.save(); }
    res.json(updatedSettings);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Error updating settings', error: error.message });
  }
};

// @desc    Public interface to get active charges for checkout
// @route   GET /api/settings/public
// @access  Public
export const getPublicSettings = async (req, res) => {
  try {
    let settings = await GlobalSetting.findOne();
    if (!settings) {
      settings = await GlobalSetting.create({});
    }

    // Expose ONLY safe values to the frontend
    res.json({
      defaultTaxRate: settings.defaultTaxRate,
      taxCalculation: settings.taxCalculation,
      baseDeliveryFee: settings.baseDeliveryFee,
      immediateDeliveryFee: settings.immediateDeliveryFee ?? 0,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      handlingFee: settings.handlingFee,
      surgeMultiplier: settings.surgeMultiplier,
      maxDeliveryRadius: settings.maxDeliveryRadius,
      immediateDeliveryEnabled: settings.immediateDeliveryEnabled,
      deliveryTimezone: settings.deliveryTimezone,
      slotBookingCutoffMinutes: settings.slotBookingCutoffMinutes,
      supportPhone: settings.supportPhone,
      whatsappNumber: settings.whatsappNumber,
      supportEmail: settings.supportEmail,
      facebookUrl: settings.facebookUrl,
      instagramUrl: settings.instagramUrl,
      twitterUrl: settings.twitterUrl,
      linkedinUrl: settings.linkedinUrl,
      officialWebsite: settings.officialWebsite,
      playStoreUrl: settings.playStoreUrl,
      appStoreUrl: settings.appStoreUrl,
      offerStripText: settings.offerStripText,
      isOfferStripEnabled: settings.isOfferStripEnabled,
        holidays: Array.isArray(settings.holidays)
        ? settings.holidays.map(h => ({
            date: h.date,
            name: h.name,
            reason: h.reason || ''
          }))
        : [],
      referral: buildReferralSettings(settings),
      appPopup: settings.appPopup ? {
        isEnabled: Boolean(settings.appPopup.isEnabled),
        title: settings.appPopup.title || '',
        message: settings.appPopup.message || '',
        imageUrl: settings.appPopup.imageUrl || '',
        actionType: settings.appPopup.actionType || 'home',
        actionTarget: settings.appPopup.actionTarget || '',
        buttonText: settings.appPopup.buttonText || 'Shop Now',
        version: settings.appPopup.version || '1'
      } : { isEnabled: false }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching public settings', error: error.message });
  }
};

// @desc    Upload App-Open Festival/Offer Popup Image
// @route   POST /api/settings/upload-popup-image
// @access  Private (Admin only)
export const uploadPopupImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select an image file to upload.' });
    }
    const uploaded = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      folder: 'saathigro/popup-banners',
      transformation: [{ width: 1200, height: 800, crop: 'limit', quality: 'auto' }]
    });
    return res.status(200).json({
      success: true,
      imageUrl: uploaded.secure_url
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

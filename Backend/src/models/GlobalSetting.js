import mongoose from 'mongoose';

const globalSettingSchema = new mongoose.Schema({
  // Tax Settings
  organizationTIN: { type: String, default: 'GST29AABCS1234Z' },
  taxIdType: { type: String, default: 'GST (India)' },
  defaultTaxRate: { type: Number, default: 18 },
  taxCalculation: { type: String, enum: ['Exclusive', 'Inclusive'], default: 'Exclusive' },

  // Delivery & App Fees
  baseDeliveryFee: { type: Number, default: 25 },
  freeDeliveryThreshold: { type: Number, default: 500 },
  handlingFee: { type: Number, default: 5 },
  immediateDeliveryFee: { type: Number, default: 0, min: 0 },
  surgeMultiplier: { type: Number, default: 1.0 },

  // Business Logic
  platformCommissionRate: { type: Number, default: 12 }, // Vendor split
  platformWalletBalance: { type: Number, default: 45280.50 }, // Track platform earnings
  maxDeliveryRadius: { type: Number, default: 20 }, // in KM
  autoInvoicingEnabled: { type: Boolean, default: true },
  immediateDeliveryEnabled: { type: Boolean, default: true },
  deliveryTimezone: { type: String, default: 'Asia/Kolkata', trim: true },
  slotBookingCutoffMinutes: { type: Number, default: 30, min: 0, max: 240 },

  // Support & Social Settings
  supportPhone: { type: String, default: '+91 9636410100' },
  whatsappNumber: { type: String, default: '919636410100' },
  supportEmail: { type: String, default: 'support@saathigro.in' },
  facebookUrl: { type: String, default: '' },
  instagramUrl: { type: String, default: '' },
  twitterUrl: { type: String, default: '' },
  linkedinUrl: { type: String, default: '' },
  officialWebsite: { type: String, default: '' },
  playStoreUrl: { type: String, default: '' },
  appStoreUrl: { type: String, default: '' },
  
  // Offer Strip Settings
  offerStripText: { type: String, default: 'Welcome to Saathigro! Discover fresh groceries at wholesale prices.' },
  isOfferStripEnabled: { type: Boolean, default: false },
  holidays: [{
    date: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    reason: { type: String, default: '', trim: true }
  }]
}, {
  timestamps: true
});

const GlobalSetting = mongoose.model('GlobalSetting', globalSettingSchema);
export default GlobalSetting;

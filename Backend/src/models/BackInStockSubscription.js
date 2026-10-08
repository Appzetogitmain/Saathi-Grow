import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, required: true },
  storeType: { type: String, enum: ['branch', 'vendor'], required: true },
  variantValue: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'processing'], default: 'pending' },
  claimedAt: Date
}, { timestamps: true });

schema.index({ user: 1, product: 1, storeId: 1, storeType: 1, variantValue: 1 }, { unique: true });
schema.index({ status: 1, claimedAt: 1 });

export default mongoose.model('BackInStockSubscription', schema);

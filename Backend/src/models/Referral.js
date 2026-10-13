import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  referee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  referralCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['registered', 'rewarded', 'cancelled'],
    default: 'registered',
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  referrerReward: {
    type: Number,
    default: 0
  },
  refereeReward: {
    type: Number,
    default: 0
  },
  rewardedAt: {
    type: Date,
    default: null
  },
  cancellationReason: { type: String, default: '' }
}, {
  timestamps: true
});

referralSchema.index({ referrer: 1, createdAt: -1 });
referralSchema.index({ status: 1, updatedAt: 1 });

const Referral = mongoose.model('Referral', referralSchema);
export default Referral;

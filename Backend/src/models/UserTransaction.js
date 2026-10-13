import mongoose from 'mongoose';

const userTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  category: {
    type: String,
    enum: ['topup', 'order_payment', 'order_refund', 'adjustment', 'referral_reward'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  description: {
    type: String,
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  razorpayOrderId: {
    type: String,
    default: null
  },
  razorpayPaymentId: {
    type: String,
    default: null
  },
  referralId: { type: mongoose.Schema.Types.ObjectId, ref: 'Referral' },
  referralRole: { type: String, enum: ['referrer', 'referee'] }
}, {
  timestamps: true
});

userTransactionSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      category: 'topup',
      razorpayPaymentId: { $type: 'string' }
    }
  }
);

userTransactionSchema.index({ user: 1, createdAt: -1 });
userTransactionSchema.index({ referralId: 1, referralRole: 1 }, {
  unique: true,
  partialFilterExpression: { category: 'referral_reward', referralId: { $type: 'objectId' } }
});

const UserTransaction = mongoose.model('UserTransaction', userTransactionSchema);
export default UserTransaction;

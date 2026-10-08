import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recipientModel'
  },
  recipientModel: {
    type: String,
    enum: ['User', 'Admin', 'Vendor', 'DeliveryPartner', 'Staff']
  },
  isBroadcast: {
    type: Boolean,
    default: false
  },
  targetGroup: {
    type: String,
    enum: ['all', 'users', 'vendors', 'delivery_partners', 'staff', 'branch_managers']
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  sourceKey: String,
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  data: {
    type: Map,
    of: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'general'
  }
}, {
  timestamps: true
});

notificationSchema.index({ sourceKey: 1 }, { unique: true, partialFilterExpression: { sourceKey: { $type: 'string' } } });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;

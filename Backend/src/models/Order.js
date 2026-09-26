import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: Number,
        price: Number,
        name: String,
        image: String,
        weight: String,
        selectedVariant: {
            type: { type: String, default: '' },
            value: { type: String, default: '' },
            price: Number,
            stock: Number
        },
        physicalLocation: { type: String, default: null } // Shelf/rack label for warehouse picking
    }],
    subTotal: {
        type: Number,
        default: 0
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    deliveryFee: {
        type: Number,
        default: 0
    },
    immediateDeliveryFee: {
        type: Number,
        default: 0
    },
    handlingFee: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    platformCommission: {
        type: Number,
        default: 0
    },
    vendorPayoutAmount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: [
            'pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered',
            'cancelled', 'return_requested', 'return_pickup_scheduled', 'return_picked_up', 'returned'
        ],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'online', 'wallet', 'cash'],
        required: true
    },
    razorpayOrderId: {
        type: String,
        default: null
    },
    razorpayPaymentId: {
        type: String,
        default: null
    },
    razorpaySignature: {
        type: String,
        default: null
    },
    shippingAddress: {
        name: String,
        phone: String,
        street: String,
        city: String,
        state: String,
        zipCode: String,
        location: {
            type: {
                type: String,
                enum: ['Point'],
                required: false
            },
            coordinates: {
                type: [Number],
                required: false
            }
        }
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor'
    },
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch'
    },
    deliverySlot: {
        type: String, // Legacy display label e.g. "Morning (9 AM - 11 AM)" — kept for backward compat
        default: null
    },
    // Sprint 1: DeliveryRun system additions
    deliverySlotId: {
        // Proper ObjectId ref to the DeliverySlot document (Sprint 2+: used for slot-grouping in admin)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliverySlot',
        default: null
    },
    isImmediate: {
        // true = customer chose ASAP delivery (no slot selected)
        type: Boolean,
        default: false
    },
    deliveryWindowSnapshot: {
        label: { type: String, default: null },
        startTime: { type: String, default: null },
        endTime: { type: String, default: null },
        timezone: { type: String, default: 'Asia/Kolkata' },
        scheduledDate: { type: String, default: null },
        isImmediate: { type: Boolean, default: false }
    },
    deliveryRunId: {
        // Link to the DeliveryRun batch this order was assigned to
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryRun',
        default: null
    },
    stopSequence: {
        // Position of this order within its DeliveryRun (1 = first stop, 2 = second, etc.)
        type: Number,
        default: null
    },
    // Delivery Q-Commerce Additions
    deliveryPartnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryPartner',
        default: null
    },
    deliveryOTP: {
        type: String, // 4 digit secure PIN
        default: null
    },
    proofOfDeliveryImage: {
        type: String, // Cloudinary Image URL
        default: null
    },
    deliveryTimestamps: {
        assignedAt: { type: Date, default: null },
        pickedUpAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null }
    },
    returnRequest: {
        isRequested: { type: Boolean, default: false },
        reason: { type: String, default: null },
        description: { type: String, default: null },
        images: { type: [String], default: [] },
        status: { type: String, enum: ['Pending', 'Accepted', 'Rejected', 'Approved', 'FinalRejected', 'Scheduled', 'PickedUp', 'Returned'], default: 'Pending' },
        requestDate: { type: Date, default: null },
        rejectionReason: { type: String, default: null },
        pickupScheduledAt: { type: Date, default: null },
        pickedUpAt: { type: Date, default: null },
        resolvedAt: { type: Date, default: null },
        pickupProofImage: { type: String, default: null },
        returnOTP: { type: String, default: null },
        pickupPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', default: null },
        pickupDeliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderDelivery', default: null }
    },
    cancellation: {
        isCancelled: { type: Boolean, default: false },
        reason: { type: String, default: null },
        cancelledAt: { type: Date, default: null }
    },
    orderSource: {
        type: String,
        enum: ['online', 'pos'],
        default: 'online'
    },
    appliedPromo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PromoCode',
        default: null
    },
    promoCode: {
        type: String, // String copy of the code used
        default: null
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    // Phase 8: Snapshot of free gift at order-placement time (historical accuracy)
    // Old orders that pre-date this field simply have null — the modal checks ?.title safely
    freeGiftSnapshot: {
        title: { type: String, default: null },
        description: { type: String, default: null },
        image: { type: String, default: null }
    },
    posCustomer: {
        name: String,
        email: String,
        phone: String
    },
    tag: {
        type: String,
        default: null,
        trim: true,
        maxlength: 30
    },
    feedback: {
        rating: { type: Number, min: 1, max: 5, default: null },
        comment: { type: String, default: null },
        submittedAt: { type: Date, default: null }
    }
}, {
    timestamps: true
});

orderSchema.index({ 'shippingAddress.location': '2dsphere' });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ vendor: 1, createdAt: -1 });
orderSchema.index({ branchId: 1, createdAt: -1 });
orderSchema.index({ deliveryPartnerId: 1, status: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'returnRequest.status': 1 });
orderSchema.index({ deliverySlotId: 1, 'deliveryWindowSnapshot.scheduledDate': 1, status: 1 });
orderSchema.index(
    { razorpayPaymentId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            paymentMethod: 'online',
            razorpayPaymentId: { $type: 'string' }
        }
    }
);
orderSchema.index(
    { razorpayOrderId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            paymentMethod: 'online',
            razorpayOrderId: { $type: 'string' }
        }
    }
);

const Order = mongoose.model('Order', orderSchema);
export default Order;

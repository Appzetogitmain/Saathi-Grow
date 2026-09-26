import mongoose from 'mongoose';
import validator from 'validator';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        default: 'New Saathi',
        validate: {
            validator: function(v) {
                if (!v || v === 'New Saathi') return true;
                return /^[a-zA-Z\s]+$/.test(v);
            },
            message: 'Full name must only contain letters and spaces'
        }
    },
    email: {
        type: String,
        unique: true,
        lowercase: true,
        sparse: true, // Allow multiple nulls but unique if present
        validate: [validator.isEmail, 'Please provide a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Please provide your phone number'],
        unique: true
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'staff', 'rider'],
        default: 'user'
    },
    isRegistrationComplete: {
        type: Boolean,
        default: false,
        index: true
    },
    profileImage: {
        type: String,
        default: null
    },
    profileImagePublicId: {
        type: String,
        default: null
    },
    // OTP Fields for Login/Register
    otp: {
        type: String,
        select: false
    },
    otpExpires: {
        type: Date,
        select: false
    },
    addresses: [{
        label: { type: String, default: 'Home' }, // Home, Work, etc.
        name: String,
        phone: String,
        street: String,
        city: String,
        state: String,
        zipCode: String,
        isDefault: { type: Boolean, default: false },
        location: {
            type: { type: String, default: 'Point' },
            coordinates: [Number] // [longitude, latitude] for hyperlocal mapping
        }
    }],
    walletBalance: {
        type: Number,
        default: 0
    },
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    cart: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        selectedVariant: {
            type: {
                type: String,
                default: ''
            },
            value: {
                type: String,
                default: ''
            }
        },
        price: {
            type: Number,
            default: null
        },
        displayName: {
            type: String,
            default: ''
        },
        weight: {
            type: String,
            default: ''
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    /** Unique code for invite/share links (e.g. /register?ref=ABC123) */
    referralCode: {
        type: String,
        unique: true,
        sparse: true,
        uppercase: true,
        trim: true
    },
    /** User who referred this account (set only on first registration) */
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    fcmToken: {
        app: {
            type: String,
            default: ''
        },
        web: {
            type: String,
            default: ''
        }
    }
}, {
    timestamps: true
});

// Index for geospatial queries tracking addresses
userSchema.index({ "addresses.location": "2dsphere" });

const User = mongoose.model('User', userSchema);
export default User;

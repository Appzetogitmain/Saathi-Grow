import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required']
  },
  tags: [String],
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: 0
  },
  mrp: {
    type: Number,
    min: 0
  },
  purchasePrice: {
    type: Number,
    min: 0
  },
  hsnCode: {
    type: String,
    trim: true,
    default: ''
  },
  isVeg: {
    type: Boolean,
    default: true
  },
  branchStocks: [{
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true
    },
    stock: {
      type: Number,
      default: 0,
      min: 0
    },
    lowStockThreshold: {
      type: Number,
      default: 10
    }
  }],
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: 0
  },
  unitType: {
    type: String,
    enum: ['pcs', 'kg', 'g', 'gm', 'ml', 'ltr', 'pkt', 'box', '500g', '250g', '100g', 'bottle', 'can', 'dozen', 'set', 'roll', 'pair', 'bundle'],
    default: 'pcs'
  },
  unitValue: {
    type: Number,
    default: 1
  },
  gallery: [String],
  variants: [{
    type: { type: String }, // e.g., 'Weight', 'Color', 'Size'
    value: String,
    stock: Number,
    price: Number,
    mrp: { type: Number, default: null },
    image: String
  }],
  physicalLocation: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required']
  },
  subCategory: {
    type: String,
    trim: true,
    default: ''
  },
  brandName: {
    type: String,
    trim: true,
    default: ''
  },
  isAllBranches: {
    type: Boolean,
    default: true
  },
  specificBranches: [String],
  sku: {
    type: String,
    unique: true,
    required: [true, 'SKU is required']
  },
  qrCode: {
    type: String, // Data URL or Cloudinary URL
    default: ''
  },
  image: {
    type: String, // Cloudinary URL (optional for bulk upload; required on Add Product UI)
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Draft', 'Out of Stock', 'Low Stock', 'Pending Approval', 'Rejected'],
    default: 'Active'
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  },
  isSaathigro: {
    type: Boolean,
    default: false
  },
  displayOrder: {
    type: Number,
    default: null,
    index: true
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  // --- Inventory Intelligence ---
  reorderThreshold: { type: Number, default: 10 },
  maxCapacityPerSku: { type: Number, default: 0 },
  isStockAutoSync: { type: Boolean, default: false },

  // --- Physical Handling ---
  weightCategory: { 
    type: String, 
    enum: ['Light', 'Medium', 'Heavy'], 
    default: 'Light' 
  },
  isFragile: { type: Boolean, default: false },
  temperatureType: { 
    type: String, 
    enum: ['Normal', 'Cold', 'Frozen'], 
    default: 'Normal' 
  },

  // --- Picking Optimization ---
  pickPriority: { type: Number, default: 0 }, // 0: Normal, 1: High/Fast-moving
  pickingZone: { 
    type: String, 
    enum: ['Food', 'Non-food', 'Mixed Restricted', 'Other'], 
    default: 'Other' 
  },

  // --- Variant Handling ---
  variantGroupId: { type: String, default: '' },
  pickSequence: { type: Number, default: 0 }, // Order within variant group

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

productSchema.index(
  {
    name: "text",
    tags: "text",
    brandName: "text",
    category: "text",
    subCategory: "text",
    description: "text"
  },
  {
    weights: {
      name: 10,
      tags: 5,
      brandName: 3,
      category: 2,
      subCategory: 2,
      description: 1
    },
    name: "ProductSearchIndex"
  }
);

// Compound Indexes for Performance (Phase 1 Optimization)
productSchema.index({ category: 1, status: 1, displayOrder: 1, isSaathigro: -1, createdAt: -1 });
productSchema.index({ status: 1, displayOrder: 1, isSaathigro: -1, createdAt: -1 });
productSchema.index({ vendor: 1, status: 1 });
productSchema.index({ 'branchStocks.branchId': 1, status: 1 });

const Product = mongoose.model('Product', productSchema);
export default Product;

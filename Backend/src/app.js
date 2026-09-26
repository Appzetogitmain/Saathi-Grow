import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { randomUUID } from 'crypto';
import connectDB from './config/db.js';
import noCache from './utils/noCache.js';
import { validateRuntimeEnv, printEnvValidationSummary } from './config/validateEnv.js';
import { handleWalletTopupWebhook } from './controllers/walletController.js';

// Database Connection
const envSummary = validateRuntimeEnv();
printEnvValidationSummary(envSummary);
try {
  await connectDB();
} catch (err) {
  // If DB init fails, keep server alive so we don't get nginx 502.
  console.error('DB initialization failed (server will start with limited functionality):', err);
}

const app = express();
app.set('trust proxy', 1);
app.use(noCache);
const httpServer = createServer(app);

// CORS configuration based on environment
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://saathi-grow-frontend.vercel.app',
  'https://saathi-grow.vercel.app',
  'https://saathigro.in',
  'https://saathi-grow-admin.vercel.app',
  'https://saathi-grow-vendor.vercel.app',
  'https://saathi-grow-8oyg.vercel.app',
  process.env.CLIENT_URL
].filter(Boolean).map(o => o.trim().replace(/\/$/, ''));

const isAllowed = (origin) => {
  if (!origin || origin === 'null') return true;

  const sanitizedOrigin = origin.trim().replace(/\/$/, '');
  if (allowedOrigins.includes(sanitizedOrigin)) return true;

  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    // Allow all localhost variants
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;

    // Allow any vercel.app subdomain
    if (hostname.endsWith('.vercel.app')) return true;

    // Allow the domain without subdomain if hit directly
    if (hostname === 'vercel.app') return true;

  } catch (err) {
    console.error('CORS Origin Parsing Error:', origin);
  }

  console.warn('CORS Blocked Origin:', origin);
  return false;
};

// Socket.io initialization for real-time tracking
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Explicit preflight handler.
// Some proxies/bundles can cause OPTIONS not to go through the normal middleware path,
// which results in missing `Access-Control-Allow-Origin` and browser CORS failures.
app.options('*', cors({
  origin: (origin, callback) => {
    if (isAllowed(origin)) callback(null, true);
    else callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.use(morgan('dev')); // Logging
app.post(
  '/api/wallet/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  handleWalletTopupWebhook
);
app.use(express.json({ limit: '50mb' })); // Body parser
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: "Welcome to SaathiGro API - Quick Commerce Backend",
    status: "Running",
    version: "1.0.0"
  });
});

// Import Routes
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import categoryPageRoutes from './routes/categoryPageRoutes.js';
import subCategoryRoutes from './routes/subcategoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import branchRoutes from './routes/branchRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import vendorPortalRoutes from './routes/vendorPortalRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import offerRoutes from './routes/offerRoutes.js';
import userRoutes from './routes/userRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import userAddressRoutes from './routes/userAddressRoutes.js';
import userWishlistRoutes from './routes/userWishlistRoutes.js';
import userCartRoutes from './routes/userCartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import adminDeliveryRoutes from './routes/adminDeliveryRoutes.js';
import deliveryAuthRoutes from './routes/deliveryAuthRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import legalRoutes from './routes/legalRoutes.js';
import deliverySlotRoutes from './routes/deliverySlotRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import inventoryRequestRoutes from './routes/inventoryRequestRoutes.js';
import demandRoutes from './routes/demandRoutes.js';
import faqRoutes from './routes/faqRoutes.js';
import posRoutes from './routes/posRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import promoCodeRoutes from './routes/promoCodeRoutes.js';
import userProfileRoutes from './routes/userProfileRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import adminCategoryPageRoutes from './routes/adminCategoryPageRoutes.js';
import physicalLocationRoutes from './routes/physicalLocationRoutes.js';
import ogRoutes from './routes/ogRoutes.js';
import searchLogRoutes from './routes/searchLogRoutes.js';
import { protect, protectAdmin, protectVendor, protectDeliveryPartner } from './middleware/authMiddleware.js';



// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userProfileRoutes);

app.use('/api/admin/subcategories', subCategoryRoutes);
app.use('/api/admin/products', productRoutes);
app.use('/api/admin/categories', categoryRoutes);
app.use('/api/admin/category-pages', adminCategoryPageRoutes);
app.use('/api/admin/brands', brandRoutes);
app.use('/api/admin/vendors', vendorRoutes);
app.use('/api/admin/branches', branchRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api/admin/locations', physicalLocationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vendors', vendorPortalRoutes);
app.use('/api/admin/campaigns', campaignRoutes);
app.use('/api/admin/offer-deals', offerRoutes);
app.use('/api/admin/delivery', adminDeliveryRoutes);
app.use('/api/admin/inventory-requests', inventoryRequestRoutes);
app.use('/api/delivery/auth', deliveryAuthRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/promocodes', promoCodeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin/reports', reportRoutes);
app.use('/api/admin/search-logs', searchLogRoutes);
app.use('/api/reviews', reviewRoutes);

// User Profile/Front-End Routes
app.use('/api/user/addresses', userAddressRoutes);
app.use('/api/user/wishlist', userWishlistRoutes);
app.use('/api/user/cart', userCartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/delivery-slots', deliverySlotRoutes);
app.use('/api/user/stores', storeRoutes);
app.use('/api/user/category-pages', categoryPageRoutes);
app.use('/api/demand', demandRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/pos', posRoutes);

// OG / Social crawler meta-tag route (Nginx proxies crawler UAs here)
app.use('/api/og', ogRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestId: req.requestId || null,
  });
});


// Socket logic placeholder
io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔥 User disconnected');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    requestId: req.requestId || null,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// Start server
const PORT = process.env.PORT || 5000;

import { initCronJobs } from './services/cronJobs.js';
initCronJobs();

httpServer.listen(PORT, () => {
  console.log(`📡 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log('✅ Subcategories route registered at: /api/admin/subcategories');
});

app.get('/api/test-sub', (req, res) => res.json({ message: "Subcategory API is reachable" }));

export { app, io };

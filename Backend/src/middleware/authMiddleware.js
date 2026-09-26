import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import Vendor from '../models/Vendor.js';
import DeliveryPartner from '../models/DeliveryPartner.js';

const PERMISSION_ALIASES = {
  MANAGE_DELIVERY: ['MANAGE_DELIVERY_BOYS'],
  MANAGE_DELIVERY_BOYS: ['MANAGE_DELIVERY'],
  VIEW_PRODUCTS: ['MANAGE_PRODUCTS']
};


// Protect Customer/User Routes
export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
      if (!req.user) return res.status(401).json({ message: 'User no longer exists' });
      
      // Strict Block Check
      if (req.user.isActive === false) {
        return res.status(403).json({ message: 'Account is deactivated. Please contact support at support@saathigro.in.', isBlocked: true });
      }
      
      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }
  if (!token) res.status(401).json({ message: 'Not authorized, no token' });
};

// Ensure customer has completed initial registration
export const requireRegistrationComplete = (req, res, next) => {
  const isMissingFromDb = typeof req.user?.isInit === 'function' && !req.user.isInit('isRegistrationComplete');
  if (!isMissingFromDb && req.user && req.user.isRegistrationComplete === false) {
    return res.status(403).json({
      message: 'Please complete your registration to proceed.',
      requiresRegistration: true
    });
  }
  next();
};

// Optional User Protection - Populates req.user if token exists, but doesn't error if not
export const optionalProtect = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    } catch (error) {
      // Silently fail, req.user will remain undefined
    }
  }
  next();
};

// Protect Vendor Portal Routes
export const protectVendor = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.vendor = await Vendor.findById(decoded.id);
      if (!req.vendor) return res.status(401).json({ message: 'Vendor access denied' });
      if (req.vendor.status !== 'Active') return res.status(403).json({ message: 'Account is not active' });
      next();
    } catch (error) {
      res.status(401).json({ message: 'Session expired, please login again' });
    }
  }
  if (!token) res.status(401).json({ message: 'Vendor authentication required' });
};

// Protect Admin Panel Routes
export const protectAdmin = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.admin = await Admin.findById(decoded.id);
      if (!req.admin) return res.status(401).json({ message: 'Admin access denied' });
      if (req.admin.isActive === false) {
        // Only Super Admins (no branchId and 'Admin' role) get the English message
        const isSuperAdmin = req.admin.role === 'Admin' && !req.admin.branchId;
        const msg = isSuperAdmin ? 'Account is inactive. Please contact support.' : 'This branch has been deleted. Please contact admin.';
        return res.status(403).json({ message: msg });
      }
      next();
    } catch (error) {
      res.status(401).json({ message: 'Session expired, please login again' });
    }
  }
  if (!token) res.status(401).json({ message: 'Admin authentication required' });
};

// Optional Admin Protection - Populates req.admin if token exists, but doesn't error if not
export const optionalProtectAdmin = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const admin = await Admin.findById(decoded.id);
      if (admin?.isActive !== false) {
        req.admin = admin;
      }
    } catch (error) {
      // Silently fail, req.admin will remain undefined
    }
  }
  next();
};

// Check specific admin role
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
};

// RBAC Middleware
export const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    // Super Admins ('Admin' role) bypass all permission checks
    if (req.admin.role === 'Admin') {
      return next();
    }

    // Branch Managers and Staff must possess the required permission in their array
    const permissions = Array.isArray(req.admin.permissions) ? req.admin.permissions : [];
    const acceptedPermissions = [requiredPermission, ...(PERMISSION_ALIASES[requiredPermission] || [])];
    const hasPermission = acceptedPermissions.some((permission) => permissions.includes(permission));

    if (hasPermission) {
      return next();
    }

    // Implicit permissions for Store Managers
    if (req.admin.role === 'Store Manager' && (requiredPermission === 'MANAGE_ORDERS' || requiredPermission === 'VIEW_ORDERS')) {
      return next();
    }

    return res.status(403).json({
      message: `Access Denied: You do not have the ${requiredPermission} permission.`
    });
  };
};

// Protect Delivery Partner Logic
// Supports token from: (1) Authorization header or (2) ?token= query param (for direct download URLs in Flutter WebView)
export const protectDeliveryPartner = async (req, res, next) => {
  let token;

  // 1. Try Authorization header first (standard API calls)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. Fall back to ?token= query param (for direct-URL file downloads from Flutter)
  else if (req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.partner = await DeliveryPartner.findById(decoded.id);
      if (!req.partner) return res.status(401).json({ message: 'Delivery Partner access denied' });
      if (req.partner.authStatus !== 'Active') return res.status(403).json({ message: 'Account is suspended or inactive. Please contact support at support@saathigro.in.' });
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Session expired, please login again' });
    }
  }

  return res.status(401).json({ message: 'Delivery Partner authentication required' });
};
// Protect routes for both Vendors and Admins (Branch Managers)
export const protectStoreManager = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Try to find Admin first
      const admin = await Admin.findById(decoded.id);
      if (admin) {
        if (admin.isActive === false) {
          // Only Super Admins (no branchId and 'Admin' role) get the English message
          const isSuperAdmin = admin.role === 'Admin' && !admin.branchId;
          const msg = isSuperAdmin ? 'Account is inactive. Please contact support.' : 'This branch has been deleted. Please contact admin.';
          return res.status(403).json({ message: msg });
        }
        req.admin = admin;
        req.user = admin;
        req.role = 'Admin';
        return next();
      }

      // Try to find Vendor
      const vendor = await Vendor.findById(decoded.id);
      if (vendor) {
        req.vendor = vendor;
        req.user = vendor;
        req.role = 'Vendor';
        return next();
      }

      return res.status(401).json({ message: 'Store manager access denied' });
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
    }
  }
  if (!token) res.status(401).json({ message: 'Authentication required' });
};
// Optional Store Manager Protection - Populates req.admin or req.vendor if token exists
export const optionalProtectStoreManager = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Try Admin
      const admin = await Admin.findById(decoded.id);
      if (admin && admin.isActive !== false) {
        req.admin = admin;
        return next();
      }

      // Try Vendor
      const vendor = await Vendor.findById(decoded.id);
      if (vendor) {
        req.vendor = vendor;
        return next();
      }
    } catch (error) {
      // Silently fail
    }
  }
  next();
};
// Protect for any valid user (Admin, Vendor, Partner, or Customer)
export const protectAny = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check Admin
      const admin = await Admin.findById(decoded.id);
      if (admin) {
        if (admin.isActive !== false) {
          req.admin = admin;
          return next();
        } else {
          return res.status(403).json({ message: 'Admin account inactive' });
        }
      }

      // Check Vendor
      const vendor = await Vendor.findById(decoded.id);
      if (vendor) {
        if (vendor.status === 'Active') {
          req.vendor = vendor;
          return next();
        } else {
          return res.status(403).json({ message: 'Vendor account not active' });
        }
      }

      // Check Delivery Partner
      const partner = await DeliveryPartner.findById(decoded.id);
      if (partner) {
        if (partner.authStatus === 'Active') {
          req.partner = partner;
          return next();
        } else {
          return res.status(403).json({ message: 'Delivery partner account not active' });
        }
      }

      // Check User
      const user = await User.findById(decoded.id);
      if (user) {
        req.user = user;
        return next();
      }

      return res.status(401).json({ message: 'User not found' });
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  }
  if (!token) return res.status(401).json({ message: 'Authentication required' });
};

import { v2 as realCloudinary } from 'cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const uploadsRootDir = path.resolve(__dirname, '../../uploads');

// Ensure root uploads directory exists
if (!fs.existsSync(uploadsRootDir)) {
  fs.mkdirSync(uploadsRootDir, { recursive: true });
}

// Preserve Cloudinary config if credentials exist in .env
try {
  realCloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} catch (_) {}

/**
 * Determine the public base URL for static uploads.
 * In production, the backend runs on https://api.saathigro.in
 */
export const getBaseUrl = (req) => {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (req) {
    let proto = req.headers?.['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers?.['x-forwarded-host'] || (typeof req.get === 'function' ? req.get('host') : req.headers?.host);
    if (host) {
      if (host.includes('saathigro.in')) proto = 'https';
      return `${proto}://${host}`;
    }
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://api.saathigro.in';
  }
  return 'http://localhost:5000';
};

/**
 * Prefix for upload URLs.
 * Default is 'uploads', served statically by Express at https://api.saathigro.in/uploads/...
 */
export const getUploadPrefix = () => {
  return (process.env.UPLOAD_PATH_PREFIX || 'uploads').replace(/^\/|\/$/g, '');
};

/**
 * Helper: Detect output format / extension safely.
 */
const detectFormat = (file) => {
  const allowedOutput = ['jpg', 'png', 'webp', 'avif', 'pdf'];
  if (file.originalname && file.originalname.includes('.')) {
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (allowedOutput.includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  }
  if (file.mimetype) {
    const mimeExt = file.mimetype.split('/')[1]?.toLowerCase();
    if (allowedOutput.includes(mimeExt)) return mimeExt === 'jpeg' ? 'jpg' : mimeExt;
    if (file.mimetype === 'application/pdf') return 'pdf';
  }
  return 'jpg';
};

/**
 * Custom Multer storage engine that saves files directly to the server's
 * `Backend/uploads/` directory and sets `file.path` to the full public URL.
 * Existing controllers use `req.file.path` directly, so no controller code needs to change.
 */
function LocalDiskStorage(options) {
  this.subfolder = options.subfolder || 'general';
}

LocalDiskStorage.prototype._handleFile = function _handleFile(req, file, cb) {
  const cleanSubfolder = this.subfolder.replace(/^saathigro\/?/, '').replace(/^\//, '');
  const destinationDir = path.join(uploadsRootDir, cleanSubfolder);

  fs.mkdir(destinationDir, { recursive: true }, (mkdirErr) => {
    if (mkdirErr) return cb(mkdirErr);

    const ext = detectFormat(file);
    const uniqueSuffix = `${Date.now()}-${randomBytes(6).toString('hex')}`;
    const safeFieldname = (file.fieldname || 'file').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${safeFieldname}-${uniqueSuffix}.${ext}`;
    const finalLocalPath = path.join(destinationDir, filename);

    const outStream = fs.createWriteStream(finalLocalPath);
    file.stream.pipe(outStream);

    outStream.on('error', (streamErr) => cb(streamErr));
    outStream.on('finish', () => {
      const baseUrl = getBaseUrl(req);
      const prefix = getUploadPrefix();
      const relativePath = cleanSubfolder ? `${cleanSubfolder}/${filename}` : filename;
      const publicUrl = `${baseUrl}/${prefix}/${relativePath}`;

      cb(null, {
        destination: destinationDir,
        filename: filename,
        path: publicUrl, // Controllers save this into MongoDB!
        localPath: finalLocalPath,
        size: outStream.bytesWritten,
        mimetype: file.mimetype,
        public_id: `${prefix}/${relativePath}`,
        url: publicUrl,
        secure_url: publicUrl,
      });
    });
  });
};

LocalDiskStorage.prototype._removeFile = function _removeFile(req, file, cb) {
  const target = file.localPath || file.path;
  if (target && typeof target === 'string' && fs.existsSync(target)) {
    fs.unlink(target, cb);
  } else {
    cb(null);
  }
};

const makeLocalStorage = (subfolder) => new LocalDiskStorage({ subfolder });

// ── Per-entity Local disk storages ──────────────────────────────────────────
const adminStorage     = makeLocalStorage('admin-profiles');
const userStorage      = makeLocalStorage('user-profiles');
const deliveryStorage  = makeLocalStorage('delivery-profiles');
const productStorage   = makeLocalStorage('products');
const complaintStorage = makeLocalStorage('complaint-attachments');
const returnStorage    = makeLocalStorage('return-proof');
const generalStorage   = makeLocalStorage('general');

const allowedMimeTypes = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/avif', 'image/heic', 'image/heif', 'application/pdf'
]);

const makeFileFilter = () => (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();
  const filename = (file.originalname || '').toLowerCase();
  const ext = filename.split('.').pop();
  
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'pdf'];

  const isAllowed =
    mimetype.startsWith('image/') ||
    mimetype === 'application/pdf' ||
    mimetype === 'application/octet-stream' ||
    mimetype === 'blob' ||
    allowedExtensions.includes(ext);

  if (!isAllowed) {
    return cb(new Error(`File type not allowed: ${file.mimetype || 'unknown'}`));
  }
  cb(null, true);
};

const uploadOpts = { fileFilter: makeFileFilter(), limits: { fileSize: 15 * 1024 * 1024 } };
const productUploadOpts = { fileFilter: makeFileFilter(), limits: { fileSize: 50 * 1024 * 1024 } };

// Named exports — routes import whichever they need
const upload          = multer({ storage: adminStorage,    ...uploadOpts });
const userUpload      = multer({ storage: userStorage,     ...uploadOpts });
const deliveryUpload  = multer({ storage: deliveryStorage, ...uploadOpts });
const productUpload   = multer({ storage: productStorage,  ...uploadOpts });
const productImageUpload = multer({ storage: productStorage, ...productUploadOpts });
const complaintUpload = multer({ storage: complaintStorage,...uploadOpts });
const returnUpload    = multer({ storage: returnStorage,   ...uploadOpts });

/** Multipart fields for delivery partner profile + KYC docs */
const deliveryPartnerUploadFields = deliveryUpload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'aadhar', maxCount: 1 },
  { name: 'license', maxCount: 1 },
  { name: 'rc', maxCount: 1 },
]);

// Memory-based upload
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: makeFileFilter(),
});

/**
 * Programmatic buffer upload (replaces uploadBufferToCloudinary)
 * Saves buffer to Backend/uploads/<folder>/<filename> and returns Cloudinary-compatible payload
 */
const uploadBufferToCloudinary = async ({
  buffer,
  folder = 'uploads',
  publicId,
  transformation = [],
  req
}) => {
  if (!buffer) {
    throw new Error('uploadBufferToCloudinary: buffer is required');
  }

  const cleanFolder = folder.replace(/^saathigro\/?/, '').replace(/^\//, '') || 'general';
  const targetDir = path.join(uploadsRootDir, cleanFolder);
  await fs.promises.mkdir(targetDir, { recursive: true });

  let ext = '.png';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) ext = '.jpg';
  else if (buffer[0] === 0x89 && buffer[1] === 0x50) ext = '.png';
  else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) ext = '.webp';

  const baseName = publicId ? path.basename(publicId).replace(/\.[^/.]+$/, '') : `${Date.now()}-${randomBytes(6).toString('hex')}`;
  const filename = `${baseName}${ext}`;
  const finalLocalPath = path.join(targetDir, filename);

  await fs.promises.writeFile(finalLocalPath, buffer);

  const baseUrl = getBaseUrl(req);
  const prefix = getUploadPrefix();
  const relativePath = `${cleanFolder}/${filename}`;
  const publicUrl = `${baseUrl}/${prefix}/${relativePath}`;

  return {
    secure_url: publicUrl,
    url: publicUrl,
    public_id: `${prefix}/${relativePath}`,
    bytes: buffer.length,
    format: ext.replace('.', ''),
  };
};

/**
 * Compatibility wrapper for cloudinary object:
 * Handles `destroy(publicId)` cleanly for local server files
 * without throwing when Cloudinary credentials fail.
 */
const cloudinary = {
  ...realCloudinary,
  uploader: {
    ...realCloudinary.uploader,
    destroy: async (publicId) => {
      if (!publicId) return { result: 'not found' };
      try {
        const cleanId = String(publicId).replace(/^\/?(api\/)?uploads\//, '');
        const localTarget = path.join(uploadsRootDir, cleanId);
        if (fs.existsSync(localTarget)) {
          await fs.promises.unlink(localTarget);
          return { result: 'ok' };
        }
      } catch (err) {
        console.warn(`[LocalStorage] Could not delete local file for publicId: ${publicId}`, err.message);
      }
      try {
        if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_CLOUD_NAME) {
          return await realCloudinary.uploader.destroy(publicId);
        }
      } catch (_) {
        // Silently ignore if Cloudinary account is disabled
      }
      return { result: 'ok' };
    }
  }
};

export {
  cloudinary,
  upload,
  userUpload,
  deliveryUpload,
  deliveryPartnerUploadFields,
  productUpload,
  complaintUpload,
  returnUpload,
  productImageUpload,
  memoryUpload,
  uploadBufferToCloudinary,
};

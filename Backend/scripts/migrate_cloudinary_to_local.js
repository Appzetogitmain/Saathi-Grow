import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRootDir = path.resolve(__dirname, '../uploads');

// CLI Flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isDownloadOnly = args.includes('--download-only');
const limitArg = args.find(a => a.startsWith('--limit='));
const limitCount = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

// Base URL for production uploads
const getBaseUrl = () => {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL.replace(/\/$/, '');
  return 'https://saathigro.in';
};

/**
 * Extract relative file path from Cloudinary URL:
 * https://res.cloudinary.com/dntvxv9ef/image/upload/v1783282052/saathigro/admin-profiles/vmhctncuvhqc3fcwycas.jpg
 * -> admin-profiles/vmhctncuvhqc3fcwycas.jpg
 */
const parseCloudinaryUrl = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com/dntvxv9ef')) {
    return null;
  }
  const match = url.match(/\/(?:image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) return null;

  let relative = match[1].replace(/^saathigro\//, '');
  // Sanitize path separators
  relative = relative.replace(/\\/g, '/');
  return relative;
};

/**
 * Resilient file downloader with retry logic
 */
const downloadFile = async (url, targetLocalPath, retries = 3) => {
  const targetDir = path.dirname(targetLocalPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // If already downloaded and valid, skip
  if (fs.existsSync(targetLocalPath)) {
    const stat = fs.statSync(targetLocalPath);
    if (stat.size > 100) {
      return { success: true, cached: true, size: stat.size };
    }
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length < 50) {
        throw new Error(`Downloaded file too small (${buffer.length} bytes)`);
      }

      await fs.promises.writeFile(targetLocalPath, buffer);
      return { success: true, cached: false, size: buffer.length };
    } catch (err) {
      if (attempt === retries) {
        return { success: false, error: err.message };
      }
      // Brief exponential backoff
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
};

/**
 * Run tasks in parallel pool with max concurrency
 */
const runPool = async (items, concurrency, fn) => {
  const results = [];
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
};

async function main() {
  console.log('====================================================');
  console.log(' SAATHIGRO: CLOUDINARY TO LOCAL SERVER MIGRATION');
  console.log('====================================================');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (No files written, no DB updates)' : isDownloadOnly ? 'DOWNLOAD-ONLY (Files saved, no DB updates)' : 'FULL (Download + MongoDB Update)'}`);
  console.log(`Base URL: ${getBaseUrl()}`);
  console.log(`Uploads Directory: ${uploadsRootDir}`);
  console.log('----------------------------------------------------');

  await connectDB();
  const db = mongoose.connection.db;

  const collectionsToScan = [
    'products',
    'categories',
    'subcategories',
    'brands',
    'offerdeals',
    'globalsettings',
    'branches',
    'admins',
    'users',
    'deliverypartners',
    'complaints',
    'promocodes',
    'orders',
    'notifications'
  ];

  console.log('1. Scanning database for all Cloudinary assets...');
  const uniqueUrls = new Map(); // url -> { relativePath, newUrl, localPath, collections: Set }

  for (const colName of collectionsToScan) {
    const docs = await db.collection(colName).find({}).toArray();
    const str = JSON.stringify(docs);
    const matches = str.match(/https?:\/\/[^\s\\"']+/g) || [];

    for (const rawUrl of matches) {
      const url = rawUrl.replace(/\\/g, '');
      if (url.includes('cloudinary.com/dntvxv9ef')) {
        const relativePath = parseCloudinaryUrl(url);
        if (relativePath) {
          if (!uniqueUrls.has(url)) {
            const localPath = path.join(uploadsRootDir, relativePath);
            const newUrl = `${getBaseUrl()}/api/uploads/${relativePath}`;
            uniqueUrls.set(url, {
              originalUrl: url,
              relativePath,
              localPath,
              newUrl,
              collections: new Set([colName])
            });
          } else {
            uniqueUrls.get(url).collections.add(colName);
          }
        }
      }
    }
  }

  const allItems = Array.from(uniqueUrls.values()).slice(0, limitCount);
  console.log(`Found ${uniqueUrls.size} unique Cloudinary assets in DB (Processing ${allItems.length}).`);

  if (isDryRun) {
    console.log('[DRY-RUN] Sample mappings:');
    allItems.slice(0, 5).forEach((item, i) => {
      console.log(` ${i + 1}. ${item.originalUrl}`);
      console.log(`    -> Local: ${item.localPath}`);
      console.log(`    -> New DB URL: ${item.newUrl}`);
    });
    console.log('[DRY-RUN] Completed without modifications.');
    process.exit(0);
  }

  console.log('\n2. Downloading media files to server disk (Concurrency: 10)...');
  let downloadedCount = 0;
  let cachedCount = 0;
  let failedCount = 0;
  const successfulUrls = new Map(); // originalUrl -> item

  const startTime = Date.now();
  await runPool(allItems, 10, async (item, idx) => {
    const res = await downloadFile(item.originalUrl, item.localPath);
    if (res.success) {
      if (res.cached) cachedCount++;
      else downloadedCount++;
      successfulUrls.set(item.originalUrl, item);
    } else {
      failedCount++;
      console.warn(`[WARN] Failed to download (${idx + 1}/${allItems.length}): ${item.originalUrl} - ${res.error}`);
    }

    if ((idx + 1) % 100 === 0 || idx + 1 === allItems.length) {
      const percent = Math.round(((idx + 1) / allItems.length) * 100);
      process.stdout.write(`\rProgress: ${idx + 1}/${allItems.length} (${percent}%) | Downloaded: ${downloadedCount} | Existing: ${cachedCount} | Failed: ${failedCount}`);
    }
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDownload completed in ${durationSec}s! (Total Success: ${successfulUrls.size}, Failed: ${failedCount})`);

  // Write migration manifest for rollback and audit
  const manifestPath = path.resolve(__dirname, 'migration_manifest.json');
  const manifestData = {
    migratedAt: new Date().toISOString(),
    baseUrl: getBaseUrl(),
    totalAssets: allItems.length,
    successfulCount: successfulUrls.size,
    failedCount,
    mappings: Array.from(successfulUrls.values()).map(i => ({
      originalUrl: i.originalUrl,
      newUrl: i.newUrl,
      relativePath: i.relativePath,
      collections: Array.from(i.collections)
    }))
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
  console.log(`Saved audit manifest to: ${manifestPath}`);

  if (isDownloadOnly) {
    console.log('\n[DOWNLOAD-ONLY] All assets successfully backed up to disk. Database was NOT modified.');
    process.exit(0);
  }

  console.log('\n3. Updating MongoDB database records with new server URLs...');
  let updatedDocsCount = 0;

  // Helper to replace matching URLs in any string or object
  const replaceUrls = (val) => {
    if (typeof val === 'string' && successfulUrls.has(val)) {
      return successfulUrls.get(val).newUrl;
    }
    if (Array.isArray(val)) {
      return val.map(item => replaceUrls(item));
    }
    if (val && typeof val === 'object') {
      const out = {};
      for (const k of Object.keys(val)) {
        out[k] = replaceUrls(val[k]);
      }
      return out;
    }
    return val;
  };

  // 1. Products
  const products = await db.collection('products').find({}).toArray();
  for (const prod of products) {
    let changed = false;
    const update = {};
    if (prod.image && successfulUrls.has(prod.image)) {
      update.image = successfulUrls.get(prod.image).newUrl;
      changed = true;
    }
    if (Array.isArray(prod.gallery) && prod.gallery.length > 0) {
      const newGallery = prod.gallery.map(g => successfulUrls.has(g) ? successfulUrls.get(g).newUrl : g);
      if (JSON.stringify(newGallery) !== JSON.stringify(prod.gallery)) {
        update.gallery = newGallery;
        changed = true;
      }
    }
    if (changed) {
      await db.collection('products').updateOne({ _id: prod._id }, { $set: update });
      updatedDocsCount++;
    }
  }
  console.log(` Updated products: ${updatedDocsCount}`);

  // 2. Categories
  let catCount = 0;
  const categories = await db.collection('categories').find({}).toArray();
  for (const cat of categories) {
    if (cat.image && successfulUrls.has(cat.image)) {
      await db.collection('categories').updateOne({ _id: cat._id }, { $set: { image: successfulUrls.get(cat.image).newUrl } });
      catCount++;
    }
  }
  console.log(` Updated categories: ${catCount}`);

  // 3. Subcategories
  let subCount = 0;
  const subcategories = await db.collection('subcategories').find({}).toArray();
  for (const sub of subcategories) {
    if (sub.image && successfulUrls.has(sub.image)) {
      await db.collection('subcategories').updateOne({ _id: sub._id }, { $set: { image: successfulUrls.get(sub.image).newUrl } });
      subCount++;
    }
  }
  console.log(` Updated subcategories: ${subCount}`);

  // 4. Brands
  let brandCount = 0;
  const brands = await db.collection('brands').find({}).toArray();
  for (const b of brands) {
    if (b.logo && successfulUrls.has(b.logo)) {
      await db.collection('brands').updateOne({ _id: b._id }, { $set: { logo: successfulUrls.get(b.logo).newUrl } });
      brandCount++;
    }
  }
  console.log(` Updated brands: ${brandCount}`);

  // 5. Offer Deals / Banners
  let offerCount = 0;
  const offers = await db.collection('offerdeals').find({}).toArray();
  for (const o of offers) {
    if (o.bannerImage && successfulUrls.has(o.bannerImage)) {
      await db.collection('offerdeals').updateOne({ _id: o._id }, { $set: { bannerImage: successfulUrls.get(o.bannerImage).newUrl } });
      offerCount++;
    }
  }
  console.log(` Updated offer deals: ${offerCount}`);

  // 6. Global Settings (appPopup)
  const settingsList = await db.collection('globalsettings').find({}).toArray();
  for (const s of settingsList) {
    if (s.appPopup?.imageUrl && successfulUrls.has(s.appPopup.imageUrl)) {
      await db.collection('globalsettings').updateOne(
        { _id: s._id },
        { $set: { 'appPopup.imageUrl': successfulUrls.get(s.appPopup.imageUrl).newUrl } }
      );
      console.log(' Updated globalSettings appPopup');
    }
  }

  // 7. Delivery Partners
  let delCount = 0;
  const deliveryPartners = await db.collection('deliverypartners').find({}).toArray();
  for (const dp of deliveryPartners) {
    const update = {};
    if (dp.profileImage && successfulUrls.has(dp.profileImage)) update.profileImage = successfulUrls.get(dp.profileImage).newUrl;
    if (dp.aadharImage && successfulUrls.has(dp.aadharImage)) update.aadharImage = successfulUrls.get(dp.aadharImage).newUrl;
    if (dp.licenseImage && successfulUrls.has(dp.licenseImage)) update.licenseImage = successfulUrls.get(dp.licenseImage).newUrl;
    if (Object.keys(update).length > 0) {
      await db.collection('deliverypartners').updateOne({ _id: dp._id }, { $set: update });
      delCount++;
    }
  }
  console.log(` Updated delivery partners: ${delCount}`);

  // 8. Orders (items.image snapshots)
  let orderCount = 0;
  const orders = await db.collection('orders').find({ 'items.image': { $regex: 'cloudinary' } }).toArray();
  for (const ord of orders) {
    let changed = false;
    const newItems = (ord.items || []).map(item => {
      if (item.image && successfulUrls.has(item.image)) {
        changed = true;
        return { ...item, image: successfulUrls.get(item.image).newUrl };
      }
      return item;
    });
    if (changed) {
      await db.collection('orders').updateOne({ _id: ord._id }, { $set: { items: newItems } });
      orderCount++;
    }
  }
  console.log(` Updated order snapshots: ${orderCount}`);

  console.log('====================================================');
  console.log(' MIGRATION & BACKUP SUCCESSFULLY COMPLETED!');
  console.log(` Total Files Stored on Disk: ${successfulUrls.size}`);
  console.log(` Location: ${uploadsRootDir}`);
  console.log(' Manifest: Backend/scripts/migration_manifest.json');
  console.log('====================================================');

  process.exit(0);
}

main().catch(err => {
  console.error('\n[FATAL ERROR] Migration failed:', err);
  process.exit(1);
});

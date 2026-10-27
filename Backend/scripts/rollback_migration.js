import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.resolve(__dirname, 'migration_manifest.json');

async function rollback() {
  console.log('====================================================');
  console.log(' SAATHIGRO: ROLLBACK LOCAL URLS BACK TO CLOUDINARY');
  console.log('====================================================');

  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: Manifest file not found at ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const newToOldMap = new Map();
  for (const m of manifest.mappings) {
    newToOldMap.set(m.newUrl, m.originalUrl);
  }
  console.log(`Loaded ${newToOldMap.size} mappings from manifest.`);

  await connectDB();
  const db = mongoose.connection.db;

  const collections = [
    'products',
    'categories',
    'subcategories',
    'brands',
    'offerdeals',
    'globalsettings',
    'deliverypartners',
    'orders'
  ];

  let totalReverted = 0;

  for (const colName of collections) {
    const docs = await db.collection(colName).find({}).toArray();
    for (const doc of docs) {
      let changed = false;
      const jsonStr = JSON.stringify(doc);
      
      let containsMappedUrl = false;
      for (const [newUrl] of newToOldMap) {
        if (jsonStr.includes(newUrl)) {
          containsMappedUrl = true;
          break;
        }
      }
      if (!containsMappedUrl) continue;

      const revertUrls = (val) => {
        if (typeof val === 'string' && newToOldMap.has(val)) {
          changed = true;
          return newToOldMap.get(val);
        }
        if (Array.isArray(val)) return val.map(revertUrls);
        if (val && typeof val === 'object') {
          const out = {};
          for (const k of Object.keys(val)) out[k] = revertUrls(val[k]);
          return out;
        }
        return val;
      };

      const updatedDoc = revertUrls(doc);
      if (changed) {
        const { _id, ...fieldsToSet } = updatedDoc;
        await db.collection(colName).replaceOne({ _id }, doc);
        totalReverted++;
      }
    }
  }

  console.log(`Rollback completed! Total documents reverted: ${totalReverted}`);
  process.exit(0);
}

rollback().catch(e => { console.error(e); process.exit(1); });

import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../src/config/db.js';
import mongoose from 'mongoose';

async function cleanup() {
  await connectDB();
  const db = mongoose.connection.db;

  const campaigns = await db.collection('campaignsections').find({}).toArray();
  for (const c of campaigns) {
    const rawProducts = c.products || [];
    const validProductIds = [];
    for (const p of rawProducts) {
      if (!p || !p.productId) continue;
      // verify it exists in products collection
      const exists = await db.collection('products').findOne({ _id: p.productId });
      if (exists) {
        validProductIds.push(p);
      } else {
        console.log(`Campaign "${c.title}": Removing non-existent product ID ${p.productId}`);
      }
    }

    if (validProductIds.length !== rawProducts.length) {
      await db.collection('campaignsections').updateOne(
        { _id: c._id },
        { $set: { products: validProductIds } }
      );
      console.log(`Cleaned campaign "${c.title}": reduced from ${rawProducts.length} to ${validProductIds.length} products.`);
    } else {
      console.log(`Campaign "${c.title}": all ${rawProducts.length} products are valid.`);
    }
  }

  // Also check offerdeals
  const offers = await db.collection('offerdeals').find({}).toArray();
  for (const o of offers) {
    const rawProducts = o.products || [];
    const validProductIds = [];
    for (const p of rawProducts) {
      if (!p || !p.productId) continue;
      const exists = await db.collection('products').findOne({ _id: p.productId });
      if (exists) {
        validProductIds.push(p);
      } else {
        console.log(`Offer "${o.title}": Removing non-existent product ID ${p.productId}`);
      }
    }
    if (validProductIds.length !== rawProducts.length) {
      await db.collection('offerdeals').updateOne(
        { _id: o._id },
        { $set: { products: validProductIds } }
      );
      console.log(`Cleaned offer "${o.title}": reduced from ${rawProducts.length} to ${validProductIds.length} products.`);
    } else {
      console.log(`Offer "${o.title}": all ${rawProducts.length} products are valid.`);
    }
  }

  process.exit(0);
}

cleanup().catch(e => {
  console.error('Error during cleanup:', e);
  process.exit(1);
});

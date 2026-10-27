import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../src/config/db.js';
import mongoose from 'mongoose';

async function fix() {
  console.log('Connecting to MongoDB...');
  await connectDB();
  const db = mongoose.connection.db;

  const FROM = 'https://saathigro.in/api/uploads/';
  const TO = 'https://api.saathigro.in/uploads/';

  console.log(`Replacing ${FROM} -> ${TO}...`);

  // 1. Products
  const products = await db.collection('products').find({ $or: [{ image: { $regex: FROM } }, { gallery: { $elemMatch: { $regex: FROM } } }] }).toArray();
  for (const p of products) {
    const update = {};
    if (p.image && p.image.includes(FROM)) update.image = p.image.replace(FROM, TO);
    if (Array.isArray(p.gallery)) {
      update.gallery = p.gallery.map(g => typeof g === 'string' ? g.replace(FROM, TO) : g);
    }
    await db.collection('products').updateOne({ _id: p._id }, { $set: update });
  }
  console.log(`Updated products: ${products.length}`);

  // 2. Categories
  const categories = await db.collection('categories').find({ image: { $regex: FROM } }).toArray();
  for (const c of categories) {
    await db.collection('categories').updateOne({ _id: c._id }, { $set: { image: c.image.replace(FROM, TO) } });
  }
  console.log(`Updated categories: ${categories.length}`);

  // 3. Subcategories
  const subcategories = await db.collection('subcategories').find({ image: { $regex: FROM } }).toArray();
  for (const s of subcategories) {
    await db.collection('subcategories').updateOne({ _id: s._id }, { $set: { image: s.image.replace(FROM, TO) } });
  }
  console.log(`Updated subcategories: ${subcategories.length}`);

  // 4. Brands
  const brands = await db.collection('brands').find({ logo: { $regex: FROM } }).toArray();
  for (const b of brands) {
    await db.collection('brands').updateOne({ _id: b._id }, { $set: { logo: b.logo.replace(FROM, TO) } });
  }
  console.log(`Updated brands: ${brands.length}`);

  // 5. Offers
  const offers = await db.collection('offerdeals').find({ bannerImage: { $regex: FROM } }).toArray();
  for (const o of offers) {
    await db.collection('offerdeals').updateOne({ _id: o._id }, { $set: { bannerImage: o.bannerImage.replace(FROM, TO) } });
  }
  console.log(`Updated offer deals: ${offers.length}`);

  // 6. Global Settings
  const settingsList = await db.collection('globalsettings').find({ 'appPopup.imageUrl': { $regex: FROM } }).toArray();
  for (const s of settingsList) {
    await db.collection('globalsettings').updateOne({ _id: s._id }, { $set: { 'appPopup.imageUrl': s.appPopup.imageUrl.replace(FROM, TO) } });
  }
  console.log(`Updated global settings: ${settingsList.length}`);

  // 7. Delivery Partners
  const dpList = await db.collection('deliverypartners').find({}).toArray();
  for (const dp of dpList) {
    const update = {};
    if (dp.profileImage?.includes(FROM)) update.profileImage = dp.profileImage.replace(FROM, TO);
    if (dp.aadharImage?.includes(FROM)) update.aadharImage = dp.aadharImage.replace(FROM, TO);
    if (dp.licenseImage?.includes(FROM)) update.licenseImage = dp.licenseImage.replace(FROM, TO);
    if (Object.keys(update).length > 0) {
      await db.collection('deliverypartners').updateOne({ _id: dp._id }, { $set: update });
    }
  }
  console.log(`Updated delivery partners: ${dpList.length}`);

  // 8. Orders
  const orders = await db.collection('orders').find({ 'items.image': { $regex: FROM } }).toArray();
  for (const ord of orders) {
    const newItems = (ord.items || []).map(item => {
      if (item.image?.includes(FROM)) {
        return { ...item, image: item.image.replace(FROM, TO) };
      }
      return item;
    });
    await db.collection('orders').updateOne({ _id: ord._id }, { $set: { items: newItems } });
  }
  console.log(`Updated orders: ${orders.length}`);

  console.log('\nSUCCESS! All MongoDB image URLs now point to https://api.saathigro.in/uploads/');
  process.exit(0);
}

fix().catch(err => {
  console.error(err);
  process.exit(1);
});

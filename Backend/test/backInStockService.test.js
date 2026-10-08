import assert from 'node:assert/strict';
import test from 'node:test';
import Product from '../src/models/Product.js';
import Branch from '../src/models/Branch.js';
import Notification from '../src/models/Notification.js';
import BackInStockSubscription from '../src/models/BackInStockSubscription.js';
import { stockForSubscription, sendBackInStockNotifications } from '../src/services/backInStockService.js';

test('stock alerts follow the selected store and variant', () => {
  const product = {
    status: 'Out of Stock',
    vendor: null,
    branchStocks: [{ branchId: 'branch-a', stock: 0 }, { branchId: 'branch-b', stock: 8 }],
    variants: [{ value: '500g', stock: 0 }, { value: '1kg', stock: 3 }]
  };
  assert.equal(stockForSubscription(product, { storeId: 'branch-a', storeType: 'branch' }), 0);
  assert.equal(stockForSubscription(product, { storeId: 'branch-b', storeType: 'branch' }), 8);
  assert.equal(stockForSubscription(product, { storeId: 'branch-b', storeType: 'branch', variantValue: '500g' }), 0);
  assert.equal(stockForSubscription(product, { storeId: 'branch-b', storeType: 'branch', variantValue: '1kg' }), 3);
  product.branchStocks[0].stock = 5;
  assert.equal(stockForSubscription(product, { storeId: 'branch-a', storeType: 'branch' }), 5);
  assert.equal(stockForSubscription({ status: 'Draft', stock: 10, vendor: 'vendor-a' }, { storeId: 'vendor-a', storeType: 'vendor' }), 0);
  assert.equal(stockForSubscription({ status: 'Active', stock: 10, vendor: 'vendor-a' }, { storeId: 'vendor-b', storeType: 'vendor' }), 0);
  assert.equal(stockForSubscription({ status: 'Active', stock: 4, vendor: 'vendor-a' }, { storeId: 'branch-a', storeType: 'branch' }), 4);
});

test('restock scan persists an alert and consumes the subscription', async (t) => {
  const original = {
    find: BackInStockSubscription.find,
    findOneAndUpdate: BackInStockSubscription.findOneAndUpdate,
    deleteOne: BackInStockSubscription.deleteOne,
    updateOne: BackInStockSubscription.updateOne,
    productFindById: Product.findById,
    branchExists: Branch.exists,
    notificationUpdateOne: Notification.updateOne
  };
  t.after(() => {
    BackInStockSubscription.find = original.find;
    BackInStockSubscription.findOneAndUpdate = original.findOneAndUpdate;
    BackInStockSubscription.deleteOne = original.deleteOne;
    BackInStockSubscription.updateOne = original.updateOne;
    Product.findById = original.productFindById;
    Branch.exists = original.branchExists;
    Notification.updateOne = original.notificationUpdateOne;
  });

  const subscription = { _id: 'sub-1', user: 'user-1', product: 'product-1', storeId: 'branch-a', storeType: 'branch', status: 'pending', variantValue: '' };
  const chain = { sort: () => chain, lean: () => chain, cursor: async function* () { yield subscription; } };
  BackInStockSubscription.find = () => chain;
  Product.findById = () => ({ lean: async () => ({ _id: 'product-1', name: 'Ghee', status: 'Active', branchStocks: [{ branchId: 'branch-a', stock: 2 }] }) });
  Branch.exists = async () => true;
  BackInStockSubscription.findOneAndUpdate = async () => subscription;
  let saved;
  Notification.updateOne = async (filter, update) => { saved = { filter, update }; };
  let deleted = false;
  BackInStockSubscription.deleteOne = async () => { deleted = true; };
  BackInStockSubscription.updateOne = async () => { throw new Error('Unexpected retry'); };

  await sendBackInStockNotifications();
  assert.equal(saved.filter.sourceKey, 'back-in-stock:sub-1');
  assert.equal(saved.update.$setOnInsert.data.productId, 'product-1');
  assert.equal(deleted, true);
});

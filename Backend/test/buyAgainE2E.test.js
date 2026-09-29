import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { getBuyAgainProducts } from '../src/controllers/orderController.js';
import Order from '../src/models/Order.js';
import Product from '../src/models/Product.js';

const originalOrderAggregate = Order.aggregate;
const originalProductFind = Product.find;

test.afterEach(() => {
  Order.aggregate = originalOrderAggregate;
  Product.find = originalProductFind;
});

test('Buy Again E2E: Returns empty list if user has no past completed orders', async () => {
  Order.aggregate = () => Promise.resolve([]);

  let responseData = null;
  const mockReq = {
    user: { _id: new mongoose.Types.ObjectId() },
    query: {}
  };
  const mockRes = {
    json(data) {
      responseData = data;
      return this;
    },
    status() {
      return this;
    }
  };

  await getBuyAgainProducts(mockReq, mockRes);

  assert.ok(responseData, 'Response must not be null');
  assert.equal(responseData.total, 0);
  assert.deepEqual(responseData.products, []);
});

test('Buy Again E2E: Aggregates unique products ranked by purchase count and recency', async () => {
  const prodId1 = new mongoose.Types.ObjectId();
  const prodId2 = new mongoose.Types.ObjectId();

  Order.aggregate = () => Promise.resolve([
    {
      _id: prodId1,
      purchaseCount: 5,
      totalQuantity: 10,
      lastOrderedAt: new Date('2026-09-25')
    },
    {
      _id: prodId2,
      purchaseCount: 2,
      totalQuantity: 3,
      lastOrderedAt: new Date('2026-09-20')
    }
  ]);

  Product.find = () => ({
    select: () => ({
      populate: () => ({
        populate: () => ({
          lean: () => Promise.resolve([
            {
              _id: prodId1,
              name: 'Amul Taaza Fresh Milk 500ml',
              basePrice: 28,
              mrp: 30,
              stock: 50,
              category: 'Dairy',
              branchStocks: []
            },
            {
              _id: prodId2,
              name: 'Fortune Sunlite Sunflower Oil 1L',
              basePrice: 145,
              mrp: 170,
              stock: 20,
              category: 'Oils',
              branchStocks: []
            }
          ])
        })
      })
    })
  });

  let responseData = null;
  const mockReq = {
    user: { _id: new mongoose.Types.ObjectId() },
    query: { limit: '10' }
  };
  const mockRes = {
    json(data) {
      responseData = data;
      return this;
    },
    status() {
      return this;
    }
  };

  await getBuyAgainProducts(mockReq, mockRes);

  assert.ok(responseData, 'Response must not be null');
  assert.equal(responseData.total, 2);
  assert.equal(responseData.products.length, 2);
  assert.equal(responseData.products[0].name, 'Amul Taaza Fresh Milk 500ml');
  assert.equal(responseData.products[0].purchaseCount, 5);
  assert.equal(responseData.products[1].name, 'Fortune Sunlite Sunflower Oil 1L');
  assert.equal(responseData.products[1].purchaseCount, 2);
});

test('Buy Again E2E: Injects store stock and isDeliverable flags when active store context is passed', async () => {
  const prodId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();

  Order.aggregate = () => Promise.resolve([
    {
      _id: prodId,
      purchaseCount: 3,
      totalQuantity: 6,
      lastOrderedAt: new Date('2026-09-27')
    }
  ]);

  Product.find = () => ({
    select: () => ({
      populate: () => ({
        populate: () => ({
          lean: () => Promise.resolve([
            {
              _id: prodId,
              name: 'Organic Whole Wheat Atta 5kg',
              basePrice: 240,
              mrp: 290,
              stock: 0,
              category: 'Staples',
              branchStocks: [
                {
                  branchId: branchId,
                  stock: 15,
                  lowStockThreshold: 5
                }
              ]
            }
          ])
        })
      })
    })
  });

  let responseData = null;
  const mockReq = {
    user: { _id: new mongoose.Types.ObjectId() },
    query: {
      storeId: branchId.toString(),
      storeType: 'branch'
    }
  };
  const mockRes = {
    json(data) {
      responseData = data;
      return this;
    },
    status() {
      return this;
    }
  };

  await getBuyAgainProducts(mockReq, mockRes);

  assert.ok(responseData, 'Response must not be null');
  assert.equal(responseData.total, 1);
  const prod = responseData.products[0];
  assert.equal(prod.name, 'Organic Whole Wheat Atta 5kg');
  assert.equal(prod.inStore, true);
  assert.equal(prod.isDeliverable, true);
  assert.equal(prod.availableStock, 15);
});

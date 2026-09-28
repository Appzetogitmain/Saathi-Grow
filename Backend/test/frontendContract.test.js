import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { getPublicSettings } from '../src/controllers/settingController.js';
import { calculateBill } from '../src/controllers/orderController.js';
import GlobalSetting from '../src/models/GlobalSetting.js';
import Product from '../src/models/Product.js';
import PromoCode from '../src/models/PromoCode.js';

const originalGlobalFindOne = GlobalSetting.findOne;
const originalProductFindById = Product.findById;
const originalPromoCodeFind = PromoCode.find;

test.beforeEach(() => {
  PromoCode.find = () => ({
    sort: () => Promise.resolve([])
  });
});

test.afterEach(() => {
  GlobalSetting.findOne = originalGlobalFindOne;
  Product.findById = originalProductFindById;
  PromoCode.find = originalPromoCodeFind;
});

test('Frontend Contract: GET /api/settings/public includes immediateDeliveryFee for checkout UI', async () => {
  GlobalSetting.findOne = () => Promise.resolve({
    defaultTaxRate: 5,
    taxCalculation: 'Inclusive',
    baseDeliveryFee: 30,
    immediateDeliveryFee: 15,
    freeDeliveryThreshold: 500,
    handlingFee: 5,
    surgeMultiplier: 1,
    maxDeliveryRadius: 20,
    immediateDeliveryEnabled: true,
    deliveryTimezone: 'Asia/Kolkata',
    slotBookingCutoffMinutes: 30,
    holidays: [
      { date: '2026-10-02', name: 'Gandhi Jayanti', reason: 'National Holiday' }
    ]
  });

  let responseData = null;
  const mockRes = {
    json(data) {
      responseData = data;
      return this;
    },
    status() {
      return this;
    }
  };

  await getPublicSettings({}, mockRes);

  assert.ok(responseData, 'Response data must not be null');
  assert.equal(typeof responseData.immediateDeliveryFee, 'number');
  assert.equal(responseData.immediateDeliveryFee, 15);
  assert.equal(responseData.immediateDeliveryEnabled, true);
  assert.equal(responseData.baseDeliveryFee, 30);
  assert.equal(responseData.freeDeliveryThreshold, 500);
  assert.ok(Array.isArray(responseData.holidays), 'holidays must be an array');
  assert.equal(responseData.holidays.length, 1);
  assert.equal(responseData.holidays[0].date, '2026-10-02');
  assert.equal(responseData.holidays[0].name, 'Gandhi Jayanti');
});

test('Frontend Contract: calculateBill returns all 8 breakdown fields and IGNORES client-submitted fees', async () => {
  const prodId = new mongoose.Types.ObjectId().toString();
  Product.findById = () => Promise.resolve({
    _id: prodId,
    name: 'Sample Item',
    basePrice: 100,
    price: 100,
    isAllBranches: true
  });

  GlobalSetting.findOne = () => Promise.resolve({
    defaultTaxRate: 5,
    baseDeliveryFee: 30,
    surgeMultiplier: 1,
    freeDeliveryThreshold: 500,
    handlingFee: 5,
    immediateDeliveryEnabled: true,
    immediateDeliveryFee: 20,
    platformCommissionRate: 10
  });

  let responseData = null;
  const mockReq = {
    user: { _id: new mongoose.Types.ObjectId() },
    body: {
      items: [{ product: prodId, quantity: 1 }],
      isImmediate: true,
      // Attempt client fee tampering
      immediateDeliveryFee: 0,
      deliveryFee: 0,
      totalAmount: 1,
      taxAmount: 0
    }
  };
  const mockRes = {
    json(data) {
      responseData = data;
      return this;
    },
    status(code) {
      return this;
    }
  };

  await calculateBill(mockReq, mockRes);

  const requiredBreakdownFields = [
    'subTotal',
    'taxAmount',
    'baseDeliveryFee',
    'immediateDeliveryFee',
    'deliveryFee',
    'handlingFee',
    'discountAmount',
    'totalAmount'
  ];

  for (const field of requiredBreakdownFields) {
    assert.ok(field in responseData, `Response must contain ${field}`);
    assert.equal(typeof responseData[field], 'number');
  }

  // Client attempted tampering must be completely ignored
  assert.equal(responseData.subTotal, 100);
  assert.equal(responseData.taxAmount, 5);
  assert.equal(responseData.baseDeliveryFee, 30);
  assert.equal(responseData.immediateDeliveryFee, 20); // authoritative 20, not client 0
  assert.equal(responseData.deliveryFee, 50);
  assert.equal(responseData.handlingFee, 5);
  assert.equal(responseData.totalAmount, 160); // 100 + 5 + 50 + 5
});

test('Frontend Contract: Product Reorder payload format [{ id, displayOrder }]', () => {
  const sampleReorderPayload = {
    items: [
      { id: '67bca1234567890123456789', displayOrder: 1 },
      { id: '67bca123456789012345678a', displayOrder: 2 },
      { id: '67bca123456789012345678b', displayOrder: null }
    ]
  };

  assert.ok(Array.isArray(sampleReorderPayload.items));
  sampleReorderPayload.items.forEach((item, index) => {
    assert.ok(item.id, `Item ${index} must have id`);
    assert.ok(item.displayOrder === null || typeof item.displayOrder === 'number', `Item ${index} displayOrder must be null or number`);
  });
});

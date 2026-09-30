import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Product from '../src/models/Product.js';

// Mirrors normalizeVariantsForSubmit logic from Frontend
export const normalizeVariants = (variants = [], fallbackPrice = 0) =>
  variants
    .filter((variant) => variant.value?.trim())
    .map((variant) => ({
      type: variant.type || 'Weight',
      value: variant.value.trim(),
      price: Number(variant.price) || Number(fallbackPrice) || 0,
      mrp: variant.mrp != null && variant.mrp !== '' && !isNaN(Number(variant.mrp)) ? Number(variant.mrp) : null,
      stock: Number(variant.stock) || 0,
    }));

// Mirrors activeMrp computation logic from ProductDetailsPage / ProductCard
export const computeActiveMrp = (product, selectedVariant) => {
  const isBaseVariant = !selectedVariant || 
    Number(selectedVariant.price) === Number(product?.price) || 
    (product?.weight && String(selectedVariant.value).trim().toLowerCase() === String(product.weight).trim().toLowerCase());

  return Number(
    (selectedVariant?.mrp && Number(selectedVariant.mrp) > 0)
      ? selectedVariant.mrp
      : (isBaseVariant ? (product?.mrp ?? product?.originalPrice ?? 0) : 0)
  );
};

describe('VARIANT MRP AND SAVINGS CALCULATION SUITE', () => {
  it('1. Product schema defines variants.mrp field', () => {
    const mrpPath = Product.schema.path('variants.mrp');
    assert.ok(mrpPath, 'Product schema must define variants.mrp');
    assert.equal(mrpPath.instance, 'Number');
  });

  it('2. Normalizing variants parses explicit mrp correctly', () => {
    const rawVariants = [
      { value: '1Kg', price: '115', mrp: '130', stock: '5' },
      { value: '500G', price: '60', mrp: '70', stock: '10' },
      { value: '250G', price: '32', mrp: '', stock: '2' },
      { value: '100G', price: '15', stock: '0' }
    ];

    const normalized = normalizeVariants(rawVariants, 100);
    assert.equal(normalized[0].mrp, 130);
    assert.equal(normalized[1].mrp, 70);
    assert.equal(normalized[2].mrp, null);
    assert.equal(normalized[3].mrp, null);
  });

  it('3. Base variant uses base product MRP when variant mrp is not set', () => {
    const product = { price: 115, mrp: 130, weight: '1 kg' };
    const baseVariant = { value: '1Kg', price: 115 };

    const activeMrp = computeActiveMrp(product, baseVariant);
    assert.equal(activeMrp, 130);

    const savings = activeMrp - baseVariant.price;
    assert.equal(savings, 15);
  });

  it('4. Non-base variant does NOT fall back to 1Kg MRP when variant mrp is missing', () => {
    const product = { price: 115, mrp: 130, weight: '1 kg' };
    const halfKgVariantWithoutMrp = { value: '500G', price: 60 };

    const activeMrp = computeActiveMrp(product, halfKgVariantWithoutMrp);
    // Must NOT be 130!
    assert.equal(activeMrp, 0);

    const hasDiscount = activeMrp > halfKgVariantWithoutMrp.price;
    assert.equal(hasDiscount, false);
  });

  it('5. Non-base variant uses its own explicit MRP and calculates correct savings', () => {
    const product = { price: 115, mrp: 130, weight: '1 kg' };
    const halfKgVariantWithMrp = { value: '500G', price: 60, mrp: 70 };

    const activeMrp = computeActiveMrp(product, halfKgVariantWithMrp);
    assert.equal(activeMrp, 70);

    const savings = activeMrp - halfKgVariantWithMrp.price;
    assert.equal(savings, 10); // Save ₹10 (not false ₹70!)

    const discountPercent = Math.round((savings / activeMrp) * 100);
    assert.equal(discountPercent, 14); // 14% OFF (not false 54% OFF!)
  });
});

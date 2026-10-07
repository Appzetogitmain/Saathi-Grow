import assert from 'node:assert/strict';
import test from 'node:test';
import { rankSearchProducts } from '../src/services/productSearchService.js';

const product = (name, brandName, stock = 10) => ({ name, brandName, stock, vendor: 'vendor-id', category: 'Dairy', subCategory: 'Ghee' });

test('ranks exact matches, variants, then other-brand alternatives without unrelated brand goods', () => {
  const products = [
    product('Amul Butter', 'Amul'),
    product('Mother Dairy Ghee', 'Mother Dairy'),
    product('Amul Ghee 500ml', 'Amul'),
    product('Amul Ghee', 'Amul', 0),
    product('Patanjali Cow Ghee', 'Patanjali')
  ];
  assert.deepEqual(rankSearchProducts(products, 'Amul Ghee').map(p => p.name), [
    'Amul Ghee', 'Amul Ghee 500ml', 'Mother Dairy Ghee', 'Patanjali Cow Ghee'
  ]);
});

test('supports a product-type prefix and keeps broader variants for modifier searches', () => {
  const products = [product('Amul Cow Ghee', 'Amul'), product('Mother Dairy Ghee', 'Mother Dairy')];
  assert.deepEqual(rankSearchProducts(products, 'Amul Cow Ghee').map(p => p.name), ['Amul Cow Ghee', 'Mother Dairy Ghee']);
  assert.deepEqual(rankSearchProducts(products, 'Amul Ghe').map(p => p.name), ['Amul Cow Ghee', 'Mother Dairy Ghee']);
});

test('tolerates one typo and prefers available alternatives within the same relevance group', () => {
  const products = [product('Brand A Ghee', 'Brand A', 0), product('Brand B Ghee', 'Brand B')];
  assert.deepEqual(rankSearchProducts(products, 'gheee').map(p => p.name), ['Brand B Ghee', 'Brand A Ghee']);
});

test('a brand-only query returns products even when imported brand metadata is missing or inconsistent', () => {
  const products = [
    product('Bikaji Moong Dal 200G', 'Bikano'),
    product('Bikaji Salted Peanuts 200G', 'Bikaji'),
    product('Bikaji Aloo Bhujia', ''),
    product('Bikano Matar Masala', 'Bikano')
  ];
  assert.deepEqual(rankSearchProducts(products, 'bikaji').map(p => p.name), [
    'Bikaji Aloo Bhujia', 'Bikaji Moong Dal 200G', 'Bikaji Salted Peanuts 200G'
  ]);
});

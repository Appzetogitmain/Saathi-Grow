import assert from 'node:assert/strict';
import test from 'node:test';
import Product from '../src/models/Product.js';
import Vendor from '../src/models/Vendor.js';
import Branch from '../src/models/Branch.js';
import { searchCustomerProducts } from '../src/controllers/productController.js';

const original = {
  vendorFind: Vendor.find,
  vendorFindById: Vendor.findById,
  branchFind: Branch.find,
  productFind: Product.find,
  productPopulate: Product.populate
};

test('search shows catalog matches when the selected vendor has none', async (t) => {
  t.after(() => {
    Vendor.find = original.vendorFind;
    Vendor.findById = original.vendorFindById;
    Branch.find = original.branchFind;
    Product.find = original.productFind;
    Product.populate = original.productPopulate;
  });

  const selectedVendorId = '6a76dbd3bd7fa006136b4e55';
  const branchId = '6a4a492241fda54c7e552b26';
  const products = [
    { _id: '1', name: 'Bikaji Moong Dal 200G', brandName: 'Bikano', status: 'Active', branchStocks: [{ branchId, stock: 5 }] },
    { _id: '2', name: 'Bikaji Aloo Bhujia', brandName: 'Bikaji', status: 'Active', branchStocks: [{ branchId, stock: 5 }] }
  ];
  Vendor.find = () => ({ distinct: async () => [] });
  Vendor.findById = () => ({ select: async () => ({ status: 'Active' }) });
  Branch.find = () => ({ distinct: async () => [branchId] });
  const queries = [];
  Product.find = (query) => {
    queries.push(query);
    const result = query.name ? [] : products;
    const chain = {
      sort: () => chain,
      limit: () => chain,
      select: () => chain,
      lean: async () => result
    };
    return chain;
  };
  Product.populate = async (items) => items;

  let response;
  const req = { query: { q: 'Bikaji', page: '2', limit: '1', storeId: selectedVendorId, storeType: 'vendor' } };
  const res = { json(value) { response = value; return this; }, status() { return this; } };
  await searchCustomerProducts(req, res);

  assert.equal(response.total, 2);
  assert.equal(response.products.length, 1);
  assert.equal(response.products[0].isDeliverable, false);
  assert.ok(queries.every(query => query.vendor?.$nin), 'selected vendor must not exclude other catalog products');
});

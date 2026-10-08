import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRelativeRoute } from '../src/services/notificationService.js';

test('product notification target overrides a stale home route', () => {
  assert.equal(resolveRelativeRoute('User', { productId: 'product-123', route: '/' }), '/product/product-123');
  assert.equal(resolveRelativeRoute('User', { entityType: 'product', entityId: 'product-456', route: '/' }), '/product/product-456');
});

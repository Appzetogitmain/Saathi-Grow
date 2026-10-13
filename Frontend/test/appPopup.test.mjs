import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import * as popupUtils from '../src/modules/user/utils/appPopupUtils.js';
import { buildAppSettingsUpdate, canAttachPopup } from '../src/modules/admin/utils/appPopupUtils.js';
import { readShopCache, hasShopCache, writeShopCache } from '../src/modules/user/utils/shopCache.js';
const require = createRequire(import.meta.url);

test('dismissal survives denied storage through the in-memory fallback', () => {
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const version = 'blocked-storage-test';
  assert.equal(popupUtils.isPopupDismissed(version), false);
  popupUtils.dismissPopup(version); assert.equal(popupUtils.isPopupDismissed(version), true);
  assert.deepEqual(readShopCache('shop_categories'), []);
  assert.equal(hasShopCache('shop_categories'), false);
  assert.doesNotThrow(() => writeShopCache('shop_categories', []));
  delete globalThis.localStorage;
});
test('checkout, auth, tracking, download and legal flows suppress announcements', () => {
  for (const route of ['/checkout', '/checkout/payment', '/login', '/register', '/orders/123/tracking', '/download-app', '/app', '/legal/privacy']) {
    assert.equal(popupUtils.isPopupSuppressedPath(route), true);
  }
  assert.equal(popupUtils.isPopupSuppressedPath('/'), false);
});
test('CTA resolution validates targets and handles all supported action types', () => {
  assert.deepEqual(popupUtils.resolvePopupDestination({ actionType: 'home' }), { to: '/', external: false });
  assert.deepEqual(popupUtils.resolvePopupDestination({ actionType: 'product', actionTarget: '507f1f77bcf86cd799439011' }), { to: '/product/507f1f77bcf86cd799439011', external: false });
  assert.equal(popupUtils.resolvePopupDestination({ actionType: 'product', actionTarget: 'undefined' }), null);
  assert.deepEqual(popupUtils.resolvePopupDestination({ actionType: 'category', actionTarget: 'fresh-fruits' }), { to: '/category/fresh-fruits', external: false });
  assert.deepEqual(popupUtils.resolvePopupDestination({ actionType: 'custom', actionTarget: 'lowest-prices' }), { to: '/lowest-prices', external: false });
  assert.equal(popupUtils.resolvePopupDestination({ actionType: 'custom', actionTarget: 'https://example.com/offer' }).external, true);
  for (const target of ['javascript:alert(1)', '//example.com', 'https://user:pass@example.com', 'bad link']) {
    assert.equal(popupUtils.resolvePopupDestination({ actionType: 'custom', actionTarget: target }), null);
  }
});
test('admin omits unchanged popup during unrelated settings save but retains a changed version guard', () => {
  const popup = { title: 'Offer', isEnabled: true, version: 'v1' };
  assert.equal(buildAppSettingsUpdate({ supportPhone: '123', appPopup: { ...popup } }, popup).appPopup, undefined);
  assert.equal(buildAppSettingsUpdate({ appPopup: { ...popup, title: 'New offer' } }, popup).appPopup.version, 'v1');
  assert.equal(canAttachPopup({ role: 'Staff', permissions: [] }, 'broadcast', 'users'), false);
  assert.equal(canAttachPopup({ role: 'Admin' }, 'broadcast', 'vendors'), false);
  assert.equal(canAttachPopup({ role: 'Admin' }, 'individual', 'users'), false);
  assert.equal(canAttachPopup({ role: 'Admin' }, 'broadcast', 'users'), true);
});

const source = fs.readFileSync(new URL('../src/modules/user/components/home/AppOpenPopup.jsx', import.meta.url), 'utf8');
const compiled = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
const fixture = ({ blocked = false, path = '/', refreshing = false, popup = {}, failedImage = '' } = {}) => {
  const data = { isEnabled: true, title: 'Festival offer', message: 'Save on groceries', version: 'component-test', actionType: 'home', ...popup };
  const states = [data.version, failedImage, null], effects = [], timers = [], changes = [], navigation = [];
  let hook = 0;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, console,
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    window: { location: { assign: value => navigation.push(value) } },
    require(name) {
      if (name === 'react') return { ...React, useRef: () => ({ current: null }), useCallback: fn => fn,
        useEffect: fn => effects.push(fn), useState() { const slot = hook++; return [states[slot], value => changes.push([slot, value])]; } };
      if (name === 'react-router-dom') return { useLocation: () => ({ pathname: path }), useNavigate: () => value => navigation.push(value) };
      if (name.endsWith('/ShopContext')) return { useShop: () => ({ settings: { appPopup: data }, settingsRefreshing: refreshing }) };
      if (name.endsWith('/usePromotionSlot')) return { __esModule: true, default: (id, wanted) => wanted };
      if (name.endsWith('/appPopupUtils')) return popupUtils;
      if (name.endsWith('/dialogFocus')) return { trapDialogFocus: () => () => {} };
      if (name === 'framer-motion') return { AnimatePresence: 'div', motion: { div: props => {
        const { initial, animate, exit, transition, ...domProps } = props; return React.createElement('div', domProps);
      } } };
      return require(name);
    }
  });
  const tree = module.exports.default({ blocked });
  return { tree, html: renderToStaticMarkup(tree), effects, timers, changes, navigation };
};
test('announcement waits while blocked by another flow, refresh or checkout route', () => {
  for (const input of [{ blocked: true }, { refreshing: true }, { path: '/checkout' }, { popup: { isEnabled: false } }]) {
    const view = fixture(input); view.effects[0]();
    assert.equal(view.timers.length, 0); assert.doesNotMatch(view.html, /role="dialog"/);
  }
});
test('text-only announcement has an accessible label, close control and CTA', () => {
  const view = fixture();
  assert.match(view.html, /id="app-open-popup-title"/); assert.match(view.html, /aria-labelledby="app-open-popup-title"/);
  assert.match(view.html, /Close offer popup/); assert.match(view.html, /Shop Now/);
});
test('new campaign retries its image instead of inheriting old image failure', () => {
  const url = 'https://example.com/banner.png';
  assert.doesNotMatch(fixture({ popup: { version: 'image-v1', imageUrl: url }, failedImage: `image-v1:${url}` }).html, /<img/);
  assert.match(fixture({ popup: { version: 'image-v2', imageUrl: url }, failedImage: `image-v1:${url}` }).html, /<img/);
});

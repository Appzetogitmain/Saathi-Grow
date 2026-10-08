import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/firebase-messaging-sw.js', import.meta.url), 'utf8');

const runClick = async (data, existingClient) => {
  const listeners = {};
  let openedUrl;
  const context = {
    self: {
      location: { origin: 'https://saathigro.in' },
      addEventListener: (name, callback) => { listeners[name] = callback; },
      registration: { showNotification: () => {} },
      skipWaiting: () => {}
    },
    clients: {
      matchAll: async () => existingClient ? [existingClient] : [],
      openWindow: async (url) => { openedUrl = url; },
      claim: async () => {}
    },
    firebase: { initializeApp: () => {}, messaging: () => ({ onBackgroundMessage: () => {} }) },
    importScripts: () => {},
    URL,
    console: { log: () => {}, warn: () => {} }
  };
  vm.runInNewContext(source, context);
  let completed;
  listeners.notificationclick({
    stopImmediatePropagation: () => {},
    notification: { data, close: () => {} },
    waitUntil: (promise) => { completed = promise; }
  });
  await completed;
  return openedUrl;
};

test('product push navigates an existing tab despite a stale home route', async () => {
  let navigatedUrl;
  const client = {
    url: 'https://saathigro.in/',
    navigate: async (url) => { navigatedUrl = url; return client; },
    focus: async () => {},
    postMessage: () => {}
  };
  await runClick({ route: '/', productId: 'product-123' }, client);
  assert.equal(navigatedUrl, 'https://saathigro.in/product/product-123');
});

test('product push opens the detail page on a cold start', async () => {
  const openedUrl = await runClick({ FCM_MSG: { data: { entityType: 'product', entityId: 'product-456', route: '/' } } });
  assert.equal(openedUrl, 'https://saathigro.in/product/product-456');
});

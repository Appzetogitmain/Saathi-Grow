// Local browser acceptance check. All catalog/settings requests are mocked;
// the production React components, providers, focus handling and animations run.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import assert from 'node:assert/strict';

const workspace = process.cwd();
const artifacts = path.resolve('.popup-browser-check');
await fs.mkdir(artifacts, { recursive: true });
const entry = `
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { ShopProvider, useShop } from './src/modules/user/context/ShopContext.jsx';
import AppOpenPopup from './src/modules/user/components/home/AppOpenPopup.jsx';
import AppDownloadPrompt from './src/modules/user/components/app-download/AppDownloadPrompt.jsx';
const queue = new URLSearchParams(location.search).has('queue');
window.publicSettings = { appPopup: { isEnabled: true, title: 'Festival savings', message: 'Enjoy great savings on festive groceries. '.repeat(100), version: queue ? 'queue-campaign' : 'primary-campaign', actionType: 'home', imageUrl: '', buttonText: 'Shop Now' } };
window.fixtureErrors = [];
window.addEventListener('error', e => { if (e.message) window.fixtureErrors.push(e.message); });
function Fixture() {
  const [blocked, setBlocked] = useState(false);
  const [external, setExternal] = useState(false);
  const { refreshSettings } = useShop();
  const navigate = useNavigate();
  useEffect(() => {
    window.popupFixture = { setBlocked, setExternal, go: navigate, refresh: refreshSettings,
      publish: async popup => { window.publicSettings = { appPopup: popup }; await refreshSettings(); } };
  }, [refreshSettings, navigate]);
  return <><button id="outside" autoFocus>Underlying page</button>
    {external && <div role="dialog" aria-label="Existing dialog"><button>Existing dialog action</button></div>}
    <AppOpenPopup blocked={blocked}/>{queue && <AppDownloadPrompt blocked={blocked}/>}</>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><ShopProvider><Fixture/></ShopProvider></BrowserRouter>);
`;
const apiMock = `
export const fetchCategories = async () => { window.catalogCalls = (window.catalogCalls || 0) + 1; return []; };
export const fetchProducts = async () => [];
export const fetchActiveCampaigns = async () => [];
export const fetchActiveOfferDeals = async () => [];
export const fetchPublicSettings = async () => { window.settingsCalls = (window.settingsCalls || 0) + 1; return structuredClone(window.publicSettings); };
`;
const bundled = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: workspace }, write: false,
  bundle: true, format: 'iife', platform: 'browser', loader: { '.png': 'dataurl' },
  define: { 'import.meta.env.VITE_PLAY_STORE_URL': '""', 'import.meta.env.VITE_APP_STORE_URL': '""', 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'isolated-api', setup(builder) {
    builder.onResolve({ filter: /\/api\/shopApi$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    builder.onResolve({ filter: /(?:\/|^)StoreContext(?:\.jsx)?$/ }, () => ({ path: 'store', namespace: 'fixture' }));
    builder.onResolve({ filter: /(?:\/|^)CartContext(?:\.jsx)?$/ }, () => ({ path: 'cart', namespace: 'fixture' }));
    builder.onResolve({ filter: /\/utils\/deviceUtils$/ }, () => ({ path: 'device', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents:
      args.path === 'api' ? apiMock : args.path === 'store' ? 'export const useStore = () => ({ activeStore: null });'
        : args.path === 'cart' ? 'export const useCart = () => ({ clearCart() {} });'
        : 'export const isWebView = () => false; export const isInstalledApp = () => false;'
    }));
  } }]
});
const cssFile = (await fs.readdir('dist/assets')).find(name => /^index-.*\.css$/.test(name));
const css = await fs.readFile(path.join('dist/assets', cssFile));
const server = http.createServer((req, res) => {
  if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundled.outputFiles[0].contents); return; }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return; }
  if (req.url === '/good.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="green"/></svg>'); return; }
  if (req.url === '/bad.svg') { res.statusCode = 404; res.end('missing'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = path.join(artifacts, `chrome-${process.pid}`);
const browser = spawn(process.env.POPUP_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let port;
  for (let i = 0; i < 80; i++) {
    try { port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  if (!port) throw new Error('Chrome did not start; set POPUP_CHROME_PATH to an installed Chrome binary');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const request = ++id;
    pending.set(request, message => message.error ? reject(message.error) : resolve(message.result));
    socket.send(JSON.stringify({ id: request, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ' ' + result.exceptionDetails.exception?.description);
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 120; i++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const shown = `Boolean(document.querySelector('[data-promotion-dialog="announcement"]'))`;
  const close = `document.querySelector('[aria-label="Close offer popup"]').click()`;
  await call('Emulation.setFocusEmulationEnabled', { enabled: true });
  await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
  await call('Page.navigate', { url: origin });
  await waitFor('Boolean(window.popupFixture)'); await waitFor(shown);
  await waitFor(`document.activeElement?.getAttribute('aria-label') === 'Close offer popup'`);
  const layout = await evaluate(`(() => {
    const modal = document.querySelector('[data-promotion-dialog="announcement"]');
    const button = modal.querySelector('[aria-label="Close offer popup"]');
    const scroll = modal.querySelector('.overflow-y-auto');
    const top = button.getBoundingClientRect().top; scroll.scrollTop = scroll.scrollHeight;
    return { top, bottom: button.getBoundingClientRect().bottom, sameTop: Math.abs(top-button.getBoundingClientRect().top)<1,
      scrolls: scroll.scrollHeight>scroll.clientHeight, labeled: Boolean(document.getElementById(modal.getAttribute('aria-labelledby'))), width: document.documentElement.scrollWidth };
  })()`);
  assert.equal(layout.width, 320); assert.ok(layout.top >= 0 && layout.bottom <= 568 && layout.sameTop && layout.scrolls && layout.labeled);
  console.log('PASS: 320x568 long announcement scrolls; close button stays reachable; dialog is labeled.');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', modifiers: 8 });
  assert.match(await evaluate('document.activeElement.textContent'), /Continue browsing/);
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 0 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', modifiers: 0 });
  await waitFor(`document.activeElement?.getAttribute('aria-label') === 'Close offer popup'`);
  await evaluate(close); await waitFor(`!${shown}`);
  assert.equal(await evaluate('document.activeElement.id'), 'outside');
  await evaluate('window.popupFixture.refresh()');
  await new Promise(resolve => setTimeout(resolve, 1100)); assert.equal(await evaluate(shown), false);
  console.log('PASS: keyboard focus wraps/restores and dismissed campaigns stay dismissed after refresh.');
  const publish = async (version, extra = {}) => evaluate(`window.popupFixture.publish({...window.publicSettings.appPopup, isEnabled:true, version:${JSON.stringify(version)}, ...${JSON.stringify(extra)}})`);
  await publish('browser-blocking'); await waitFor(shown);
  await evaluate('window.popupFixture.setBlocked(true)'); await waitFor(`!${shown}`);
  await evaluate('window.popupFixture.setBlocked(false)'); await waitFor(shown);
  await evaluate('window.popupFixture.setExternal(true)'); await waitFor(`!${shown}`);
  await evaluate('window.popupFixture.setExternal(false)'); await waitFor(shown);
  console.log('PASS: existing flows and external dialogs pause announcements without dismissing campaigns.');
  await evaluate('window.popupFixture.go("/checkout")'); await waitFor(`!${shown}`);
  await evaluate('window.popupFixture.go("/")'); await waitFor(shown);
  console.log('PASS: checkout hides announcements; returning to shopping resumes pending campaigns.');
  await publish('browser-bad-image', { imageUrl: origin + '/bad.svg' }); await waitFor(shown);
  await waitFor(`!document.querySelector('[data-promotion-dialog="announcement"] img')`);
  await publish('browser-good-image', { imageUrl: origin + '/good.svg' }); await waitFor(shown);
  await waitFor(`document.querySelector('[data-promotion-dialog="announcement"] img')?.naturalWidth > 0`);
  console.log('PASS: a new image/campaign retries after the previous image failed.');
  const catalogCalls = await evaluate('window.catalogCalls');
  await evaluate('window.publicSettings.appPopup.isEnabled=false; window.dispatchEvent(new Event("focus"))');
  await waitFor(`!${shown}`); assert.equal(await evaluate('window.catalogCalls'), catalogCalls);
  await evaluate('window.publicSettings.appPopup={...window.publicSettings.appPopup,isEnabled:true,version:"browser-foreground"}; window.dispatchEvent(new Event("focus"))');
  await waitFor(shown);
  console.log('PASS: foreground refresh applies disable/new campaigns without refreshing catalog or clearing carts.');
  await evaluate(`window.originalGet=Storage.prototype.getItem; window.originalSet=Storage.prototype.setItem;
    Storage.prototype.getItem=()=>{throw new Error('storage denied')}; Storage.prototype.setItem=()=>{throw new Error('storage denied')};`);
  await evaluate(close); await waitFor(`!${shown}`);
  await evaluate('window.popupFixture.refresh()');
  await new Promise(resolve => setTimeout(resolve, 1100)); assert.equal(await evaluate(shown), false);
  await evaluate('Storage.prototype.getItem=window.originalGet; Storage.prototype.setItem=window.originalSet');
  assert.deepEqual(await evaluate('window.fixtureErrors'), []);
  console.log('PASS: denied storage cannot crash dismissal or reopen the dismissed announcement.');
  for (const [width, height] of [[320,568],[360,640],[390,844],[768,900],[1280,900]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await publish(`browser-responsive-${width}`); await waitFor(shown);
    const fit = await evaluate(`(() => {
      const close = document.querySelector('[aria-label="Close offer popup"]').getBoundingClientRect();
      return document.documentElement.scrollWidth <= innerWidth && close.top >= 0 && close.bottom <= innerHeight;
    })()`);
    assert.equal(fit, true, `Popup must fit at ${width}x${height}`);
  }
  console.log('PASS: long popup fits 320, 360, 390, 768 and 1280px viewports.');
  await call('Page.navigate', { url: origin + '/?queue=1' });
  await waitFor('Boolean(window.popupFixture)'); await waitFor(shown);
  await new Promise(resolve => setTimeout(resolve, 2700));
  assert.equal(await evaluate('document.querySelectorAll("[data-promotion-dialog]").length'), 1);
  assert.equal(await evaluate('Boolean(document.querySelector("[data-promotion-dialog=download]"))'), false);
  await evaluate(close); await waitFor('Boolean(document.querySelector("[data-promotion-dialog=download]"))');
  assert.equal(await evaluate('document.querySelectorAll("[data-promotion-dialog]").length'), 1);
  assert.deepEqual(await evaluate('window.fixtureErrors'), []);
  console.log('PASS: download prompt queues behind announcement; the two promotions never stack.');
} finally {
  socket?.close(); browser.kill();
  await new Promise(resolve => server.close(resolve));
}

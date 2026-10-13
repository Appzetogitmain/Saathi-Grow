import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import Product from '../src/models/Product.js';
import Category from '../src/models/Category.js';
import GlobalSetting from '../src/models/GlobalSetting.js';
import { updateSettings } from '../src/controllers/settingController.js';
import { preparePopupUpdate, assertAppPopupPublisher } from '../src/services/appPopupService.js';
import { authorizeAppPopup } from '../src/middleware/appPopupMiddleware.js';

const popup = { isEnabled: true, title: 'Festival offer', message: 'Save on groceries', imageUrl: '', actionType: 'home', actionTarget: '', buttonText: 'Shop Now', version: 'original' };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; } });
const patched = [];
const patch = (object, name, value) => { patched.push([object, name, object[name]]); object[name] = value; };
test.beforeEach(() => { patch(Product, 'exists', async () => ({ _id: 'product' })); patch(Category, 'exists', async () => ({ _id: 'category' })); });
test.afterEach(() => { for (const [object, name, value] of patched.splice(0).reverse()) object[name] = value; });

test('unchanged popup including surrounding whitespace keeps its campaign version', async () => {
  assert.equal(await preparePopupUpdate({ ...popup, title: ' Festival offer ' }, popup), null);
});
test('changed popup and explicit republish receive unique versions', async () => {
  const first = await preparePopupUpdate({ ...popup, title: 'New offer' }, popup);
  const second = await preparePopupUpdate(popup, popup, { republish: true });
  assert.notEqual(first.version, popup.version); assert.notEqual(first.version, second.version);
});
test('stale campaign edit is rejected instead of replacing a newer publication', async () => {
  await assert.rejects(preparePopupUpdate({ ...popup, title: 'Stale edit', version: 'old' }, popup), error => error.status === 409);
});
test('drafts allow incomplete destinations; enabled product popup requires a published product', async () => {
  const draft = await preparePopupUpdate({ ...popup, isEnabled: false, actionType: 'product' }, popup);
  assert.equal(draft.isEnabled, false);
  await assert.rejects(preparePopupUpdate({ ...popup, actionType: 'product', actionTarget: '' }, popup), /published product/);
  await assert.rejects(preparePopupUpdate({ ...popup, actionType: 'product', actionTarget: 'invalid' }, popup), /published product/);
  patch(Product, 'exists', async () => null);
  await assert.rejects(preparePopupUpdate({ ...popup, actionType: 'product', actionTarget: '507f1f77bcf86cd799439011' }, popup), /published product/);
});
test('active category is checked by slug and unavailable categories are rejected', async () => {
  assert.equal((await preparePopupUpdate({ ...popup, actionType: 'category', actionTarget: 'fresh-fruits' }, popup)).actionTarget, 'fresh-fruits');
  patch(Category, 'exists', async () => null);
  await assert.rejects(preparePopupUpdate({ ...popup, actionType: 'category', actionTarget: 'fresh-fruits' }, popup), /active category/);
});
test('unsafe custom destinations and invalid image URLs are rejected', async () => {
  for (const target of ['', 'javascript:alert(1)', '//example.com', 'https://user:pass@example.com', 'bad link', 'data:text/html,test']) {
    await assert.rejects(preparePopupUpdate({ ...popup, actionType: 'custom', actionTarget: target }, popup));
  }
  await assert.rejects(preparePopupUpdate({ ...popup, imageUrl: 'http://example.com/image.png' }, popup));
  assert.equal((await preparePopupUpdate({ ...popup, actionType: 'custom', actionTarget: 'lowest-prices' }, popup)).actionTarget, '/lowest-prices');
  assert.equal((await preparePopupUpdate({ ...popup, actionType: 'custom', actionTarget: 'https://example.com/offer' }, popup)).actionTarget, 'https://example.com/offer');
});
test('types, oversized copy, and blank enabled announcement are validated', async () => {
  for (const value of [null, [], { isEnabled: 'true' }, { title: 'a'.repeat(161) }, { message: 'a'.repeat(6001) }, { actionType: {} }, { title: '', message: '' }]) {
    await assert.rejects(preparePopupUpdate(value, popup));
  }
});
test('legacy popup with an invalid image can still be disabled without editing its content', async () => {
  const disabled = await preparePopupUpdate({ isEnabled: false, version: 'original' }, { ...popup, imageUrl: 'http://example.com/old.png' });
  assert.equal(disabled.isEnabled, false);
});
test('only settings-authorized customer broadcasts may publish a global popup', () => {
  const body = { setAsAppPopup: 'true', targetType: 'broadcast', group: 'users' };
  assert.throws(() => assertAppPopupPublisher(body, { role: 'Staff', permissions: [] }), error => error.status === 403);
  assert.doesNotThrow(() => assertAppPopupPublisher(body, { role: 'Staff', permissions: ['MANAGE_SETTINGS'] }));
  for (const group of ['staff', 'vendors', 'delivery_partners', 'branch_managers', undefined]) {
    assert.throws(() => assertAppPopupPublisher({ ...body, group }, { role: 'Admin' }));
  }
  assert.throws(() => assertAppPopupPublisher({ ...body, targetType: 'individual' }, { role: 'Admin' }));
  assert.doesNotThrow(() => assertAppPopupPublisher({ setAsAppPopup: 'false' }, { role: 'Staff' }));
  const res = response();
  authorizeAppPopup({ body, admin: { role: 'Staff' } }, res, () => assert.fail('Unauthorized publisher passed'));
  assert.equal(res.statusCode, 403);
});
test('unrelated settings update with unchanged popup retains campaign version and fees', async () => {
  const settings = GlobalSetting.hydrate({ _id: '507f1f77bcf86cd799439011', appPopup: popup, baseDeliveryFee: 25 });
  settings.save = async () => settings;
  patch(GlobalSetting, 'findOne', async () => settings);
  const res = response();
  await updateSettings({ body: { supportPhone: '+91 9876543210', appPopup: { ...popup } } }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.data.appPopup.version, 'original');
  assert.equal(res.data.baseDeliveryFee, 25);
});
test('concurrent popup edit is guarded by the persisted version', async () => {
  const settings = GlobalSetting.hydrate({ _id: '507f1f77bcf86cd799439011', appPopup: popup });
  patch(GlobalSetting, 'findOne', async () => settings);
  patch(GlobalSetting, 'findOneAndUpdate', async filter => {
    assert.equal(filter['appPopup.version'], 'original'); return null;
  });
  const res = response();
  await updateSettings({ body: { appPopup: { ...popup, title: 'New title' } } }, res);
  assert.equal(res.statusCode, 409);
});
test('legacy settings without a stored popup version can publish their first campaign', async () => {
  const settings = GlobalSetting.hydrate({ _id: '507f1f77bcf86cd799439011', supportPhone: '123' });
  patch(GlobalSetting, 'findOne', async () => settings);
  patch(GlobalSetting, 'findOneAndUpdate', async filter => {
    assert.deepEqual(filter.$or, [{ 'appPopup.version': '1' }, { 'appPopup.version': { $exists: false } }]);
    return settings;
  });
  const res = response();
  await updateSettings({ body: { appPopup: { ...popup, version: '1' } } }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.data.appPopup.isEnabled, true);
});

// Execute the production controller with explicitly inert push/upload functions.
// No real dispatch service is imported or called by these publication tests.
const controllerSource = fs.readFileSync(new URL('../src/controllers/notificationController.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/export const /g, 'const ');
const publicationHarness = ({ failSave = false, failRecord = false } = {}) => {
  let store = { popup: { ...popup }, records: [] }, sent = 0, sessions = 0;
  const settingModel = { findOne: () => ({ session: session => Promise.resolve({
    appPopup: { ...session.state.popup }, async save(options) {
      assert.equal(options.session, session);
      if (failSave) throw new Error('Popup save failed');
      session.state.popup = this.appPopup;
    }
  }) }) };
  const transactionModel = { create: async (value, options) => {
    if (options) {
      if (failRecord) throw new Error('Notification save failed');
      options.session.state.records.push(value[0]); return value;
    }
    store.records.push(value); return value;
  } };
  const mongooseMock = { startSession: async () => ({ state: null,
    async withTransaction(callback) { this.state = structuredClone(store); await callback(); store = this.state; },
    async endSession() { sessions++; }
  }) };
  const noPush = async () => { sent++; assert.ok(store.records.length, 'Dispatch must follow commit'); return false; };
  const send = new Function('User', 'Admin', 'Vendor', 'DeliveryPartner', 'Notification', 'GlobalSetting', 'mongoose',
    'sendPushNotification', 'notifyAllUsers', 'notifyAdmins', 'notifyUsers', 'uploadBufferToCloudinary',
    'assertAppPopupPublisher', 'wantsAppPopup', 'preparePopupUpdate', controllerSource + '\nreturn adminSendNotification;')(
    {}, {}, {}, {}, transactionModel, settingModel, mongooseMock, noPush, noPush, noPush, noPush,
    async () => { throw new Error('Uploads forbidden in tests'); }, assertAppPopupPublisher,
    body => body.setAsAppPopup === true || body.setAsAppPopup === 'true', preparePopupUpdate);
  return { send, snapshot: () => ({ ...store, sent, sessions }) };
};
const publicationRequest = () => ({ admin: { role: 'Admin', _id: '507f1f77bcf86cd799439011' }, body: {
  title: 'Published offer', body: 'Festival announcement', targetType: 'broadcast', group: 'users', clickActionType: 'home', setAsAppPopup: true
} });
test('popup publication commits notification and campaign before inert dispatch', async () => {
  const harness = publicationHarness(), res = response();
  await harness.send(publicationRequest(), res);
  assert.equal(res.statusCode, 200); assert.equal(res.data.appPopupPublished, true);
  assert.equal(harness.snapshot().popup.title, 'Published offer'); assert.equal(harness.snapshot().records.length, 1);
  assert.equal(harness.snapshot().sent, 1); assert.equal(harness.snapshot().sessions, 1);
});
for (const failure of ['popup', 'record']) {
  test(`failed ${failure} write rolls back both changes and never sends a push`, async () => {
    const harness = publicationHarness({ failSave: failure === 'popup', failRecord: failure === 'record' }), res = response();
    await harness.send(publicationRequest(), res);
    assert.equal(res.statusCode, 500); assert.equal(res.data.success, false);
    assert.equal(harness.snapshot().popup.title, popup.title); assert.equal(harness.snapshot().records.length, 0);
    assert.equal(harness.snapshot().sent, 0); assert.equal(harness.snapshot().sessions, 1);
  });
}
test('ordinary staff notification retains its existing nontransactional dispatch path', async () => {
  const harness = publicationHarness(), res = response(), req = publicationRequest();
  req.admin = { role: 'Staff', permissions: [] }; req.body.setAsAppPopup = false;
  await harness.send(req, res);
  assert.equal(res.statusCode, 200); assert.equal(harness.snapshot().records.length, 1);
  assert.equal(harness.snapshot().sent, 1); assert.equal(harness.snapshot().sessions, 0);
  assert.equal(harness.snapshot().popup.version, popup.version);
});

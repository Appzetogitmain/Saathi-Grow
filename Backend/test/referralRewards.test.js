import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Referral from '../src/models/Referral.js';
import User from '../src/models/User.js';
import Order from '../src/models/Order.js';
import UserTransaction from '../src/models/UserTransaction.js';
import GlobalSetting from '../src/models/GlobalSetting.js';
import { applyReferralRewards } from '../src/services/referralRewardService.js';
import { recoverUserReferral, processOrderDeliveryReferral } from '../src/services/referralService.js';
import { buildReferralSettings } from '../src/utils/referralSettings.js';
import { validateUserOtpVerifyPayload } from '../src/middleware/requestValidation.js';
import { updateAdminReferralSettings } from '../src/controllers/adminReferralController.js';

// Snapshot/commit model with write-conflict retry. Runs the real service without a live DB.
const patches = [];
const patch = (object, name, value) => { patches.push([object, name, object[name]]); object[name] = value; };
let store, failLedger, failSave, failInsert, sessionsEnded, retried, orderQuery;
const defaults = { isEnabled: true, rewardTrigger: 'first_order_delivered', referrerRewardAmount: 50,
  refereeRewardAmount: 25, minOrderValue: 199, maxReferralsPerUser: 50 };
const clone = value => structuredClone(value);
const query = run => {
  let session;
  const value = { session(s) { session = s; return value; }, sort() { return value; }, select() { return value; },
    then(resolve, reject) { return Promise.resolve().then(() => run(session)).then(resolve, reject); } };
  return value;
};
const stateFor = session => session ? session.state : store;
const referralDoc = (record, session) => record ? { ...clone(record), async save(options) {
  assert.equal(options.session, session);
  if (failSave) throw new Error('Referral save failed');
  const data = { ...this }; delete data.save;
  stateFor(session).referrals[this._id] = data;
} } : null;
const findReferral = (filter, state) => Object.values(state.referrals).find(item =>
  Object.entries(filter).every(([key, value]) => item[key] === value));

test.beforeEach(() => {
  failLedger = false; failSave = false; failInsert = false; sessionsEnded = 0; retried = 0;
  store = { version: 0, users: {
    a: { _id: 'a', walletBalance: 0, isActive: true, referralCode: 'INVITE01' },
    b: { _id: 'b', walletBalance: 0, isActive: true, referredBy: 'a', signupReferralCode: 'INVITE01', referralRecoveryPending: true },
    c: { _id: 'c', walletBalance: 0, isActive: true, referredBy: 'a', signupReferralCode: 'INVITE01' }
  }, referrals: { r1: { _id: 'r1', referrer: 'a', referee: 'b', status: 'registered' } },
  ledger: [], settings: { referral: { ...defaults } },
  orders: [{ _id: 'o1', user: 'b', totalAmount: 250, status: 'delivered', paymentStatus: 'paid' }] };
  patch(mongoose, 'startSession', async () => ({
    state: null,
    async withTransaction(callback) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const version = store.version;
        this.state = clone(store);
        await callback();
        if (version !== store.version) { retried++; continue; }
        store = this.state; store.version = version + 1; return;
      }
      throw new Error('Retry limit');
    },
    async endSession() { sessionsEnded++; }
  }));
  patch(Referral, 'findOne', filter => query(session => referralDoc(findReferral(filter, stateFor(session)), session)));
  patch(Referral, 'countDocuments', filter => query(session => Object.values(stateFor(session).referrals)
    .filter(item => Object.entries(filter).every(([key, value]) => item[key] === value)).length));
  patch(Referral, 'findOneAndUpdate', async (filter, update) => {
    if (failInsert) throw new Error('Temporary insert failure');
    let record = findReferral(filter, store);
    if (!record) {
      record = { _id: `r${Object.keys(store.referrals).length + 1}`, ...update.$setOnInsert };
      store.referrals[record._id] = record;
    }
    return clone(record);
  });
  patch(User, 'findById', id => query(session => clone(stateFor(session).users[id] || null)));
  patch(User, 'findOneAndUpdate', async (filter, update, options) => {
    assert.ok(options.session, 'Referrer lock must participate in transaction');
    const user = options.session.state.users[filter._id];
    if (!user || user.isActive === false) return null;
    assert.equal(update.$inc.referralRewardRevision, 1);
    user.referralRewardRevision = (user.referralRewardRevision || 0) + 1;
    return clone(user);
  });
  patch(User, 'findByIdAndUpdate', async (id, update, options) => {
    assert.ok(options.session, 'Wallet write must participate in transaction');
    const user = options.session.state.users[id];
    if (!user) return null;
    user.walletBalance += update.$inc.walletBalance;
    return clone(user);
  });
  patch(User, 'updateOne', async (filter, update) => { Object.assign(store.users[filter._id], update.$set); });
  patch(UserTransaction, 'create', async (entries, options) => {
    assert.ok(options.session, 'Ledger write must participate in transaction');
    if (failLedger) throw new Error('Ledger write failed');
    for (const entry of entries) {
      assert.ok(entry.referralId && entry.referralRole);
      options.session.state.ledger.push(clone(entry));
    }
  });
  patch(GlobalSetting, 'findOne', async () => clone(store.settings));
  patch(Order, 'findOne', filter => {
    orderQuery = filter;
    return query(session => clone(stateFor(session).orders.find(order => order.user === filter.user) || null));
  });
});
test.afterEach(() => { for (const [object, name, value] of patches.splice(0).reverse()) object[name] = value; });

const pay = (id = 'r1', settings = defaults, order = { _id: 'o1' }) => applyReferralRewards({ referralId: id, settings, order });

test('referral payout commits both wallets, both ledger entries and reward record once', async () => {
  await pay(); await pay();
  assert.equal(store.users.a.walletBalance, 50); assert.equal(store.users.b.walletBalance, 25);
  assert.equal(store.ledger.length, 2); assert.equal(store.referrals.r1.status, 'rewarded');
  assert.equal(store.referrals.r1.orderId, 'o1'); assert.equal(sessionsEnded, 2);
});
test('concurrent duplicate deliveries retry and never double-credit', async () => {
  await Promise.all([pay(), pay()]);
  assert.ok(retried > 0); assert.equal(store.users.a.walletBalance, 50);
  assert.equal(store.users.b.walletBalance, 25); assert.equal(store.ledger.length, 2);
});
test('concurrent friends cannot exceed the shared referrer cap', async () => {
  store.referrals.r2 = { _id: 'r2', referrer: 'a', referee: 'c', status: 'registered' };
  await Promise.all([pay('r1', { ...defaults, maxReferralsPerUser: 1 }, null), pay('r2', { ...defaults, maxReferralsPerUser: 1 }, null)]);
  assert.equal(store.users.a.walletBalance, 50); assert.equal(store.ledger.length, 2);
  assert.equal(Object.values(store.referrals).filter(ref => ref.status === 'rewarded').length, 1);
  assert.equal(Object.values(store.referrals).filter(ref => ref.status === 'cancelled').length, 1);
});
for (const failure of ['ledger', 'referral save']) {
  test(`${failure} failure rolls back all money and records; retry pays once`, async () => {
    failLedger = failure === 'ledger'; failSave = failure === 'referral save';
    await assert.rejects(pay());
    assert.equal(store.users.a.walletBalance, 0); assert.equal(store.users.b.walletBalance, 0);
    assert.equal(store.ledger.length, 0); assert.equal(store.referrals.r1.status, 'registered');
    assert.equal(sessionsEnded, 1);
    failLedger = false; failSave = false;
    await pay(); assert.equal(store.users.a.walletBalance, 50); assert.equal(store.ledger.length, 2);
  });
}
test('first delivery below minimum cannot qualify through a later order', async () => {
  store.orders[0].totalAmount = 100;
  await pay();
  store.orders.push({ _id: 'o2', user: 'b', totalAmount: 300, status: 'delivered', paymentStatus: 'paid' });
  await applyReferralRewards({ referralId: 'r1', settings: defaults, order: store.orders[1] });
  assert.equal(store.referrals.r1.status, 'cancelled'); assert.equal(store.ledger.length, 0);
});
test('delivery retries use stored paid order, not caller-supplied amount', async () => {
  store.orders[0].totalAmount = 198;
  await applyReferralRewards({ referralId: 'r1', settings: defaults, order: { _id: 'o1', totalAmount: 999 } });
  assert.equal(store.ledger.length, 0);
});
test('returned first order remains ineligible during recovery', async () => {
  store.orders[0].status = 'returned'; store.orders[0].paymentStatus = 'refunded';
  await pay(); assert.equal(store.ledger.length, 0);
  assert.ok(orderQuery.$or[1].status.$in.includes('returned'));
});
test('missing recipient aborts payout without losing pending referral', async () => {
  delete store.users.b;
  await assert.rejects(pay(), /unavailable/); assert.equal(store.users.a.walletBalance, 0);
  assert.equal(store.referrals.r1.status, 'registered');
});
test('signup recovery recreates a missed referral from persisted attribution and retries safely', async () => {
  store.referrals = {}; failInsert = true;
  await assert.rejects(recoverUserReferral('b'));
  assert.equal(store.users.b.referralRecoveryPending, true);
  failInsert = false;
  await recoverUserReferral('b'); await recoverUserReferral('b');
  assert.equal(Object.keys(store.referrals).length, 1);
  assert.equal(store.users.b.referralRecoveryPending, false);
});
test('registration reward recovery pays immediately without an order and returns stable balances on retry', async () => {
  store.orders = []; store.settings.referral.rewardTrigger = 'registration';
  await recoverUserReferral('b'); await recoverUserReferral('b');
  assert.equal(store.users.a.walletBalance, 50); assert.equal(store.users.b.walletBalance, 25);
  assert.equal(store.referrals.r1.orderId, null); assert.equal(store.ledger.length, 2);
});
test('disabled program preserves pending history without paying', async () => {
  store.settings.referral.isEnabled = false;
  await processOrderDeliveryReferral(store.orders[0]);
  assert.equal(store.ledger.length, 0); assert.equal(store.referrals.r1.status, 'registered');
});
test('payout failure does not interrupt delivery and the pending reward can recover', async () => {
  failLedger = true;
  assert.equal(await processOrderDeliveryReferral(store.orders[0]), null);
  assert.equal(store.orders[0].status, 'delivered'); assert.equal(store.users.a.walletBalance, 0);
  assert.equal(store.referrals.r1.status, 'registered');
  failLedger = false;
  await processOrderDeliveryReferral(store.orders[0]);
  assert.equal(store.users.a.walletBalance, 50); assert.equal(store.ledger.length, 2);
});
test('an order exactly at the minimum is eligible', async () => {
  store.orders[0].totalAmount = 199;
  await pay(); assert.equal(store.referrals.r1.status, 'rewarded');
});
test('zero rewards and unlimited cap are valid', async () => {
  await pay('r1', { ...defaults, maxReferralsPerUser: 0, referrerRewardAmount: 0, refereeRewardAmount: 0 }, null);
  assert.equal(store.referrals.r1.status, 'rewarded'); assert.equal(store.ledger.length, 0);
});
test('defaults follow reward trigger and preserve store links and deliberately empty terms', () => {
  const signup = buildReferralSettings({ referral: { rewardTrigger: 'registration' }, playStoreUrl: 'https://play.google.com/store/apps/details?id=test' });
  assert.match(signup.description, /sign up/); assert.match(signup.terms[2], /no order/);
  assert.ok(signup.playStoreUrl);
  const saved = buildReferralSettings({ referral: { ...signup, rewardTrigger: 'first_order_delivered', minOrderValue: 300 } });
  assert.match(saved.terms[2], /₹300/); assert.match(saved.description, /delivery/);
  assert.deepEqual(buildReferralSettings({ referral: { terms: [] } }).terms, []);
});
test('referral ledger has a dedicated unique identifier without changing payment index', () => {
  const indexes = UserTransaction.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.referralId === 1 && keys.referralRole === 1 && options.unique));
  assert.ok(indexes.some(([keys, options]) => keys.razorpayPaymentId === 1 && options.unique));
});
test('OTP validation normalizes referral codes and rejects objects', () => {
  const req = { body: { phone: '9876543210', otp: '123456', referralCode: ' invite01 ' } };
  validateUserOtpVerifyPayload(req, {}, () => {});
  assert.equal(req.body.referralCode, 'INVITE01');
  req.body.referralCode = { $ne: null };
  let status;
  validateUserOtpVerifyPayload(req, { status(code) { status = code; return { json() {} }; } }, () => assert.fail('Invalid referral should not pass'));
  assert.equal(status, 400);
});
test('admin rejects invalid caps and booleans instead of changing program state', async () => {
  for (const body of [{ maxReferralsPerUser: 1.5 }, { isEnabled: 'false' }, { referrerRewardAmount: -1 }, { rewardTrigger: 'unknown' }]) {
    let status;
    await updateAdminReferralSettings({ body }, { status(code) { status = code; return this; }, json() {} });
    assert.equal(status, 400);
  }
});
test('partial admin update preserves reward amounts and unrelated settings', async () => {
  const document = { ...store.settings, baseDeliveryFee: 25, save: async () => {} };
  patch(GlobalSetting, 'findOne', async () => document);
  let data;
  await updateAdminReferralSettings({ body: { isEnabled: false } }, {
    status() { assert.fail('Update should succeed'); }, json(value) { data = value; }
  });
  assert.equal(data.settings.isEnabled, false);
  assert.equal(data.settings.referrerRewardAmount, 50); assert.equal(data.settings.refereeRewardAmount, 25);
  assert.equal(document.baseDeliveryFee, 25);
});

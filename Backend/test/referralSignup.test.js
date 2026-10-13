import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Otp from '../src/models/Otp.js';
import Referral from '../src/models/Referral.js';
import GlobalSetting from '../src/models/GlobalSetting.js';
import { verifyOTP } from '../src/controllers/authController.js';

const originals = [];
const patch = (object, name, value) => { originals.push([object, name, object[name]]); object[name] = value; };
const query = value => ({ select: () => Promise.resolve(value), then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
const referrerId = new mongoose.Types.ObjectId();
let users, referrals, enabled, invalidCode, failedInsert, deletedOtp, response;

test.beforeEach(() => {
  users = new Map(); referrals = new Map(); enabled = true; invalidCode = false; failedInsert = false; deletedOtp = 0;
  process.env.JWT_SECRET ||= 'isolated-referral-test-secret';
  patch(User.prototype, 'save', async function () { users.set(this.phone, this); return this; });
  patch(User, 'exists', async () => false);
  patch(User, 'findOne', filter => query(filter.phone ? users.get(filter.phone) || null : invalidCode ? null : { _id: referrerId }));
  patch(User, 'findById', id => query([...users.values()].find(user => String(user._id) === String(id)) || null));
  patch(User, 'updateOne', async (filter, update) => {
    const user = [...users.values()].find(user => String(user._id) === String(filter._id));
    if (user) Object.assign(user, update.$set);
  });
  patch(Otp, 'findOne', async () => ({ otp: '123456', expiresAt: new Date(Date.now() + 60_000) }));
  patch(Otp, 'deleteOne', async () => { deletedOtp++; });
  patch(GlobalSetting, 'findOne', async () => ({ referral: { isEnabled: enabled, rewardTrigger: 'first_order_delivered' } }));
  patch(Referral, 'findOneAndUpdate', async (filter, update) => {
    if (failedInsert) throw new Error('Temporary referral storage outage');
    const key = String(filter.referee);
    if (!referrals.has(key)) referrals.set(key, { _id: new mongoose.Types.ObjectId(), ...update.$setOnInsert });
    return referrals.get(key);
  });
});
test.afterEach(() => { for (const [object, name, value] of originals.splice(0).reverse()) object[name] = value; });
const verify = async (body = {}) => {
  let status = 200;
  const res = { status(code) { status = code; return this; }, json(data) { response = { status, ...data }; } };
  await verifyOTP({ body: { phone: '9876543210', otp: '123456', ...body } }, res);
  return response;
};

test('new OTP signup persists referral attribution and creates a single referral record', async () => {
  const res = await verify({ referralCode: ' invite01 ' });
  assert.equal(res.status, 200); assert.equal(res.isNewUser, true); assert.ok(res.token);
  const user = users.get('9876543210');
  assert.equal(String(user.referredBy), String(referrerId)); assert.equal(user.signupReferralCode, 'INVITE01');
  assert.equal(user.referralRecoveryPending, false); assert.equal(referrals.size, 1); assert.equal(deletedOtp, 1);
});
test('invalid referral code preserves OTP and does not create an unattributed account', async () => {
  invalidCode = true;
  const res = await verify({ referralCode: 'UNKNOWN' });
  assert.equal(res.status, 400); assert.equal(users.size, 0); assert.equal(deletedOtp, 0);
  assert.match(res.message, /Invalid referral code/);
});
test('disabled program permits ordinary signup without referral attribution or payout', async () => {
  enabled = false;
  const res = await verify({ referralCode: 'INVITE01' });
  assert.equal(res.status, 200); assert.equal(users.get('9876543210').referredBy, null);
  assert.equal(referrals.size, 0);
});
test('referral bookkeeping failure never breaks OTP signup; next login recovers attribution', async () => {
  failedInsert = true;
  let res = await verify({ referralCode: 'INVITE01' });
  assert.equal(res.status, 200); assert.ok(res.token);
  const user = users.get('9876543210');
  assert.equal(user.referralRecoveryPending, true); assert.equal(referrals.size, 0);
  failedInsert = false; user.otp = '123456'; user.otpExpires = new Date(Date.now() + 60_000);
  res = await verify();
  assert.equal(res.status, 200); assert.equal(res.isNewUser, false);
  assert.equal(user.referralRecoveryPending, false); assert.equal(referrals.size, 1);
});
test('existing login ignores new referral code and preserves the existing signup attribution', async () => {
  const user = new User({ phone: '9876543210', name: 'Existing Customer', isRegistrationComplete: true,
    otp: '123456', otpExpires: new Date(Date.now() + 60_000) });
  users.set(user.phone, user);
  const res = await verify({ referralCode: 'INVITE01' });
  assert.equal(res.status, 200); assert.equal(res.isNewUser, false);
  assert.equal(user.referredBy, null); assert.equal(referrals.size, 0);
});

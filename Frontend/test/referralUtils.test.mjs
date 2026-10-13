import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReferralSharePayload, captureReferralFromUrl, getStoredReferralCode,
  storeReferralCode, clearStoredReferralCode, getReferralProgramCopy } from '../src/modules/user/utils/referralUtils.js';

test.beforeEach(() => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  globalThis.window = { location: { origin: 'https://saathigro.in' } };
});
test.afterEach(() => { delete globalThis.localStorage; delete globalThis.window; });

test('invite link survives login redirect; manual code overrides it and can be removed', () => {
  captureReferralFromUrl('?ref=friend01'); assert.equal(getStoredReferralCode(), 'FRIEND01');
  captureReferralFromUrl(''); assert.equal(getStoredReferralCode(), 'FRIEND01');
  storeReferralCode(' other02 '); assert.equal(getStoredReferralCode(), 'OTHER02');
  storeReferralCode(''); assert.equal(getStoredReferralCode(), null);
  storeReferralCode('TEST'); clearStoredReferralCode(); assert.equal(getStoredReferralCode(), null);
});
test('share includes configured store links and encoded referral attribution', () => {
  const payload = buildReferralSharePayload('FRIEND01', { refereeRewardAmount: 25, minOrderValue: 199,
    playStoreUrl: 'https://play.google.com/store/apps/details?id=saathi', appStoreUrl: 'https://apps.apple.com/app/id123' });
  assert.equal(new URL(payload.playStoreLink).searchParams.get('referrer'), 'utm_source=saathigro_invite&utm_content=FRIEND01');
  assert.equal(new URL(payload.appStoreLink).searchParams.get('ct'), 'FRIEND01');
  assert.equal(payload.webLink, 'https://saathigro.in/register?ref=FRIEND01');
  assert.match(payload.shareText, /₹199 or more is delivered/);
});
test('signup reward copy promises signup cashback without an order', () => {
  const settings = { rewardTrigger: 'registration', refereeRewardAmount: 25, referrerRewardAmount: 50, maxReferralsPerUser: 2 };
  assert.match(buildReferralSharePayload('TEST', settings).shareText, /when you sign up/);
  assert.doesNotMatch(buildReferralSharePayload('TEST', settings).shareText, /first order/);
  assert.match(getReferralProgramCopy(settings).stepDescription, /No order is required/);
  assert.match(getReferralProgramCopy(settings).capDescription, /2 friends/);
});
test('disabled and zero-reward programs never advertise welcome cashback', () => {
  assert.doesNotMatch(buildReferralSharePayload('TEST', { isEnabled: false, refereeRewardAmount: 25 }).shareText, /welcome cashback/);
  assert.doesNotMatch(buildReferralSharePayload('TEST', { refereeRewardAmount: 0 }).shareText, /welcome cashback/);
});

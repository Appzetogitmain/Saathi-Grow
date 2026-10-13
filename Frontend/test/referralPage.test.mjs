import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import * as referralUtils from '../src/modules/user/utils/referralUtils.js';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../src/modules/user/pages/profile/ReferAndEarnPage.jsx', import.meta.url), 'utf8');
const compiled = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
const renderPage = (data, error = '') => {
  const states = [false, data, false, false, error, 0];
  let stateIndex = 0;
  const module = { exports: {} };
  const reactMock = { ...React, useState: () => [states[stateIndex++], () => {}], useEffect: () => {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require: name => {
      if (name === 'react') return reactMock;
      if (name === 'react-router-dom') return { useNavigate: () => () => {} };
      if (name.endsWith('/AuthContext')) return { useAuth: () => ({ token: 'test-token', user: {} }) };
      if (name.endsWith('/referralApi')) return { fetchMyReferralDashboard: async () => data };
      if (name.endsWith('/referralUtils')) return referralUtils;
      if (name === 'react-toastify') return { toast: { success() {}, error() {} } };
      return require(name);
    },
    window: { location: { origin: 'https://saathigro.in' } }, console
  });
  globalThis.window = { location: { origin: 'https://saathigro.in' } };
  try { return renderToStaticMarkup(React.createElement(module.exports.default)); }
  finally { delete globalThis.window; }
};
const dashboard = (settings = {}) => ({ referralCode: 'INVITE01', walletBalance: 75, totalInvited: 1,
  totalRewarded: 1, totalEarned: 50, referrals: [{ _id: 'r1', friendName: 'Friend', friendPhone: '98******10', status: 'rewarded', earnedAmount: 50 }],
  programSettings: { isEnabled: true, rewardTrigger: 'first_order_delivered', minOrderValue: 199,
    referrerRewardAmount: 50, refereeRewardAmount: 25, maxReferralsPerUser: 50, terms: [], ...settings } });

test('paused referral page retains earned rewards/history and hides invite offers and controls', () => {
  const html = renderPage(dashboard({ isEnabled: false }));
  assert.match(html, /currently paused/); assert.match(html, /Friend/); assert.match(html, /₹50/);
  assert.doesNotMatch(html, /INVITE01|Share on WhatsApp|You get|How It Works/);
});
test('signup reward page explains signup without ordering or delivery', () => {
  const html = renderPage(dashboard({ rewardTrigger: 'registration' }));
  assert.match(html, /No order is required/); assert.match(html, /When they sign up/);
  assert.doesNotMatch(html, /first grocery order|Once their order is delivered/);
});
test('delivery reward page explains minimum and first-delivery ineligibility', () => {
  const html = renderPage(dashboard());
  assert.match(html, /₹199/); assert.match(html, /below-minimum first delivery is ineligible/);
  assert.match(html, /Share on WhatsApp/); assert.match(html, /INVITE01/);
});
test('dashboard failure shows retry instead of inventing reward offers or empty history', () => {
  const html = renderPage(null, 'Could not load referral details. Please try again.');
  assert.match(html, /role="alert"/); assert.match(html, /Try again/);
  assert.doesNotMatch(html, /You get|Share on WhatsApp|No invites yet/);
});

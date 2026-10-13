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
const source = fs.readFileSync(new URL('../src/modules/user/pages/auth/LoginPage.jsx', import.meta.url), 'utf8');
const compiled = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
const login = (location, { step = 'phone', isEnabled = true, code } = {}) => {
  let hook = 0, submitted;
  const module = { exports: {} };
  const initial = value => typeof value === 'function' ? value() : value;
  vm.runInNewContext(compiled, {
    module, exports: module.exports, URLSearchParams,
    require: name => {
      if (name === 'react') return { ...React, useEffect() {}, useRef: () => ({ current: null }),
        useState(value) {
          const index = hook++;
          return [index === 0 && code !== undefined ? code : index === 1 ? '9876543210'
            : index === 2 ? '123456' : index === 3 ? step : initial(value), () => {}];
        } };
      if (name === 'react-router-dom') return { useNavigate: () => () => {}, useLocation: () => location };
      if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user: null, token: null, loading: false,
        verifyOtp: async payload => { submitted = payload; return { success: false }; } }) };
      if (name.endsWith('/ShopContext')) return { useShop: () => ({ settings: { referral: { isEnabled } } }) };
      if (name.endsWith('/userAuthApi')) return {};
      if (name.endsWith('/referralUtils')) return referralUtils;
      if (name === 'react-toastify') return { toast: { success() {}, error() {} } };
      if (name.endsWith('/PolicyViewerModal') || name.endsWith('/ReferralCodeInput')) return () => null;
      return require(name);
    }
  });
  const tree = module.exports.default();
  const findForm = element => {
    if (!element || typeof element !== 'object') return null;
    if (element.type === 'form') return element;
    const children = Array.isArray(element.props?.children) ? element.props.children : [element.props?.children];
    return children.map(findForm).find(Boolean);
  };
  return { tree, form: findForm(tree), submitted: () => submitted };
};

test('fresh register invite survives ProtectedRoute redirect and reaches OTP request payload', async () => {
  const page = login({ search: '', state: { from: { pathname: '/register', search: '?ref=friend01' } } }, { step: 'otp' });
  await page.form.props.onSubmit({ preventDefault() {} });
  assert.equal(page.submitted().referralCode, 'FRIEND01');
  assert.equal(page.submitted().phone, '9876543210'); assert.equal(page.submitted().otp, '123456');
});
test('manual code is passed to OTP verification and disabled program omits it', async () => {
  const location = { search: '', state: null };
  const page = login(location, { step: 'otp', code: 'MANUAL01' });
  await page.form.props.onSubmit({ preventDefault() {} });
  assert.equal(page.submitted().referralCode, 'MANUAL01');
  const paused = login(location, { step: 'otp', code: 'MANUAL01', isEnabled: false });
  await paused.form.props.onSubmit({ preventDefault() {} });
  assert.equal(paused.submitted().referralCode, undefined);
});
test('ordinary login still renders and verifies OTP without a referral', async () => {
  const page = login({ search: '', state: null }, { step: 'otp', code: '' });
  assert.match(renderToStaticMarkup(page.tree), /Verify Mobile Number/);
  await page.form.props.onSubmit({ preventDefault() {} });
  assert.equal(page.submitted().referralCode, undefined);
});

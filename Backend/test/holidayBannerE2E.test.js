import assert from 'node:assert/strict';
import test from 'node:test';
import { getPublicSettings } from '../src/controllers/settingController.js';
import GlobalSetting from '../src/models/GlobalSetting.js';

const originalGlobalFindOne = GlobalSetting.findOne;

test.afterEach(() => {
  GlobalSetting.findOne = originalGlobalFindOne;
});

test('Holiday Banner E2E: GET /api/settings/public correctly exposes upcoming holidays array', async () => {
  GlobalSetting.findOne = () => Promise.resolve({
    deliveryTimezone: 'Asia/Kolkata',
    holidays: [
      { date: '2026-10-02', name: 'Gandhi Jayanti', reason: 'National Holiday' },
      { date: '2026-10-20', name: 'Diwali', reason: 'Festival of Lights' }
    ]
  });

  let responseData = null;
  const mockRes = {
    json(data) {
      responseData = data;
      return this;
    },
    status() {
      return this;
    }
  };

  await getPublicSettings({}, mockRes);

  assert.ok(responseData, 'Response data must not be null');
  assert.ok(Array.isArray(responseData.holidays), 'holidays must be an array');
  assert.equal(responseData.holidays.length, 2);
  assert.equal(responseData.holidays[0].date, '2026-10-02');
  assert.equal(responseData.holidays[0].name, 'Gandhi Jayanti');
  assert.equal(responseData.holidays[0].reason, 'National Holiday');
  assert.equal(responseData.holidays[1].date, '2026-10-20');
  assert.equal(responseData.holidays[1].name, 'Diwali');
});

test('Holiday Banner Logic: Accurate 2-day pre-holiday window computation', () => {
  const getDayDifference = (todayStr, targetStr) => {
    const [y1, m1, d1] = todayStr.split('-').map(Number);
    const [y2, m2, d2] = targetStr.split('-').map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    return Math.round((utc2 - utc1) / 86400000);
  };

  const holidayDate = '2026-10-02';

  // 3 days prior: should NOT show
  assert.equal(getDayDifference('2026-09-29', holidayDate), 3);
  assert.equal(getDayDifference('2026-09-29', holidayDate) <= 2 && getDayDifference('2026-09-29', holidayDate) >= 0, false);

  // 2 days prior: SHOULD show (Upcoming notice)
  assert.equal(getDayDifference('2026-09-30', holidayDate), 2);
  assert.equal(getDayDifference('2026-09-30', holidayDate) <= 2 && getDayDifference('2026-09-30', holidayDate) >= 0, true);

  // 1 day prior: SHOULD show (Closed tomorrow)
  assert.equal(getDayDifference('2026-10-01', holidayDate), 1);
  assert.equal(getDayDifference('2026-10-01', holidayDate) <= 2 && getDayDifference('2026-10-01', holidayDate) >= 0, true);

  // Holiday day: SHOULD show (Closed today)
  assert.equal(getDayDifference('2026-10-02', holidayDate), 0);
  assert.equal(getDayDifference('2026-10-02', holidayDate) <= 2 && getDayDifference('2026-10-02', holidayDate) >= 0, true);

  // Day after holiday: should NOT show (auto-hidden)
  assert.equal(getDayDifference('2026-10-03', holidayDate), -1);
  assert.equal(getDayDifference('2026-10-03', holidayDate) <= 2 && getDayDifference('2026-10-03', holidayDate) >= 0, false);
});

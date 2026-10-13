const REFERRAL_STORAGE_KEY = 'saathigro_referral_code';

export const normalizeReferralCode = (value = '') => String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);

export const storeReferralCode = (value) => {
  try {
    const code = normalizeReferralCode(value);
    if (code) localStorage.setItem(REFERRAL_STORAGE_KEY, code);
    else localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch { /* Storage may be unavailable. */ }
};

/**
 * Persist referral code from URL (?ref=) so it survives until registration.
 */
export const captureReferralFromUrl = (search = window.location.search) => {
  try {
    const params = new URLSearchParams(search);
    const ref = normalizeReferralCode(params.get('ref') || '');
    if (ref) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
    }
  } catch {
    // ignore storage errors
  }
};

export const getStoredReferralCode = () => {
  try {
    return localStorage.getItem(REFERRAL_STORAGE_KEY) || null;
  } catch {
    return null;
  }
};

export const clearStoredReferralCode = () => {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ignore
  }
};

/**
 * Web invite link: https://host/register?ref=CODE
 */
export const buildReferralShareLink = (referralCode) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/register?ref=${encodeURIComponent(referralCode)}`;
};

const getConfiguredStoreUrls = (settings = {}) => ({
  playStoreUrl:
    settings.playStoreUrl ||
    import.meta.env?.VITE_PLAY_STORE_URL ||
    '',
  appStoreUrl:
    settings.appStoreUrl ||
    import.meta.env?.VITE_APP_STORE_URL ||
    ''
});

/**
 * Attach referral code to store URLs (Play Install Referrer / App Store campaign token).
 */
export const withReferralOnStoreUrl = (storeUrl, referralCode, platform = 'android') => {
  if (!storeUrl || !referralCode) return storeUrl || '';
  try {
    const url = new URL(storeUrl);
    if (platform === 'android') {
      const referrerValue = `utm_source=saathigro_invite&utm_content=${referralCode}`;
      url.searchParams.set('referrer', referrerValue);
    } else {
      url.searchParams.set('ct', referralCode);
    }
    return url.toString();
  } catch {
    return storeUrl;
  }
};

/**
 * Full share payload: referral code + Play Store + App Store + web link.
 */
export const buildReferralSharePayload = (referralCode, settings = {}) => {
  const webLink = buildReferralShareLink(referralCode);
  const { playStoreUrl, appStoreUrl } = getConfiguredStoreUrls(settings);
  const playStoreLink = withReferralOnStoreUrl(playStoreUrl, referralCode, 'android');
  const appStoreLink = withReferralOnStoreUrl(appStoreUrl, referralCode, 'ios');

  const refereeBonus = settings.isEnabled !== false && settings.refereeRewardAmount
    ? settings.rewardTrigger === 'registration'
      ? ` and get ₹${settings.refereeRewardAmount} welcome cashback when you sign up using my code`
      : ` and get ₹${settings.refereeRewardAmount} welcome cashback after your first order of ₹${settings.minOrderValue ?? 199} or more is delivered`
    : '';
  const lines = [
    `Join me on Saathigro for fresh groceries${refereeBonus}!`,
    '',
    `Referral code: ${referralCode}`
  ];

  if (playStoreLink || appStoreLink) lines.push('', 'Download the app:');

  if (playStoreLink) {
    lines.push(`Android (Play Store): ${playStoreLink}`);
  }
  if (appStoreLink) {
    lines.push(`iOS (App Store): ${appStoreLink}`);
  }
  lines.push('', `Or open on web: ${webLink}`);

  return {
    referralCode,
    webLink,
    playStoreLink,
    appStoreLink,
    shareText: lines.join('\n')
  };
};

export const getReferralProgramCopy = (settings = {}) => {
  const onSignup = settings.rewardTrigger === 'registration';
  return {
    stepTitle: onSignup ? 'Friend signs up with your code' : 'Friend completes their first delivery',
    stepDescription: onSignup
      ? 'Your friend creates a new account using your code. No order is required.'
      : `Your friend's first delivered order must total ₹${settings.minOrderValue ?? 199} or more, including fees and taxes after discounts. A below-minimum first delivery is ineligible.`,
    payoutDescription: onSignup
      ? `When they sign up, you get ₹${settings.referrerRewardAmount} and your friend gets ₹${settings.refereeRewardAmount} in their wallet.`
      : `After their qualifying first delivery, you get ₹${settings.referrerRewardAmount} and your friend gets ₹${settings.refereeRewardAmount} in their wallet.`,
    capDescription: settings.maxReferralsPerUser > 0 ? `You can earn rewards for up to ${settings.maxReferralsPerUser} friends.` : 'There is no limit on rewarded referrals.'
  };
};

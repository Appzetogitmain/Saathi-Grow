const legacyDescription = 'Share your referral code with friends. When they place their first order, both of you earn wallet cashback!';
const legacyTerms = [
  'Share your referral code or link with friends.',
  'Friend must sign up using your code.',
  'Friend completes their first order meeting the minimum order value.',
  'Both wallets are credited automatically upon successful delivery!'
];
const amount = (value, fallback) => Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : fallback;

export const buildReferralSettings = (settings = {}) => {
  const referral = settings.referral || {};
  const onSignup = referral.rewardTrigger === 'registration';
  const minOrderValue = amount(referral.minOrderValue, 199);
  const isDefaultTerms = Array.isArray(referral.terms) && referral.terms.length === 4 &&
    referral.terms[0] === legacyTerms[0] && referral.terms[1] === legacyTerms[1] &&
    [legacyTerms[3], 'Rewards are credited to both wallets, subject to the referrer reward cap.'].includes(referral.terms[3]) &&
    (referral.terms[2] === legacyTerms[2] ||
      referral.terms[2] === 'Rewards are credited when your friend creates a new account; no order is required.' ||
      /^The friend's first delivered order must total at least ₹[\d.]+, including fees and taxes after discounts\. A below-minimum first delivery is ineligible\.$/.test(referral.terms[2]));
  const defaultTerms = [
    legacyTerms[0], legacyTerms[1],
    onSignup ? 'Rewards are credited when your friend creates a new account; no order is required.'
      : `The friend's first delivered order must total at least ₹${minOrderValue}, including fees and taxes after discounts. A below-minimum first delivery is ineligible.`,
    'Rewards are credited to both wallets, subject to the referrer reward cap.'
  ];
  return {
    isEnabled: referral.isEnabled ?? true,
    rewardTrigger: onSignup ? 'registration' : 'first_order_delivered',
    referrerRewardAmount: amount(referral.referrerRewardAmount, 50),
    refereeRewardAmount: amount(referral.refereeRewardAmount, 25),
    minOrderValue,
    maxReferralsPerUser: Number.isInteger(referral.maxReferralsPerUser) && referral.maxReferralsPerUser >= 0 ? referral.maxReferralsPerUser : 50,
    headline: referral.headline || 'Invite Friends & Earn Rewards!',
    description: !referral.description || [legacyDescription,
      'Share your code with friends. When they sign up using it, both of you earn wallet cashback!',
      'Share your code with friends. After their first qualifying delivery, both of you earn wallet cashback!'].includes(referral.description)
      ? onSignup ? 'Share your code with friends. When they sign up using it, both of you earn wallet cashback!'
        : 'Share your code with friends. After their first qualifying delivery, both of you earn wallet cashback!'
      : referral.description,
    terms: !Array.isArray(referral.terms) || isDefaultTerms
      ? defaultTerms : referral.terms,
    playStoreUrl: settings.playStoreUrl || '',
    appStoreUrl: settings.appStoreUrl || ''
  };
};

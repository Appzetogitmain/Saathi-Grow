import { normalizeReferralCode, storeReferralCode } from '../../utils/referralUtils';
import { useId } from 'react';

export default function ReferralCodeInput({ value, onChange, disabled = false }) {
  const inputId = useId();
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={inputId} className="block text-xs font-bold text-gray-700 dark:text-gray-300">
        Referral code (optional)
      </label>
      <input id={inputId} type="text" value={value} maxLength={32} disabled={disabled}
        autoCapitalize="characters" autoComplete="off" placeholder="Enter your friend's code"
        onChange={event => {
          const code = normalizeReferralCode(event.target.value);
          storeReferralCode(code);
          onChange(code);
        }}
        className="w-full min-w-0 min-h-11 p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl !text-base font-mono text-gray-900 dark:text-white" />
      <p className="text-xs text-gray-500 break-words">Applies when creating a new account. Existing accounts cannot add a referral.</p>
    </div>
  );
}

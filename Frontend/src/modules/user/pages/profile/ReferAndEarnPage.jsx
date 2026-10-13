import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Gift, 
  Copy, 
  Check, 
  Share2, 
  Users, 
  TrendingUp, 
  Sparkles, 
  ShoppingBag, 
  Wallet, 
  ChevronRight, 
  HelpCircle, 
  Loader2,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchMyReferralDashboard } from '../../api/referralApi';
import { buildReferralSharePayload, getReferralProgramCopy } from '../../utils/referralUtils';
import { toast } from 'react-toastify';

const ReferAndEarnPage = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      if (!token) return;
      try {
        setLoading(true);
        setError('');
        const res = await fetchMyReferralDashboard(token);
        if (active) setData(res);
      } catch (err) {
        console.error('Failed to load referral dashboard', err);
        if (active) setError('Could not load referral details. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();
    const refresh = () => setReload(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); };
  }, [token, reload]);

  const referralCode = data?.referralCode || user?.referralCode || '';
  const settings = data?.programSettings || {
    isEnabled: true,
    referrerRewardAmount: 50,
    refereeRewardAmount: 25,
    minOrderValue: 199,
    headline: 'Invite Friends & Earn Rewards!',
    description: 'Share your referral code with friends. When they place their first order, both of you earn wallet cashback!',
    terms: []
  };

  const sharePayload = referralCode ? buildReferralSharePayload(referralCode, settings) : null;
  const inviteText = sharePayload?.shareText || `Join me on Saathigro using my referral code: ${referralCode}`;
  const programCopy = getReferralProgramCopy(settings);

  const handleCopyCode = async () => {
    if (!referralCode || !settings.isEnabled || error) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralCode);
      } else {
        const ta = document.createElement('textarea');
        ta.value = referralCode;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!successful) throw new Error('Copy failed');
      }
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const handleShareWhatsApp = () => {
    if (!referralCode || !settings.isEnabled || error) return;
    const text = encodeURIComponent(inviteText);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    if (!referralCode || !settings.isEnabled || error) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Saathigro',
          text: inviteText,
          url: sharePayload?.webLink
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopyCode();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <Loader2 className="animate-spin text-[#0c831f]" size={36} />
      </div>
    );
  }

  if (error || !data) {
    return <div className="min-h-screen p-6 text-center bg-white dark:bg-black dark:text-white">
      <p role="alert">{error || 'Referral details are unavailable.'}</p>
      <button className="p-3 text-[#0c831f]" onClick={() => setReload(value => value + 1)}>Try again</button>
      <button className="p-3" onClick={() => navigate('/profile')}>Back to profile</button>
    </div>;
  }

  return (
    <div className="min-h-screen w-full min-w-0 bg-[#f8fafc] dark:bg-black pb-28 text-slate-800 dark:text-slate-100 font-sans [overflow-wrap:anywhere]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-[#111]/90 backdrop-blur-md border-b border-gray-100 dark:border-white/5 px-4 py-3.5 flex flex-wrap items-center justify-between gap-2 max-w-2xl mx-auto">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/profile')}
            className="min-h-11 min-w-11 shrink-0 flex items-center justify-center p-2 bg-gray-50 dark:bg-white/5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 active:scale-95 transition-all"
            aria-label="Back to profile"
          >
            <ArrowLeft size={18} className="text-gray-700 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-base font-black text-gray-900 dark:text-white leading-tight">Refer & Earn</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Earn real wallet cash</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/wallet')}
          className="flex min-h-11 max-w-full items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-500/10 text-[#0c831f] text-xs font-bold active:scale-95 transition-all"
        >
          <Wallet size={14} className="shrink-0" />
          <span>₹{data?.walletBalance ?? user?.walletBalance ?? 0}</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {!settings.isEnabled && <p role="status" className="p-4 bg-white dark:bg-[#141414] rounded-2xl">The referral program is currently paused. Your previous rewards and referral history are shown below.</p>}
        {settings.isEnabled && <>
        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c831f] via-[#09731b] to-[#044d10] p-6 text-white shadow-xl shadow-green-900/10">
          <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-black uppercase tracking-wider text-green-100 border border-white/10">
              <Sparkles size={12} />
              <span>Saathi Referral Program</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black leading-tight tracking-tight">
              {settings.headline || 'Invite Friends & Earn Rewards!'}
            </h2>

            <p className="text-xs sm:text-sm text-green-100/90 leading-relaxed font-medium">
              {settings.description || programCopy.payoutDescription}
            </p>

            {/* Two-Sided Reward Pill */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <div className="px-3.5 py-1.5 rounded-2xl bg-white text-gray-900 font-black text-xs shadow-sm flex items-center gap-1.5">
                <Gift size={14} className="text-[#0c831f]" />
                <span>You get ₹{settings.referrerRewardAmount}</span>
              </div>
              <div className="px-3.5 py-1.5 rounded-2xl bg-white/20 backdrop-blur-md text-white font-bold text-xs border border-white/20">
                Friend gets ₹{settings.refereeRewardAmount}
              </div>
            </div>
          </div>
        </div>

        {/* Referral Code Card */}
        <div className="bg-white dark:bg-[#141414] rounded-3xl p-5 border border-gray-100 dark:border-white/5 shadow-sm space-y-4">
          <div className="text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Your Personal Referral Code</span>
            <div className="mt-2 py-3 px-3 sm:px-6 bg-green-50/70 dark:bg-green-900/10 rounded-2xl border-2 border-dashed border-[#0c831f]/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="min-w-0 max-w-full break-all text-xl sm:text-2xl font-black tracking-[0.15em] sm:tracking-[0.25em] text-[#0c831f] font-mono">
                {referralCode || '—'}
              </span>
              <button
                onClick={handleCopyCode}
                className="flex min-h-11 w-full sm:w-auto shrink-0 items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-[#0c831f] text-white text-xs font-bold hover:bg-[#0a6f1a] active:scale-95 transition-all shadow-md shadow-green-600/20"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Share Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleShareWhatsApp}
              className="flex min-h-11 min-w-0 items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs shadow-md shadow-green-500/20 active:scale-95 transition-all"
            >
              <Share2 size={16} />
              <span>Share on WhatsApp</span>
            </button>

            <button
              onClick={handleNativeShare}
              className="flex min-h-11 min-w-0 items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
            >
              <Share2 size={16} />
              <span>More Options</span>
            </button>
          </div>
        </div>

        {/* User Stats Card */}
        </>}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-[#141414] p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <TrendingUp size={15} className="text-[#0c831f]" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Earned</span>
            </div>
            <p className="text-2xl font-black text-[#0c831f]">₹{data?.totalEarned ?? 0}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Direct wallet rewards</p>
          </div>

          <div className="bg-white dark:bg-[#141414] p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Users size={15} className="text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Friends Joined</span>
            </div>
            <p className="text-2xl font-black text-gray-800 dark:text-white">{data?.totalInvited ?? 0}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{data?.totalRewarded ?? 0} converted</p>
          </div>
        </div>

        {/* How it Works Section */}
        {settings.isEnabled &&
        <div className="bg-white dark:bg-[#141414] rounded-3xl p-5 border border-gray-100 dark:border-white/5 shadow-sm space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">How It Works</h3>

          <div className="space-y-3.5">
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-500/10 text-[#0c831f] flex items-center justify-center font-black text-xs shrink-0">
                1
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-white">Share your Invite Code</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Send your referral link or code to your friends and family on WhatsApp.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center font-black text-xs shrink-0">
                2
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-white">{programCopy.stepTitle}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {programCopy.stepDescription}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 flex items-center justify-center font-black text-xs shrink-0">
                3
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-white">Both Earn Wallet Cashback</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {programCopy.payoutDescription}
                </p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-500">{programCopy.capDescription}</p>
        </div>
        }

        {/* Invited Friends List */}
        <div className="bg-white dark:bg-[#141414] rounded-3xl p-5 border border-gray-100 dark:border-white/5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Your Referrals</h3>
            <span className="text-[10px] font-bold text-gray-400">{data.totalInvited} total{data.totalInvited > data.referrals.length ? ' · Showing latest 50' : ''}</span>
          </div>

          {!data?.referrals || data.referrals.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Gift className="mx-auto text-gray-300 dark:text-gray-700 mb-2" size={32} />
              <p className="text-xs font-bold">No invites yet!</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Share your code above to start earning free groceries.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {data.referrals.map((item) => (
                <div key={item._id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                  <div className="min-w-0 max-w-full sm:flex-1">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{item.friendName}</p>
                    <p className="text-[10px] text-gray-400">{item.friendPhone}</p>
                  </div>

                  <div className="min-w-0 max-w-full text-left sm:text-right">
                    {item.status === 'rewarded' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#0c831f] bg-green-50 dark:bg-green-500/10 px-2.5 py-1 rounded-full">
                        <CheckCircle2 size={11} /> +₹{item.earnedAmount} Earned
                      </span>
                    ) : item.status === 'registered' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-full">
                        <Clock size={11} /> {settings.rewardTrigger === 'registration' ? 'Reward Pending' : 'Order Pending'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-full">
                        <XCircle size={11} /> Ineligible
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Terms & Conditions Accordion */}
        {settings.isEnabled && settings.terms && settings.terms.length > 0 && (
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowTerms(p => !p)}
              className="w-full p-4 flex items-center justify-between text-left text-xs font-bold text-gray-700 dark:text-gray-200"
            >
              <div className="flex items-center gap-2">
                <HelpCircle size={15} className="text-gray-400" />
                <span>Program Terms & Conditions</span>
              </div>
              <ChevronRight
                size={16}
                className={`text-gray-400 transition-transform duration-200 ${showTerms ? 'rotate-90' : ''}`}
              />
            </button>

            {showTerms && (
              <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-white/5 text-[11px] text-gray-500 dark:text-gray-400 space-y-1.5">
                {settings.terms.map((term, i) => (
                  <p key={i}>• {term}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferAndEarnPage;

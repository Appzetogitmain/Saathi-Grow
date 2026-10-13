import React, { useState, useEffect, useCallback } from 'react';
import { 
  Gift, 
  Users, 
  CheckCircle, 
  IndianRupee, 
  Save, 
  Loader, 
  Share2, 
  Sliders, 
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  Clock, 
  XCircle, 
  Award,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '../../context/AdminAuthContext';
import * as referralApi from '../../api/referralApi';
import { toast } from 'react-toastify';

const ReferralManagement = () => {
  const { t } = useTranslation('admin_settings');
  const { adminUser } = useAdminAuth();
  const token = adminUser?.token;

  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'logs'
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    isEnabled: true,
    rewardTrigger: 'first_order_delivered',
    referrerRewardAmount: 50,
    refereeRewardAmount: 25,
    minOrderValue: 199,
    maxReferralsPerUser: 50,
    headline: 'Invite Friends & Earn Rewards!',
    description: 'Share your referral code with friends. When they place their first order, both of you earn wallet cashback!',
    terms: []
  });

  // Analytics State
  const [analytics, setAnalytics] = useState({
    totalReferrals: 0,
    totalRewarded: 0,
    totalPending: 0,
    totalPayout: 0,
    totalReferrerPaid: 0,
    totalRefereePaid: 0,
    topReferrers: []
  });

  // Logs Table State
  const [referrals, setReferrals] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newTerm, setNewTerm] = useState('');

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const [settingsData, analyticsData] = await Promise.all([
        referralApi.getReferralSettings(token),
        referralApi.getReferralAnalytics(token)
      ]);

      if (settingsData) {
        setSettings({
          isEnabled: settingsData.isEnabled ?? true,
          rewardTrigger: settingsData.rewardTrigger || 'first_order_delivered',
          referrerRewardAmount: settingsData.referrerRewardAmount ?? 50,
          refereeRewardAmount: settingsData.refereeRewardAmount ?? 25,
          minOrderValue: settingsData.minOrderValue ?? 199,
          maxReferralsPerUser: settingsData.maxReferralsPerUser ?? 50,
          headline: settingsData.headline || 'Invite Friends & Earn Rewards!',
          description: settingsData.description || 'Share your referral code with friends. When they place their first order, both of you earn wallet cashback!',
          terms: Array.isArray(settingsData.terms) ? settingsData.terms : []
        });
      }

      if (analyticsData) {
        setAnalytics(analyticsData);
      }
    } catch (error) {
      toast.error('Failed to load referral program data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadLogs = useCallback(async () => {
    if (!token) return;
    try {
      setLogsLoading(true);
      const res = await referralApi.getReferralsList(token, {
        page,
        limit: 15,
        status: statusFilter || undefined,
        search: searchQuery || undefined
      });

      if (res?.success) {
        setReferrals(res.referrals || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalCount(res.pagination?.total || 0);
      }
    } catch (error) {
      toast.error('Failed to load referral logs');
      console.error(error);
    } finally {
      setLogsLoading(false);
    }
  }, [token, page, statusFilter, searchQuery]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab, loadLogs]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number'
        ? (name === 'maxReferralsPerUser' ? Math.floor(Math.max(0, Number(value))) : Math.round(Math.max(0, Number(value)) * 100) / 100)
        : value)
    }));
  };

  const handleAddTerm = () => {
    if (!newTerm.trim()) return;
    setSettings(prev => ({
      ...prev,
      terms: [...prev.terms, newTerm.trim()]
    }));
    setNewTerm('');
  };

  const handleRemoveTerm = (index) => {
    setSettings(prev => ({
      ...prev,
      terms: prev.terms.filter((_, i) => i !== index)
    }));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const updated = await referralApi.updateReferralSettings(token, settings);
      setSettings(prev => ({ ...prev, ...updated }));
      toast.success('Referral settings updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update referral settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-40">
        <Loader className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="container-fluid w-full min-w-0 py-6 bg-slate-50/30 min-h-screen !px-3 sm:!px-4 md:!px-6 max-w-7xl mx-auto font-sans text-slate-800 [overflow-wrap:anywhere] [&_svg]:shrink-0 [&_input]:min-w-0 [&_input]:!text-base [&_select]:min-w-0 [&_select]:!text-base">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gift size={16} className="text-emerald-600" />
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Growth & Marketing</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Refer & Earn Management
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Configure dynamic referral reward rules, welcome gifts, and view customer invite analytics.
          </p>
        </div>

        <div className="flex w-full md:w-auto items-center gap-3">
          {activeTab === 'config' && (
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className={`flex min-h-11 w-full md:w-auto justify-center items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all transform active:scale-95 ${
                isSaving ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'
              }`}
            >
              <Save size={16} className={isSaving ? 'animate-pulse' : ''} />
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Invites</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{analytics.totalReferrals}</h3>
            <span className="text-[10px] text-slate-500 font-medium">Invites registered</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Successful Referrals</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{analytics.totalRewarded}</h3>
            <span className="text-[10px] text-emerald-600 font-medium">Converted & rewarded</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rewards Paid</p>
            <h3 className="text-2xl font-black text-purple-600 mt-1">₹{analytics.totalPayout.toLocaleString('en-IN')}</h3>
            <span className="text-[10px] text-slate-500 font-medium">Referrer: ₹{analytics.totalReferrerPaid} | Referee: ₹{analytics.totalRefereePaid}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <IndianRupee size={22} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Conversion</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{analytics.totalPending}</h3>
            <span className="text-[10px] text-amber-600 font-medium">Awaiting first order</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 mb-6 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex min-h-11 min-w-0 items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'config'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sliders size={14} />
          <span>Rules & Configuration</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex min-h-11 min-w-0 items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'logs'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText size={14} />
          <span>Referral Logs & Conversions ({analytics.totalReferrals})</span>
        </button>
      </div>

      {/* Tab 1: Rules & Configuration */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Master Program Switch */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-600" />
                <h3 className="text-base font-bold text-slate-800">Refer & Earn Program Master Switch</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Toggle the entire referral program on or off. When disabled, banners and invite codes will be hidden in the customer app.
              </p>
            </div>
            <label className="relative inline-flex min-h-11 shrink-0 items-center cursor-pointer">
              <input
                type="checkbox"
                name="isEnabled"
                aria-label="Enable referral program"
                checked={settings.isEnabled}
                onChange={handleInputChange}
                className="sr-only peer"
              />
              <div className="relative w-14 h-7 bg-slate-200 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Reward Rules Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Award size={18} className="text-blue-600" />
              Reward Distribution & Eligibility Rules
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Trigger */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Reward Trigger Event</label>
                <select
                  name="rewardTrigger"
                  value={settings.rewardTrigger}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer"
                >
                  <option value="first_order_delivered">On First Order Delivered (Recommended & Safe)</option>
                  <option value="registration">Instant on Sign Up (Immediate Registration)</option>
                </select>
                <p className="text-[11px] text-slate-400">Controls when wallet cashback is awarded. First delivery means the earliest successfully delivered order; a below-minimum first delivery cannot qualify through a later order.</p>
              </div>

              {/* Referrer Reward Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Referrer Bonus Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    name="referrerRewardAmount"
                    min="0"
                    step="0.01"
                    value={settings.referrerRewardAmount}
                    onChange={handleInputChange}
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Cashback added to the existing customer who shared the code.</p>
              </div>

              {/* Referee Welcome Reward Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Friend Welcome Bonus (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    name="refereeRewardAmount"
                    min="0"
                    step="0.01"
                    value={settings.refereeRewardAmount}
                    onChange={handleInputChange}
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Welcome gift credited to the new user who signed up using the code.</p>
              </div>

              {/* Minimum Order Value */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Minimum Order Value (MOV) (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    name="minOrderValue"
                    min="0"
                    step="0.01"
                    value={settings.minOrderValue}
                    onChange={handleInputChange}
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400">The first delivered order total (including fees and taxes after discounts) must meet this amount. Signup rewards do not require an order.</p>
              </div>

              {/* Max Referrals Per User */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Max Rewards Per User (Cap)</label>
                <input
                  type="number"
                  name="maxReferralsPerUser"
                  min="0"
                  value={settings.maxReferralsPerUser}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                />
                <p className="text-[11px] text-slate-400">Cap on successful referrals per user to prevent bot/loop abuse (0 = unlimited).</p>
              </div>
            </div>
          </div>

          {/* Marketing Copy & Customer Terms */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Share2 size={18} className="text-emerald-600" />
              App Banners & Terms Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">App Banner Headline</label>
                <input
                  type="text"
                  name="headline"
                  value={settings.headline}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Program Subtitle / Tagline</label>
                <input
                  type="text"
                  name="description"
                  value={settings.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Dynamic Terms list */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <label className="text-xs font-bold text-slate-700 block">Terms & Conditions Bullet Points</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTerm())}
                  placeholder="e.g. Cashback will be valid for 90 days from credit date."
                  className="w-full min-w-0 min-h-11 flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={handleAddTerm}
                  className="min-h-11 shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex justify-center items-center gap-1.5 transition-all"
                >
                  <Plus size={14} /> Add Rule
                </button>
              </div>

              <div className="space-y-2 mt-3">
                {settings.terms.map((term, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
                    <span className="min-w-0 flex-1 pr-2">• {term}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(index)}
                      className="min-h-11 min-w-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-red-500 p-1 transition-colors"
                      title="Remove Rule"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Referrers Leaderboard */}
          {analytics.topReferrers?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-600" />
                Top Performing Referrers Leaderboard
              </h3>
              <div className="w-full min-w-0 max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Top referrers table">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-3">Rank</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Referral Code</th>
                      <th className="p-3 text-center">Successful Referrals</th>
                      <th className="p-3 text-right">Total Cashback Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {analytics.topReferrers.map((item, idx) => (
                      <tr key={item._id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-900">#{idx + 1}</td>
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{item.name || 'Anonymous'}</p>
                          <p className="text-[11px] text-slate-400">{item.phone}</p>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold rounded text-[11px]">
                            {item.referralCode || '—'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-emerald-600">
                          {item.successfulCount}
                        </td>
                        <td className="p-3 text-right font-black text-slate-900">
                          ₹{item.totalEarned.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Logs & History */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-0 w-full sm:w-80 sm:flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone or code..."
                className="w-full min-h-11 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-auto max-w-full min-h-11 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="rewarded">Rewarded (Completed)</option>
                <option value="registered">Registered (Pending Order)</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="w-full min-w-0 max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Referral history table">
            {logsLoading ? (
              <div className="py-20 flex justify-center items-center">
                <Loader size={30} className="animate-spin text-blue-600" />
              </div>
            ) : referrals.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs font-medium">
                No referral records found matching your query.
              </div>
            ) : (
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-3.5">Referrer</th>
                    <th className="p-3.5">Referred Friend (Referee)</th>
                    <th className="p-3.5">Code</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Order</th>
                    <th className="p-3.5 text-right">Referrer Reward</th>
                    <th className="p-3.5 text-right">Referee Reward</th>
                    <th className="p-3.5 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {referrals.map((ref) => (
                    <tr key={ref._id} className="hover:bg-slate-50/50">
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{ref.referrer?.name || 'Unknown'}</p>
                        <p className="text-[11px] text-slate-400">{ref.referrer?.phone || '—'}</p>
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{ref.referee?.name || 'New Saathi'}</p>
                        <p className="text-[11px] text-slate-400">{ref.referee?.phone || '—'}</p>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-mono font-bold rounded text-[11px]">
                          {ref.referralCode}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {ref.status === 'rewarded' && (
                          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit">
                            <CheckCircle size={10} /> Rewarded
                          </span>
                        )}
                        {ref.status === 'registered' && (
                          <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit">
                            <Clock size={10} /> Pending Order
                          </span>
                        )}
                        {ref.status === 'cancelled' && (
                          <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit">
                            <XCircle size={10} /> Cancelled
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {ref.orderId ? (
                          <div>
                            <span className="font-mono text-blue-600 font-bold">#{ref.orderId.orderId}</span>
                            <p className="text-[10px] text-slate-400">₹{ref.orderId.totalAmount}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-600">
                        {ref.referrerReward ? `+₹${ref.referrerReward}` : '—'}
                      </td>
                      <td className="p-3.5 text-right font-bold text-purple-600">
                        {ref.refereeReward ? `+₹${ref.refereeReward}` : '—'}
                      </td>
                      <td className="p-3.5 text-right text-slate-500 text-[11px]">
                        {new Date(ref.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
              <span>Showing Page {page} of {totalPages} ({totalCount} total)</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  aria-label="Previous referral page"
                  className="min-h-11 min-w-11 flex items-center justify-center p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  aria-label="Next referral page"
                  className="min-h-11 min-w-11 flex items-center justify-center p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReferralManagement;

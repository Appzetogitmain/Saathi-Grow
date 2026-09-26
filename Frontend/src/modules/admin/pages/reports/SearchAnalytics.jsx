import React, { useState, useEffect, useCallback } from 'react';
import { Download, Search, Calendar, ChevronLeft, ChevronRight, RefreshCw, Loader2, Sparkles, Filter, User } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { getSearchAnalytics, exportSearchAnalyticsExcel } from '../../api/reportApi';
import { toast } from 'react-toastify';

const SearchAnalytics = () => {
    const { adminUser } = useAdminAuth();
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [data, setData] = useState({
        logs: [],
        pagination: {
            total: 0,
            totalPages: 1
        },
        stats: {
            totalSearches: 0,
            topQueries: []
        }
    });

    const limit = 15;

    const fetchLogs = useCallback(async () => {
        if (!adminUser?.token) return;
        setLoading(true);
        try {
            const res = await getSearchAnalytics(adminUser.token, {
                page,
                limit,
                search: searchTerm,
                source: sourceFilter,
                startDate,
                endDate
            });
            if (res.success) {
                setData(res);
            }
        } catch (error) {
            console.error('Failed to load search logs', error);
            toast.error(error.message || 'Failed to load search analytics');
        } finally {
            setLoading(false);
        }
    }, [adminUser?.token, page, searchTerm, sourceFilter, startDate, endDate]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExport = async () => {
        if (!adminUser?.token) return;
        setExporting(true);
        try {
            const blob = await exportSearchAnalyticsExcel(adminUser.token, {
                search: searchTerm,
                source: sourceFilter,
                startDate,
                endDate
            });
            const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            const link = document.createElement('a');
            link.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `customer_searches_${dateStr}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Search report exported successfully to Excel!');
        } catch (error) {
            console.error('Export failed', error);
            toast.error('Failed to export search analytics');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="container-fluid py-6 bg-slate-50/30 min-h-screen px-4 md:px-6 max-w-7xl mx-auto font-sans text-slate-800">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">Customer Search Analytics</h1>
                    <p className="text-slate-500 text-xs mt-1 font-bold opacity-70 uppercase tracking-tight">
                        Track queries, discover customer demand, and export search intelligence
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl transition-all shadow-sm hover:border-blue-500 active:scale-95 text-slate-600 disabled:opacity-50"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting || loading}
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                    >
                        {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        <span>Export Excel (.xlsx)</span>
                    </button>
                </div>
            </div>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                        <Search size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Recorded Searches</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">{data.stats?.totalSearches || 0}</p>
                    </div>
                </div>

                <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={16} className="text-amber-500" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Customer Searches</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {data.stats?.topQueries?.length > 0 ? (
                            data.stats.topQueries.map((tq, idx) => (
                                <span
                                    key={idx}
                                    onClick={() => { setSearchTerm(tq.query); setPage(1); }}
                                    className="cursor-pointer px-3 py-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5"
                                >
                                    <span>{tq.query}</span>
                                    <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded-full font-black">{tq.count}</span>
                                </span>
                            ))
                        ) : (
                            <span className="text-xs text-slate-400 font-medium italic">No frequent search queries logged yet</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-3 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filter queries, customer name or email..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                        />
                    </div>

                    <select
                        value={sourceFilter}
                        onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                    >
                        <option value="">All Search Modes</option>
                        <option value="keyword">Standard Keyword</option>
                        <option value="ai">AI Search</option>
                    </select>

                    <div className="flex items-center gap-1.5">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                            className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                        />
                        <span className="text-slate-300 font-bold">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                            className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                {(searchTerm || sourceFilter || startDate || endDate) && (
                    <button
                        onClick={() => { setSearchTerm(''); setSourceFilter(''); setStartDate(''); setEndDate(''); setPage(1); }}
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors uppercase tracking-wider"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                                <th className="px-6 py-4">#</th>
                                <th className="px-6 py-4">Search Query</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4 text-center">Results</th>
                                <th className="px-6 py-4 text-center">Mode</th>
                                <th className="px-6 py-4 text-right">Date & Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="6" className="px-6 py-5">
                                            <div className="h-4 bg-slate-100 rounded w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : data.logs?.length > 0 ? (
                                data.logs.map((log, index) => (
                                    <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-slate-400 font-bold">{(page - 1) * limit + index + 1}</td>
                                        <td className="px-6 py-4 font-bold text-slate-900">
                                            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                {log.query}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.userName ? (
                                                <div>
                                                    <p className="font-bold text-slate-800">{log.userName}</p>
                                                    <p className="text-[10px] text-slate-400">{log.userEmail || ''}</p>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">Guest Customer</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${log.resultsCount > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                {log.resultsCount} found
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                {log.source === 'ai' ? 'AI Search' : 'Keyword'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-500 font-medium">
                                            {new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                                                <Search size={28} />
                                            </div>
                                            <p className="text-slate-400 font-bold uppercase text-[11px] tracking-widest">No customer search records found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && data.pagination?.total > 0 && (
                    <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Total {data.pagination.total} Searches logged
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs font-bold text-slate-700 px-2">
                                Page {page} of {data.pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                                disabled={page >= data.pagination.totalPages}
                                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchAnalytics;

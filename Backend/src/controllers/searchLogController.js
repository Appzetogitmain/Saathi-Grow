import SearchLog from '../models/SearchLog.js';
import XLSX from 'xlsx';

/**
 * @desc    Get paginated customer search logs with summary analytics
 * @route   GET /api/admin/search-logs
 * @access  Private (Admin only)
 */
export const getSearchLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            startDate,
            endDate,
            source
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        const query = {};

        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            query.$or = [
                { query: searchRegex },
                { userName: searchRegex },
                { userEmail: searchRegex }
            ];
        }

        if (source && ['keyword', 'ai'].includes(source)) {
            query.source = source;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const [logs, total, topQueriesAgg] = await Promise.all([
            SearchLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            SearchLog.countDocuments(query),
            SearchLog.aggregate([
                { $match: query },
                { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ])
        ]);

        const topQueries = topQueriesAgg.map(t => ({
            query: t._id,
            count: t.count
        }));

        res.json({
            success: true,
            logs,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1
            },
            stats: {
                totalSearches: total,
                topQueries
            }
        });
    } catch (error) {
        console.error('Error fetching search logs:', error);
        res.status(500).json({ message: 'Failed to fetch search logs', error: error.message });
    }
};

/**
 * @desc    Export customer search logs to an Excel (.xlsx) file
 * @route   GET /api/admin/search-logs/export
 * @access  Private (Admin only)
 */
export const exportSearchLogs = async (req, res) => {
    try {
        const {
            search = '',
            startDate,
            endDate,
            source
        } = req.query;

        const query = {};

        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            query.$or = [
                { query: searchRegex },
                { userName: searchRegex },
                { userEmail: searchRegex }
            ];
        }

        if (source && ['keyword', 'ai'].includes(source)) {
            query.source = source;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        // Cap to safe maximum rows (10,000) to protect server memory
        const logs = await SearchLog.find(query)
            .sort({ createdAt: -1 })
            .limit(10000)
            .lean();

        const excelRows = logs.map((log, index) => ({
            'S.No': index + 1,
            'Search Query': log.query || '',
            'Customer Name': log.userName || 'Guest User',
            'Customer Email': log.userEmail || 'N/A',
            'Results Found': log.resultsCount || 0,
            'Search Mode': log.source === 'ai' ? 'AI Search' : 'Keyword Search',
            'Date & Time (IST)': log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'
        }));

        const headers = ['S.No', 'Search Query', 'Customer Name', 'Customer Email', 'Results Found', 'Search Mode', 'Date & Time (IST)'];
        // Build Excel Workbook (ensure headers exist even on empty datasets)
        const worksheet = excelRows.length > 0
            ? XLSX.utils.json_to_sheet(excelRows)
            : XLSX.utils.aoa_to_sheet([headers]);
        // Set column widths for readability
        worksheet['!cols'] = [
            { wch: 6 },  // S.No
            { wch: 30 }, // Search Query
            { wch: 22 }, // Customer Name
            { wch: 28 }, // Customer Email
            { wch: 14 }, // Results Found
            { wch: 16 }, // Search Mode
            { wch: 24 }  // Date & Time
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Search Analytics');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `customer_searches_${dateStr}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
    } catch (error) {
        console.error('Error exporting search logs:', error);
        res.status(500).json({ message: 'Failed to export search logs', error: error.message });
    }
};

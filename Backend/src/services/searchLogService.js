import SearchLog from '../models/SearchLog.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Safely logs customer search query.
 * Must NEVER throw or block search responses.
 */
export const recordSearchLog = async (req, query, resultsCount = 0, source = 'keyword') => {
    try {
        if (!query || typeof query !== 'string') return;
        const trimmed = query.trim();
        if (trimmed.length < 2) return;

        let userId = req.user?._id || null;
        let userName = req.user?.name || null;
        let userEmail = req.user?.email || null;

        // If req.user is not populated yet, try decoding token safely
        if (!userId && req.headers?.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.decode(token);
                if (decoded?.id) {
                    userId = decoded.id;
                    const u = await User.findById(decoded.id).select('name email').lean();
                    if (u) {
                        userName = u.name || null;
                        userEmail = u.email || null;
                    }
                }
            } catch (_) {
                // Ignore token decode failure
            }
        }

        const sessionId = req.headers?.['x-session-id'] || null;

        await SearchLog.create({
            query: trimmed,
            userId,
            userName,
            userEmail,
            sessionId,
            resultsCount: Number(resultsCount) || 0,
            source
        });
    } catch (err) {
        // Silently capture logging error - search MUST continue to succeed
        console.warn('[SEARCH-LOG] Error recording search query:', err.message);
    }
};

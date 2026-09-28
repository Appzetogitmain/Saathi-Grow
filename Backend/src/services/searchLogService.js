import SearchLog from '../models/SearchLog.js';

/**
 * Safely logs customer search query.
 * Must NEVER throw or block search responses.
 */
export const recordSearchLog = async (req, query, resultsCount = 0, source = 'keyword') => {
    try {
        if (!query || typeof query !== 'string') return;
        const trimmed = query.trim();
        if (trimmed.length < 2) return;

        // Identity is populated only by optionalProtect, which verifies the JWT.
        const userId = req.user?._id || null;
        const userName = req.user?.name || null;
        const userEmail = req.user?.email || null;

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

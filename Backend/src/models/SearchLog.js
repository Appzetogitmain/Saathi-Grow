import mongoose from 'mongoose';

const searchLogSchema = new mongoose.Schema({
    query: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    userName: {
        type: String,
        default: null
    },
    userEmail: {
        type: String,
        default: null
    },
    sessionId: {
        type: String,
        default: null
    },
    resultsCount: {
        type: Number,
        default: 0
    },
    source: {
        type: String,
        enum: ['keyword', 'ai'],
        default: 'keyword'
    }
}, {
    timestamps: true
});

searchLogSchema.index({ createdAt: -1 });
searchLogSchema.index({ query: 1 });

const SearchLog = mongoose.model('SearchLog', searchLogSchema);
export default SearchLog;

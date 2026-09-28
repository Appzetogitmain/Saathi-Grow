import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield, Clock, AlertCircle } from 'lucide-react';
import { getPolicyContent } from '../../../../common/utils/legalUtils';

const LegalPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      const data = await getPolicyContent(slug, 'User');
      setPolicy(data);
      setLoading(false);
    };
    fetchContent();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--saathi-green)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <AlertCircle size={40} className="text-red-500" />
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">Policy Not Found</h2>
        <p className="text-gray-500 mb-6 max-w-xs uppercase text-[10px] font-bold tracking-widest">The legal document you are looking for does not exist or has been removed.</p>
        <button
          onClick={() => navigate(-1)}
          className="bg-black text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-b border-gray-100 dark:border-white/5 px-4 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-full transition-colors"
        >
          <ChevronLeft size={24} className="text-gray-900 dark:text-gray-100" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-sm font-black text-gray-900 dark:text-gray-100 line-clamp-1">{policy.title}</h1>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            <Clock size={10} />
            Updated {new Date(policy.updatedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </div>
        </div>
      </header>

      {/* Content Section */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
          <Shield size={14} className="text-[var(--saathi-green)]" />
          <span className="text-[10px] font-black text-[var(--saathi-green)] uppercase tracking-wider">Official Policy</span>
        </div>

        <div className="prose prose-sm max-w-none">
          {/* Basic rendering - if real markdown support is needed, use react-markdown */}
          <div
            className="legal-content text-gray-700 dark:text-gray-300 leading-relaxed font-medium space-y-4"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {policy.content}
          </div>
        </div>

        <div className="mt-12 py-8 border-t border-gray-100">
          <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-[0.2em]">
            © {new Date().getFullYear()} SaathiGro Platform. All Rights Reserved.
          </p>
        </div>
      </main>

      <style>{`
                .legal-content h1 { font-size: 1.5rem; font-weight: 900; color: currentColor; margin-top: 2rem; margin-bottom: 1rem; }
                .legal-content h2 { font-size: 1.25rem; font-weight: 800; color: currentColor; margin-top: 1.5rem; margin-bottom: 0.75rem; }
                .legal-content p { margin-bottom: 1rem; }
                .legal-content b, .legal-content strong { color: currentColor; font-weight: 700; opacity: 0.9; }
            `}</style>
    </div>
  );
};

export default LegalPage;

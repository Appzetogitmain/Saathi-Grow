import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield, FileText, ChevronRight, Info } from 'lucide-react';
import { getPoliciesList, getPolicyContent } from '../../../common/utils/legalUtils';

const LegalDocuments = () => {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchList = async () => {
      const list = await getPoliciesList('Delivery Partner');
      setPolicies(list);
      setLoading(false);
    };
    fetchList();
  }, []);

  const viewPolicy = async (slug) => {
    const data = await getPolicyContent(slug, 'Delivery Partner');
    setSelectedPage(data);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-[#028A0F] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (selectedPage) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <header className="sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-100 dark:border-zinc-800 p-4 flex items-center gap-4 z-40">
          <button onClick={() => setSelectedPage(null)} className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-xl text-slate-400 active:scale-90 transition-all">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-black text-slate-800 dark:text-zinc-100 tracking-tight">{selectedPage.title}</h1>
        </header>
        <div className="p-5 overflow-y-auto">
          <div
            className="text-gray-700 leading-relaxed font-medium"
            style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}
          >
            {selectedPage.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-10">
      <header className="flex items-center gap-4 py-2">
        <button onClick={() => navigate(-1)} className="p-2 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl text-slate-400 hover:text-[#028A0F] active:scale-90 transition-all shadow-sm">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-zinc-100 tracking-tight">Legal & Privacy</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Regulatory Compliance</p>
        </div>
      </header>

      <div className="bg-[#028A0F] rounded-[2rem] p-6 text-white mb-8 shadow-xl shadow-[#028A0F]/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Shield size={24} className="text-white/80" />
            <h2 className="text-xl font-black tracking-tight">Partner Trust</h2>
          </div>
          <p className="text-white/70 text-xs font-medium leading-relaxed">Your data security and operational transparency are our top priorities. Review our ecosystem policies below.</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 italic">Policy Fragments</h3>
        {policies.map(p => (
          <button
            key={p._id}
            onClick={() => viewPolicy(p.slug)}
            className="w-full bg-white dark:bg-zinc-900 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-zinc-800 shadow-sm active:scale-[0.98] transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-slate-50 dark:bg-zinc-800 text-slate-400 group-hover:text-[#028A0F] transition-colors rounded-xl font-bold">
                <FileText size={18} />
              </div>
              <div className="text-left">
                <span className="block font-black text-slate-800 dark:text-zinc-100 text-sm tracking-tight">{p.title}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Verified document</span>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-200" />
          </button>
        ))}
        {policies.length === 0 && (
          <div className="text-center py-10 bg-white rounded-xl border border-dashed">
            <Info size={32} className="text-gray-300 mb-2 mx-auto" />
            <p className="text-gray-500 text-sm">No documents found.</p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center px-4">
        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
          SaathiGro Delivery Partner Ecosystem
        </p>
      </div>
    </div>
  );
};

export default LegalDocuments;

import React from 'react';
import appLogo from '../../assets/logo_fav.png';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);

    const errorMessage = error?.message || '';
    if (
      errorMessage.includes('dynamically imported module') ||
      errorMessage.includes('Loading chunk') ||
      errorMessage.includes('Failed to fetch')
    ) {
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('last_chunk_reload', now.toString());
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem('last_chunk_reload');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-20 h-20 rounded-3xl bg-white shadow-md border border-slate-100 p-3 flex items-center justify-center mb-6">
            <img src={appLogo} alt="SaathiGro" className="w-full h-full object-contain" />
          </div>

          <h1 className="text-2xl font-black text-slate-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
            The app encountered an issue while loading. Please tap below to refresh and get the latest updates.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#0c831f] hover:bg-[#0a701a] text-white font-bold text-sm shadow-lg shadow-emerald-700/20 active:scale-95 transition-all cursor-pointer"
            >
              Refresh App
            </button>
            <button
              onClick={this.handleGoHome}
              className="w-full py-3 px-6 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-sm border border-slate-200 transition-all cursor-pointer"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

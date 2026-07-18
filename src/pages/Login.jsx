import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Play, Film, Settings } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Server settings configuration states
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('custom_api_url') || import.meta.env.VITE_API_URL || 'http://localhost:5000');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter the password.');
      return;
    }

    setError('');
    setLoading(true);
    
    // Automatically use 'admin' as the username in the backend request
    const result = await login('admin', password);
    setLoading(false);
    
    if (!result.success) {
      setError(result.error);
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    const cleanUrl = apiUrl.trim();
    if (!cleanUrl) {
      localStorage.removeItem('custom_api_url');
    } else {
      localStorage.setItem('custom_api_url', cleanUrl);
    }
    setShowSettings(false);
    window.location.reload(); // Reload to apply the new API base URL
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-dark-950 px-4 overflow-hidden">
      {/* Background blobs for premium depth */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Settings Gear Button */}
      <button 
        onClick={() => setShowSettings(true)}
        className="absolute top-4 right-4 p-3 rounded-full text-slate-400 hover:text-white transition duration-200 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 z-20 shadow-lg"
        title="Server Settings"
      >
        <Settings className="w-5 h-5 animate-hover-spin" />
      </button>

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl shadow-2xl relative z-10 fade-in border border-slate-800">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-brand-600 to-indigo-400 rounded-2xl flex items-center justify-center shadow-glow-brand mb-4">
            <Film className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Stream<span className="text-brand-500">m</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">Personal Self-Hosted Streaming Server</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2" htmlFor="password">
              Server Access Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full px-4 py-3 rounded-lg glass-input text-sm text-white"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <label className="flex items-center cursor-pointer select-none">
              <input type="checkbox" defaultChecked className="mr-2 accent-brand-500 rounded bg-slate-800 border-slate-700" />
              Remember session
            </label>
            <span className="hover:underline cursor-not-allowed">Forgot Password?</span>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold rounded-lg transition duration-200 shadow-glow-brand flex items-center justify-center space-x-2"
            disabled={loading}
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <Play className="w-4 h-4 fill-white" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-dark-900 border border-slate-800 p-6 rounded-2xl shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-500" />
              Server Connection
            </h2>
            <p className="text-slate-400 text-xs mb-6 leading-relaxed">
              If your PC server is running behind a Cloudflare Tunnel or using a dynamic address, paste your active URL below.
            </p>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">
                  Server URL / Address
                </label>
                <input
                  type="text"
                  placeholder="https://xxxxx.trycloudflare.com"
                  className="w-full px-4 py-3 rounded-lg glass-input text-sm text-white"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end mt-8">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold rounded-lg text-sm transition shadow-glow-brand"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

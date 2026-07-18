import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Play, Film } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);
    
    const result = await login(username, password);
    setLoading(false);
    
    if (!result.success) {
      setError(result.error);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-dark-950 px-4 overflow-hidden">
      {/* Background blobs for premium depth */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />

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
            <label className="block text-slate-300 text-sm font-semibold mb-2" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="w-full px-4 py-3 rounded-lg glass-input text-sm"
              placeholder="Enter administrator username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full px-4 py-3 rounded-lg glass-input text-sm"
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
    </div>
  );
}

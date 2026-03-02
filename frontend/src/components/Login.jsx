import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function Login({ onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      await login(email, password);
      showToast('Signed in', 'success');
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Invalid email or password';
      setError(msg); showToast(msg, 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0a' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10 border-r" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div>
          <div className="flex items-center gap-2.5 mb-16">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#fff' }}>
              <svg className="w-4 h-4" fill="#0a0a0a" viewBox="0 0 24 24"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 5h2v-2h2v2h2v2h-2v2h-2v-2h-2v-2z"/></svg>
            </div>
            <span className="font-bold text-white tracking-tight">Collab Board</span>
          </div>

          <div className="space-y-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#555' }}>What's inside</p>
              {[
                { n: '01', t: 'Real-time canvas', d: 'Draw with your team, instantly synced.' },
                { n: '02', t: 'Voice rooms', d: 'Talk while you work, no switching apps.' },
                { n: '03', t: 'Persistent chat', d: 'Keep context alongside the board.' },
              ].map(item => (
                <div key={item.n} className="flex gap-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <span className="mono text-xs pt-0.5" style={{ color: '#444' }}>{item.n}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.t}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#666' }}>{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs" style={{ color: '#444' }}>Up to 6 collaborators per room.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Sign in</h1>
            <p className="text-sm" style={{ color: '#666' }}>Welcome back to your workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#888' }}>EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-base w-full rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#888' }}>PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-base w-full rounded-lg px-4 py-3 text-sm"
              />
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full rounded-lg py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : null}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="divider my-6" />

          <p className="text-sm text-center" style={{ color: '#555' }}>
            No account?{' '}
            <button onClick={onSwitchToRegister} className="text-white font-semibold hover:opacity-70 t">
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
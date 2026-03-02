import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function Register({ onSwitchToLogin }) {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const { showToast } = useToast();

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim() || !formData.confirmPassword.trim()) {
      setError('Please fill in all fields'); return;
    }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return; }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true); setError('');
    try {
      await register(formData.email, formData.password, formData.confirmPassword, formData.name);
      showToast('Account created', 'success');
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Registration failed';
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

          <div>
            <p className="text-3xl font-bold text-white leading-snug mb-4">
              Build ideas live<br />with your team.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#666' }}>
              Create an account to launch rooms, draw in real-time, talk over voice, and keep chat in sync.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { label: 'Rooms', val: 'Private & secure' },
                { label: 'Canvas', val: 'Live sync' },
                { label: 'Voice', val: 'Built-in' },
                { label: 'Chat', val: 'Persistent' },
              ].map(item => (
                <div key={item.label} className="rounded-lg p-3" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-xs mb-1" style={{ color: '#555' }}>{item.label}</p>
                  <p className="text-sm font-semibold text-white">{item.val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs" style={{ color: '#444' }}>Max 6 users per room.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Create account</h1>
            <p className="text-sm" style={{ color: '#666' }}>Set up your profile in seconds.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#888' }}>FULL NAME</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe"
                className="input-base w-full rounded-lg px-4 py-3 text-sm" maxLength={100} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#888' }}>EMAIL</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com"
                className="input-base w-full rounded-lg px-4 py-3 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#888' }}>PASSWORD</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Min 6 chars"
                  className="input-base w-full rounded-lg px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#888' }}>CONFIRM</label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Repeat"
                  className="input-base w-full rounded-lg px-4 py-3 text-sm" />
              </div>
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
              {loading && <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="divider my-6" />

          <p className="text-sm text-center" style={{ color: '#555' }}>
            Already have an account?{' '}
            <button onClick={onSwitchToLogin} className="text-white font-semibold hover:opacity-70 t">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
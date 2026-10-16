import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useCurrentUser, useSession } from '../lib/session';

const DEMO = [
  ['admin@opshub.io',   'admin123',   'Admin',   'Full access — all sites & builder'],
  ['manager@opshub.io', 'manager123', 'Manager', 'Manager — all 3 sites'],
  ['member@opshub.io',  'member123',  'Member',  'Read / request only'],
  ['stores@opshub.io',  'stores123',  'Manager', 'Central Stores only'],
  ['tech@opshub.io',    'tech123',    'Manager', 'Service Centre only'],
];

const ROLE_PILL = {
  Admin:   { bg: 'var(--primary)',     color: 'var(--primary-foreground)' },
  Manager: { bg: 'var(--success)',     color: 'oklch(0.12 0.04 155)' },
  Member:  { bg: 'var(--secondary)',   color: 'var(--muted-foreground)' },
};

export default function Login() {
  const user = useCurrentUser();
  const nav  = useNavigate();
  const setToken = useSession((s) => s.setToken);

  const [email, setEmail] = useState('');
  const [pw,    setPw]    = useState('');
  const [err,   setErr]   = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const fill = (e, p) => { setEmail(e); setPw(p); setErr(''); };

  const submit = async (ev) => {
    ev.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const r = await api('POST', '/api/auth/login', { email, password: pw });
      setToken(r.token);
      nav('/');
    } catch (x) {
      setErr(x.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            ◈
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>OpsHub</h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>One login. Every operations site.</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {/* Email / Password form */}
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="lbl">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="lbl">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
              />
            </div>
            {err && (
              <p className="text-sm" style={{ color: 'var(--destructive)' }}>{err}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing in…' : '🔐 Sign in to the hub'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Demo accounts</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* Demo user picker */}
          <div className="space-y-2">
            {DEMO.map(([e, p, role, desc]) => (
              <button
                key={e}
                type="button"
                onClick={() => fill(e, p)}
                className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors"
                style={{
                  background: email === e ? 'oklch(0.82 0.16 85 / 10%)' : 'var(--secondary)',
                  border: `1px solid ${email === e ? 'oklch(0.82 0.16 85 / 50%)' : 'var(--border)'}`,
                }}
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{e}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{desc}</div>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-3 shrink-0"
                  style={ROLE_PILL[role] ?? ROLE_PILL.Member}
                >
                  {role}
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Roles and access are assigned separately for each site.
        </p>
      </div>
    </div>
  );
}

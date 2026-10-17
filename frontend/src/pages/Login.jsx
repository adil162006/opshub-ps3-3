import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Authcontext';

const FEATURES = [
  { icon: '⚡', text: 'Live visibility' },
  { icon: '🛡️', text: 'Role-based access' },
  { icon: '✓', text: 'Fewer handoffs' },
];

const METRICS = [
  { label: 'Active Sites', value: '03', detail: 'All sites operational', accent: true },
  { label: 'Pending Requests', value: '12', detail: '4 require approval', accent: false },
  { label: 'Inventory Alerts', value: '04', detail: '2 low stock items', accent: false },
];

const ACTIVITY = [
  { text: 'Stock updated', site: 'Central Stores', time: '2m ago', color: 'var(--success)' },
  { text: 'Request approved', site: 'Service Centre', time: '8m ago', color: 'var(--primary)' },
  { text: 'Shipment dispatched', site: 'Distribution Hub', time: '14m ago', color: 'oklch(0.70 0.14 250)' },
  { text: 'New user added', site: 'Central Stores', time: '22m ago', color: 'var(--muted-foreground)' },
];

const SITES = [
  { name: 'Central Stores', status: 'online', latency: '18ms' },
  { name: 'Service Centre', status: 'online', latency: '24ms' },
  { name: 'Distribution Hub', status: 'syncing', latency: 'Sync' },
];

export default function Login() {
  const { user, loading: sessionLoading, error: authError, login } = useAuth();
  const nav  = useNavigate();

  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [err, setErr]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw]   = useState(false);

  if (user) return <Navigate to="/" replace />;
  if (sessionLoading) return <div className="p-10 text-foreground">Checking your session…</div>;

  const submit = async (ev) => {
    ev.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      await login(email, pw);
      nav('/');
    } catch (x) {
      const verification = x.response?.data?.details?.find?.((detail) => detail.code === 'PHONE_NOT_VERIFIED');
      if (verification) {
        nav(`/verify-phone?phone=${encodeURIComponent(verification.phoneNumber || '')}`);
        return;
      }
      setErr(x.response?.data?.message || x.response?.data?.error || x.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      {/* ── Left hero panel (hidden on mobile) ── */}
      <div className="login-hero">
        {/* Logo */}
        <div className="login-hero__brand">
          <div className="login-hero__logo">◈</div>
          <div>
            <div className="login-hero__title">OpsHub</div>
            <div className="login-hero__subtitle">One login. Every operations site.</div>
          </div>
        </div>

        {/* Hero copy + dashboard preview */}
        <div className="login-hero__copy">
          {/* Badge + heading + desc */}
          <div className="login-hero__text">
            <div className="login-hero__badge">
              <span className="login-hero__badge-dot" />
              Operations, connected
            </div>
            <h1 className="login-hero__heading">
              Keep every site moving{' '}
              <span className="login-hero__heading--accent">forward.</span>
            </h1>
            <p className="login-hero__desc">
              One calm command center for inventory, requests, approvals, and the people who make your operation work.
            </p>
          </div>

          {/* ── Mini dashboard preview ── */}
          <div className="hero-dash">
            {/* Metric cards row */}
            <div className="hero-dash__metrics">
              {METRICS.map((m) => (
                <div key={m.label} className="hero-dash__metric">
                  <div className={`hero-dash__metric-value${m.accent ? ' hero-dash__metric-value--accent' : ''}`}>
                    {m.value}
                  </div>
                  <div className="hero-dash__metric-label">{m.label}</div>
                  <div className="hero-dash__metric-detail">{m.detail}</div>
                </div>
              ))}
            </div>

            {/* Bottom row: activity feed + site status */}
            <div className="hero-dash__row">
              {/* Activity feed */}
              <div className="hero-dash__feed">
                <div className="hero-dash__feed-header">
                  <span className="hero-dash__feed-title">Recent Activity</span>
                  <span className="hero-dash__feed-badge">Live feed</span>
                </div>
                <div className="hero-dash__feed-list">
                  {ACTIVITY.map((a, i) => (
                    <div key={i} className="hero-dash__feed-item">
                      <span className="hero-dash__feed-dot" style={{ background: a.color }} />
                      <div className="hero-dash__feed-content">
                        <span className="hero-dash__feed-text">{a.text}</span>
                        <span className="hero-dash__feed-site">{a.site}</span>
                      </div>
                      <span className="hero-dash__feed-time">{a.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Site status */}
              <div className="hero-dash__sites">
                <div className="hero-dash__sites-header">
                  <span>Connected Sites</span>
                  <span className="hero-dash__sites-count">3/3</span>
                </div>
                <div className="hero-dash__sites-list">
                  {SITES.map((s) => (
                    <div key={s.name} className="hero-dash__site-row">
                      <span className={`hero-dash__site-dot hero-dash__site-dot--${s.status}`} />
                      <span className="hero-dash__site-name">{s.name}</span>
                      <span className="hero-dash__site-latency">{s.latency}</span>
                      <span className={`hero-dash__site-status hero-dash__site-status--${s.status}`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Mini network visualization */}
                <div className="hero-dash__network">
                  <svg viewBox="0 0 220 74" className="hero-dash__network-svg">
                    <defs>
                      <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--success)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.6" />
                      </linearGradient>
                    </defs>

                    {/* Connecting links */}
                    <line x1="110" y1="36" x2="38" y2="20" stroke="oklch(1 0 0 / 14%)" strokeWidth="1.5" />
                    <line x1="110" y1="36" x2="38" y2="54" stroke="oklch(1 0 0 / 14%)" strokeWidth="1.5" />
                    <line x1="110" y1="36" x2="182" y2="36" stroke="oklch(1 0 0 / 14%)" strokeWidth="1.5" strokeDasharray="3 3" />

                    {/* Active data packet pulses */}
                    <circle r="2.2" fill="var(--success)">
                      <animateMotion path="M 38 20 L 110 36" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                    <circle r="2.2" fill="var(--success)">
                      <animateMotion path="M 38 54 L 110 36" dur="3s" repeatCount="indefinite" />
                    </circle>
                    <circle r="2.2" fill="var(--primary)">
                      <animateMotion path="M 110 36 L 182 36" dur="2s" repeatCount="indefinite" />
                    </circle>

                    {/* Hub pulse ring */}
                    <circle cx="110" cy="36" r="8" fill="none" stroke="var(--primary)" strokeWidth="1.5" opacity="0.4">
                      <animate attributeName="r" values="8;20;8" dur="2.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0;0.6" dur="2.8s" repeatCount="indefinite" />
                    </circle>

                    {/* Site 1: Stores */}
                    <circle cx="38" cy="20" r="5" fill="var(--success)" />
                    <text x="38" y="10" textAnchor="middle" fill="var(--muted-foreground)" fontSize="8" fontWeight="500">Stores</text>

                    {/* Site 2: Service */}
                    <circle cx="38" cy="54" r="5" fill="var(--success)" />
                    <text x="38" y="67" textAnchor="middle" fill="var(--muted-foreground)" fontSize="8" fontWeight="500">Service</text>

                    {/* Site 3: Distribution */}
                    <circle cx="182" cy="36" r="5" fill="var(--primary)" />
                    <text x="182" y="52" textAnchor="middle" fill="var(--muted-foreground)" fontSize="8" fontWeight="500">Dist</text>

                    {/* Center Hub Node */}
                    <circle cx="110" cy="36" r="8" fill="var(--primary)" />
                    <circle cx="110" cy="36" r="3.5" fill="var(--primary-foreground)" />
                    <text x="110" y="23" textAnchor="middle" fill="var(--foreground)" fontSize="8.5" fontWeight="600">OpsHub</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="login-hero__bottom">
          <div className="login-hero__features">
            {FEATURES.map((f) => (
              <span key={f.text} className="login-hero__feature-pill">
                <span>{f.icon}</span> {f.text}
              </span>
            ))}
          </div>
          <p className="login-hero__footer">Built for teams that keep things moving.</p>
        </div>
      </div>

      {/* ── Right login card panel ── */}
      <div className="login-card-panel">
        <div className="login-card">
          <h2 className="login-card__title">Welcome back</h2>
          <p className="login-card__desc">Sign in to continue to your operations hub.</p>

          {/* Form */}
          <form onSubmit={submit} className="login-card__form">
            <div className="login-card__field">
              <label className="login-card__label">EMAIL ADDRESS</label>
              <input
                className="login-card__input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="login-card__field">
              <label className="login-card__label">PASSWORD</label>
              <div className="login-card__pw-wrap">
                <input
                  className="login-card__input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-card__pw-toggle"
                  onClick={() => setShowPw(!showPw)}
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {(err || authError) && <p className="login-card__error">{err || authError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="login-card__submit"
              style={{ opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Signing in…' : 'Sign in to OpsHub →'}
            </button>
          </form>

          {/* Footer */}
          <p className="login-card__footer">
            🔒 Secure access for your operations team
          </p>
        </div>
      </div>
    </div>
  );
}
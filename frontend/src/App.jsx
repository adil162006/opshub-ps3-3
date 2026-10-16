import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Toaster } from './ui';
import { useAuth } from './context/Authcontext';
import { getSites, SITES_QUERY_KEY } from './api/site.api';
import Login from './pages/Login';
import Hub from './pages/Hub';
import SiteRoute from './pages/SiteRoute';
import { BuilderEditor, BuilderIndex } from './pages/Builder';
import Users from './pages/Users';
import Catalogue from './pages/Catalogue';
import Tests from './pages/Tests';
import Settings from './pages/Settings';

function Shell({ admin, children }) {
  const { user, loading, error: authError, logout } = useAuth(); const nav = useNavigate();
  const { pathname } = useLocation();
  const { data: sites = [], isLoading: sitesLoading, error: sitesError } = useQuery({
    queryKey: SITES_QUERY_KEY,
    queryFn: getSites,
    enabled: !!user,
  });
  const accessibleSites = sites.filter((site) => site.role);
  if (loading) return <div className="p-10 text-foreground">Loading your session…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'Admin') return <div className="p-10 text-foreground">Admins only.</div>;
  const cur = pathname.match(/^\/(?:s|preview)\/([^/]+)/)?.[1] || '';
  const L = (to, t) => (
    <NavLink
      to={to}
      end
      className="px-2.5 py-1 rounded-md text-sm transition-colors"
      style={({ isActive }) => ({
        background: isActive ? 'var(--primary)' : 'transparent',
        color: isActive ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
      })}
    >
      {t}
    </NavLink>
  );
  return (
    <>
      <header
        className="h-12 px-4 flex items-center gap-3"
        style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
      >
        <Link to="/" className="font-bold tracking-tight text-foreground flex items-center gap-1.5">
          ◈ OpsHub
        </Link>
        <select
          aria-label="Switch site"
          className="text-sm rounded-md px-2 py-1"
          style={{ background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          value={cur}
          onChange={(e) => { const slug = e.currentTarget.value; if (slug && slug !== cur) nav(`/s/${slug}`); }}
        >
          <option value="">Switch site…</option>
          {accessibleSites.map((site) => (
            <option key={site.id} value={site.slug}>{site.name} · {site.role}</option>
          ))}
        </select>
        {sitesLoading && <span className="text-xs muted">Loading sites…</span>}
        <nav className="flex gap-1">
          {L('/', 'Hub')}
          {L('/catalogue', 'Catalogue')}
          {user.role === 'Admin' && (
            <>
              {L('/builder', 'Builder')}
              {L('/users', 'Users')}
            </>
          )}
        </nav>
        <div className="ml-auto text-sm flex items-center gap-3">
          <span style={{ color: 'var(--muted-foreground)' }}>
            {user.name} · {user.role === 'Admin' ? 'Admin' : 'User'}
          </span>
          <button
            className="px-2.5 py-1 rounded-md text-sm transition-colors"
            style={{ background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            onClick={async () => { if (await logout()) nav('/login'); }}
          >
            Sign out
          </button>
        </div>
      </header>
      {authError && <div role="alert" className="px-4 py-2 text-sm text-red-400">{authError}</div>}
      {sitesError && <div role="alert" className="px-4 py-2 text-sm text-red-400">Could not load your sites: {sitesError.message}</div>}
      {children}
    </>
  );
}

const PreviewKeyed = () => { const { slug } = useParams(); return <SiteRoute key={slug} preview />; };
const SiteShell = () => { const { slug } = useParams(); return <Shell key={slug}><SiteRoute key={slug} /></Shell>; };

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Shell><Hub /></Shell>} />
        <Route path="/s/:slug/*" element={<SiteShell />} />
        <Route path="/preview/:slug/*" element={<Shell admin><PreviewKeyed /></Shell>} />
        <Route path="/builder" element={<Shell><BuilderIndex /></Shell>} />
        <Route path="/builder/:slug" element={<Shell><BuilderEditor /></Shell>} />
        <Route path="/users" element={<Shell admin><Users /></Shell>} />
        <Route path="/catalogue" element={<Shell><Catalogue /></Shell>} />
        <Route path="/tests" element={<Shell admin><Tests /></Shell>} />
        <Route path="/settings" element={<Shell admin><Settings /></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

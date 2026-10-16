import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Toaster } from './ui';
import { useCurrentUser, useSession } from './lib/session';
import { apiSync } from './lib/api';
import { useDB } from './lib/db';
import Login from './pages/Login';
import Hub from './pages/Hub';
import SiteRoute from './pages/SiteRoute';
import { BuilderEditor, BuilderIndex } from './pages/Builder';
import Users from './pages/Users';
import Catalogue from './pages/Catalogue';
import Tests from './pages/Tests';
import Settings from './pages/Settings';

function Shell({ admin, children }) {
  const user = useCurrentUser(); const setToken = useSession((s) => s.setToken); const nav = useNavigate();
  const { pathname } = useLocation();
  useDB((s) => s.sites);
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'Admin') return <div className="p-10 text-white">Admins only.</div>;
  const sites = apiSync('GET', '/api/sites'); const cur = pathname.match(/^\/(?:s|preview)\/([^/]+)/)?.[1] || '';
  const L = (to, t) => <NavLink to={to} end className="px-2.5 py-1 rounded-md text-sm" style={({ isActive }) => ({ background: isActive ? 'rgba(255,255,255,.18)' : 'transparent' })}>{t}</NavLink>;
  return (
    <>
      <header className="h-12 px-4 flex items-center gap-3 text-white" style={{ background: '#0b1020', borderBottom: '1px solid #1f2a44' }}>
        <Link to="/" className="font-bold tracking-tight">◈ OpsHub</Link>
        <select aria-label="Switch site" className="text-sm rounded-md px-2 py-1 text-white" style={{ background: '#1b2542', border: '1px solid #2c3a63' }} value={cur} onChange={(e) => { const slug = e.currentTarget.value; if (slug && slug !== cur) nav(`/s/${slug}`); }}>
          <option value="">Switch site…</option>{sites.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}</select>
        {/* <nav className="flex gap-1">{L('/', 'Hub')}{L('/catalogue', 'Catalogue')}{user.role === 'Admin' && <>{L('/builder', 'Builder')}{L('/users', 'Users')}{L('/tests', 'Tests')}{L('/settings', 'Backup')}</>}</nav> */}
        <nav className="flex gap-1">{L('/', 'Hub')}</nav>
        <div className="ml-auto text-sm flex items-center gap-3"><span className="opacity-70">{user.name} · {user.role === 'Admin' ? 'Admin' : 'User'}</span><button className="px-2 py-1 rounded-md" style={{ background: '#1b2542' }} onClick={() => { setToken(null); nav('/login'); }}>Sign out</button></div>
      </header>
      {children}
    </>);
}
const PreviewKeyed = () => { const { slug } = useParams(); return <SiteRoute key={slug} preview />; };
const SiteShell = () => { const { slug } = useParams(); return <Shell key={slug}><SiteRoute key={slug} /></Shell>; };

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Shell><Hub /></Shell>} />
        <Route path="/s/:slug/*" element={<SiteShell />} />
        <Route path="/preview/:slug/*" element={<Shell admin><PreviewKeyed /></Shell>} />
        <Route path="/builder" element={<Shell admin><BuilderIndex /></Shell>} />
        <Route path="/builder/:slug" element={<Shell admin><BuilderEditor /></Shell>} />
        <Route path="/users" element={<Shell admin><Users /></Shell>} />
        <Route path="/catalogue" element={<Shell><Catalogue /></Shell>} />
        <Route path="/tests" element={<Shell admin><Tests /></Shell>} />
        <Route path="/settings" element={<Shell admin><Settings /></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </HashRouter>);
}

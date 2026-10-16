import { useMemo } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useDB } from '../lib/db';
import { useCurrentUser } from '../lib/session';
import { apiSync, makeApi } from '../lib/api';
import { DEFAULT_THEME, pagesOf } from '../lib/registry';
import { Access, Dashboard, Members } from '../views/Core';
import { InventoryView } from '../views/Stock';
import { ApprovalView, AssignmentCards, AssignmentView, ConsumptionView, RequestView, ReturnsView } from '../views/Workflow';
import { RepairView } from '../views/Repair';
import { AnalyticsView, ReportsView } from '../views/Insights';

const VIEWS = { shell: Dashboard, auth: Access, users: Members, inventory: InventoryView, request: RequestView, approval: ApprovalView, assignment: AssignmentView, assignmentUi: AssignmentCards, consumption: ConsumptionView, returns: ReturnsView, repair: RepairView, analytics: AnalyticsView, reports: ReportsView };
const FONTS = { Inter: 'Inter, system-ui, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' };

export default function SiteRoute({ preview = false }) {
  const { slug, '*': sub } = useParams();
  const sites = useDB((s) => s.sites); const users = useDB((s) => s.users);
  const user = useCurrentUser();
  const site = sites.find((s) => s.slug === slug);
  const state = useMemo(() => {
    if (!site) return { error: 'Site not found' };
    try {
      const v = apiSync('GET', `/api/sites/${site.id}`, null, { preview });
      const base = `${preview ? '/preview' : '/s'}/${slug}`;
      return { ctx: { site: { ...v.site }, config: v.config, role: v.role, theme: { ...DEFAULT_THEME, ...v.config.theme }, preview, user, base, api: makeApi(site.id, preview) } };
    } catch (e) { return { error: e.message }; }
  }, [site, users, user, preview, slug]);
  if (state.error) return <div className="themed p-10 text-center" style={{ minHeight: 'calc(100vh - 48px)', background: '#f6f7fb' }}><div className="text-5xl mb-2">🔒</div><h1 className="text-lg font-semibold">{state.error}</h1></div>;
  const { ctx } = state; const t = ctx.theme; const dark = t.mode === 'dark';
  const style = { '--primary': t.primary, '--accent': t.accent, '--radius': `${t.radius}px`, '--bg': dark ? '#0b1220' : '#f6f7fb', '--card': dark ? '#131c2e' : '#ffffff', '--fg': dark ? '#e5e7eb' : '#0f172a', '--muted': dark ? '#94a3b8' : '#64748b', '--border': dark ? '#243049' : '#e5e7eb', fontFamily: FONTS[t.font] || FONTS.Inter, minHeight: 'calc(100vh - 48px)' };
  const pages = pagesOf(ctx.config);
  const page = pages.find((p) => p.path === (sub || ''));
  const View = page ? VIEWS[page.type] : null;
  const link = (p) => <NavLink key={p.path} end to={`${ctx.base}/${p.path}`.replace(/\/$/, '')} className={t.layout === 'sidebar' ? 'block px-3 py-2 rounded-lg text-sm' : 'px-3 py-1.5 rounded-full text-sm whitespace-nowrap'} style={({ isActive }) => (isActive ? { background: 'var(--primary)', color: '#fff' } : { color: 'var(--fg)' })}>{p.icon} {p.title}</NavLink>;
  const body = View ? <View ctx={ctx} /> : <div className="p-10 text-center muted">This page is not part of this site’s navigation.</div>;
  return (
    <div className={`themed ${t.density === 'compact' ? 'compact' : ''}`} style={style}>
      {preview && <div className="px-4 py-1.5 text-sm text-center font-medium" style={{ background: '#fde68a', color: '#78350f' }}>PREVIEW — unpublished draft. Publish in the Builder to make it live.</div>}
      {t.layout === 'sidebar' ? (
        <div className="flex">
          <aside className="w-56 shrink-0 p-3 space-y-1 border-r" style={{ borderColor: 'var(--border)', background: 'var(--card)', minHeight: 'calc(100vh - 80px)' }}>
            <div className="px-3 py-3 mb-2"><div className="font-bold" style={{ color: 'var(--primary)' }}>{ctx.site.name}</div><div className="text-xs muted">v{ctx.site.live} · {ctx.role}</div></div>
            {pages.map(link)}
          </aside>
          <main className="flex-1 min-w-0">{body}</main>
        </div>
      ) : (
        <>
          <header className="px-6 py-3 flex items-center gap-4 flex-wrap border-b" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <div className="font-bold text-lg" style={{ color: 'var(--primary)' }}>{ctx.site.name}</div>
            <nav className="flex gap-1 flex-wrap">{pages.map(link)}</nav>
            <span className="ml-auto text-xs muted">v{ctx.site.live} · {ctx.role}</span>
          </header>
          <main>{body}</main>
        </>
      )}
    </div>);
}

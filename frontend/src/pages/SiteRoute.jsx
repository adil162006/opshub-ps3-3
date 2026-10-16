import { useMemo } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
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

  if (state.error) return (
    <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 'calc(100vh - 48px)', background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="text-5xl mb-3">🔒</div>
      <h1 className="text-lg font-semibold">{state.error}</h1>
    </div>
  );

  const { ctx } = state; const t = ctx.theme;
  const primary = t.primary || 'oklch(0.82 0.16 85)';

  // Always dark base; per-site primary/accent colors layer on top
  const style = {
    '--primary': primary,
    '--accent': t.accent || primary,
    '--radius': `${t.radius ?? 10}px`,
    '--bg': 'var(--background)',
    '--card': 'var(--card)',
    '--fg': 'var(--foreground)',
    '--muted': 'var(--muted-foreground)',
    '--border': 'var(--border)',
    fontFamily: FONTS[t.font] || FONTS.Inter,
    minHeight: 'calc(100vh - 48px)',
    background: 'var(--background)',
    color: 'var(--foreground)',
  };

  const pages = pagesOf(ctx.config);
  const page = pages.find((p) => p.path === (sub || ''));
  const View = page ? VIEWS[page.type] : null;

  const navLink = (p) => (
    <NavLink
      key={p.path}
      end
      to={`${ctx.base}/${p.path}`.replace(/\/$/, '')}
      className={t.layout === 'sidebar'
        ? 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors'
        : 'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors'}
      style={({ isActive }) => isActive
        ? { background: primary, color: '#fff' }
        : { color: 'var(--muted-foreground)' }}
    >
      {p.icon} {p.title}
    </NavLink>
  );

  const body = View
    ? <View ctx={ctx} />
    : <div className="p-10 text-center" style={{ color: 'var(--muted-foreground)' }}>This page is not part of this site's navigation.</div>;

  return (
    <div className={t.density === 'compact' ? 'compact' : ''} style={style}>
      {preview && (
        <div className="px-4 py-1.5 text-sm text-center font-medium" style={{ background: 'oklch(0.82 0.16 85 / 20%)', color: 'oklch(0.82 0.16 85)' }}>
          PREVIEW — unpublished draft. Publish in the Builder to make it live.
        </div>
      )}

      {t.layout === 'sidebar' ? (
        <div className="flex">
          {/* Sidebar */}
          <aside
            className="w-56 shrink-0 flex flex-col"
            style={{ background: 'var(--card)', borderRight: '1px solid var(--border)', minHeight: 'calc(100vh - 48px)' }}
          >
            {/* Hub switcher */}
            <div className="px-3 pt-4 pb-2">
              <Link
                to="/"
                className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80 mb-4"
                style={{ color: 'var(--muted-foreground)' }}
              >
                ← Hub switcher
              </Link>
              {/* Site identity */}
              <div className="flex items-center gap-2.5 px-1 mb-2">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-base shrink-0"
                  style={{ background: `${primary}30`, color: primary }}
                >
                  {ctx.site.icon || '◈'}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: 'var(--foreground)' }}>{ctx.site.name}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>/{ctx.site.slug || slug}</div>
                </div>
              </div>
            </div>

            {/* Separator */}
            <div style={{ height: 1, background: 'var(--border)', margin: '0 12px 8px' }} />

            {/* Nav */}
            <nav className="flex flex-col gap-0.5 px-2 pb-4">
              {pages.map(navLink)}
            </nav>

            {/* Footer */}
            <div className="mt-auto px-4 py-3">
              <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                v{ctx.site.live} deployed · {ctx.role}
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0" style={{ background: 'var(--background)' }}>{body}</main>
        </div>
      ) : (
        <>
          <header
            className="px-6 py-3 flex items-center gap-4 flex-wrap"
            style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}
          >
            <Link to="/" className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>← Hub</Link>
            <div className="font-bold text-lg" style={{ color: primary }}>{ctx.site.name}</div>
            <nav className="flex gap-1 flex-wrap">{pages.map(navLink)}</nav>
            <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)' }}>v{ctx.site.live} · {ctx.role}</span>
          </header>
          <main style={{ background: 'var(--background)' }}>{body}</main>
        </>
      )}
    </div>
  );
}

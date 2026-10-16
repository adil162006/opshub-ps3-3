import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { useAuth } from '../context/Authcontext';
import { getSite, getSites, SITES_QUERY_KEY } from '../api/site.api';
import { useSiteStore } from '../store/site.store';
import { makeApi } from '../lib/api';
import { makeHttpSiteApi } from '../api/siteData.api';
import { DEFAULT_THEME, pagesOf } from '../lib/registry';
import { Access, Dashboard } from '../views/Core';
import SiteMembers from './SiteMembers';
import { InventoryView } from '../views/Stock';
import { ApprovalView, AssignmentCards, AssignmentView, ConsumptionView, RequestView, ReturnsView } from '../views/Workflow';
import { RepairView } from '../views/Repair';
import { AnalyticsView, ReportsView } from '../views/Insights';

const VIEWS = { shell: Dashboard, auth: Access, users: SiteMembers, inventory: InventoryView, request: RequestView, approval: ApprovalView, assignment: AssignmentView, assignmentUi: AssignmentCards, consumption: ConsumptionView, returns: ReturnsView, repair: RepairView, analytics: AnalyticsView, reports: ReportsView };
const FONTS = { Inter: 'Inter, system-ui, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' };

export default function SiteRoute({ preview = false }) {
  const { slug, '*': sub } = useParams();
  const { user } = useAuth();
  const { data: sites = [], isLoading: sitesLoading, error: sitesError } = useQuery({
    queryKey: SITES_QUERY_KEY,
    queryFn: getSites,
  });
  const activeSite = useSiteStore((state) => state.activeSite);
  const setActiveSite = useSiteStore((state) => state.setActiveSite);
  const queryClient = useQueryClient();
  const remoteSite = sites.find((candidate) => candidate.slug === slug);
  const { data: siteData, isLoading: siteLoading, error: siteError } = useQuery({
    queryKey: ['site', remoteSite?.id, preview],
    queryFn: () => getSite(remoteSite.id, preview),
    enabled: !!remoteSite,
  });

  const theme = useMemo(() => {
    const backendTheme = siteData?.config?.theme || remoteSite?.theme || {};
    return {
      ...DEFAULT_THEME,
      ...backendTheme,
      primary: backendTheme.primary || backendTheme.primaryColor || DEFAULT_THEME.primary,
      accent: backendTheme.accent || backendTheme.accentColor || backendTheme.primaryColor || DEFAULT_THEME.accent,
      radius: backendTheme.radius ?? (Number.parseFloat(backendTheme.borderRadius) || DEFAULT_THEME.radius),
      font: backendTheme.font || backendTheme.fontFamily || DEFAULT_THEME.font,
    };
  }, [remoteSite?.theme, siteData?.config?.theme]);

  useEffect(() => {
    if (remoteSite && siteData) {
      setActiveSite({ id: remoteSite.id, slug: remoteSite.slug, theme });
    }
  }, [remoteSite, setActiveSite, siteData, theme]);

  const state = useMemo(() => {
    if (!remoteSite) return { error: 'Site not found or you do not have access to it' };
    if (!siteData) return {};
    if (preview && siteData.role !== 'Admin') return { error: 'Preview is Admin only' };
    const base = `${preview ? '/preview' : '/s'}/${slug}`;
    return {
      ctx: {
        site: { ...siteData.site, live: remoteSite.live },
        config: siteData.config,
        role: siteData.role,
        theme: activeSite?.id === remoteSite.id ? activeSite.theme : theme,
        preview,
        user,
        base,
        api: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(remoteSite.id)
          ? makeHttpSiteApi(remoteSite.id, preview, () => queryClient.invalidateQueries({ queryKey: ['site-data', remoteSite.id] }), siteData.config)
          : makeApi(remoteSite.id, preview),
      },
    };
  }, [activeSite, preview, queryClient, remoteSite, siteData, slug, theme, user]);

  if (sitesLoading || siteLoading) return <div className="p-10 text-foreground">Loading site…</div>;
  if (sitesError || siteError) return <div role="alert" className="p-10 text-red-400">Could not load site: {(sitesError || siteError).message}</div>;
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
    fontFamily: FONTS[t.font] || FONTS.Inter,
    minHeight: 'calc(100vh - 48px)',
    background: 'var(--background)',
    color: 'var(--foreground)',
  };

  const pages = pagesOf(ctx.config);
  const landingPage = pages.find((candidate) => candidate.path === '') || pages[0];
  const page = pages.find((candidate) => candidate.path === (sub || '')) || (!sub ? landingPage : null);
  if (sub && !page && landingPage) {
    return <Navigate to={`${ctx.base}/${landingPage.path}`.replace(/\/$/, '')} replace />;
  }
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
    : (
      <div className="p-10 flex flex-col items-center gap-3 text-center" style={{ color: 'var(--muted-foreground)' }}>
        <p>This site has no published pages configured yet.</p>
        {ctx.role === 'Admin' ? (
          <Link className="btn btn-primary" to={`/builder/${ctx.site.slug}`}>Configure this site</Link>
        ) : (
          <p className="text-sm">Ask a site Admin to configure and publish its pages.</p>
        )}
      </div>
    );

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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSites, SITES_QUERY_KEY } from '../api/site.api';
import { MODULES } from '../lib/registry';

const EXAMPLE_CONFIGS = {
  'central-stores': {
    slug: 'central-stores',
    theme: { primary: '#4f46e5' },
    modules: ['auth', 'shell', 'inventory', 'analytics', 'reports'],
  },
  'service-centre': {
    slug: 'service-centre',
    theme: { primary: '#0891b2' },
    modules: ['auth', 'shell', 'request', 'approval', 'repair', 'returns'],
  },
  distribution: {
    slug: 'distribution',
    theme: { primary: '#059669' },
    modules: ['auth', 'shell', 'inventory', 'request', 'approval', 'assignment', 'consumption'],
  },
};

const SITE_COLORS = {
  'central-stores': '#4f46e5',
  'service-centre': '#0891b2',
  distribution: '#059669',
};

function JsonSnippet({ cfg, color }) {
  const monoStyle = {
    background: 'oklch(0.12 0.012 260)',
    border: `1px solid ${color}44`,
    borderRadius: '0.75rem',
    padding: '0.75rem',
    fontSize: '0.72rem',
    lineHeight: '1.7',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: 'var(--foreground)',
    overflowX: 'auto',
  };
  const k = { color: '#7dd3fc' };
  const v = { color };
  const g = { color: '#86efac' };
  const m = { color: 'var(--muted-foreground)' };

  return (
    <div style={monoStyle}>
      <div><span style={m}>{'{'}</span></div>
      <div>&nbsp;&nbsp;<span style={k}>&quot;slug&quot;</span>: <span style={v}>&quot;{cfg.slug}&quot;</span>,</div>
      <div>&nbsp;&nbsp;<span style={k}>&quot;theme&quot;</span>: {'{ '}<span style={k}>&quot;primary&quot;</span>: <span style={v}>&quot;{cfg.theme.primary}&quot;</span> {'}'},</div>
      <div>&nbsp;&nbsp;<span style={k}>&quot;modules&quot;</span>: [</div>
      {cfg.modules.map((mod, i) => (
        <div key={mod}>&nbsp;&nbsp;&nbsp;&nbsp;<span style={g}>&quot;{mod}&quot;</span>{i < cfg.modules.length - 1 ? ',' : ''}</div>
      ))}
      <div>&nbsp;&nbsp;]</div>
      <div><span style={m}>{'}'}</span></div>
    </div>
  );
}

function HowItWorks({ sites = [] }) {
  const PALETTE = ['#4f46e5', '#0891b2', '#059669', '#f97316', '#8b5cf6', '#e11d48'];

  const configMap = sites.length
    ? Object.fromEntries(sites.map((s) => [s.slug, {
        slug: s.slug,
        theme: { primary: s.theme?.primary || '#4f46e5' },
        modules: s.moduleTypes || [],
      }]))
    : EXAMPLE_CONFIGS;

  const colorMap = sites.length
    ? Object.fromEntries(sites.map((s, i) => [s.slug, s.theme?.primary || PALETTE[i % PALETTE.length]]))
    : SITE_COLORS;

  const slugs = Object.keys(configMap);
  const [active, setActive] = useState(slugs[0] || 'central-stores');
  const activeSlug = slugs.includes(active) ? active : slugs[0];
  const cfg = configMap[activeSlug];
  const color = colorMap[activeSlug] || '#4f46e5';

  return (
    <div className="px-8 pb-8">
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: 'oklch(0.82 0.16 85 / 12%)', color: 'oklch(0.82 0.16 85)' }}
          >
            Core concept
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Same codebase. Different config. Completely different product.
          </span>
        </div>

        {/* 3-column flow */}
        <div className="grid md:grid-cols-3 gap-0 mb-5">

          {/* Column 1 — Config */}
          <div className="flex flex-col gap-2 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'oklch(0.82 0.16 85)', color: 'oklch(0.18 0.03 85)' }}
              >1</div>
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Site config (JSONB)</span>
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Admin drags modules onto the builder canvas. Saved as JSON — no code written.
            </p>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {slugs.map((slug) => (
                <button
                  key={slug}
                  onClick={() => setActive(slug)}
                  className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
                  style={{
                    background: activeSlug === slug ? `${colorMap[slug]}22` : 'var(--secondary)',
                    color: activeSlug === slug ? colorMap[slug] : 'var(--muted-foreground)',
                    border: `1px solid ${activeSlug === slug ? colorMap[slug] : 'var(--border)'}`,
                  }}
                >
                  /{slug}
                </button>
              ))}
            </div>
            <JsonSnippet cfg={cfg} color={color} />
          </div>

          {/* Column 2 — Renderer */}
          <div className="hidden md:flex items-center justify-center" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '-1rem', right: '-1rem', top: '50%', height: 1, background: 'var(--border)' }} />
            <div
              className="relative z-10 rounded-xl px-3 py-2 text-center"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', minWidth: 120 }}
            >
              <div className="text-lg mb-0.5">⚙️</div>
              <div className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>One renderer</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>SiteRoute.jsx</div>
              <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>reads config →</div>
              <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>renders pages</div>
            </div>
          </div>

          {/* Column 3 — Output */}
          <div className="flex flex-col gap-2 pl-4">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: color, color: '#fff' }}
              >3</div>
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Live site — different product</span>
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Same React + Express codebase. Own theme, pages, data, and workflows.
            </p>
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: 'oklch(0.12 0.012 260)', border: `1px solid ${color}44` }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: `${color}22`, color }}
                >
                  {sites.find((s) => s.slug === activeSlug)?.icon || '◈'}
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                    {sites.find((s) => s.slug === activeSlug)?.name || activeSlug}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>/{activeSlug}</div>
                </div>
                <div
                  className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${color}22`, color }}
                >
                  v{sites.find((s) => s.slug === activeSlug)?.live ?? 1} live
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {cfg.modules.map((mod) => (
                  <span
                    key={mod}
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}
                  >
                    {MODULES[mod]?.icon} {MODULES[mod]?.page?.title || mod}
                  </span>
                ))}
              </div>
              <div
                className="text-[10px] pt-1"
                style={{ color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)' }}
              >
                {(cfg.modules || []).length} modules enabled
              </div>
            </div>
          </div>
        </div>

        {/* Bottom callout */}
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap"
          style={{ background: 'oklch(0.82 0.16 85 / 6%)', border: '1px solid oklch(0.82 0.16 85 / 20%)' }}
        >
          <span className="text-lg">💡</span>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <strong style={{ color: 'var(--foreground)' }}>The core challenge: </strong>
            switching sites changes layout, theme, modules, and workflows — not just colours.
            Adding a module to a live site and publishing activates it with{' '}
            <strong style={{ color: 'oklch(0.82 0.16 85)' }}>no code changes and no server restart.</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Hub() {
  const { data: sites = [], isLoading, error } = useQuery({
    queryKey: SITES_QUERY_KEY,
    queryFn: getSites,
  });

  return (
    <div style={{ background: 'var(--background)', minHeight: 'calc(100vh - 48px)', color: 'var(--foreground)' }}>

      {/* Hero */}
      <div className="px-8 pt-10 pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.12em' }}>
          <span style={{ opacity: 0.6 }}>⊞</span> Site Switcher
        </div>
        <h1 className="text-4xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>
          Your units, one codebase
        </h1>
        <p className="text-base max-w-xl leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          Each site below is rendered from configuration — its own theme, modules, data and workflows.
          Same code, different products. Open a site, or enter its builder to change what it runs.
        </p>
      </div>

      {isLoading && <div className="px-8 pb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading your sites…</div>}
      {error && <div role="alert" className="px-8 pb-6 text-sm text-red-400">Could not load your sites: {error.message}</div>}

      {/* How it works explainer */}
      <HowItWorks sites={sites} />

      {/* Site cards */}
      <div className="px-8 pb-10">
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {sites.map((s) => {
            const primary = s.theme?.primary || 'oklch(0.82 0.16 85)';
            const modules = s.moduleTypes || [];
            const shown = modules.slice(0, 5);
            const extra = modules.length - shown.length;
            return (
              <div
                key={s.id}
                className="rounded-2xl p-5 flex flex-col gap-4 transition-shadow"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div>
                  <span
                    className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${primary}25`, color: primary }}
                  >
                    /{s.slug}
                  </span>
                </div>

                <div>
                  <div className="text-xl font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.name}</div>
                  <div className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{s.description}</div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {shown.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
                    >
                      {MODULES[t]?.page?.title || MODULES[t]?.name || t}
                    </span>
                  ))}
                  {extra > 0 && (
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
                    >
                      +{extra} more
                    </span>
                  )}
                </div>

                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  v{s.live} deployed · {s.role}
                </div>

                <div className="flex items-center gap-2 mt-auto">
                  <Link
                    to={`/s/${s.slug}`}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center transition-opacity hover:opacity-90"
                    style={{ background: primary, color: '#fff' }}
                  >
                    Open site →
                  </Link>
                  {s.role === 'Admin' && (
                    <Link
                      to={`/builder/${s.slug}`}
                      className="px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:brightness-110"
                      style={{ background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    >
                      🔑 Builder
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
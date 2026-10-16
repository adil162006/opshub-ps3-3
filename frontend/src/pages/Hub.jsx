import { Link } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Badge, DataTable, fmt } from '../ui';
import { useAuth } from '../context/Authcontext';
import { getSites, SITES_QUERY_KEY } from '../api/site.api';
import { MODULES } from '../lib/registry';

export default function Hub() {
  const { user } = useAuth();
  const { data: sites = [], isLoading, error } = useQuery({
    queryKey: SITES_QUERY_KEY,
    queryFn: getSites,
  });
  const stats = sites.map((site) => ({ ...site, items: '—', value: null, pending: '—', repairs: '—' }));

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

      {/* Site cards */}
      <div className="px-8 pb-10">
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {stats.map((s) => {
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
                {/* Slug pill */}
                <div>
                  <span
                    className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${primary}25`, color: primary }}
                  >
                    /{s.slug}
                  </span>
                </div>

                {/* Name + desc */}
                <div>
                  <div className="text-xl font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.name}</div>
                  <div className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{s.description}</div>
                </div>

                {/* Module tags */}
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

                {/* Meta */}
                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  v{s.live} deployed · {s.role}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto">
                  <Link
                    to={`/s/${s.slug}`}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center transition-opacity hover:opacity-90"
                    style={{ background: primary, color: '#fff' }}
                  >
                    Open site →
                  </Link>
                  {user?.role === 'Admin' && (
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

        {/* Combined stats section */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-base mb-5">Combined view across units</h2>
          <div className="grid md:grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Sites', value: sites.length },
              { label: 'Total stock value', value: stats.some((site) => site.value != null) ? fmt(stats.reduce((a, site) => a + (site.value || 0), 0)) : '—' },
              { label: 'Pending requests (all units)', value: '—' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl p-4"
                style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
              >
                <div className="text-xs uppercase tracking-wider mb-2 font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
                <div className="text-2xl font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <DataTable
              rows={stats}
              columns={[
                { key: 'name', label: 'Unit' },
                { key: 'items', label: 'SKUs' },
                { label: 'Stock value', render: (s) => (s.value == null ? '—' : fmt(s.value)) },
                { key: 'pending', label: 'Pending' },
                { key: 'repairs', label: 'Open repairs' },
              ]}
            />
            <div className="rounded-xl p-4" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
              <div className="lbl mb-3">Stock value by unit</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={stats.filter((s) => s.value != null).map((s) => ({ name: s.name, value: s.value }))}>
                    <XAxis dataKey="name" fontSize={11} tick={{ fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis fontSize={11} tick={{ fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Bar dataKey="value" fill="oklch(0.82 0.16 85)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, DataTable, fmt } from '../ui';
import { useDB } from '../lib/db';
import { useCurrentUser } from '../lib/session';
import { apiSync } from '../lib/api';
import { MODULES } from '../lib/registry';

const tryList = (id, r) => { try { return apiSync('GET', `/api/${id}/${r}`); } catch { return null; } };

export default function Hub() {
  useDB((s) => s.rows); useDB((s) => s.sites);
  const user = useCurrentUser(); const sites = apiSync('GET', '/api/sites');
  const stats = sites.map((s) => {
    const inv = tryList(s.id, 'inventory'); const req = tryList(s.id, 'requests'); const rep = tryList(s.id, 'repairs');
    return { ...s, items: inv?.length ?? '—', value: inv ? inv.reduce((a, r) => a + (r.total || 0), 0) : null, pending: req ? req.filter((r) => r.status === 'pending').length : '—', repairs: rep ? rep.filter((r) => r.status !== 'completed').length : '—' };
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
                  {user.role === 'Admin' && (
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
              { label: 'Total stock value', value: fmt(stats.reduce((a, s) => a + (s.value || 0), 0)) },
              { label: 'Pending requests (all units)', value: stats.reduce((a, s) => a + (typeof s.pending === 'number' ? s.pending : 0), 0) },
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

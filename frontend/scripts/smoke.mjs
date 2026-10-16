const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const { signJwt: sj } = await import('../src/lib/jwt.js');
store['opshub.token'] = sj({ sub: process.env.UID_ });
const React = (await import('react')).default;
const { renderToString } = await import('react-dom/server');
const { MemoryRouter, Routes, Route } = await import('react-router-dom');
const { signJwt } = await import('../src/lib/jwt.js');
const { dbGet } = await import('../src/lib/db.js');
const { pagesOf } = await import('../src/lib/registry.js');
const SiteRoute = (await import('../src/pages/SiteRoute.jsx')).default;
const Hub = (await import('../src/pages/Hub.jsx')).default;
const Catalogue = (await import('../src/pages/Catalogue.jsx')).default;
const Users = (await import('../src/pages/Users.jsx')).default;
let bad = 0;
for (const uid of [process.env.UID_]) {
  const run = (name, path, el) => { try { const h = renderToString(React.createElement(MemoryRouter, { initialEntries: [path] }, el)); if (h.length < 200) throw new Error('empty'); } catch (e) { bad++; console.log('FAIL', uid, name, e.message); } };
  run('hub', '/', React.createElement(Hub)); run('catalogue', '/', React.createElement(Catalogue));
  if (uid === 'user_1') run('users', '/', React.createElement(Users));
  for (const s of dbGet().sites) for (const p of [{ path: '' }, ...pagesOf(s.draft)]) {
    run(`${s.slug}/${p.path}`, `/s/${s.slug}/${p.path}`, React.createElement(Routes, null, React.createElement(Route, { path: '/s/:slug/*', element: React.createElement(SiteRoute) })));
  }
}
console.log(bad ? `${bad} failures` : 'smoke ok');

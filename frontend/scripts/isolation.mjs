// Run: npm run test:isolation  (uses vite-node; shims localStorage)
const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const { runIsolationTests } = await import('../src/lib/isolation.js');
const results = runIsolationTests();
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  [${r.group}] ${r.name}${r.ok ? '' : ' — ' + r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

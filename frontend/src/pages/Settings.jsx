import { Page, toast } from '../ui';
import { dbCommit, dbGet, resetDB } from '../lib/db';

export default function Settings() {
  const backup = () => { const blob = new Blob([JSON.stringify(dbGet(), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `opshub-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); };
  const restore = async (file) => { try { const j = JSON.parse(await file.text()); if (!j.sites || !j.rows || !j.users) throw new Error('Not an OpsHub backup'); dbCommit(j); toast.ok('Backup restored'); } catch (e) { toast.err(e.message); } };
  return (
    <div className="themed min-h-[calc(100vh-48px)]" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <Page title="Backup & demo data" sub="The whole app runs offline from browser storage — a JSON backup guarantees the demo works even if the live setup fails.">
        <div className="card p-4 flex gap-3 flex-wrap items-center">
          <button className="btn btn-primary" onClick={backup}>⬇ Download backup</button>
          <label className="btn">⬆ Restore backup<input type="file" accept=".json" hidden onChange={(e) => { e.target.files[0] && restore(e.target.files[0]); e.target.value = ''; }} /></label>
          <button className="btn" onClick={() => { if (confirm('Reset ALL data to the seeded demo state?')) { resetDB(); toast.ok('Reset to seed data'); } }}>↺ Reset to seed data</button>
        </div>
      </Page>
    </div>);
}

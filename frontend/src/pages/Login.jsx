import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useCurrentUser, useSession } from '../lib/session';

const DEMO = [['admin@opshub.io', 'admin123', 'Admin — everything'], ['manager@opshub.io', 'manager123', 'Manager — all 3 sites'], ['member@opshub.io', 'member123', 'Member — read / request'], ['stores@opshub.io', 'stores123', 'Manager — Central Stores only'], ['tech@opshub.io', 'tech123', 'Manager — Service Centre only']];
export default function Login() {
  const user = useCurrentUser(); const nav = useNavigate(); const setToken = useSession((s) => s.setToken);
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  if (user) return <Navigate to="/" replace />;
  const submit = async (e) => { e.preventDefault(); try { const r = await api('POST', '/api/auth/login', { email, password: pw }); setToken(r.token); nav('/'); } catch (x) { setErr(x.message); } };
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg,#0b1020,#1e1b4b)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl space-y-5">
        <div><div className="text-2xl font-bold text-indigo-700">OpsHub</div><p className="text-sm text-slate-500">One login. Every operations site.</p></div>
        <form onSubmit={submit} className="space-y-3">
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          {err && <div className="text-sm text-red-600">{err}</div>}
          <button className="w-full bg-indigo-600 text-white rounded-lg py-2 font-medium">Sign in</button>
        </form>
        <div><div className="text-xs font-semibold text-slate-400 uppercase mb-2">Demo accounts (click to fill)</div>
          <div className="space-y-1">{DEMO.map(([e, p, d]) => <button key={e} type="button" onClick={() => { setEmail(e); setPw(p); }} className="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-slate-100 flex justify-between"><span>{e}</span><span className="text-slate-400">{d}</span></button>)}</div></div>
      </div>
    </div>);
}

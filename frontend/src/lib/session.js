import { useMemo } from 'react';
import { create } from 'zustand';
import { useDB } from './db';
import { verifyJwt } from './jwt';

const TK = 'opshub.token';
export const useSession = create((set) => ({
  token: globalThis.localStorage?.getItem(TK) || null,
  setToken: (t) => { if (t) localStorage.setItem(TK, t); else localStorage.removeItem(TK); set({ token: t }); },
}));
export function useCurrentUser() {
  const token = useSession((s) => s.token);
  const users = useDB((s) => s.users);
  return useMemo(() => {
    if (!token) return null;
    const p = verifyJwt(token);
    return p ? users.find((u) => u.id === p.sub) || null : null;
  }, [token, users]);
}

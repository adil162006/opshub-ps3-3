import { useMemo } from 'react';
import { create } from 'zustand';
import { useDB } from './db';
import { verifyJwt } from './jwt';

export const useSession = create((set) => ({
  token: null,
  setToken: (token) => set({ token }),
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

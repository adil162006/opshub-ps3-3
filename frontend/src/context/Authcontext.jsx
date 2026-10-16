import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getMe, loginUser, logoutUser } from '../api/user.api';
import { SITES_QUERY_KEY } from '../api/site.api';
import { useSiteStore } from '../store/site.store';

const CURRENT_USER_QUERY_KEY = ['auth', 'me'];
const AuthContext = createContext(null);

function normalizeUser(user) {
  return { ...user, role: user.role || (user.isHubAdmin ? 'Admin' : 'User') };
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const clearActiveSite = useSiteStore((state) => state.clearActiveSite);
  const [user, setUser] = useState(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getCurrentUser = useCallback(async () => {
    const result = await queryClient.fetchQuery({
      queryKey: CURRENT_USER_QUERY_KEY,
      queryFn: getMe,
      staleTime: 0,
      retry: false,
    });
    setUser(normalizeUser(result.user));
    setSites(result.sites || []);
    return result;
  }, [queryClient]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getCurrentUser()
      .catch((requestError) => {
        if (!active) return;
        setUser(null);
        setSites([]);
        if (requestError.response?.status !== 401) {
          setError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [getCurrentUser]);

  const login = useCallback(async (email, password) => {
    setError('');
    const result = await loginUser({ email, password });
    setUser(normalizeUser(result.user));
    setSites(result.sites || []);
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, {
      user: result.user,
      sites: result.sites || [],
    });
    queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEY });
    return result;
  }, [queryClient]);

  const logout = useCallback(async () => {
    setError('');
    try {
      await logoutUser();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
      return false;
    }

    setUser(null);
    setSites([]);
    clearActiveSite();
    queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    queryClient.removeQueries({ queryKey: SITES_QUERY_KEY });
    return true;
  }, [clearActiveSite, queryClient]);

  const value = useMemo(() => ({
    user,
    sites,
    loading,
    error,
    login,
    logout,
    getCurrentUser,
  }), [user, sites, loading, error, login, logout, getCurrentUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import type { UserSession } from '../types/inbox';

export function useAuth() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<string>('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api.getMe();
      setUser(me);
      setActiveWorkspace((prev) => {
        if (prev && me.workspaces.some((w) => w.id === prev)) return prev;
        return me.workspaces[0]?.id ?? '';
      });
    } catch {
      setUser(null);
      setActiveWorkspace('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(() => {
    window.location.href = '/auth/login';
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => null);
    setUser(null);
    setActiveWorkspace('');
  }, []);

  return {
    user,
    loading,
    activeWorkspace,
    setActiveWorkspace,
    login,
    logout,
    refresh,
  };
}

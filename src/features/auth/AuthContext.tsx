import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { authService } from '../../services/auth.service';
import type { WorkspaceContext, WorkspaceMembership } from '../../types/domain';

const ACTIVE_STORE_STORAGE_KEY = 'menuflow_active_store_id';

interface AuthContextValue {
  session: Session | null;
  authLoading: boolean;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  workspaces: WorkspaceContext | null;
  workspacesLoading: boolean;
  workspacesError: Error | null;
  refetchWorkspaces: () => Promise<void>;
  activeStoreId: string | null;
  activeMembership: WorkspaceMembership | null;
  selectStore: (storeId: string | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const hadAuthenticatedSessionRef = useRef(false);
  const [storedStoreId, setStoredStoreId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_STORE_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        if (data.session) hadAuthenticatedSessionRef.current = true;
        setAuthLoading(false);
      })
      .catch(() => {
        if (active) setAuthLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        hadAuthenticatedSessionRef.current = true;
        setSessionExpired(false);
      } else if (event === 'SIGNED_OUT') {
        if (hadAuthenticatedSessionRef.current) {
          setSessionExpired(true);
        }
        hadAuthenticatedSessionRef.current = false;
        queryClient.clear();
      }
      setAuthLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [queryClient]);

  const {
    data: workspaces = null,
    isLoading: workspacesLoading,
    error: workspacesError,
    refetch,
  } = useQuery<WorkspaceContext, Error>({
    queryKey: ['workspaces', session?.user?.id],
    queryFn: () => authService.getMyWorkspaces(),
    enabled: Boolean(session?.user?.id),
    staleTime: 30_000,
  });

  const memberships = useMemo(() => workspaces?.memberships ?? [], [workspaces]);

  const activeStoreId = useMemo(() => {
    if (memberships.length === 0) return null;
    if (storedStoreId && memberships.some((m) => m.store_id === storedStoreId)) {
      return storedStoreId;
    }
    if (memberships.length === 1) {
      return memberships[0].store_id;
    }
    return null;
  }, [memberships, storedStoreId]);

  const activeMembership = useMemo(
    () => memberships.find((m) => m.store_id === activeStoreId) ?? null,
    [memberships, activeStoreId]
  );

  const selectStore = useCallback((storeId: string | null) => {
    setStoredStoreId(storeId);
    try {
      if (storeId) {
        localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, storeId);
      } else {
        localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY);
      }
    } catch {
      // Ignorar indisponibilidade de storage em contextos restritos
    }
  }, []);

  const signOut = useCallback(async () => {
    hadAuthenticatedSessionRef.current = false;
    setSessionExpired(false);
    selectStore(null);
    await authService.signOut();
    queryClient.clear();
  }, [queryClient, selectStore]);

  const refetchWorkspaces = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      authLoading,
      sessionExpired,
      clearSessionExpired,
      workspaces,
      workspacesLoading: Boolean(session?.user?.id) && workspacesLoading,
      workspacesError: workspacesError ?? null,
      refetchWorkspaces,
      activeStoreId,
      activeMembership,
      selectStore,
      signOut,
    }),
    [
      session,
      authLoading,
      sessionExpired,
      clearSessionExpired,
      workspaces,
      workspacesLoading,
      workspacesError,
      refetchWorkspaces,
      activeStoreId,
      activeMembership,
      selectStore,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider.');
  }
  return ctx;
}

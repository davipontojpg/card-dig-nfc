import { createContext, useContext, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Building2, Store } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { storesService } from '../../services/stores.service';
import type { StoreAccessContext } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Card, Badge } from '../../components/ui/Badge';
import { ErrorState, LoadingSpinner } from '../../components/ui/Feedback';
import { getLifecycleStatusMeta, getSubscriptionStatusMeta } from '../../lib/permissions';

interface StoreWorkspaceContextValue {
  access: StoreAccessContext;
  refetchAccess: () => Promise<void>;
}

const StoreWorkspaceContext = createContext<StoreWorkspaceContextValue | null>(null);

export function StoreMemberGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const {
    session,
    authLoading,
    workspaces,
    workspacesLoading,
    workspacesError,
    refetchWorkspaces,
    activeStoreId,
    selectStore,
    signOut,
  } = useAuth();

  const {
    data: access,
    isLoading: accessLoading,
    error: accessError,
    refetch: refetchAccessQuery,
  } = useQuery<StoreAccessContext, Error>({
    queryKey: ['store-access', activeStoreId],
    queryFn: () => storesService.getStoreAccessContext(activeStoreId!),
    enabled: Boolean(session && activeStoreId),
    staleTime: 20_000,
  });

  if (authLoading || (session && workspacesLoading)) {
    return <LoadingSpinner label="Carregando seu estabelecimento..." />;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (workspacesError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <ErrorState
          title="Erro ao carregar vínculos de estabelecimento"
          message={workspacesError.message}
          onRetry={() => void refetchWorkspaces()}
        />
      </div>
    );
  }

  const memberships = workspaces?.memberships ?? [];

  if (memberships.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Nenhum estabelecimento associado
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sua conta ainda não possui vínculo com nenhum estabelecimento. Caso você seja
            operador do SaaS, acesse o painel da plataforma.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {workspaces?.is_platform_admin ? (
              <Button onClick={() => (window.location.href = '/platform')}>
                Acessar Painel Central
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => void signOut()}>
              Sair da conta
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!activeStoreId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-xl space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">Selecione o estabelecimento</h1>
            <p className="mt-1 text-sm text-slate-600">
              Você possui acesso a múltiplos estabelecimentos. Escolha qual deseja administrar.
            </p>
          </div>
          <div className="space-y-3">
            {memberships.map((m) => {
              const lifecycle = getLifecycleStatusMeta(m.lifecycle_status);
              const sub = getSubscriptionStatusMeta(m.subscription_status);
              return (
                <Card
                  key={m.store_id}
                  className="flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-md"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Store className="h-4 w-4 text-indigo-600" />
                      <h2 className="font-semibold text-slate-900">{m.store_name}</h2>
                      <Badge tone={lifecycle.tone}>{lifecycle.label}</Badge>
                      <Badge tone={sub.tone}>{sub.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      /m/{m.slug} • Plano {m.plan_name} • Papel:{' '}
                      {m.role === 'owner' ? 'Proprietário' : 'Editor'}
                    </p>
                  </div>
                  <Button onClick={() => selectStore(m.store_id)}>Entrar</Button>
                </Card>
              );
            })}
          </div>
          <div className="text-center">
            <Button variant="ghost" onClick={() => void signOut()}>
              Sair da conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (accessLoading || !access) {
    if (accessError) {
      return (
        <div className="mx-auto max-w-lg px-4 py-12">
          <ErrorState
            title="Não foi possível carregar o contexto do estabelecimento"
            message={accessError.message}
            onRetry={() => void refetchAccessQuery()}
          />
        </div>
      );
    }
    return <LoadingSpinner label="Carregando permissões e plano do estabelecimento..." />;
  }

  return (
    <StoreWorkspaceContext.Provider
      value={{
        access,
        refetchAccess: async () => {
          await refetchAccessQuery();
        },
      }}
    >
      {children}
    </StoreWorkspaceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStoreWorkspace() {
  const ctx = useContext(StoreWorkspaceContext);
  if (!ctx) {
    throw new Error('useStoreWorkspace deve ser usado dentro de StoreMemberGuard.');
  }
  return ctx;
}


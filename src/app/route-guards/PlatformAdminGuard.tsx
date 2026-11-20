import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingSpinner } from '../../components/ui/Feedback';

interface PlatformAdminGuardProps {
  children: ReactNode;
  requireSuperAdmin?: boolean;
}

export function PlatformAdminGuard({
  children,
  requireSuperAdmin = false,
}: PlatformAdminGuardProps) {
  const location = useLocation();
  const {
    session,
    authLoading,
    workspaces,
    workspacesLoading,
    workspacesError,
    refetchWorkspaces,
    signOut,
  } = useAuth();

  if (authLoading || (session && workspacesLoading)) {
    return <LoadingSpinner label="Verificando credenciais da plataforma..." />;
  }

  if (!session) {
    return <Navigate to="/platform/login" state={{ from: location.pathname }} replace />;
  }

  if (workspacesError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <ErrorState
          title="Erro ao validar acesso administrativo"
          message={workspacesError.message}
          onRetry={() => void refetchWorkspaces()}
        />
      </div>
    );
  }

  if (!workspaces?.is_platform_admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Acesso restrito ao operador</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sua conta não está cadastrada como operadora ativa da plataforma. Se você administra um
            estabelecimento, utilize o painel do cliente.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={() => void signOut()}>
              Sair da conta
            </Button>
            <Button onClick={() => (window.location.href = '/app')}>Ir para meu painel</Button>
          </div>
        </div>
      </div>
    );
  }

  if (requireSuperAdmin && workspaces.platform_role !== 'super_admin') {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <ErrorState
          title="Permissão exclusiva de Super Admin"
          message="A gestão de operadores da plataforma exige o papel super_admin."
        />
      </div>
    );
  }

  return <>{children}</>;
}


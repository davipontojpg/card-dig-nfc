import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { Session } from '@supabase/supabase-js';
import * as AuthContextModule from '../../features/auth/AuthContext';
import { StoreMemberGuard } from './StoreMemberGuard';
import { PlatformAdminGuard } from './PlatformAdminGuard';
import type { WorkspaceContext } from '../../types/domain';

const fakeSession = {
  user: { id: 'user-1', email: 'teste@exemplo.com' },
} as unknown as Session;

function mockAuth(workspaces: WorkspaceContext | null) {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    session: fakeSession,
    authLoading: false,
    sessionExpired: false,
    clearSessionExpired: vi.fn(),
    workspaces,
    workspacesLoading: false,
    workspacesError: null,
    refetchWorkspaces: vi.fn().mockResolvedValue(undefined),
    activeStoreId: null,
    activeMembership: null,
    selectStore: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  });
}

describe('RouteGuards isolation & access control', () => {
  it('nunca exibe botão de acesso ao Painel Central dentro de StoreMemberGuard', () => {
    mockAuth({
      user_id: 'user-1',
      email: 'operador@exemplo.com',
      full_name: 'Operador',
      is_platform_admin: true,
      platform_role: 'operator',
      memberships: [],
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app']}>
          <StoreMemberGuard>
            <div>Painel da Loja</div>
          </StoreMemberGuard>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Nenhum estabelecimento associado')).toBeInTheDocument();
    expect(screen.queryByText(/Painel Central/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/operador do SaaS/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sair da conta/i })).toBeInTheDocument();
  });

  it('bloqueia acesso ao painel /platform para conta de dono de estabelecimento (não admin)', () => {
    mockAuth({
      user_id: 'user-2',
      email: 'dono@restaurante.com',
      full_name: 'Dono',
      is_platform_admin: false,
      platform_role: null,
      memberships: [
        {
          store_id: 'store-1',
          store_name: 'Restaurante Teste',
          slug: 'restaurante-teste',
          role: 'owner',
          lifecycle_status: 'pending_setup',
          subscription_status: 'trialing',
          plan_code: 'menu',
          plan_name: 'Cardápio Digital',
          has_service_access: false,
          can_edit_workspace: true,
          features: ['digital_menu', 'qr_code'],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/platform']}>
        <PlatformAdminGuard>
          <div>Conteúdo Secreto do Admin</div>
        </PlatformAdminGuard>
      </MemoryRouter>
    );

    expect(screen.queryByText('Conteúdo Secreto do Admin')).not.toBeInTheDocument();
    expect(screen.getByText('Acesso restrito ao operador')).toBeInTheDocument();
  });

  it('permite acesso ao painel /platform apenas para contas com is_platform_admin = true', () => {
    mockAuth({
      user_id: 'user-3',
      email: 'admin@saas.com',
      full_name: 'Super Admin',
      is_platform_admin: true,
      platform_role: 'super_admin',
      memberships: [],
    });

    render(
      <MemoryRouter initialEntries={['/platform']}>
        <PlatformAdminGuard>
          <div>Conteúdo Secreto do Admin</div>
        </PlatformAdminGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Conteúdo Secreto do Admin')).toBeInTheDocument();
  });
});

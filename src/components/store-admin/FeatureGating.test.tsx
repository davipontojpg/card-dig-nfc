import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { ToastProvider } from '../ui/Toast';
import { PlatformDashboardPage } from '../../pages/PlatformDashboardPage';
import { platformService } from '../../services/platform.service';
import * as StoreMemberGuardModule from '../../app/route-guards/StoreMemberGuard';
import { StoreFeatureGuard } from '../../app/route-guards/StoreFeatureGuard';
import type { StoreAccessContext } from '../../types/domain';

function makeAccess(features: string[], hasServiceAccess = true): StoreAccessContext {
  return {
    store: {
      id: 'store-1',
      name: 'Loja Teste',
      slug: 'loja-teste',
      business_type: 'Restaurante',
      description: null,
      logo_path: null,
      primary_color: '#0f766e',
      public_phone: null,
      public_address: null,
      timezone: 'America/Sao_Paulo',
      is_published: true,
      lifecycle_status: 'active',
      onboarding_status: 'completed',
      onboarding_review_notes: null,
      onboarding_submitted_at: null,
      created_by_platform_admin: null,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
    role: 'owner',
    subscription: {
      id: 'sub-1',
      plan_id: 'plan-1',
      plan_code: 'menu',
      plan_name: 'Cardápio Digital',
      status: 'active',
      monthly_price_snapshot: 19.9,
      setup_fee_snapshot: 100,
      setup_fee_status: 'paid',
      started_at: '2026-11-01T00:00:00Z',
      current_period_start: null,
      current_period_end: null,
      next_billing_at: null,
      last_payment_at: null,
      grace_until: null,
    },
    has_service_access: hasServiceAccess,
    features,
  };
}

describe('FeatureGating & PlatformDashboardPage', () => {
  it('bloqueia módulo protegido quando feature_key está ausente no plano', () => {
    vi.spyOn(StoreMemberGuardModule, 'useStoreWorkspace').mockReturnValue({
      access: makeAccess(['digital_menu', 'qr_code']),
      refetchAccess: async () => {},
    });

    render(
      <MemoryRouter>
        <StoreFeatureGuard
          featureKey="scheduled_promotions"
          title="Promoções Agendadas"
          requiredPlanHint="Plano 3"
          description="Upgrade necessário."
        >
          <div>Conteúdo protegido de promoções</div>
        </StoreFeatureGuard>
      </MemoryRouter>
    );

    expect(screen.queryByText('Conteúdo protegido de promoções')).not.toBeInTheDocument();
    expect(screen.getByText('Plano 3')).toBeInTheDocument();
  });

  it('libera módulo quando feature_key e acesso estão ativos', () => {
    vi.spyOn(StoreMemberGuardModule, 'useStoreWorkspace').mockReturnValue({
      access: makeAccess(['digital_menu', 'qr_code', 'nfc_access']),
      refetchAccess: async () => {},
    });

    render(
      <MemoryRouter>
        <StoreFeatureGuard
          featureKey="nfc_access"
          title="NFC"
          requiredPlanHint="Plano 2"
          description="Upgrade necessário."
        >
          <div>Guia técnico NTAG213</div>
        </StoreFeatureGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Guia técnico NTAG213')).toBeInTheDocument();
  });

  it('libera módulo de promoções para plano intermediário com basic_promotions', () => {
    vi.spyOn(StoreMemberGuardModule, 'useStoreWorkspace').mockReturnValue({
      access: makeAccess(['digital_menu', 'qr_code', 'nfc_access', 'basic_promotions']),
      refetchAccess: async () => {},
    });

    render(
      <MemoryRouter>
        <StoreFeatureGuard
          featureKey={['basic_promotions', 'scheduled_promotions']}
          title="Promoções"
          requiredPlanHint="Plano 2+"
          description="Upgrade necessário."
        >
          <div>Gerenciador de promoções comuns</div>
        </StoreFeatureGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Gerenciador de promoções comuns')).toBeInTheDocument();
  });

  it('exibe MRR explicitamente identificado como estimativa operacional (não contábil)', async () => {
    vi.spyOn(platformService, 'getDashboardMetrics').mockResolvedValue({
      total_stores: 2,
      by_lifecycle: { pending_setup: 1, active: 1, suspended: 0, archived: 0 },
      by_subscription_status: { trialing: 1, active: 1, past_due: 0, suspended: 0, canceled: 0 },
      by_plan: [
        { plan_code: 'menu', plan_name: 'Cardápio Digital', count: 1 },
        { plan_code: 'menu_nfc', plan_name: 'Cardápio + NFC', count: 1 },
      ],
      estimated_mrr: 49.9,
      active_billing_subscriptions_count: 1,
      pending_onboarding_count: 1,
      upcoming_billings: [],
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ToastProvider>
            <PlatformDashboardPage />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('MRR Operacional Estimado')).toBeInTheDocument();
    });
    expect(screen.getByText(/não representa contabilidade/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?49,90/)).toBeInTheDocument();
  });
});

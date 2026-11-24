import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { StoreAccessContext } from '../types/domain';
import { StoreAccessPage } from './StoreAccessPage';
import {
  DEFAULT_NFC_QR_INSTRUCTION,
  DEFAULT_QR_ONLY_INSTRUCTION,
} from '../lib/qr-card-generator';

const mockUseStoreWorkspace = vi.fn();
const mockGenerateBrandedQrCardDataUrl = vi.fn();

vi.mock('../app/route-guards/StoreMemberGuard', () => ({
  useStoreWorkspace: () => mockUseStoreWorkspace(),
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QRPNG'),
    toString: vi.fn().mockResolvedValue('<svg></svg>'),
  },
}));

vi.mock('../lib/qr-card-generator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/qr-card-generator')>();
  return {
    ...actual,
    generateBrandedQrCardDataUrl: (...args: unknown[]) =>
      mockGenerateBrandedQrCardDataUrl(...args),
  };
});

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

function buildAccess(
  features: StoreAccessContext['features'],
  planCode: 'menu' | 'menu_nfc'
): StoreAccessContext {
  return {
    store: {
      id: 'store-1',
      name: 'Adega do Jota',
      slug: 'adega-do-jota',
      business_type: 'Adega',
      description: null,
      logo_path: null,
      primary_color: '#cc8914',
      public_phone: null,
      public_address: null,
      timezone: 'America/Sao_Paulo',
      is_published: true,
      lifecycle_status: 'active',
      onboarding_status: 'completed',
      onboarding_review_notes: null,
      onboarding_submitted_at: null,
      created_by_platform_admin: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    role: 'owner',
    subscription: {
      id: 'sub-1',
      plan_id: `plan-${planCode}`,
      plan_code: planCode,
      plan_name: planCode === 'menu' ? 'Cardápio Digital' : 'Cardápio + NFC',
      status: 'active',
      monthly_price_snapshot: planCode === 'menu' ? 29.9 : 44.9,
      setup_fee_snapshot: 100,
      setup_fee_status: 'paid',
      started_at: '2026-01-01T00:00:00Z',
      current_period_start: '2026-01-01T00:00:00Z',
      current_period_end: '2026-02-01T00:00:00Z',
      next_billing_at: '2026-02-01T00:00:00Z',
      last_payment_at: '2026-01-01T00:00:00Z',
      grace_until: null,
    },
    has_service_access: true,
    can_edit_workspace: true,
    features,
  };
}

describe('StoreAccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateBrandedQrCardDataUrl.mockResolvedValue('data:image/png;base64,CARDPNG');
  });

  it('no plano padrão (sem nfc_access), remove opções/configurações de NFC e exibe apenas QR e o card bloqueado de upgrade NFC', async () => {
    mockUseStoreWorkspace.mockReturnValue({
      access: buildAccess(['digital_menu', 'qr_code'], 'menu'),
      refetchAccess: vi.fn(),
    });

    render(
      <MemoryRouter>
        <StoreAccessPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Acesso Público: URL e QR Code' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'QR Code para Mesas e Balcão' })).toBeInTheDocument();

    // Não deve exibir seletor de chamada NFC + QR Code nem seção de configuração NFC
    expect(screen.queryByRole('button', { name: 'NFC + QR Code' })).not.toBeInTheDocument();
    expect(screen.queryByText('Modelo de chamada')).not.toBeInTheDocument();
    expect(screen.queryByText('Configuração e Gravação de Etiquetas NFC')).not.toBeInTheDocument();
    expect(screen.queryByText(/Passo a passo \(NFC Tools\)/i)).not.toBeInTheDocument();

    // Input deve vir preenchido com texto somente QR Code
    const input = screen.getByLabelText('Texto exibido acima do QR Code') as HTMLInputElement;
    expect(input.value).toBe(DEFAULT_QR_ONLY_INSTRUCTION);

    // Gerador do cartão deve ser chamado sem ícone NFC
    await waitFor(() => {
      expect(mockGenerateBrandedQrCardDataUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          showNfcIcon: false,
          instructionText: DEFAULT_QR_ONLY_INSTRUCTION,
        })
      );
    });

    // Deve exibir o card de bloqueio do módulo NFC com a mensagem esperada
    expect(screen.getByRole('heading', { name: 'Módulo de Implantação NFC' })).toBeInTheDocument();
    expect(
      screen.getByText('Recurso dos planos Cardápio + NFC e Cardápio + NFC + Promoções')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Este módulo fornece a URL pronta para gravação de chips NTAG213, instruções de instalação física, proteção anti-metal e checklist de testes. Solicite o upgrade ao operador da plataforma para liberar.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver plano e status da assinatura' })).toBeInTheDocument();
  });

  it('nos planos com nfc_access, mantém as opções NFC + QR e a seção de configuração de etiquetas NFC', async () => {
    mockUseStoreWorkspace.mockReturnValue({
      access: buildAccess(['digital_menu', 'qr_code', 'nfc_access'], 'menu_nfc'),
      refetchAccess: vi.fn(),
    });

    render(
      <MemoryRouter>
        <StoreAccessPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: 'Acesso Público: URL, QR Code e NFC' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'NFC + QR Code' })).toBeInTheDocument();
    expect(screen.getByText('Configuração e Gravação de Etiquetas NFC')).toBeInTheDocument();

    const input = screen.getByLabelText('Texto exibido acima do QR Code') as HTMLInputElement;
    expect(input.value).toBe(DEFAULT_NFC_QR_INSTRUCTION);

    await waitFor(() => {
      expect(mockGenerateBrandedQrCardDataUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          showNfcIcon: true,
          instructionText: DEFAULT_NFC_QR_INSTRUCTION,
        })
      );
    });
  });
});

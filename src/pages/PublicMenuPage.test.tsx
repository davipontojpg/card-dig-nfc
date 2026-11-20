import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { PublicMenuPage } from './PublicMenuPage';
import { publicMenuService } from '../services/public-menu.service';

function renderPublicMenu(slug: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/m/${slug}`]}>
        <Routes>
          <Route path="/m/:slug" element={<PublicMenuPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PublicMenuPage', () => {
  it('renderiza cardápio, promoções, adicionais e NÃO exibe carrinho, compra ou checkout', async () => {
    vi.spyOn(publicMenuService, 'getBySlug').mockResolvedValue({
      status: 'ok',
      evaluated_at: '2026-11-23T22:00:00Z',
      store: {
        id: 'store-1',
        name: 'Bistrô Horizonte',
        slug: 'bistro-horizonte',
        business_type: 'Restaurante',
        description: 'Gastronomia artesanal',
        logo_path: null,
        primary_color: '#0f766e',
        public_phone: '(11) 99999-1111',
        public_address: 'Rua das Flores, 50',
        timezone: 'America/Sao_Paulo',
      },
      features: {
        digital_menu: true,
        qr_code: true,
        scheduled_promotions: true,
      },
      active_promotions: [
        {
          promotion_id: 'promo-1',
          name: 'Segunda da Casa',
          description: 'Desconto especial',
          schedule_type: 'weekly',
          ends_at: null,
          end_time: '22:00:00',
        },
      ],
      categories: [
        {
          id: 'cat-1',
          name: 'Combos',
          description: 'Para compartilhar',
          sort_order: 1,
          products: [
            {
              id: 'prod-1',
              category_id: 'cat-1',
              name: 'Combo de Cerveja',
              description: 'Balde com 4 unidades',
              price: 50,
              image_path: null,
              is_available: true,
              is_featured: true,
              sort_order: 1,
              promotion: {
                promotion_id: 'promo-1',
                name: 'Segunda da Casa',
                description: '10% OFF',
                discount_type: 'percent_off',
                discount_value: 10,
                original_price: 50,
                promotional_price: 45,
                schedule_type: 'weekly',
              },
              option_groups: [
                {
                  id: 'grp-1',
                  name: 'Escolha o acompanhamento',
                  description: null,
                  is_required: false,
                  min_selection: 0,
                  max_selection: 2,
                  sort_order: 1,
                  options: [
                    {
                      id: 'opt-1',
                      name: 'Amendoim',
                      description: null,
                      extra_price: 5,
                      sort_order: 1,
                    },
                  ],
                },
              ],
            },
            {
              id: 'prod-2',
              category_id: 'cat-1',
              name: 'Tábua Especial',
              description: 'Frios selecionados',
              price: 60,
              image_path: null,
              is_available: false,
              is_featured: false,
              sort_order: 2,
              promotion: null,
              option_groups: [],
            },
          ],
        },
      ],
    });

    const user = userEvent.setup();
    renderPublicMenu('bistro-horizonte');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Bistrô Horizonte' })).toBeInTheDocument();
    });

    expect(screen.getByText('Ofertas vigentes agora')).toBeInTheDocument();
    expect(screen.getByText('Combo de Cerveja')).toBeInTheDocument();
    expect(screen.getByText('Indisponível')).toBeInTheDocument();

    // Garantir ausência absoluta de carrinho, checkout ou botão de compra
    expect(screen.queryByText(/carrinho/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/checkout/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/finalizar pedido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/comprar/i)).not.toBeInTheDocument();

    // Abrir detalhes do produto e conferir adicionais
    await user.click(screen.getByText('Combo de Cerveja'));
    await waitFor(() => {
      expect(screen.getByText('Escolha o acompanhamento')).toBeInTheDocument();
      expect(screen.getByText('Amendoim')).toBeInTheDocument();
      expect(screen.getByText(/\+ R\$\s?5,00/)).toBeInTheDocument();
    });
  });

  it('exibe estado apropriado quando estabelecimento não está publicado', async () => {
    vi.spyOn(publicMenuService, 'getBySlug').mockResolvedValue({
      status: 'unpublished',
    });

    renderPublicMenu('loja-em-breve');

    await waitFor(() => {
      expect(screen.getByText('Cardápio em preparação')).toBeInTheDocument();
    });
  });
});

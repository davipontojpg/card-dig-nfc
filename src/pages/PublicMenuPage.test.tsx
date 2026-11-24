import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { PublicMenuPage } from './PublicMenuPage';
import { publicMenuService } from '../services/public-menu.service';

function renderPublicMenu(slug: string, query = '') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/m/${slug}${query}`]}>
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

  it('exibe promoção comum (always) quando estabelecimento possui apenas basic_promotions', async () => {
    vi.spyOn(publicMenuService, 'getBySlug').mockResolvedValue({
      status: 'ok',
      evaluated_at: '2026-11-23T22:00:00Z',
      store: {
        id: 'store-2',
        name: 'Café Central',
        slug: 'cafe-central',
        business_type: 'Cafeteria',
        description: null,
        logo_path: null,
        primary_color: '#0f766e',
        public_phone: null,
        public_address: null,
        timezone: 'America/Sao_Paulo',
      },
      features: {
        digital_menu: true,
        qr_code: true,
        basic_promotions: true,
        scheduled_promotions: false,
      },
      active_promotions: [
        {
          promotion_id: 'promo-common-1',
          name: 'Oferta da Semana',
          description: 'Desconto direto',
          schedule_type: 'always',
          ends_at: null,
          end_time: null,
        },
      ],
      categories: [
        {
          id: 'cat-2',
          name: 'Cafés',
          description: null,
          sort_order: 1,
          products: [
            {
              id: 'prod-3',
              category_id: 'cat-2',
              name: 'Cappuccino',
              description: null,
              price: 15,
              image_path: null,
              is_available: true,
              is_featured: false,
              sort_order: 1,
              promotion: {
                promotion_id: 'promo-common-1',
                name: 'Oferta da Semana',
                description: 'Desconto direto',
                discount_type: 'fixed_price',
                discount_value: 12,
                original_price: 15,
                promotional_price: 12,
                schedule_type: 'always',
              },
              option_groups: [],
            },
          ],
        },
      ],
    });

    renderPublicMenu('cafe-central');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Café Central' })).toBeInTheDocument();
    });

    expect(screen.getByText('Ofertas vigentes agora')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?12,00/)).toBeInTheDocument();
  });

  it('exibe banner de modo prévia quando acessado com ?preview=1', async () => {
    vi.spyOn(publicMenuService, 'getPreviewBySlug').mockResolvedValue({
      status: 'ok',
      is_preview: true,
      lifecycle_status: 'pending_setup',
      is_published: false,
      evaluated_at: '2026-11-23T22:00:00Z',
      store: {
        id: 'store-3',
        name: 'Pizzaria Nova',
        slug: 'pizzaria-nova',
        business_type: 'Pizzaria',
        description: null,
        logo_path: null,
        primary_color: '#b45309',
        public_phone: null,
        public_address: null,
        timezone: 'America/Sao_Paulo',
      },
      features: {
        digital_menu: true,
        qr_code: true,
        basic_promotions: false,
        scheduled_promotions: false,
      },
      active_promotions: [],
      categories: [],
    });

    renderPublicMenu('pizzaria-nova', '?preview=1');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pizzaria Nova' })).toBeInTheDocument();
    });

    expect(screen.getByText(/Modo prévia/i)).toBeInTheDocument();
  });

  it('exibe variantes disponíveis selecionáveis e bloqueia variantes esgotadas', async () => {
    vi.spyOn(publicMenuService, 'getBySlug').mockResolvedValue({
      status: 'ok',
      evaluated_at: '2026-11-24T22:00:00Z',
      store: {
        id: 'store-4',
        name: 'Conveniência Express',
        slug: 'conveniencia-express',
        business_type: 'Conveniência',
        description: null,
        logo_path: null,
        primary_color: '#0f766e',
        public_phone: null,
        public_address: null,
        timezone: 'America/Sao_Paulo',
      },
      features: {
        digital_menu: true,
        qr_code: true,
        basic_promotions: false,
        scheduled_promotions: false,
      },
      active_promotions: [],
      categories: [
        {
          id: 'cat-4',
          name: 'Energéticos',
          description: null,
          sort_order: 1,
          products: [
            {
              id: 'prod-monster',
              category_id: 'cat-4',
              name: 'Monster',
              description: 'Lata 473ml',
              price: 12,
              image_path: null,
              is_available: true,
              is_featured: false,
              sort_order: 1,
              variant_label: 'Sabores',
              variants: [
                { id: 'v-1', name: 'Manga', is_available: true, sort_order: 1 },
                { id: 'v-2', name: 'Morango', is_available: false, sort_order: 2 },
                { id: 'v-3', name: 'Maçã Verde', is_available: true, sort_order: 3 },
              ],
              promotion: null,
              option_groups: [],
            },
          ],
        },
      ],
    });

    const user = userEvent.setup();
    renderPublicMenu('conveniencia-express');

    await waitFor(() => {
      expect(screen.getByText('Monster')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Monster'));

    const dialog = await screen.findByRole('dialog');
    const mangaBtn = within(dialog).getByRole('button', { name: /^Manga$/i });
    const morangoBtn = within(dialog).getByRole('button', { name: /Morango/i });

    expect(mangaBtn).not.toBeDisabled();
    expect(morangoBtn).toBeDisabled();

    await user.click(mangaBtn);
    expect(mangaBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('exibe destaques de promoção direta no topo e combos em lote com soma riscada', async () => {
    vi.spyOn(publicMenuService, 'getBySlug').mockResolvedValue({
      status: 'ok',
      evaluated_at: '2026-11-24T22:00:00Z',
      store: {
        id: 'store-5',
        name: 'Burger Prime',
        slug: 'burger-prime',
        business_type: 'Hamburgueria',
        description: null,
        logo_path: null,
        primary_color: '#0f766e',
        public_phone: null,
        public_address: null,
        timezone: 'America/Sao_Paulo',
      },
      features: {
        digital_menu: true,
        qr_code: true,
        basic_promotions: true,
        scheduled_promotions: true,
      },
      active_promotions: [],
      highlighted_products: [
        {
          product_id: 'prod-smash',
          name: 'Smash Duplo',
          original_price: 32,
          promotional_price: 24.9,
          image_path: null,
        },
      ],
      bundles: [
        {
          id: 'bundle-1',
          name: 'Combo Sextou',
          description: 'Para dividir',
          regular_total: 84,
          promo_price: 69.9,
          highlight_top: true,
          items: [
            {
              product_id: 'prod-smash',
              product_name: 'Smash Duplo',
              quantity: 2,
              unit_price: 32,
              image_path: null,
            },
            {
              product_id: 'prod-batata',
              product_name: 'Batata Grande',
              quantity: 1,
              unit_price: 20,
              image_path: null,
            },
          ],
        },
      ],
      categories: [],
    });

    renderPublicMenu('burger-prime');

    await waitFor(() => {
      expect(screen.getByText('Ofertas vigentes agora')).toBeInTheDocument();
    });

    expect(screen.getByText('Smash Duplo')).toBeInTheDocument();
    expect(screen.getAllByText('Combo Sextou').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2x Smash Duplo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R\$\s?69,90/).length).toBeGreaterThanOrEqual(1);
  });
});

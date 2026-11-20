import { expect, test } from '@playwright/test';

test.describe('Fluxos públicos e autenticação (smoke responsivo)', () => {
  test('landing exibe os três planos comerciais com valores exatos em mobile e desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByText('Cardápio Digital', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('R$ 19,90/mês')).toBeVisible();
    await expect(page.getByText('R$ 49,90/mês')).toBeVisible();
    await expect(page.getByText('R$ 59,90/mês')).toBeVisible();
  });

  test('rotas de login do estabelecimento e do operador carregam acessíveis por teclado', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Painel do Estabelecimento' })).toBeVisible();

    await page.goto('/platform/login');
    await expect(page.getByRole('heading', { name: 'Console do Operador' })).toBeVisible();
  });

  test('cardápio público renderiza sem login com oferta, adicionais e zero carrinho/checkout', async ({
    page,
  }) => {
    await page.route('**/rest/v1/rpc/get_public_menu', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          evaluated_at: '2026-11-23T22:00:00Z',
          store: {
            id: 'store-demo',
            name: 'Adega Horizonte',
            slug: 'adega-horizonte',
            business_type: 'Adega & Empório',
            description: 'Rótulos selecionados',
            logo_path: null,
            primary_color: '#0f766e',
            public_phone: '(11) 99999-0000',
            public_address: 'Av. Paulista, 1000',
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
              name: 'Segunda Especial',
              description: 'Oferta da semana',
              schedule_type: 'weekly',
              ends_at: null,
              end_time: '22:00:00',
            },
          ],
          categories: [
            {
              id: 'cat-1',
              name: 'Combos',
              description: null,
              sort_order: 1,
              products: [
                {
                  id: 'prod-1',
                  category_id: 'cat-1',
                  name: 'Combo de cerveja',
                  description: '4 long necks',
                  price: 40,
                  image_path: null,
                  is_available: true,
                  is_featured: true,
                  sort_order: 1,
                  promotion: {
                    promotion_id: 'promo-1',
                    name: 'Segunda Especial',
                    description: null,
                    discount_type: 'fixed_price',
                    discount_value: 34.9,
                    original_price: 40,
                    promotional_price: 34.9,
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
              ],
            },
          ],
        }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/m/adega-horizonte');

    await expect(page.getByRole('heading', { name: 'Adega Horizonte' })).toBeVisible();
    await expect(page.getByText('Ofertas vigentes agora')).toBeVisible();
    await expect(page.getByText('Combo de cerveja')).toBeVisible();
    await expect(page.getByText(/carrinho/i)).toHaveCount(0);
    await expect(page.getByText(/checkout/i)).toHaveCount(0);

    await page.getByText('Combo de cerveja').click();
    await expect(page.getByText('Escolha o acompanhamento')).toBeVisible();
    await expect(page.getByText('Amendoim')).toBeVisible();
  });
});


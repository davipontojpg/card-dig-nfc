import { describe, expect, it } from 'vitest';
import { productSchema } from './product.schema';
import { optionGroupSchema } from './option.schema';
import { promotionSchema } from './promotion.schema';
import { storeAppearanceSchema } from './store.schema';

describe('Zod schemas de validação', () => {
  it('exige preço maior que zero para produto ativo', () => {
    const res = productSchema.safeParse({
      category_id: '11111111-1111-4111-8111-111111111111',
      name: 'Cerveja IPA',
      price: 0,
      is_active: true,
      is_available: true,
      is_featured: false,
      sort_order: 1,
    });
    expect(res.success).toBe(false);
  });

  it('valida regras de grupo obrigatório e mínimo/máximo', () => {
    const invalidRequired = optionGroupSchema.safeParse({
      name: 'Ponto da carne',
      is_required: true,
      min_selection: 0,
      max_selection: 1,
      sort_order: 0,
      is_active: true,
    });
    expect(invalidRequired.success).toBe(false);

    const invalidRange = optionGroupSchema.safeParse({
      name: 'Molhos',
      is_required: false,
      min_selection: 3,
      max_selection: 2,
      sort_order: 0,
      is_active: true,
    });
    expect(invalidRange.success).toBe(false);
  });

  it('rejeita promoção semanal que atravessa a meia-noite e aceita regra válida', () => {
    const crossesMidnight = promotionSchema.safeParse({
      name: 'Madrugada',
      schedule_type: 'weekly',
      discount_type: 'percent_off',
      discount_value: 15,
      weekdays: [5],
      start_time: '22:00',
      end_time: '02:00',
      priority: 0,
      is_active: true,
      products: [{ product_id: '11111111-1111-4111-8111-111111111111' }],
    });
    expect(crossesMidnight.success).toBe(false);

    const valid = promotionSchema.safeParse({
      name: 'Segunda da Casa',
      schedule_type: 'weekly',
      discount_type: 'percent_off',
      discount_value: 15,
      weekdays: [1],
      start_time: '18:00',
      end_time: '22:00',
      priority: 10,
      is_active: true,
      products: [{ product_id: '11111111-1111-4111-8111-111111111111' }],
    });
    expect(valid.success).toBe(true);

    const validAlways = promotionSchema.safeParse({
      name: 'Oferta da Casa',
      schedule_type: 'always',
      discount_type: 'amount_off',
      discount_value: 5,
      priority: 0,
      is_active: true,
      products: [{ product_id: '11111111-1111-4111-8111-111111111111' }],
    });
    expect(validAlways.success).toBe(true);
  });

  it('rejeita slug reservado na aparência da loja', () => {
    const res = storeAppearanceSchema.safeParse({
      name: 'Minha Loja',
      slug: 'platform',
      primary_color: '#0f766e',
      timezone: 'America/Sao_Paulo',
      is_published: false,
    });
    expect(res.success).toBe(false);
  });
});


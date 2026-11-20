import { z } from 'zod';

export const promotionProductSelectionSchema = z
  .object({
    product_id: z.string().uuid(),
    discount_type_override: z
      .enum(['percent_off', 'amount_off', 'fixed_price'])
      .optional()
      .nullable(),
    discount_value_override: z.coerce.number().optional().nullable(),
  })
  .superRefine((item, ctx) => {
    const hasType = Boolean(item.discount_type_override);
    const hasVal =
      item.discount_value_override !== null &&
      item.discount_value_override !== undefined &&
      !Number.isNaN(item.discount_value_override);

    if (hasType !== hasVal) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe tipo e valor juntos ao personalizar desconto de um produto.',
      });
    }
    if (hasType && hasVal) {
      const val = Number(item.discount_value_override);
      if (item.discount_type_override === 'percent_off' && (val <= 0 || val >= 100)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Percentual personalizado deve estar entre 0,01% e 99,99%.',
        });
      }
      if (
        (item.discount_type_override === 'amount_off' ||
          item.discount_type_override === 'fixed_price') &&
        val <= 0
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Valor personalizado deve ser maior que zero.',
        });
      }
    }
  });

export const promotionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Informe o nome da promoção.')
      .max(120, 'Máximo de 120 caracteres.'),
    description: z.string().trim().max(400, 'Máximo de 400 caracteres.').optional().nullable(),
    schedule_type: z.enum(['once', 'weekly']),
    discount_type: z.enum(['percent_off', 'amount_off', 'fixed_price']),
    discount_value: z.coerce
      .number({ error: 'Informe um valor de desconto válido.' })
      .positive('O valor do desconto deve ser maior que zero.')
      .transform((val) => Math.round(val * 100) / 100),
    starts_at_local: z.string().optional().nullable(),
    ends_at_local: z.string().optional().nullable(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional().default([]),
    start_time: z.string().optional().nullable(),
    end_time: z.string().optional().nullable(),
    valid_from: z.string().optional().nullable(),
    valid_until: z.string().optional().nullable(),
    priority: z.coerce.number().int().min(-100).max(1000).default(0),
    is_active: z.boolean().default(true),
    products: z
      .array(promotionProductSelectionSchema)
      .min(1, 'Selecione pelo menos um produto para a promoção.'),
  })
  .superRefine((data, ctx) => {
    if (data.discount_type === 'percent_off' && (data.discount_value <= 0 || data.discount_value >= 100)) {
      ctx.addIssue({
        code: 'custom',
        path: ['discount_value'],
        message: 'Desconto percentual deve ser maior que 0% e menor que 100%.',
      });
    }

    if (data.schedule_type === 'once') {
      if (!data.starts_at_local) {
        ctx.addIssue({
          code: 'custom',
          path: ['starts_at_local'],
          message: 'Informe data e hora de início.',
        });
      }
      if (!data.ends_at_local) {
        ctx.addIssue({
          code: 'custom',
          path: ['ends_at_local'],
          message: 'Informe data e hora de término.',
        });
      }
      if (data.starts_at_local && data.ends_at_local && data.ends_at_local <= data.starts_at_local) {
        ctx.addIssue({
          code: 'custom',
          path: ['ends_at_local'],
          message: 'O término deve ser posterior ao início.',
        });
      }
    } else {
      if (!data.weekdays || data.weekdays.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['weekdays'],
          message: 'Selecione ao menos um dia da semana.',
        });
      }
      if (!data.start_time) {
        ctx.addIssue({
          code: 'custom',
          path: ['start_time'],
          message: 'Informe o horário inicial.',
        });
      }
      if (!data.end_time) {
        ctx.addIssue({
          code: 'custom',
          path: ['end_time'],
          message: 'Informe o horário final.',
        });
      }
      if (data.start_time && data.end_time && data.end_time <= data.start_time) {
        ctx.addIssue({
          code: 'custom',
          path: ['end_time'],
          message:
            'O horário final deve ser posterior ao inicial (recorrência semanal não atravessa a meia-noite).',
        });
      }
      if (data.valid_from && data.valid_until && data.valid_until < data.valid_from) {
        ctx.addIssue({
          code: 'custom',
          path: ['valid_until'],
          message: 'A data final de validade não pode ser anterior à inicial.',
        });
      }
    }
  });

export type PromotionFormValues = z.infer<typeof promotionSchema>;


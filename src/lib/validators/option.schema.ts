import { z } from 'zod';

export const optionGroupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'O nome do grupo deve ter pelo menos 2 caracteres.')
      .max(80, 'Máximo de 80 caracteres.'),
    description: z.string().trim().max(240, 'Máximo de 240 caracteres.').optional().nullable(),
    is_required: z.boolean(),
    min_selection: z.coerce.number().int().min(0, 'Mínimo deve ser >= 0.').max(99),
    max_selection: z.coerce.number().int().min(1, 'Máximo deve ser >= 1.').max(99),
    sort_order: z.coerce.number().int().min(0).max(9999),
    is_active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.max_selection < data.min_selection) {
      ctx.addIssue({
        code: 'custom',
        path: ['max_selection'],
        message: 'Quantidade máxima deve ser maior ou igual à mínima.',
      });
    }
    if (data.is_required && data.min_selection < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['min_selection'],
        message: 'Grupos obrigatórios devem exigir mínimo de pelo menos 1 opção.',
      });
    }
  });

export const productOptionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome da opção.')
    .max(80, 'Máximo de 80 caracteres.'),
  description: z.string().trim().max(200, 'Máximo de 200 caracteres.').optional().nullable(),
  extra_price: z.coerce
    .number({ error: 'Informe um valor numérico válido.' })
    .min(0, 'O acréscimo não pode ser negativo.')
    .max(99999.99)
    .transform((val) => Math.round(val * 100) / 100),
  sort_order: z.coerce.number().int().min(0).max(9999),
  is_active: z.boolean(),
});

export type OptionGroupFormValues = z.infer<typeof optionGroupSchema>;
export type ProductOptionFormValues = z.infer<typeof productOptionSchema>;


import { z } from 'zod';

export const productSchema = z
  .object({
    category_id: z.string().uuid('Selecione uma categoria válida.'),
    name: z
      .string()
      .trim()
      .min(2, 'O nome do produto deve ter pelo menos 2 caracteres.')
      .max(120, 'O nome deve ter no máximo 120 caracteres.'),
    description: z.string().trim().max(800, 'Máximo de 800 caracteres.').optional().nullable(),
    price: z.coerce
      .number({ error: 'Informe um preço numérico válido.' })
      .min(0, 'O preço não pode ser negativo.')
      .max(999999.99, 'Preço acima do limite permitido.')
      .transform((val) => Math.round(val * 100) / 100),
    is_active: z.boolean(),
    is_available: z.boolean(),
    is_featured: z.boolean(),
    sort_order: z.coerce.number().int().min(0).max(9999),
  })
  .superRefine((data, ctx) => {
    if (data.is_active && data.price <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['price'],
        message: 'Produtos ativos precisam ter preço maior que R$ 0,00.',
      });
    }
  });

export type ProductFormValues = z.infer<typeof productSchema>;


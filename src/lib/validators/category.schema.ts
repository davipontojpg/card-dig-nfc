import { z } from 'zod';

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome da categoria deve ter pelo menos 2 caracteres.')
    .max(80, 'O nome da categoria deve ter no máximo 80 caracteres.'),
  description: z.string().trim().max(300, 'Máximo de 300 caracteres.').optional().nullable(),
  sort_order: z.coerce
    .number()
    .int('A ordem deve ser um número inteiro.')
    .min(0, 'A ordem não pode ser negativa.')
    .max(9999, 'Valor máximo: 9999.'),
  is_active: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;


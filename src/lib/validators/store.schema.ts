import { z } from 'zod';
import { isValidSlug, normalizeSlug } from '../formatters';

export const storeAppearanceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome público com pelo menos 2 caracteres.')
    .max(120, 'O nome público deve ter no máximo 120 caracteres.'),
  slug: z
    .string()
    .trim()
    .transform((val) => normalizeSlug(val))
    .refine((val) => isValidSlug(val), {
      message:
        'Slug inválido ou reservado. Use entre 3 e 63 letras minúsculas, números e hifens.',
    }),
  business_type: z.string().trim().max(80, 'Máximo de 80 caracteres.').optional().nullable(),
  description: z.string().trim().max(500, 'Máximo de 500 caracteres.').optional().nullable(),
  public_phone: z.string().trim().max(40, 'Máximo de 40 caracteres.').optional().nullable(),
  public_address: z.string().trim().max(240, 'Máximo de 240 caracteres.').optional().nullable(),
  primary_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Informe uma cor hexadecimal válida (ex.: #0f766e).'),
  timezone: z.string().trim().min(3, 'Informe um fuso horário válido.'),
  is_published: z.boolean(),
});

export const provisionStoreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome comercial com pelo menos 2 caracteres.')
    .max(120, 'Máximo de 120 caracteres.'),
  slug: z
    .string()
    .trim()
    .transform((val) => normalizeSlug(val))
    .refine((val) => isValidSlug(val), {
      message:
        'Slug inválido ou reservado. Use entre 3 e 63 caracteres (letras minúsculas, números e hifens).',
    }),
  business_type: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  public_phone: z.string().trim().max(40).optional().nullable(),
  public_address: z.string().trim().max(240).optional().nullable(),
  primary_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Cor principal deve ser hexadecimal (#RRGGBB).'),
  timezone: z.string().trim().min(3, 'Fuso horário é obrigatório.'),
  contact_name: z
    .string()
    .trim()
    .min(2, 'Informe o nome do responsável pelo estabelecimento.')
    .max(120),
  contact_email: z.email('Informe um e-mail válido para acesso do proprietário.'),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  internal_notes: z.string().trim().max(2000).optional().nullable(),
  plan_id: z.string().uuid('Selecione um plano válido.'),
  subscription_status: z.enum(['trialing', 'active', 'past_due', 'suspended', 'canceled']),
  setup_fee_status: z.enum(['pending', 'paid', 'waived']),
  started_at: z.string().optional().nullable(),
  current_period_start: z.string().optional().nullable(),
  current_period_end: z.string().optional().nullable(),
  next_billing_at: z.string().optional().nullable(),
  onboarding_status: z.enum([
    'pending_data',
    'in_setup',
    'awaiting_client',
    'ready',
    'completed',
  ]),
});

export type StoreAppearanceFormValues = z.infer<typeof storeAppearanceSchema>;
export type ProvisionStoreFormValues = z.infer<typeof provisionStoreSchema>;


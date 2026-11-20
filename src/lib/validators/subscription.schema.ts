import { z } from 'zod';

export const subscriptionUpdateSchema = z
  .object({
    plan_id: z.string().uuid('Selecione um plano válido.'),
    status: z.enum(['trialing', 'active', 'past_due', 'suspended', 'canceled']),
    setup_fee_status: z.enum(['pending', 'paid', 'waived']),
    monthly_price_snapshot: z.coerce
      .number()
      .min(0, 'Mensalidade não pode ser negativa.')
      .transform((val) => Math.round(val * 100) / 100),
    setup_fee_snapshot: z.coerce
      .number()
      .min(0, 'Taxa de implantação não pode ser negativa.')
      .transform((val) => Math.round(val * 100) / 100),
    started_at: z.string().optional().nullable(),
    current_period_start: z.string().optional().nullable(),
    current_period_end: z.string().optional().nullable(),
    next_billing_at: z.string().optional().nullable(),
    last_payment_at: z.string().optional().nullable(),
    grace_until: z.string().optional().nullable(),
    subscription_internal_notes: z.string().max(2000).optional().nullable(),
    reason: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (
      data.current_period_start &&
      data.current_period_end &&
      data.current_period_end < data.current_period_start
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['current_period_end'],
        message: 'Fim do período vigente deve ser maior ou igual ao início.',
      });
    }
  });

export type SubscriptionUpdateFormValues = z.infer<typeof subscriptionUpdateSchema>;


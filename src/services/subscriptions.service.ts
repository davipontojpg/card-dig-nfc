import { supabase } from '../lib/supabase';
import type { SetupFeeStatus, SubscriptionStatus } from '../types/database';
import type { StoreSubscriptionRow } from '../types/domain';

export interface UpdateSubscriptionInput {
  store_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  setup_fee_status: SetupFeeStatus;
  monthly_price_snapshot?: number | null;
  setup_fee_snapshot?: number | null;
  started_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  next_billing_at?: string | null;
  last_payment_at?: string | null;
  grace_until?: string | null;
  subscription_internal_notes?: string | null;
  reason?: string | null;
}

export const subscriptionsService = {
  async updateSubscription(input: UpdateSubscriptionInput): Promise<StoreSubscriptionRow> {
    const { data, error } = await supabase.rpc('platform_update_subscription', {
      p_store_id: input.store_id,
      p_plan_id: input.plan_id,
      p_status: input.status,
      p_setup_fee_status: input.setup_fee_status,
      p_monthly_price_snapshot: input.monthly_price_snapshot ?? null,
      p_setup_fee_snapshot: input.setup_fee_snapshot ?? null,
      p_started_at: input.started_at ?? null,
      p_current_period_start: input.current_period_start ?? null,
      p_current_period_end: input.current_period_end ?? null,
      p_next_billing_at: input.next_billing_at ?? null,
      p_last_payment_at: input.last_payment_at ?? null,
      p_grace_until: input.grace_until ?? null,
      p_subscription_internal_notes: input.subscription_internal_notes ?? null,
      p_reason: input.reason ?? null,
    });
    if (error) throw error;
    return {
      ...data,
      monthly_price_snapshot: Number(data.monthly_price_snapshot),
      setup_fee_snapshot: Number(data.setup_fee_snapshot),
    };
  },
};


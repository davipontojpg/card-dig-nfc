import { supabase } from '../lib/supabase';
import type { ProvisionStorePayload, ProvisionStoreResult } from '../types/domain';

export type ResendInviteMode =
  | 'resend_owner_invite'
  | 'link_existing_confirmed'
  | 'invite_editor';

export interface ResendInvitePayload {
  store_id: string;
  mode: ResendInviteMode;
  email?: string;
  full_name?: string;
  redirect_to?: string;
}

export interface ResendInviteResult {
  status: string;
  message: string;
  owner_invite_status?: string;
}

function extractFunctionError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const maybeErr = error as { message?: string; context?: { json?: () => Promise<{ error?: string }> } };
    if (maybeErr.message) return maybeErr.message;
  }
  return fallback;
}

export const provisioningService = {
  async provisionStore(
    payload: ProvisionStorePayload & { redirect_to?: string }
  ): Promise<ProvisionStoreResult> {
    const { data, error } = await supabase.functions.invoke('provision-store', {
      body: payload,
    });
    if (error) {
      throw new Error(
        extractFunctionError(error, 'Erro ao provisionar estabelecimento via Edge Function.')
      );
    }
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error));
    }
    return data as ProvisionStoreResult;
  },

  async resendOrManageInvite(payload: ResendInvitePayload): Promise<ResendInviteResult> {
    const { data, error } = await supabase.functions.invoke('resend-store-invite', {
      body: payload,
    });
    if (error) {
      throw new Error(extractFunctionError(error, 'Erro ao executar operação de convite.'));
    }
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error));
    }
    return data as ResendInviteResult;
  },
};


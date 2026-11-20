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

export async function extractFunctionError(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === 'object') {
    const maybeErr = error as {
      message?: string;
      context?: Response;
    };

    const res = maybeErr.context;
    if (res && typeof res === 'object') {
      const status = typeof res.status === 'number' ? res.status : null;
      let detail = '';

      try {
        const clone = typeof res.clone === 'function' ? res.clone() : res;
        const json = (await clone.json()) as {
          error?: unknown;
          message?: unknown;
          msg?: unknown;
        };
        const rawMsg = json?.error ?? json?.message ?? json?.msg;
        if (typeof rawMsg === 'string' && rawMsg.trim()) {
          detail = rawMsg.trim();
        }
      } catch {
        try {
          const text = await res.text();
          if (text.trim()) {
            detail = text.trim().slice(0, 240);
          }
        } catch {
          // Ignorar falha de leitura de corpo
        }
      }

      if (detail) {
        return status ? `[HTTP ${status}] ${detail}` : detail;
      }
      if (status) {
        return `Erro HTTP ${status} ao chamar a Edge Function.`;
      }
    }

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
        await extractFunctionError(error, 'Erro ao provisionar estabelecimento via Edge Function.')
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
      throw new Error(await extractFunctionError(error, 'Erro ao executar operação de convite.'));
    }
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error));
    }
    return data as ResendInviteResult;
  },
};

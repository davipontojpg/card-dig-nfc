import { describe, expect, it } from 'vitest';
import {
  validateProvisionPayload,
  validateResendInvitePayload,
} from '../../../supabase/functions/_shared/validation';
import { extractFunctionError } from '../../services/provisioning.service';

describe('Validação das Edge Functions de provisionamento e convites', () => {
  const validPayload = {
    name: 'Adega Central',
    slug: 'adega-central',
    primary_color: '#0f766e',
    timezone: 'America/Sao_Paulo',
    contact_name: 'Carlos Silva',
    contact_email: 'Carlos@Adega.com.br',
    plan_id: '11111111-1111-4111-8111-111111111111',
    subscription_status: 'trialing',
    setup_fee_status: 'pending',
    onboarding_status: 'pending_data',
  };

  it('aceita payload válido e normaliza e-mail e slug', () => {
    const res = validateProvisionPayload(validPayload);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.contact_email).toBe('carlos@adega.com.br');
      expect(res.data.slug).toBe('adega-central');
    }
  });

  it('rejeita slug reservado ou e-mail inválido', () => {
    expect(validateProvisionPayload({ ...validPayload, slug: 'platform' }).ok).toBe(false);
    expect(validateProvisionPayload({ ...validPayload, contact_email: 'invalido' }).ok).toBe(false);
  });

  it('exige e-mail ao convidar editor e valida modos permitidos de resend-store-invite', () => {
    expect(
      validateResendInvitePayload({
        store_id: '11111111-1111-4111-8111-111111111111',
        mode: 'invite_editor',
      }).ok
    ).toBe(false);

    expect(
      validateResendInvitePayload({
        store_id: '11111111-1111-4111-8111-111111111111',
        mode: 'link_existing_confirmed',
        email: 'dono@exemplo.com.br',
      }).ok
    ).toBe(true);
  });

  it('extrai mensagem real e status HTTP do corpo Response das Edge Functions', async () => {
    const response = new Response(
      JSON.stringify({ error: 'O slug "adega-central" já está em uso por outro estabelecimento.' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );

    const msg = await extractFunctionError(
      { message: 'Edge Function returned a non-2xx status code', context: response },
      'Fallback'
    );

    expect(msg).toContain('[HTTP 409]');
    expect(msg).toContain('já está em uso');
  });
});


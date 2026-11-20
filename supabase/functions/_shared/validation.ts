export const RESERVED_SLUGS = new Set([
  'login',
  'app',
  'admin',
  'platform',
  'm',
  'api',
  'auth',
  'assets',
  'static',
  'health',
  'status',
  'robots',
  'sitemap',
  'docs',
  'support',
  'billing',
  'settings',
  'onboarding',
]);

export interface ProvisionPayload {
  name: string;
  slug: string;
  business_type?: string | null;
  description?: string | null;
  public_phone?: string | null;
  public_address?: string | null;
  primary_color: string;
  timezone: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string | null;
  internal_notes?: string | null;
  plan_id: string;
  subscription_status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled';
  setup_fee_status: 'pending' | 'paid' | 'waived';
  started_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  next_billing_at?: string | null;
  onboarding_status: 'pending_data' | 'in_setup' | 'awaiting_client' | 'ready' | 'completed';
  redirect_to?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const VALID_SUB_STATUSES = new Set(['trialing', 'active', 'past_due', 'suspended', 'canceled']);
const VALID_FEE_STATUSES = new Set(['pending', 'paid', 'waived']);
const VALID_ONBOARDING_STATUSES = new Set([
  'pending_data',
  'in_setup',
  'awaiting_client',
  'ready',
  'completed',
]);

export function validateProvisionPayload(raw: unknown): {
  ok: true;
  data: ProvisionPayload;
} | {
  ok: false;
  error: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Payload inválido.' };
  }

  const input = raw as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  const primaryColor =
    typeof input.primary_color === 'string' && input.primary_color.trim()
      ? input.primary_color.trim()
      : '#0f766e';
  const timezone =
    typeof input.timezone === 'string' && input.timezone.trim()
      ? input.timezone.trim()
      : 'America/Sao_Paulo';
  const contactName = typeof input.contact_name === 'string' ? input.contact_name.trim() : '';
  const contactEmail =
    typeof input.contact_email === 'string' ? input.contact_email.trim().toLowerCase() : '';
  const planId = typeof input.plan_id === 'string' ? input.plan_id.trim() : '';
  const subStatus =
    typeof input.subscription_status === 'string' ? input.subscription_status : 'trialing';
  const feeStatus =
    typeof input.setup_fee_status === 'string' ? input.setup_fee_status : 'pending';
  const onboardingStatus =
    typeof input.onboarding_status === 'string' ? input.onboarding_status : 'pending_data';

  if (name.length < 2 || name.length > 120) {
    return { ok: false, error: 'Nome comercial deve ter entre 2 e 120 caracteres.' };
  }
  if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 63 || RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: 'Slug inválido ou reservado.' };
  }
  if (!HEX_COLOR_RE.test(primaryColor)) {
    return { ok: false, error: 'Cor principal deve estar no formato hexadecimal #RRGGBB.' };
  }
  if (contactName.length < 2 || contactName.length > 120) {
    return { ok: false, error: 'Nome do responsável deve ter entre 2 e 120 caracteres.' };
  }
  if (!EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: 'E-mail do proprietário inválido.' };
  }
  if (!UUID_RE.test(planId)) {
    return { ok: false, error: 'Identificador de plano inválido.' };
  }
  if (!VALID_SUB_STATUSES.has(subStatus)) {
    return { ok: false, error: 'Status de assinatura inválido.' };
  }
  if (!VALID_FEE_STATUSES.has(feeStatus)) {
    return { ok: false, error: 'Status da taxa de implantação inválido.' };
  }
  if (!VALID_ONBOARDING_STATUSES.has(onboardingStatus)) {
    return { ok: false, error: 'Status de onboarding inválido.' };
  }

  return {
    ok: true,
    data: {
      name,
      slug,
      business_type:
        typeof input.business_type === 'string' ? input.business_type.trim() || null : null,
      description:
        typeof input.description === 'string' ? input.description.trim() || null : null,
      public_phone:
        typeof input.public_phone === 'string' ? input.public_phone.trim() || null : null,
      public_address:
        typeof input.public_address === 'string' ? input.public_address.trim() || null : null,
      primary_color: primaryColor,
      timezone,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone:
        typeof input.contact_phone === 'string' ? input.contact_phone.trim() || null : null,
      internal_notes:
        typeof input.internal_notes === 'string' ? input.internal_notes.trim() || null : null,
      plan_id: planId,
      subscription_status: subStatus as ProvisionPayload['subscription_status'],
      setup_fee_status: feeStatus as ProvisionPayload['setup_fee_status'],
      started_at: typeof input.started_at === 'string' && input.started_at ? input.started_at : null,
      current_period_start:
        typeof input.current_period_start === 'string' && input.current_period_start
          ? input.current_period_start
          : null,
      current_period_end:
        typeof input.current_period_end === 'string' && input.current_period_end
          ? input.current_period_end
          : null,
      next_billing_at:
        typeof input.next_billing_at === 'string' && input.next_billing_at
          ? input.next_billing_at
          : null,
      onboarding_status: onboardingStatus as ProvisionPayload['onboarding_status'],
      redirect_to:
        typeof input.redirect_to === 'string' && input.redirect_to ? input.redirect_to : null,
    },
  };
}

export interface ResendInviteValidationResult {
  store_id: string;
  mode: 'resend_owner_invite' | 'link_existing_confirmed' | 'invite_editor';
  email: string | null;
  full_name: string | null;
  redirect_to: string | null;
}

export function validateResendInvitePayload(raw: unknown): {
  ok: true;
  data: ResendInviteValidationResult;
} | {
  ok: false;
  error: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Payload inválido.' };
  }
  const input = raw as Record<string, unknown>;
  const storeId = typeof input.store_id === 'string' ? input.store_id.trim() : '';
  const mode = typeof input.mode === 'string' ? input.mode : '';
  const email =
    typeof input.email === 'string' && input.email.trim()
      ? input.email.trim().toLowerCase()
      : null;

  if (!UUID_RE.test(storeId)) {
    return { ok: false, error: 'store_id inválido.' };
  }
  if (
    mode !== 'resend_owner_invite' &&
    mode !== 'link_existing_confirmed' &&
    mode !== 'invite_editor'
  ) {
    return { ok: false, error: 'Modo de convite inválido.' };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, error: 'E-mail informado é inválido.' };
  }
  if (mode === 'invite_editor' && !email) {
    return { ok: false, error: 'Informe o e-mail do editor a ser convidado.' };
  }

  return {
    ok: true,
    data: {
      store_id: storeId,
      mode,
      email,
      full_name: typeof input.full_name === 'string' ? input.full_name.trim() || null : null,
      redirect_to:
        typeof input.redirect_to === 'string' && input.redirect_to ? input.redirect_to : null,
    },
  };
}


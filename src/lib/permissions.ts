import type {
  FeatureKey,
  OnboardingStatus,
  PromotionDiscountType,
  StoreLifecycleStatus,
  SubscriptionStatus,
} from '../types/database';
import type { PromotionRow, StoreAccessContext } from '../types/domain';
import { DEFAULT_TIMEZONE } from './formatters';

export function hasFeature(
  features: readonly string[] | null | undefined,
  featureKey: FeatureKey
): boolean {
  if (!features) return false;
  return features.includes(featureKey);
}

export function isSubscriptionWritable(access: StoreAccessContext | null | undefined): boolean {
  if (!access) return false;
  return access.has_service_access;
}

export function getSubscriptionStatusMeta(status: SubscriptionStatus): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  description: string;
} {
  switch (status) {
    case 'active':
      return {
        label: 'Ativa',
        tone: 'success',
        description: 'Assinatura em dia com todos os recursos do plano liberados.',
      };
    case 'trialing':
      return {
        label: 'Em avaliação / Implantação',
        tone: 'success',
        description: 'Acesso completo aos recursos contratados durante o período inicial.',
      };
    case 'past_due':
      return {
        label: 'Em atraso',
        tone: 'warning',
        description:
          'Pagamento pendente. O acesso permanece ativo somente até a data limite de tolerância.',
      };
    case 'suspended':
      return {
        label: 'Suspensa',
        tone: 'danger',
        description: 'Cardápio público e recursos administrativos bloqueados até regularização.',
      };
    case 'canceled':
      return {
        label: 'Cancelada',
        tone: 'neutral',
        description: 'Contrato encerrado. Cardápio público indisponível.',
      };
  }
}

export function getLifecycleStatusMeta(status: StoreLifecycleStatus): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
} {
  switch (status) {
    case 'pending_setup':
      return { label: 'Em implantação', tone: 'warning' };
    case 'active':
      return { label: 'Ativo', tone: 'success' };
    case 'suspended':
      return { label: 'Suspenso', tone: 'danger' };
    case 'archived':
      return { label: 'Arquivado', tone: 'neutral' };
  }
}

export function getOnboardingStatusMeta(status: OnboardingStatus): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
} {
  switch (status) {
    case 'pending_data':
      return { label: 'Aguardando dados', tone: 'warning' };
    case 'in_setup':
      return { label: 'Em configuração', tone: 'warning' };
    case 'awaiting_client':
      return { label: 'Aguardando cliente', tone: 'neutral' };
    case 'ready':
      return { label: 'Pronto para publicar', tone: 'success' };
    case 'completed':
      return { label: 'Concluído', tone: 'success' };
  }
}

export function calculatePromotionalPrice(
  basePrice: number,
  discountType: PromotionDiscountType,
  discountValue: number
): number | null {
  if (!Number.isFinite(basePrice) || !Number.isFinite(discountValue) || basePrice <= 0) {
    return null;
  }

  let result = 0;
  switch (discountType) {
    case 'percent_off':
      if (discountValue <= 0 || discountValue >= 100) return null;
      result = basePrice * (1 - discountValue / 100);
      break;
    case 'amount_off':
      if (discountValue <= 0) return null;
      result = basePrice - discountValue;
      break;
    case 'fixed_price':
      if (discountValue <= 0) return null;
      result = discountValue;
      break;
  }

  const rounded = Math.round(result * 100) / 100;
  if (rounded <= 0 || rounded >= basePrice) {
    return null;
  }
  return rounded;
}

export type DerivedPromotionStatus = 'paused' | 'scheduled' | 'active_now' | 'ended';

export function getPromotionStatusMeta(status: DerivedPromotionStatus): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
} {
  switch (status) {
    case 'active_now':
      return { label: 'Vigente agora', tone: 'success' };
    case 'scheduled':
      return { label: 'Programada', tone: 'warning' };
    case 'paused':
      return { label: 'Pausada', tone: 'neutral' };
    case 'ended':
      return { label: 'Encerrada', tone: 'danger' };
  }
}

/**
 * Deriva o estado administrativo da promoção para exibição na UI no fuso do estabelecimento.
 * Observação: a vigência pública oficial é sempre calculada no banco/servidor usando now().
 */
export function derivePromotionStatus(
  promo: Pick<
    PromotionRow,
    | 'is_active'
    | 'schedule_type'
    | 'starts_at'
    | 'ends_at'
    | 'weekdays'
    | 'start_time'
    | 'end_time'
    | 'valid_from'
    | 'valid_until'
  >,
  timezone: string = DEFAULT_TIMEZONE,
  now: Date = new Date()
): DerivedPromotionStatus {
  if (!promo.is_active) return 'paused';

  if (promo.schedule_type === 'once') {
    if (!promo.starts_at || !promo.ends_at) return 'paused';
    const starts = new Date(promo.starts_at).getTime();
    const ends = new Date(promo.ends_at).getTime();
    const nowMs = now.getTime();
    if (nowMs < starts) return 'scheduled';
    if (nowMs >= ends) return 'ended';
    return 'active_now';
  }

  // Semanal recorrente no fuso do estabelecimento
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const localDow = weekdayMap[get('weekday')] ?? 0;
  const localDate = `${get('year')}-${get('month')}-${get('day')}`;
  const rawHour = get('hour') === '24' ? '00' : get('hour');
  const localTime = `${rawHour}:${get('minute')}:${get('second')}`;

  if (promo.valid_until && localDate > promo.valid_until) {
    return 'ended';
  }
  if (promo.valid_from && localDate < promo.valid_from) {
    return 'scheduled';
  }

  const startTime = promo.start_time ?? '00:00:00';
  const endTime = promo.end_time ?? '23:59:59';
  const weekdays = promo.weekdays ?? [];

  if (weekdays.includes(localDow) && localTime >= startTime && localTime < endTime) {
    return 'active_now';
  }

  return 'scheduled';
}


export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

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

export const WEEKDAY_OPTIONS: Array<{ value: number; shortLabel: string; label: string }> = [
  { value: 0, shortLabel: 'Dom', label: 'Domingo' },
  { value: 1, shortLabel: 'Seg', label: 'Segunda-feira' },
  { value: 2, shortLabel: 'Ter', label: 'Terça-feira' },
  { value: 3, shortLabel: 'Qua', label: 'Quarta-feira' },
  { value: 4, shortLabel: 'Qui', label: 'Quinta-feira' },
  { value: 5, shortLabel: 'Sex', label: 'Sexta-feira' },
  { value: 6, shortLabel: 'Sáb', label: 'Sábado' },
];

export const COMMON_TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Cuiaba',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Bahia',
  'America/Rio_Branco',
  'America/Noronha',
];

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'R$ 0,00';
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num)) return 'R$ 0,00';
  return brlFormatter.format(num);
}

export function formatDateTimeInTz(
  iso: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateInTz(
  isoOrDate: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!isoOrDate) return '—';
  // Se vier YYYY-MM-DD puro, evitar deslocamento de dia por UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    const [year, month, day] = isoOrDate.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function normalizeSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function isValidSlug(slug: string): boolean {
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    slug.length >= 3 &&
    slug.length <= 63 &&
    !RESERVED_SLUGS.has(slug)
  );
}

export function getAccessibleTextColor(hexColor: string): '#ffffff' | '#0f172a' {
  const clean = hexColor.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#ffffff';

  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.42 ? '#0f172a' : '#ffffff';
}

export function formatTimeShort(timeValue: string | null | undefined): string {
  if (!timeValue) return '—';
  return timeValue.slice(0, 5);
}

export function formatWeekdaysSummary(weekdays: number[] | null | undefined): string {
  if (!weekdays || weekdays.length === 0) return '—';
  const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
  return sorted
    .map((day) => WEEKDAY_OPTIONS.find((w) => w.value === day)?.shortLabel ?? String(day))
    .join(', ');
}

/**
 * Converte data/hora local informada no formulário (YYYY-MM-DDTHH:mm) interpretada
 * no fuso do estabelecimento para string ISO UTC (timestamptz).
 */
export function localDateTimeInputToUtcIso(localValue: string, timezone: string): string {
  if (!localValue) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localValue);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcGuess));

  const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const tzHour = getPart('hour') === 24 ? 0 : getPart('hour');
  const tzTimestamp = Date.UTC(
    getPart('year'),
    getPart('month') - 1,
    getPart('day'),
    tzHour,
    getPart('minute'),
    getPart('second')
  );

  const offsetMs = tzTimestamp - utcGuess;
  return new Date(utcGuess - offsetMs).toISOString();
}

/**
 * Converte um ISO timestamptz para valor compatível com input datetime-local
 * exibido no fuso horário do estabelecimento.
 */
export function utcIsoToLocalDateTimeInput(iso: string | null | undefined, timezone: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}


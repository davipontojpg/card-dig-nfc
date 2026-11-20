import { describe, expect, it } from 'vitest';
import {
  calculatePromotionalPrice,
  derivePromotionStatus,
  hasAnyPromotionFeature,
  hasFeature,
} from './permissions';
import { isLocalOrPreviewUrl } from './env';

describe('permissions & promotion helpers', () => {
  it('verifica feature_key corretamente', () => {
    const features = ['digital_menu', 'qr_code'];
    expect(hasFeature(features, 'qr_code')).toBe(true);
    expect(hasFeature(features, 'nfc_access')).toBe(false);
    expect(hasFeature(features, 'basic_promotions')).toBe(false);
    expect(hasFeature(features, 'scheduled_promotions')).toBe(false);
    expect(hasAnyPromotionFeature(features)).toBe(false);
    expect(hasAnyPromotionFeature(['digital_menu', 'basic_promotions'])).toBe(true);
    expect(hasAnyPromotionFeature(['digital_menu', 'scheduled_promotions'])).toBe(true);
  });

  it('deriva estado administrativo da promoção comum (always)', () => {
    const baseAlways = {
      schedule_type: 'always' as const,
      starts_at: null,
      ends_at: null,
      weekdays: null,
      start_time: null,
      end_time: null,
      valid_from: null,
      valid_until: null,
    };

    expect(derivePromotionStatus({ ...baseAlways, is_active: true })).toBe('active_now');
    expect(derivePromotionStatus({ ...baseAlways, is_active: false })).toBe('paused');
  });

  it('calcula preço promocional para percent_off, amount_off e fixed_price sem permitir <= 0 ou >= base', () => {
    expect(calculatePromotionalPrice(50, 'percent_off', 15)).toBe(42.5);
    expect(calculatePromotionalPrice(50, 'amount_off', 5)).toBe(45);
    expect(calculatePromotionalPrice(50, 'fixed_price', 39.9)).toBe(39.9);
    expect(calculatePromotionalPrice(50, 'amount_off', 50)).toBeNull();
    expect(calculatePromotionalPrice(50, 'fixed_price', 55)).toBeNull();
  });

  it('deriva estado administrativo da promoção semanal em America/Sao_Paulo', () => {
    const promo = {
      is_active: true,
      schedule_type: 'weekly' as const,
      starts_at: null,
      ends_at: null,
      weekdays: [1], // Segunda-feira
      start_time: '18:00:00',
      end_time: '22:00:00',
      valid_from: null,
      valid_until: null,
    };

    // Segunda-feira 2026-11-23 às 19:00 BRT = 22:00 UTC
    expect(
      derivePromotionStatus(promo, 'America/Sao_Paulo', new Date('2026-11-23T22:00:00Z'))
    ).toBe('active_now');

    // Segunda-feira 2026-11-23 às 22:00 BRT (exclusivo!) = 2026-11-24T01:00:00Z
    expect(
      derivePromotionStatus(promo, 'America/Sao_Paulo', new Date('2026-11-24T01:00:00Z'))
    ).toBe('scheduled');
  });

  it('identifica URLs locais ou temporárias de preview para alerta NFC/QR', () => {
    expect(isLocalOrPreviewUrl('http://localhost:5173')).toBe(true);
    expect(isLocalOrPreviewUrl('https://preview.pages.dev')).toBe(true);
    expect(isLocalOrPreviewUrl('https://cardapio.minhaempresa.com.br')).toBe(false);
  });
});


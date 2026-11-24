import { describe, expect, it } from 'vitest';
import {
  formatBRL,
  formatDateInTz,
  formatDateTimeInTz,
  formatWeekdaysSummary,
  getAccessibleTextColor,
  isValidSlug,
  localDateTimeInputToUtcIso,
  normalizeSlug,
  parseDecimalInput,
  sanitizeDecimalInput,
  utcIsoToLocalDateTimeInput,
} from './formatters';

describe('formatters', () => {
  it('formata valores monetários em BRL corretamente', () => {
    expect(formatBRL(19.9)).toMatch(/R\$\s?19,90/);
    expect(formatBRL(100)).toMatch(/R\$\s?100,00/);
    expect(formatBRL(0)).toMatch(/R\$\s?0,00/);
  });

  it('normaliza e valida slugs rejeitando rotas reservadas', () => {
    expect(normalizeSlug('Adega São Paulo!')).toBe('adega-sao-paulo');
    expect(isValidSlug('adega-sao-paulo')).toBe(true);
    expect(isValidSlug('platform')).toBe(false);
    expect(isValidSlug('app')).toBe(false);
    expect(isValidSlug('login')).toBe(false);
    expect(isValidSlug('ab')).toBe(false);
  });

  it('converte data/hora local em America/Sao_Paulo para UTC ISO e vice-versa', () => {
    const utcIso = localDateTimeInputToUtcIso('2026-11-20T18:00', 'America/Sao_Paulo');
    expect(utcIso).toBe('2026-11-20T21:00:00.000Z');
    expect(utcIsoToLocalDateTimeInput(utcIso, 'America/Sao_Paulo')).toBe('2026-11-20T18:00');
  });

  it('formata datas YYYY-MM-DD sem deslocamento por fuso UTC', () => {
    expect(formatDateInTz('2026-11-23', 'America/Sao_Paulo')).toBe('23/11/2026');
    expect(formatDateTimeInTz('2026-11-20T21:00:00.000Z', 'America/Sao_Paulo')).toContain(
      '20/11/2026'
    );
  });

  it('resume dias da semana ordenados e escolhe contraste WCAG adequado', () => {
    expect(formatWeekdaysSummary([3, 1, 1])).toBe('Seg, Qua');
    expect(getAccessibleTextColor('#0f172a')).toBe('#ffffff');
    expect(getAccessibleTextColor('#f8fafc')).toBe('#0f172a');
  });

  it('sanitiza e converte entrada numérica livre sem aceitar texto', () => {
    expect(sanitizeDecimalInput('abc19,90xyz')).toBe('19,90');
    expect(sanitizeDecimalInput('24.999')).toBe('24,99');
    expect(parseDecimalInput('19,90')).toBe(19.9);
    expect(parseDecimalInput('150')).toBe(150);
    expect(parseDecimalInput('')).toBeNull();
  });
});


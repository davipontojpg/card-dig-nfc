import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NFC_QR_INSTRUCTION,
  sanitizeHexColor,
  wrapTextLines,
} from './qr-card-generator';

describe('qr-card-generator helpers', () => {
  it('valida e aplica fallback seguro para cores hexadecimais', () => {
    expect(sanitizeHexColor('#b45309')).toBe('#b45309');
    expect(sanitizeHexColor('  #0F766E  ')).toBe('#0F766E');
    expect(sanitizeHexColor('invalid')).toBe('#0f766e');
    expect(sanitizeHexColor(null)).toBe('#0f766e');
  });

  it('quebra textos longos em múltiplas linhas respeitando a largura máxima', () => {
    const lines = wrapTextLines(DEFAULT_NFC_QR_INSTRUCTION, 30, (sample) => sample.length);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.length <= 30)).toBe(true);
    expect(lines.join(' ')).toBe(DEFAULT_NFC_QR_INSTRUCTION);
  });
});

import QRCode from 'qrcode';
import { getAccessibleTextColor } from './formatters';

export const DEFAULT_NFC_QR_INSTRUCTION =
  'Aproxime o celular do indicador ou escaneie o QR Code para ver o cardápio';

export const DEFAULT_QR_ONLY_INSTRUCTION =
  'Escaneie o QR Code com a câmera do celular para ver o cardápio';

export interface BrandedQrCardOptions {
  storeName: string;
  slug: string;
  publicUrl: string;
  primaryColor: string;
  logoUrl?: string | null;
  instructionText?: string;
  showNfcIcon?: boolean;
}

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 1680;

export function sanitizeHexColor(hex: string | null | undefined, fallback = '#0f766e'): string {
  if (!hex) return fallback;
  const trimmed = hex.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

export function wrapTextLines(
  text: string,
  maxWidth: number,
  measureText: (sample: string) => number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${currentLine} ${words[i]}`;
    if (measureText(candidate) <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawNfcIcon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;

  // Ponto central
  ctx.beginPath();
  ctx.arc(centerX - 18, centerY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Ondas NFC
  const radii = [16, 29, 42];
  for (const radius of radii) {
    ctx.beginPath();
    ctx.arc(centerX - 18, centerY, radius, -Math.PI / 3.4, Math.PI / 3.4);
    ctx.stroke();
  }
  ctx.restore();
}

async function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
  // Tenta via fetch + ObjectURL primeiro para evitar problemas de CORS/tainted canvas
  if (!src.startsWith('data:') && typeof fetch === 'function') {
    try {
      const response = await fetch(src, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        try {
          const img = await loadHtmlImage(objectUrl);
          return img;
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }
    } catch {
      // Fallback para Image com crossOrigin
    }
  }

  try {
    return await loadHtmlImage(src, true);
  } catch {
    return null;
  }
}

function loadHtmlImage(src: string, useCrossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCrossOrigin && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem.'));
    img.src = src;
  });
}

export async function generateBrandedQrCardDataUrl(
  options: BrandedQrCardOptions
): Promise<string> {
  const accentColor = sanitizeHexColor(options.primaryColor);
  const contrastText = getAccessibleTextColor(accentColor);
  const isLightAccent = contrastText === '#0f172a';
  const showNfcIcon = options.showNfcIcon ?? true;
  const instructionText =
    options.instructionText?.trim() ||
    (showNfcIcon ? DEFAULT_NFC_QR_INSTRUCTION : DEFAULT_QR_ONLY_INSTRUCTION);

  const qrDataUrl = await QRCode.toDataURL(options.publicUrl, {
    width: 720,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  const [qrImg, logoImg] = await Promise.all([
    loadImageSafe(qrDataUrl),
    options.logoUrl ? loadImageSafe(options.logoUrl) : Promise.resolve(null),
  ]);

  if (!qrImg) {
    throw new Error('Não foi possível renderizar o QR Code.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D indisponível neste navegador.');
  }

  // 1. Fundo principal na cor da loja
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Moldura sutil interna para acabamento de impressão
  ctx.save();
  ctx.strokeStyle = isLightAccent ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 44, 44, CARD_WIDTH - 88, CARD_HEIGHT - 88, 44);
  ctx.stroke();
  ctx.restore();

  // 2. Logotipo centralizado (ou iniciais em destaque se não houver logo)
  const logoSize = 230;
  const logoX = (CARD_WIDTH - logoSize) / 2;
  const logoY = 108;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 46);
  ctx.fill();
  ctx.restore();

  if (logoImg) {
    // Desenha a logo proporcionalmente (contain) dentro do quadro branco com margem interna
    const pad = 18;
    const innerSize = logoSize - pad * 2;
    const scale = Math.min(innerSize / logoImg.width, innerSize / logoImg.height);
    const drawW = logoImg.width * scale;
    const drawH = logoImg.height * scale;
    const drawX = logoX + (logoSize - drawW) / 2;
    const drawY = logoY + (logoSize - drawH) / 2;

    ctx.save();
    drawRoundedRect(ctx, logoX + pad / 2, logoY + pad / 2, logoSize - pad, logoSize - pad, 36);
    ctx.clip();
    ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = accentColor;
    ctx.font = '700 84px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      options.storeName.trim().slice(0, 2).toUpperCase() || 'CD',
      CARD_WIDTH / 2,
      logoY + logoSize / 2 + 4
    );
    ctx.restore();
  }

  // 3. Nome do estabelecimento + selo "CARDÁPIO DIGITAL"
  const pillWidth = 340;
  const pillHeight = 46;
  const pillX = (CARD_WIDTH - pillWidth) / 2;
  const pillY = logoY + logoSize + 36;

  ctx.save();
  ctx.fillStyle = isLightAccent ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.18)';
  drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 23);
  ctx.fill();
  ctx.fillStyle = contrastText;
  ctx.font = '700 22px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CARDÁPIO DIGITAL', CARD_WIDTH / 2, pillY + pillHeight / 2 + 1);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = contrastText;
  ctx.font = '800 58px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const nameLines = wrapTextLines(options.storeName.trim() || 'Cardápio', CARD_WIDTH - 160, (s) =>
    ctx.measureText(s).width
  ).slice(0, 2);

  let cursorY = pillY + pillHeight + 28;
  for (const line of nameLines) {
    ctx.fillText(line, CARD_WIDTH / 2, cursorY);
    cursorY += 68;
  }
  ctx.restore();

  // 4. Painel branco inferior com instrução + QR Code logo abaixo
  const panelMarginX = 92;
  const panelWidth = CARD_WIDTH - panelMarginX * 2;
  const panelTop = Math.max(580, cursorY + 24);
  const panelBottom = CARD_HEIGHT - 122;
  const panelHeight = panelBottom - panelTop;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, panelMarginX, panelTop, panelWidth, panelHeight, 44);
  ctx.fill();
  ctx.restore();

  // Ícone NFC (opcional) + texto de instrução
  let innerY = panelTop + 52;
  if (showNfcIcon) {
    const iconBadgeRadius = 40;
    ctx.save();
    ctx.fillStyle = `${accentColor}18`;
    ctx.beginPath();
    ctx.arc(CARD_WIDTH / 2, innerY + iconBadgeRadius, iconBadgeRadius, 0, Math.PI * 2);
    ctx.fill();
    drawNfcIcon(ctx, CARD_WIDTH / 2 + 4, innerY + iconBadgeRadius, accentColor);
    ctx.restore();
    innerY += iconBadgeRadius * 2 + 26;
  } else {
    innerY += 16;
  }

  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 36px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const instructionLines = wrapTextLines(instructionText, panelWidth - 110, (s) =>
    ctx.measureText(s).width
  ).slice(0, 3);

  for (const line of instructionLines) {
    ctx.fillText(line, CARD_WIDTH / 2, innerY);
    innerY += 48;
  }
  ctx.restore();

  // 5. QR Code centralizado logo abaixo do texto
  const availableQrHeight = panelBottom - innerY - 56;
  const qrBoxSize = Math.min(600, panelWidth - 140, availableQrHeight);
  const qrX = (CARD_WIDTH - qrBoxSize) / 2;
  const qrY = innerY + Math.max(24, (availableQrHeight - qrBoxSize) / 2);

  ctx.save();
  ctx.strokeStyle = `${accentColor}30`;
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, qrX - 18, qrY - 18, qrBoxSize + 36, qrBoxSize + 36, 30);
  ctx.stroke();
  ctx.drawImage(qrImg, qrX, qrY, qrBoxSize, qrBoxSize);
  ctx.restore();

  // 6. Rodapé com endereço amigável
  const displayUrl = options.publicUrl.replace(/^https?:\/\//i, '');
  ctx.save();
  ctx.fillStyle = isLightAccent ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.88)';
  ctx.font = '600 26px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    displayUrl.length > 48 ? `/m/${options.slug}` : displayUrl,
    CARD_WIDTH / 2,
    CARD_HEIGHT - 82
  );
  ctx.restore();

  return canvas.toDataURL('image/png');
}

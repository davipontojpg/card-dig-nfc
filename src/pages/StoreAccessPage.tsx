import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Nfc,
  QrCode,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useStoreWorkspace } from '../app/route-guards/StoreMemberGuard';
import { StoreFeatureGuard } from '../app/route-guards/StoreFeatureGuard';
import { hasFeature, isSubscriptionWritable } from '../lib/permissions';
import { storageService } from '../services/storage.service';
import { buildPublicMenuUrl, env, isLocalOrPreviewUrl } from '../lib/env';
import {
  DEFAULT_NFC_QR_INSTRUCTION,
  DEFAULT_QR_ONLY_INSTRUCTION,
  generateBrandedQrCardDataUrl,
} from '../lib/qr-card-generator';
import { Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

type QrDownloadMode = 'branded' | 'simple';
type CardTextPreset = 'nfc_qr' | 'qr_only';

export function StoreAccessPage() {
  const toast = useToast();
  const { access } = useStoreWorkspace();
  const { store } = access;
  const hasNfcAccess =
    isSubscriptionWritable(access) && hasFeature(access.features, 'nfc_access');
  const publicUrl = buildPublicMenuUrl(store.slug);
  const logoUrl = storageService.getPublicUrl(store.logo_path);
  const unstableUrl = isLocalOrPreviewUrl(env.publicAppUrl);

  const [qrMode, setQrMode] = useState<QrDownloadMode>('branded');
  const [textPreset, setTextPreset] = useState<CardTextPreset>(() =>
    hasNfcAccess ? 'nfc_qr' : 'qr_only'
  );
  const [instructionText, setInstructionText] = useState<string>(() =>
    hasNfcAccess ? DEFAULT_NFC_QR_INSTRUCTION : DEFAULT_QR_ONLY_INSTRUCTION
  );
  const effectiveTextPreset: CardTextPreset = hasNfcAccess ? textPreset : 'qr_only';

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [brandedCardDataUrl, setBrandedCardDataUrl] = useState<string>('');
  const [brandedCardLoading, setBrandedCardLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!hasNfcAccess) {
      setTextPreset('qr_only');
      setInstructionText((prev) =>
        prev === DEFAULT_NFC_QR_INSTRUCTION ? DEFAULT_QR_ONLY_INSTRUCTION : prev
      );
    }
  }, [hasNfcAccess]);

  useEffect(() => {
    let active = true;
    Promise.all([
      QRCode.toDataURL(publicUrl, { width: 640, margin: 2, errorCorrectionLevel: 'M' }),
      QRCode.toString(publicUrl, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }),
    ])
      .then(([pngUrl, svgText]) => {
        if (!active) return;
        setQrDataUrl(pngUrl);
        setQrSvg(svgText);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [publicUrl]);

  useEffect(() => {
    let active = true;
    setBrandedCardLoading(true);

    generateBrandedQrCardDataUrl({
      storeName: store.name,
      slug: store.slug,
      publicUrl,
      primaryColor: store.primary_color,
      logoUrl,
      instructionText,
      showNfcIcon: effectiveTextPreset === 'nfc_qr',
    })
      .then((dataUrl) => {
        if (!active) return;
        setBrandedCardDataUrl(dataUrl);
      })
      .catch(() => {
        if (!active) return;
        setBrandedCardDataUrl('');
      })
      .finally(() => {
        if (active) setBrandedCardLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    store.name,
    store.slug,
    store.primary_color,
    publicUrl,
    logoUrl,
    instructionText,
    effectiveTextPreset,
  ]);

  async function copyPublicUrl() {
    await navigator.clipboard.writeText(publicUrl);
    toast.success('URL pública copiada!', publicUrl);
  }

  function handlePresetChange(nextPreset: CardTextPreset) {
    setTextPreset(nextPreset);
    setInstructionText(
      nextPreset === 'nfc_qr' ? DEFAULT_NFC_QR_INSTRUCTION : DEFAULT_QR_ONLY_INSTRUCTION
    );
  }

  function downloadSvg() {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-${store.slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {hasNfcAccess ? 'Acesso Público: URL, QR Code e NFC' : 'Acesso Público: URL e QR Code'}
        </h1>
        <p className="text-sm text-slate-600">
          {hasNfcAccess
            ? 'Compartilhe seu cardápio por link permanente, QR Code impresso nas mesas ou tags NFC.'
            : 'Compartilhe seu cardápio por link permanente ou QR Code impresso nas mesas.'}
        </p>
      </div>

      {unstableUrl ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold">Atenção: URL base de desenvolvimento ou preview</p>
            <p className="mt-0.5 text-xs">
              A variável <code>VITE_PUBLIC_APP_URL</code> aponta atualmente para{' '}
              <code>{env.publicAppUrl}</code>.{' '}
              {hasNfcAccess
                ? 'Configure um domínio estável definitivo antes de imprimir QR Codes em escala ou gravar etiquetas NFC permanentes.'
                : 'Configure um domínio estável definitivo antes de imprimir QR Codes em escala.'}
            </p>
          </div>
        </div>
      ) : null}

      {/* URL Permanente */}
      <Card className="p-5 sm:p-6">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          URL Pública Permanente
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <code className="block overflow-x-auto rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-900">
            {publicUrl}
          </code>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => void copyPublicUrl()}>
              <Copy className="h-4 w-4" />
              Copiar link
            </Button>
            <a href={`/m/${store.slug}`} target="_blank" rel="noreferrer">
              <Button>
                <ExternalLink className="h-4 w-4" />
                Testar cardápio
              </Button>
            </a>
          </div>
        </div>
      </Card>

      {/* QR Code + Modelo Personalizado (todos os planos) */}
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-zinc-900" />
            <h2 className="text-lg font-bold text-slate-900">QR Code para Mesas e Balcão</h2>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setQrMode('branded')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                qrMode === 'branded'
                  ? 'bg-zinc-950 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Modelo personalizado
            </button>
            <button
              type="button"
              onClick={() => setQrMode('simple')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                qrMode === 'simple'
                  ? 'bg-zinc-950 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="h-3.5 w-3.5" />
              QR simples
            </button>
          </div>
        </div>

        {qrMode === 'branded' ? (
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* Prévia do modelo pronto para impressão */}
            <div className="flex shrink-0 flex-col items-center">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                {brandedCardDataUrl ? (
                  <img
                    src={brandedCardDataUrl}
                    alt={`Modelo personalizado de QR Code de ${store.name}`}
                    className="h-auto w-56 sm:w-64"
                  />
                ) : (
                  <div className="flex h-80 w-56 items-center justify-center text-xs text-slate-500 sm:w-64">
                    {brandedCardLoading ? 'Gerando modelo...' : 'Prévia indisponível'}
                  </div>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Alta resolução (1200 × 1680 px) pronta para impressão
              </p>
            </div>

            <div className="flex-1 space-y-4">
              <p className="text-sm text-slate-600">
                Gerado automaticamente com a <strong>cor principal</strong> ({store.primary_color})
                e o <strong>logotipo</strong> do seu estabelecimento, pronto para displays de mesa,
                adesivos ou placas de balcão.
              </p>

              {/* Escolha rápida do texto (somente planos com NFC) */}
              {hasNfcAccess ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Modelo de chamada</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handlePresetChange('nfc_qr')}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        effectiveTextPreset === 'nfc_qr'
                          ? 'border-zinc-950 bg-zinc-950 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      NFC + QR Code
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetChange('qr_only')}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        effectiveTextPreset === 'qr_only'
                          ? 'border-zinc-950 bg-zinc-950 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Somente QR Code
                    </button>
                  </div>
                </div>
              ) : null}

              <Input
                label="Texto exibido acima do QR Code"
                value={instructionText}
                maxLength={120}
                onChange={(e) => setInstructionText(e.target.value)}
                placeholder={
                  hasNfcAccess ? DEFAULT_NFC_QR_INSTRUCTION : DEFAULT_QR_ONLY_INSTRUCTION
                }
              />

              <div className="flex flex-wrap gap-2 pt-1">
                {brandedCardDataUrl ? (
                  <a
                    href={brandedCardDataUrl}
                    download={`placa-cardapio-${store.slug}.png`}
                  >
                    <Button isLoading={brandedCardLoading}>
                      <Download className="h-4 w-4" />
                      Baixar modelo personalizado (PNG)
                    </Button>
                  </a>
                ) : (
                  <Button disabled isLoading={brandedCardLoading}>
                    <Download className="h-4 w-4" />
                    Gerando modelo...
                  </Button>
                )}

                {qrDataUrl ? (
                  <a href={qrDataUrl} download={`qrcode-${store.slug}.png`}>
                    <Button variant="outline">
                      <Download className="h-4 w-4" />
                      QR simples (PNG)
                    </Button>
                  </a>
                ) : null}

                <Button variant="outline" onClick={downloadSvg} disabled={!qrSvg}>
                  <Download className="h-4 w-4" />
                  QR simples (SVG)
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex shrink-0 flex-col items-center rounded-2xl border border-slate-200 bg-white p-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code do cardápio de ${store.name}`}
                  className="h-48 w-48"
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center text-slate-400">
                  <QrCode className="h-12 w-12" />
                </div>
              )}
              <p className="mt-2 text-xs font-medium text-slate-500">/m/{store.slug}</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {hasNfcAccess
                  ? 'Disponível em todos os planos. O mesmo QR Code pode ser impresso em todas as mesas e suportes do estabelecimento, mantendo o acesso alternativo mesmo para aparelhos sem NFC.'
                  : 'Disponível em todos os planos. O mesmo QR Code pode ser impresso em todas as mesas e suportes do estabelecimento.'}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {qrDataUrl ? (
                  <a href={qrDataUrl} download={`qrcode-${store.slug}.png`}>
                    <Button variant="outline">
                      <Download className="h-4 w-4" />
                      Baixar PNG
                    </Button>
                  </a>
                ) : null}
                <Button variant="outline" onClick={downloadSvg} disabled={!qrSvg}>
                  <Download className="h-4 w-4" />
                  Baixar SVG (gráfica)
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* NFC (protegido por feature_key = nfc_access) */}
      <StoreFeatureGuard
        featureKey="nfc_access"
        title="Módulo de Implantação NFC"
        requiredPlanHint="Recurso dos planos Cardápio + NFC e Cardápio + NFC + Promoções"
        description="Este módulo fornece a URL pronta para gravação de chips NTAG213, instruções de instalação física, proteção anti-metal e checklist de testes. Solicite o upgrade ao operador da plataforma para liberar."
      >
        <Card className="space-y-5 p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <Nfc className="h-6 w-6 text-zinc-900" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Configuração e Gravação de Etiquetas NFC
              </h2>
              <p className="text-xs text-slate-500">
                Gravação externa via aplicativo móvel (ex.: NFC Tools). Nenhum dado privado ou token
                deve ser gravado no chip.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-xs font-semibold text-zinc-900 uppercase">
              URL exata para gravar no registro NDEF (URL / URI)
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <code className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-950 ring-1 ring-stone-300">
                {publicUrl}
              </code>
              <Button size="sm" onClick={() => void copyPublicUrl()}>
                <Copy className="h-4 w-4" />
                Copiar URL para gravação
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900">Passo a passo (NFC Tools)</h3>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600">
                <li>Utilize tags recomendadas <strong>NTAG213</strong> (13,56 MHz) compatíveis com URL curta.</li>
                <li>Abra o app <strong>NFC Tools</strong> (Android ou iOS) em <em>Escrever → Adicionar registro → URL / URI</em>.</li>
                <li>Cole exatamente a URL pública acima (sem espaços extras).</li>
                <li>Aproxime o celular da tag para gravar e confirme a leitura em Android e iOS.</li>
                <li>
                  <strong>Teste no suporte definitivo:</strong> valide a leitura após colar a tag na
                  mesa, display acrílico ou placa.
                </li>
                <li>
                  Após validar o funcionamento definitivo, bloqueie a tag contra regravação (Lock) se
                  o modelo suportar e não precisar ser reutilizada.
                </li>
              </ol>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-4 text-xs leading-relaxed text-slate-600">
              <div className="flex items-start gap-2 text-amber-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p>
                  <strong>Superfícies metálicas:</strong> mesas ou placas de metal bloqueiam o campo
                  RFID comum. Utilize exclusivamente etiquetas{' '}
                  <strong>anti-metal com camada de ferrite</strong> nesses casos.
                </p>
              </div>
              <div className="flex items-start gap-2 text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>
                  <strong>QR Code sempre junto:</strong> mantenha o QR Code impresso no mesmo display
                  para clientes com NFC desativado ou aparelhos incompatíveis.
                </p>
              </div>
              <p className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500">
                <strong>Aviso comercial:</strong> chips NFC, adesivos, displays acrílicos, impressão
                e frete não estão inclusos automaticamente na mensalidade ou taxa de implantação e
                são orçados separadamente.
              </p>
            </div>
          </div>
        </Card>
      </StoreFeatureGuard>
    </div>
  );
}

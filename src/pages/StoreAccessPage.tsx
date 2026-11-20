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
} from 'lucide-react';
import { useStoreWorkspace } from '../app/route-guards/StoreMemberGuard';
import { StoreFeatureGuard } from '../app/route-guards/StoreFeatureGuard';
import { buildPublicMenuUrl, env, isLocalOrPreviewUrl } from '../lib/env';
import { Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

export function StoreAccessPage() {
  const toast = useToast();
  const { access } = useStoreWorkspace();
  const { store } = access;
  const publicUrl = buildPublicMenuUrl(store.slug);
  const unstableUrl = isLocalOrPreviewUrl(env.publicAppUrl);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string>('');

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

  async function copyPublicUrl() {
    await navigator.clipboard.writeText(publicUrl);
    toast.success('URL pública copiada!', publicUrl);
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
        <h1 className="text-2xl font-bold text-slate-900">Acesso Público: URL, QR Code e NFC</h1>
        <p className="text-sm text-slate-600">
          Compartilhe seu cardápio por link permanente, QR Code impresso nas mesas ou tags NFC.
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
              <code>{env.publicAppUrl}</code>. Configure um domínio estável definitivo antes de
              imprimir QR Codes em escala ou gravar etiquetas NFC permanentes.
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

      {/* QR Code (todos os planos) */}
      <Card className="p-5 sm:p-6">
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
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">QR Code para Mesas e Balcão</h2>
            </div>
            <p className="text-sm text-slate-600">
              Disponível em todos os planos. O mesmo QR Code pode ser impresso em todas as mesas e
              suportes do estabelecimento, mantendo o acesso alternativo mesmo para aparelhos sem
              NFC.
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
            <Nfc className="h-6 w-6 text-indigo-600" />
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

          <div className="rounded-xl bg-indigo-50 p-4">
            <p className="text-xs font-semibold text-indigo-900 uppercase">
              URL exata para gravar no registro NDEF (URL / URI)
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <code className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-950 ring-1 ring-indigo-200">
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


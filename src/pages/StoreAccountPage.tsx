import { Check, Lock, ShieldCheck } from 'lucide-react';
import { useStoreWorkspace } from '../app/route-guards/StoreMemberGuard';
import { formatBRL, formatDateInTz } from '../lib/formatters';
import {
  getLifecycleStatusMeta,
  getSubscriptionStatusMeta,
  hasFeature,
} from '../lib/permissions';
import { Badge, Card } from '../components/ui/Badge';

const ALL_FEATURES = [
  {
    key: 'digital_menu',
    name: 'Cardápio Digital Público',
    requiredPlan: 'Todos os planos',
  },
  {
    key: 'qr_code',
    name: 'Gerador de QR Code (PNG/SVG)',
    requiredPlan: 'Todos os planos',
  },
  {
    key: 'nfc_access',
    name: 'Módulo e Guia Técnico NFC',
    requiredPlan: 'Cardápio + NFC ou Cardápio + NFC + Promoções',
  },
  {
    key: 'scheduled_promotions',
    name: 'Promoções Pontuais e Semanais Recorrentes',
    requiredPlan: 'Cardápio + NFC + Promoções',
  },
] as const;

export function StoreAccountPage() {
  const { access } = useStoreWorkspace();
  const { store, subscription, features, role, has_service_access } = access;
  const subMeta = getSubscriptionStatusMeta(subscription.status);
  const lifecycleMeta = getLifecycleStatusMeta(store.lifecycle_status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Plano e Situação da Assinatura</h1>
        <p className="text-sm text-slate-600">
          Consulte os recursos liberados para seu estabelecimento e a situação comercial do contrato.
        </p>
      </div>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">{subscription.plan_name}</h2>
              <p className="text-xs text-slate-500">
                Seu papel neste estabelecimento:{' '}
                <strong>{role === 'owner' ? 'Proprietário' : 'Editor'}</strong>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={lifecycleMeta.tone}>{lifecycleMeta.label}</Badge>
            <Badge tone={subMeta.tone}>{subMeta.label}</Badge>
          </div>
        </div>

        <p className="text-sm text-slate-600">{subMeta.description}</p>

        {role === 'owner' || role === 'platform_admin' ? (
          <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Mensalidade contratada</p>
              <p className="font-bold text-slate-900">
                {formatBRL(subscription.monthly_price_snapshot)}/mês
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Taxa de implantação</p>
              <p className="font-bold text-slate-900">
                {formatBRL(subscription.setup_fee_snapshot)} (
                {subscription.setup_fee_status === 'paid'
                  ? 'Paga'
                  : subscription.setup_fee_status === 'waived'
                    ? 'Isenta'
                    : 'Pendente'}
                )
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Próxima cobrança</p>
              <p className="font-bold text-slate-900">
                {formatDateInTz(subscription.next_billing_at, store.timezone)}
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            Valores comerciais e detalhes de cobrança ficam visíveis apenas para o proprietário do
            estabelecimento.
          </p>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">Recursos do Plano</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {ALL_FEATURES.map((feat) => {
            const enabled = has_service_access && hasFeature(features, feat.key);
            return (
              <div
                key={feat.key}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  {enabled ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <div>
                    <p className={`font-medium ${enabled ? 'text-slate-900' : 'text-slate-500'}`}>
                      {feat.name}
                    </p>
                    {!enabled ? (
                      <p className="text-xs text-slate-400">Disponível em: {feat.requiredPlan}</p>
                    ) : null}
                  </div>
                </div>
                <Badge tone={enabled ? 'success' : 'neutral'}>
                  {enabled ? 'Liberado' : 'Não contratado'}
                </Badge>
              </div>
            );
          })}
        </div>

        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
          Deseja alterar de plano, contratar suporte NFC ou regularizar uma pendência? Entre em
          contato diretamente com o operador da plataforma para atualização do contrato.
        </p>
      </Card>
    </div>
  );
}


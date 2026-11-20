import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Mail,
  RefreshCw,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { platformService } from '../services/platform.service';
import { provisioningService } from '../services/provisioning.service';
import { subscriptionsService } from '../services/subscriptions.service';
import { buildPublicMenuUrl } from '../lib/env';
import {
  COMMON_TIMEZONES,
  formatBRL,
  formatDateTimeInTz,
  normalizeSlug,
} from '../lib/formatters';
import {
  getLifecycleStatusMeta,
  getOnboardingStatusMeta,
  getSubscriptionStatusMeta,
} from '../lib/permissions';
import type {
  OnboardingStatus,
  OnboardingTaskStatus,
  SetupFeeStatus,
  StoreLifecycleStatus,
  SubscriptionStatus,
} from '../types/database';
import { Badge, Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { ErrorState, LoadingSpinner } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';

type DetailTab = 'summary' | 'subscription' | 'onboarding' | 'access' | 'menu' | 'audit';

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function fromDateInput(dateStr: string): string | null {
  return dateStr ? new Date(`${dateStr}T12:00:00Z`).toISOString() : null;
}

export function PlatformStoreDetailPage() {
  const { storeId = '' } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DetailTab>('summary');

  const [lifecycleConfirm, setLifecycleConfirm] = useState<{
    open: boolean;
    nextStatus: StoreLifecycleStatus;
    title: string;
    description: string;
  } | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState('');

  const [inviteEditorModalOpen, setInviteEditorModalOpen] = useState(false);
  const [editorEmail, setEditorEmail] = useState('');
  const [editorName, setEditorName] = useState('');

  const { data: detail, isLoading, error, refetch } = useQuery({
    queryKey: ['platform-store-detail', storeId],
    queryFn: () => platformService.getStoreDetail(storeId),
    enabled: Boolean(storeId),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => platformService.listPlans(),
  });

  // Form states para aba Resumo
  const [summaryForm, setSummaryForm] = useState({
    name: '',
    slug: '',
    business_type: '',
    description: '',
    public_phone: '',
    public_address: '',
    primary_color: '#0f766e',
    timezone: 'America/Sao_Paulo',
    is_published: false,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    internal_notes: '',
  });

  // Form states para aba Plano e Assinatura
  const [subForm, setSubForm] = useState({
    plan_id: '',
    status: 'trialing' as SubscriptionStatus,
    setup_fee_status: 'pending' as SetupFeeStatus,
    monthly_price_snapshot: '0',
    setup_fee_snapshot: '0',
    started_at: '',
    current_period_start: '',
    current_period_end: '',
    next_billing_at: '',
    last_payment_at: '',
    grace_until: '',
    subscription_internal_notes: '',
    reason: '',
  });

  useEffect(() => {
    if (!detail) return;
    setSummaryForm({
      name: detail.store.name,
      slug: detail.store.slug,
      business_type: detail.store.business_type ?? '',
      description: detail.store.description ?? '',
      public_phone: detail.store.public_phone ?? '',
      public_address: detail.store.public_address ?? '',
      primary_color: detail.store.primary_color,
      timezone: detail.store.timezone,
      is_published: detail.store.is_published,
      contact_name: detail.internal?.contact_name ?? '',
      contact_email: detail.internal?.contact_email ?? '',
      contact_phone: detail.internal?.contact_phone ?? '',
      internal_notes: detail.internal?.internal_notes ?? '',
    });

    if (detail.subscription) {
      setSubForm({
        plan_id: detail.subscription.plan_id,
        status: detail.subscription.status,
        setup_fee_status: detail.subscription.setup_fee_status,
        monthly_price_snapshot: String(detail.subscription.monthly_price_snapshot),
        setup_fee_snapshot: String(detail.subscription.setup_fee_snapshot),
        started_at: toDateInput(detail.subscription.started_at),
        current_period_start: toDateInput(detail.subscription.current_period_start),
        current_period_end: toDateInput(detail.subscription.current_period_end),
        next_billing_at: toDateInput(detail.subscription.next_billing_at),
        last_payment_at: toDateInput(detail.subscription.last_payment_at),
        grace_until: detail.subscription.grace_until
          ? detail.subscription.grace_until.slice(0, 16)
          : '',
        subscription_internal_notes: detail.internal?.subscription_internal_notes ?? '',
        reason: '',
      });
    }
  }, [detail]);

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['platform-store-detail', storeId] }),
      queryClient.invalidateQueries({ queryKey: ['platform-stores'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-dashboard'] }),
    ]);
  }

  const saveSummaryMutation = useMutation({
    mutationFn: async () => {
      await platformService.updateStoreDetails(
        storeId,
        {
          name: summaryForm.name.trim(),
          slug: normalizeSlug(summaryForm.slug),
          business_type: summaryForm.business_type.trim() || null,
          description: summaryForm.description.trim() || null,
          public_phone: summaryForm.public_phone.trim() || null,
          public_address: summaryForm.public_address.trim() || null,
          primary_color: summaryForm.primary_color,
          timezone: summaryForm.timezone,
          is_published: summaryForm.is_published,
        },
        {
          contact_name: summaryForm.contact_name.trim() || null,
          contact_email: summaryForm.contact_email.trim().toLowerCase() || null,
          contact_phone: summaryForm.contact_phone.trim() || null,
          internal_notes: summaryForm.internal_notes.trim() || null,
        }
      );
    },
    onSuccess: async () => {
      await invalidateAll();
      toast.success('Dados do estabelecimento salvos.');
    },
    onError: (err) => {
      toast.error('Erro ao salvar dados', err instanceof Error ? err.message : 'Erro desconhecido');
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: async () => {
      if (!lifecycleConfirm) return;
      await platformService.updateStoreLifecycle(
        storeId,
        lifecycleConfirm.nextStatus,
        lifecycleReason || null
      );
    },
    onSuccess: async () => {
      setLifecycleConfirm(null);
      setLifecycleReason('');
      await invalidateAll();
      toast.success('Situação do estabelecimento atualizada.');
    },
    onError: (err) => {
      toast.error('Erro ao alterar situação', err instanceof Error ? err.message : 'Erro');
    },
  });

  const subscriptionMutation = useMutation({
    mutationFn: async () => {
      await subscriptionsService.updateSubscription({
        store_id: storeId,
        plan_id: subForm.plan_id,
        status: subForm.status,
        setup_fee_status: subForm.setup_fee_status,
        monthly_price_snapshot: Number(subForm.monthly_price_snapshot),
        setup_fee_snapshot: Number(subForm.setup_fee_snapshot),
        started_at: fromDateInput(subForm.started_at),
        current_period_start: fromDateInput(subForm.current_period_start),
        current_period_end: fromDateInput(subForm.current_period_end),
        next_billing_at: fromDateInput(subForm.next_billing_at),
        last_payment_at: fromDateInput(subForm.last_payment_at),
        grace_until: subForm.grace_until ? new Date(subForm.grace_until).toISOString() : null,
        subscription_internal_notes: subForm.subscription_internal_notes,
        reason: subForm.reason || null,
      });
    },
    onSuccess: async () => {
      setSubForm((prev) => ({ ...prev, reason: '' }));
      await invalidateAll();
      toast.success('Plano e assinatura atualizados.');
    },
    onError: (err) => {
      toast.error('Erro ao salvar assinatura', err instanceof Error ? err.message : 'Erro');
    },
  });

  const onboardingStatusMutation = useMutation({
    mutationFn: (nextStatus: OnboardingStatus) =>
      platformService.updateOnboardingStatus(storeId, nextStatus),
    onSuccess: async () => {
      await invalidateAll();
      toast.success('Status de onboarding atualizado.');
    },
  });

  const taskMutation = useMutation({
    mutationFn: (input: { taskId: string; status: OnboardingTaskStatus; notes: string | null }) =>
      platformService.updateOnboardingTask(input.taskId, input.status, input.notes),
    onSuccess: async () => {
      await invalidateAll();
    },
  });

  const inviteActionMutation = useMutation({
    mutationFn: provisioningService.resendOrManageInvite,
    onSuccess: async (res) => {
      await invalidateAll();
      setInviteEditorModalOpen(false);
      setEditorEmail('');
      setEditorName('');
      toast.success('Operação de acesso concluída', res.message);
    },
    onError: (err) => {
      toast.error('Falha no convite/vínculo', err instanceof Error ? err.message : 'Erro');
    },
  });

  if (isLoading) return <LoadingSpinner label="Carregando detalhes do estabelecimento..." />;
  if (error || !detail) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Estabelecimento não encontrado.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const { store, internal, subscription, plan } = detail;
  const lifecycleMeta = getLifecycleStatusMeta(store.lifecycle_status);
  const onboardingMeta = getOnboardingStatusMeta(store.onboarding_status);
  const subMeta = subscription ? getSubscriptionStatusMeta(subscription.status) : null;
  const publicUrl = buildPublicMenuUrl(store.slug);

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'summary', label: 'Resumo' },
    { id: 'subscription', label: 'Plano e Assinatura' },
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'access', label: 'Acesso' },
    { id: 'menu', label: 'Cardápio' },
    { id: 'audit', label: 'Auditoria' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/platform/stores"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-zinc-950"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para estabelecimentos
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{store.name}</h1>
            <Badge tone={lifecycleMeta.tone}>{lifecycleMeta.label}</Badge>
            {subMeta ? <Badge tone={subMeta.tone}>{subMeta.label}</Badge> : null}
            <Badge tone={onboardingMeta.tone}>{onboardingMeta.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Plano atual: <strong>{plan?.name ?? '—'}</strong> • Slug:{' '}
            <span className="font-mono">/m/{store.slug}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {store.lifecycle_status !== 'active' ? (
            <Button
              size="sm"
              onClick={() =>
                setLifecycleConfirm({
                  open: true,
                  nextStatus: 'active',
                  title: 'Ativar estabelecimento',
                  description:
                    'O estabelecimento passará a ter status operacional ativo, permitindo publicar o cardápio conforme sua assinatura.',
                })
              }
            >
              Ativar estabelecimento
            </Button>
          ) : null}
          {store.lifecycle_status === 'active' ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                setLifecycleConfirm({
                  open: true,
                  nextStatus: 'suspended',
                  title: 'Suspender estabelecimento',
                  description:
                    'A suspensão tira o cardápio público do ar imediatamente e bloqueia alterações.',
                })
              }
            >
              Suspender
            </Button>
          ) : null}
          {store.lifecycle_status !== 'archived' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setLifecycleConfirm({
                  open: true,
                  nextStatus: 'archived',
                  title: 'Arquivar estabelecimento',
                  description:
                    'Arquivar mantém o histórico e os dados preservados no banco, despublicando o cardápio público.',
                })
              }
            >
              Arquivar
            </Button>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-t-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-zinc-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Aba Resumo */}
      {activeTab === 'summary' ? (
        <Card className="p-5 sm:p-6">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              saveSummaryMutation.mutate();
            }}
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nome público"
                required
                value={summaryForm.name}
                onChange={(e) => setSummaryForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Slug público"
                required
                value={summaryForm.slug}
                onChange={(e) => setSummaryForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Tipo de negócio"
                value={summaryForm.business_type}
                onChange={(e) => setSummaryForm((f) => ({ ...f, business_type: e.target.value }))}
              />
              <Input
                label="Telefone público"
                value={summaryForm.public_phone}
                onChange={(e) => setSummaryForm((f) => ({ ...f, public_phone: e.target.value }))}
              />
              <Select
                label="Fuso horário"
                value={summaryForm.timezone}
                onChange={(e) => setSummaryForm((f) => ({ ...f, timezone: e.target.value }))}
                options={COMMON_TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Endereço público"
                value={summaryForm.public_address}
                onChange={(e) => setSummaryForm((f) => ({ ...f, public_address: e.target.value }))}
              />
              <Input
                label="Cor principal (#RRGGBB)"
                value={summaryForm.primary_color}
                onChange={(e) => setSummaryForm((f) => ({ ...f, primary_color: e.target.value }))}
              />
            </div>

            <Textarea
              label="Descrição pública"
              value={summaryForm.description}
              onChange={(e) => setSummaryForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />

            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={summaryForm.is_published}
                onChange={(e) => setSummaryForm((f) => ({ ...f, is_published: e.target.checked }))}
                className="h-4 w-4 rounded border-stone-300 text-zinc-950 accent-zinc-950"
              />
              Cardápio publicado ao público (requer estabelecimento e assinatura ativos)
            </label>

            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Dados Internos do Cliente (visíveis apenas ao operador)
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Responsável"
                  value={summaryForm.contact_name}
                  onChange={(e) => setSummaryForm((f) => ({ ...f, contact_name: e.target.value }))}
                />
                <Input
                  label="E-mail de contato"
                  type="email"
                  value={summaryForm.contact_email}
                  onChange={(e) =>
                    setSummaryForm((f) => ({ ...f, contact_email: e.target.value }))
                  }
                />
                <Input
                  label="Telefone interno"
                  value={summaryForm.contact_phone}
                  onChange={(e) =>
                    setSummaryForm((f) => ({ ...f, contact_phone: e.target.value }))
                  }
                />
              </div>
              <div className="mt-4">
                <Textarea
                  label="Observações internas"
                  value={summaryForm.internal_notes}
                  onChange={(e) =>
                    setSummaryForm((f) => ({ ...f, internal_notes: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" isLoading={saveSummaryMutation.isPending}>
                Salvar alterações
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {/* Aba Plano e Assinatura */}
      {activeTab === 'subscription' ? (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Gestão Manual de Plano e Assinatura
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Ao alterar o plano, os valores de referência do novo plano preenchem automaticamente o
              snapshot contratado (editável antes de salvar).
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                subscriptionMutation.mutate();
              }}
              className="mt-4 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Select
                  label="Plano"
                  value={subForm.plan_id}
                  onChange={(e) => {
                    const nextPlanId = e.target.value;
                    const chosen = plans.find((p) => p.id === nextPlanId);
                    setSubForm((prev) => ({
                      ...prev,
                      plan_id: nextPlanId,
                      monthly_price_snapshot: chosen
                        ? String(chosen.monthly_price)
                        : prev.monthly_price_snapshot,
                      setup_fee_snapshot: chosen
                        ? String(chosen.setup_fee)
                        : prev.setup_fee_snapshot,
                    }));
                  }}
                  options={plans.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${formatBRL(p.monthly_price)}/mês)`,
                  }))}
                />
                <Select
                  label="Status da assinatura"
                  value={subForm.status}
                  onChange={(e) =>
                    setSubForm((prev) => ({
                      ...prev,
                      status: e.target.value as SubscriptionStatus,
                    }))
                  }
                  options={[
                    { value: 'trialing', label: 'Avaliação / Implantação' },
                    { value: 'active', label: 'Ativa' },
                    { value: 'past_due', label: 'Em atraso' },
                    { value: 'suspended', label: 'Suspensa' },
                    { value: 'canceled', label: 'Cancelada' },
                  ]}
                />
                <Select
                  label="Situação da taxa de implantação"
                  value={subForm.setup_fee_status}
                  onChange={(e) =>
                    setSubForm((prev) => ({
                      ...prev,
                      setup_fee_status: e.target.value as SetupFeeStatus,
                    }))
                  }
                  options={[
                    { value: 'pending', label: 'Pendente' },
                    { value: 'paid', label: 'Paga' },
                    { value: 'waived', label: 'Isenta' },
                  ]}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Mensalidade contratada (snapshot R$)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={subForm.monthly_price_snapshot}
                  onChange={(e) =>
                    setSubForm((prev) => ({ ...prev, monthly_price_snapshot: e.target.value }))
                  }
                />
                <Input
                  label="Taxa de implantação (snapshot R$)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={subForm.setup_fee_snapshot}
                  onChange={(e) =>
                    setSubForm((prev) => ({ ...prev, setup_fee_snapshot: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Início da assinatura"
                  type="date"
                  value={subForm.started_at}
                  onChange={(e) => setSubForm((p) => ({ ...p, started_at: e.target.value }))}
                />
                <Input
                  label="Início do período vigente"
                  type="date"
                  value={subForm.current_period_start}
                  onChange={(e) =>
                    setSubForm((p) => ({ ...p, current_period_start: e.target.value }))
                  }
                />
                <Input
                  label="Fim do período vigente"
                  type="date"
                  value={subForm.current_period_end}
                  onChange={(e) =>
                    setSubForm((p) => ({ ...p, current_period_end: e.target.value }))
                  }
                />
                <Input
                  label="Próxima cobrança prevista"
                  type="date"
                  value={subForm.next_billing_at}
                  onChange={(e) => setSubForm((p) => ({ ...p, next_billing_at: e.target.value }))}
                />
                <Input
                  label="Último pagamento registrado"
                  type="date"
                  value={subForm.last_payment_at}
                  onChange={(e) => setSubForm((p) => ({ ...p, last_payment_at: e.target.value }))}
                />
                <Input
                  label="Tolerância até (grace_until)"
                  type="datetime-local"
                  value={subForm.grace_until}
                  onChange={(e) => setSubForm((p) => ({ ...p, grace_until: e.target.value }))}
                />
              </div>

              <Textarea
                label="Observações internas da assinatura"
                value={subForm.subscription_internal_notes}
                onChange={(e) =>
                  setSubForm((p) => ({ ...p, subscription_internal_notes: e.target.value }))
                }
              />
              <Input
                label="Motivo da alteração (registrado no histórico)"
                value={subForm.reason}
                onChange={(e) => setSubForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Ex.: Pagamento confirmado via PIX / Upgrade para Plano NFC"
              />

              <div className="flex justify-end">
                <Button type="submit" isLoading={subscriptionMutation.isPending}>
                  Salvar assinatura
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-5 sm:p-6">
            <h3 className="text-base font-semibold text-slate-900">
              Histórico de Eventos da Assinatura
            </h3>
            <div className="mt-4 divide-y divide-slate-100">
              {detail.subscriptionEvents.map((ev) => (
                <div key={ev.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{ev.event_type}</span>
                    <span className="text-xs text-slate-500">
                      {formatDateTimeInTz(ev.created_at)}
                    </span>
                  </div>
                  {ev.reason ? <p className="mt-1 text-xs text-slate-600">{ev.reason}</p> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {/* Aba Onboarding */}
      {activeTab === 'onboarding' ? (
        <Card className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Checklist de Implantação</h2>
              <p className="text-xs text-slate-500">
                Acompanhe pendências operacionais até a publicação do estabelecimento.
              </p>
            </div>
            <div className="w-full sm:w-64">
              <Select
                label="Status geral do onboarding"
                value={store.onboarding_status}
                onChange={(e) => onboardingStatusMutation.mutate(e.target.value as OnboardingStatus)}
                options={[
                  { value: 'pending_data', label: 'Aguardando dados' },
                  { value: 'in_setup', label: 'Em configuração' },
                  { value: 'awaiting_client', label: 'Aguardando cliente' },
                  { value: 'ready', label: 'Pronto para publicar' },
                  { value: 'completed', label: 'Concluído' },
                ]}
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {detail.onboardingTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      task.status === 'done' ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{task.title}</p>
                    {task.completed_at ? (
                      <p className="text-xs text-slate-500">
                        Concluído em {formatDateTimeInTz(task.completed_at)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <select
                  aria-label={`Status de ${task.title}`}
                  value={task.status}
                  onChange={(e) =>
                    taskMutation.mutate({
                      taskId: task.id,
                      status: e.target.value as OnboardingTaskStatus,
                      notes: task.notes,
                    })
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm"
                >
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em andamento</option>
                  <option value="done">Concluída</option>
                  <option value="blocked">Bloqueada</option>
                </select>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Aba Acesso */}
      {activeTab === 'access' ? (
        <div className="space-y-6">
          <Card className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Acesso do Proprietário e Convites
                </h2>
                <p className="text-xs text-slate-500">
                  E-mail cadastrado: <strong>{internal?.contact_email || '—'}</strong> • Status do
                  convite: <strong>{internal?.owner_invite_status ?? 'not_sent'}</strong>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={inviteActionMutation.isPending}
                  onClick={() =>
                    inviteActionMutation.mutate({
                      store_id: storeId,
                      mode: 'resend_owner_invite',
                      redirect_to: `${window.location.origin}/auth/set-password`,
                    })
                  }
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reenviar convite
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setInviteEditorModalOpen(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Convidar editor
                </Button>
              </div>
            </div>

            {internal?.owner_invite_error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Atenção no provisionamento de acesso:</p>
                <p className="mt-1 text-xs">{internal.owner_invite_error}</p>
                {internal.owner_invite_status === 'not_sent' && internal.contact_email ? (
                  <Button
                    size="sm"
                    className="mt-3"
                    isLoading={inviteActionMutation.isPending}
                    onClick={() =>
                      inviteActionMutation.mutate({
                        store_id: storeId,
                        mode: 'link_existing_confirmed',
                        email: internal.contact_email ?? undefined,
                      })
                    }
                  >
                    <UserCheck className="h-4 w-4" />
                    Confirmar vinculação da conta existente ({internal.contact_email})
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Membros vinculados ({detail.memberships.length})
              </h3>
              {detail.memberships.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhum usuário associado ainda. Envie ou confirme o convite acima.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {detail.memberships.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-900">
                            {m.profile?.full_name || m.profile?.email || m.user_id}
                          </p>
                          <p className="text-xs text-slate-500">{m.profile?.email}</p>
                        </div>
                      </div>
                      <Badge tone={m.role === 'owner' ? 'info' : 'neutral'}>
                        {m.role === 'owner' ? 'Proprietário' : 'Editor'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {/* Aba Cardápio */}
      {activeTab === 'menu' ? (
        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">Resumo Operacional do Cardápio</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Categorias</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {detail.menuStats.categoriesCount}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Produtos cadastrados</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {detail.menuStats.productsCount}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Produtos ativos</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {detail.menuStats.activeProductsCount}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">URL Pública</p>
              <p className="truncate font-mono text-sm text-slate-900">{publicUrl}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(publicUrl);
                  toast.success('URL copiada!');
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar URL
              </Button>
              <Link to={`/m/${store.slug}`} target="_blank" rel="noreferrer">
                <Button size="sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir cardápio
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Aba Auditoria */}
      {activeTab === 'audit' ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Histórico de Auditoria Administrativa
          </h2>
          <div className="mt-4 divide-y divide-slate-100">
            {detail.auditLogs.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum evento registrado ainda.</p>
            ) : (
              detail.auditLogs.map((log) => (
                <div key={log.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-zinc-900">
                      {log.action}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDateTimeInTz(log.created_at)}
                    </span>
                  </div>
                  {log.metadata ? (
                    <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                      {JSON.stringify(log.metadata)}
                    </pre>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Card>
      ) : null}

      {/* Modal confirmar alteração de ciclo de vida */}
      <ConfirmDialog
        open={Boolean(lifecycleConfirm?.open)}
        onClose={() => setLifecycleConfirm(null)}
        onConfirm={() => lifecycleMutation.mutate()}
        title={lifecycleConfirm?.title ?? ''}
        description={lifecycleConfirm?.description ?? ''}
        variant={lifecycleConfirm?.nextStatus === 'active' ? 'primary' : 'danger'}
        isLoading={lifecycleMutation.isPending}
      >
        <Input
          label="Motivo (opcional)"
          value={lifecycleReason}
          onChange={(e) => setLifecycleReason(e.target.value)}
          placeholder="Ex.: Solicitação comercial / inadimplência / encerramento"
        />
      </ConfirmDialog>

      {/* Modal convidar editor */}
      <Modal
        open={inviteEditorModalOpen}
        onClose={() => setInviteEditorModalOpen(false)}
        title="Convidar Editor do Cardápio"
        description="Editores podem manter categorias, produtos e promoções (conforme plano), sem alterar plano ou dados comerciais."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inviteActionMutation.mutate({
              store_id: storeId,
              mode: 'invite_editor',
              email: editorEmail,
              full_name: editorName,
              redirect_to: `${window.location.origin}/auth/set-password`,
            });
          }}
          className="space-y-4"
        >
          <Input
            label="Nome do editor"
            required
            value={editorName}
            onChange={(e) => setEditorName(e.target.value)}
          />
          <Input
            label="E-mail do editor"
            type="email"
            required
            value={editorEmail}
            onChange={(e) => setEditorEmail(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInviteEditorModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={inviteActionMutation.isPending}>
              Enviar convite
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


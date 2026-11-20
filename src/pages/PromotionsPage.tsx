import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Edit3, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { useStoreWorkspace } from '../app/route-guards/StoreMemberGuard';
import { StoreFeatureGuard } from '../app/route-guards/StoreFeatureGuard';
import { promotionsService, type SavePromotionInput } from '../services/promotions.service';
import { productsService } from '../services/products.service';
import {
  promotionSchema,
  type PromotionFormValues,
} from '../lib/validators/promotion.schema';
import {
  WEEKDAY_OPTIONS,
  formatBRL,
  formatDateInTz,
  formatDateTimeInTz,
  formatTimeShort,
  formatWeekdaysSummary,
  localDateTimeInputToUtcIso,
  utcIsoToLocalDateTimeInput,
} from '../lib/formatters';
import {
  calculatePromotionalPrice,
  derivePromotionStatus,
  getPromotionStatusMeta,
  isSubscriptionWritable,
} from '../lib/permissions';
import type { PromotionDiscountType } from '../types/database';
import type { PromotionWithProducts } from '../types/domain';
import { Badge, Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { EmptyState, ErrorState, LoadingSpinner } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';

export function PromotionsPage() {
  return (
    <StoreFeatureGuard
      featureKey="scheduled_promotions"
      title="Promoções Agendadas e Recorrentes"
      requiredPlanHint="Recurso exclusivo do plano Cardápio + NFC + Promoções"
      description="Crie promoções pontuais por data/hora ou recorrências semanais (ex.: toda segunda-feira), calculadas automaticamente no fuso do estabelecimento sem alterar o preço-base. Solicite upgrade ao operador para ativar."
    >
      <PromotionsManager />
    </StoreFeatureGuard>
  );
}

function PromotionsManager() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { access } = useStoreWorkspace();
  const storeId = access.store.id;
  const timezone = access.store.timezone;
  const writable = isSubscriptionWritable(access);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionWithProducts | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromotionWithProducts | null>(null);

  const { data: promotions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['promotions', storeId],
    queryFn: () => promotionsService.listByStore(storeId),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', storeId],
    queryFn: () => productsService.listByStore(storeId),
  });

  const { data: conflictReport } = useQuery({
    queryKey: ['promotion-conflicts', storeId],
    queryFn: () => promotionsService.getConflicts(storeId),
  });

  const form = useForm({
    resolver: zodResolver(promotionSchema),
    defaultValues: {
      name: '',
      description: '',
      schedule_type: 'weekly' as const,
      discount_type: 'percent_off' as const,
      discount_value: 10,
      starts_at_local: '',
      ends_at_local: '',
      weekdays: [1] as number[],
      start_time: '18:00',
      end_time: '22:00',
      valid_from: '',
      valid_until: '',
      priority: 0,
      is_active: true,
      products: [] as Array<{
        product_id: string;
        discount_type_override?: PromotionDiscountType | null;
        discount_value_override?: number | null;
      }>,
    },
  });

  const watchedScheduleType = useWatch({ control: form.control, name: 'schedule_type' });
  const watchedDiscountType = useWatch({ control: form.control, name: 'discount_type' });
  const watchedDiscountValue = useWatch({ control: form.control, name: 'discount_value' });
  const watchedWeekdays = useWatch({ control: form.control, name: 'weekdays' }) ?? [];
  const watchedProducts = useWatch({ control: form.control, name: 'products' }) ?? [];

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['promotions', storeId] }),
      queryClient.invalidateQueries({ queryKey: ['promotion-conflicts', storeId] }),
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: PromotionFormValues) => {
      // Validar cálculo promocional em todos os produtos selecionados antes de gravar
      for (const item of values.products) {
        const prod = productMap.get(item.product_id);
        if (!prod) continue;
        const effType = item.discount_type_override || values.discount_type;
        const effVal =
          item.discount_value_override !== null && item.discount_value_override !== undefined
            ? Number(item.discount_value_override)
            : Number(values.discount_value);
        const calc = calculatePromotionalPrice(prod.price, effType, effVal);
        if (calc === null) {
          throw new Error(
            `O desconto configurado resulta em preço inválido (<= R$ 0,00 ou >= preço-base) para "${prod.name}".`
          );
        }
      }

      const payload: SavePromotionInput = {
        name: values.name,
        description: values.description || null,
        schedule_type: values.schedule_type,
        discount_type: values.discount_type,
        discount_value: values.discount_value,
        starts_at:
          values.schedule_type === 'once'
            ? localDateTimeInputToUtcIso(values.starts_at_local || '', timezone)
            : null,
        ends_at:
          values.schedule_type === 'once'
            ? localDateTimeInputToUtcIso(values.ends_at_local || '', timezone)
            : null,
        weekdays: values.schedule_type === 'weekly' ? values.weekdays : null,
        start_time: values.schedule_type === 'weekly' ? values.start_time || null : null,
        end_time: values.schedule_type === 'weekly' ? values.end_time || null : null,
        valid_from: values.schedule_type === 'weekly' ? values.valid_from || null : null,
        valid_until: values.schedule_type === 'weekly' ? values.valid_until || null : null,
        priority: values.priority,
        is_active: values.is_active,
        products: values.products.map((p) => ({
          product_id: p.product_id,
          discount_type_override: p.discount_type_override || null,
          discount_value_override:
            p.discount_type_override && p.discount_value_override !== undefined
              ? p.discount_value_override
              : null,
        })),
      };

      if (editing) {
        return promotionsService.update(editing.id, storeId, payload);
      }
      return promotionsService.create(storeId, payload);
    },
    onSuccess: async () => {
      setModalOpen(false);
      setEditing(null);
      await refresh();
      toast.success(editing ? 'Promoção atualizada!' : 'Promoção criada!');
    },
    onError: (err) => {
      toast.error('Erro ao salvar promoção', err instanceof Error ? err.message : 'Erro');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      promotionsService.toggleActive(id, storeId, isActive),
    onSuccess: async () => {
      await refresh();
      toast.success('Estado da promoção atualizado.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => promotionsService.remove(id, storeId),
    onSuccess: async () => {
      setDeleteTarget(null);
      await refresh();
      toast.success('Promoção excluída.');
    },
  });

  function openCreate() {
    setEditing(null);
    form.reset({
      name: '',
      description: '',
      schedule_type: 'weekly',
      discount_type: 'percent_off',
      discount_value: 10,
      starts_at_local: '',
      ends_at_local: '',
      weekdays: [1],
      start_time: '18:00',
      end_time: '22:00',
      valid_from: '',
      valid_until: '',
      priority: 0,
      is_active: true,
      products: [],
    });
    setModalOpen(true);
  }

  function openEdit(promo: PromotionWithProducts) {
    setEditing(promo);
    form.reset({
      name: promo.name,
      description: promo.description ?? '',
      schedule_type: promo.schedule_type,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      starts_at_local: utcIsoToLocalDateTimeInput(promo.starts_at, timezone),
      ends_at_local: utcIsoToLocalDateTimeInput(promo.ends_at, timezone),
      weekdays: promo.weekdays ?? [],
      start_time: promo.start_time ? promo.start_time.slice(0, 5) : '18:00',
      end_time: promo.end_time ? promo.end_time.slice(0, 5) : '22:00',
      valid_from: promo.valid_from ?? '',
      valid_until: promo.valid_until ?? '',
      priority: promo.priority,
      is_active: promo.is_active,
      products: promo.promotion_products.map((pp) => ({
        product_id: pp.product_id,
        discount_type_override: pp.discount_type_override,
        discount_value_override: pp.discount_value_override,
      })),
    });
    setModalOpen(true);
  }

  function toggleWeekday(day: number) {
    const next = watchedWeekdays.includes(day)
      ? watchedWeekdays.filter((d) => d !== day)
      : [...watchedWeekdays, day].sort((a, b) => a - b);
    form.setValue('weekdays', next, { shouldValidate: true });
  }

  function toggleProduct(productId: string) {
    const exists = watchedProducts.some((p) => p.product_id === productId);
    const next = exists
      ? watchedProducts.filter((p) => p.product_id !== productId)
      : [...watchedProducts, { product_id: productId }];
    form.setValue('products', next, { shouldValidate: true });
  }

  function updateProductOverride(
    productId: string,
    type: PromotionDiscountType | '',
    value: string
  ) {
    const next = watchedProducts.map((p) =>
      p.product_id === productId
        ? {
            ...p,
            discount_type_override: type ? type : null,
            discount_value_override: type && value ? Number(value) : null,
          }
        : p
    );
    form.setValue('products', next, { shouldValidate: true });
  }

  if (isLoading) return <LoadingSpinner label="Carregando promoções..." />;
  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao carregar promoções.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const effectiveMap = new Map(
    (conflictReport?.effective_now ?? []).map((e) => [e.product_id, e])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promoções Agendadas</h1>
          <p className="text-sm text-slate-600">
            Regras pontuais ou recorrentes avaliadas no fuso <strong>{timezone}</strong> sem
            alterar o preço-base dos produtos.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!writable || products.length === 0}>
          <Plus className="h-4 w-4" />
          Nova promoção
        </Button>
      </div>

      {/* Alertas de conflito */}
      {conflictReport && conflictReport.conflicts.length > 0 ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="space-y-1.5">
              <p className="font-bold">Conflitos de promoção detectados</p>
              <p className="text-xs">
                No máximo uma promoção é aplicada por produto em cada instante (vence a de maior
                prioridade; em empate, a mais antiga).
              </p>
              <ul className="space-y-1 text-xs">
                {conflictReport.conflicts.map((c, idx) => (
                  <li key={`${c.product_id}-${idx}`}>
                    • <strong>{c.product_name}</strong>: <strong>{c.winning_promotion_name}</strong>{' '}
                    prevalece sobre <em>{c.conflicting_promotion_name}</em>.
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {promotions.length === 0 ? (
        <EmptyState
          title="Nenhuma promoção configurada"
          description="Crie uma oferta pontual ou semanal recorrente (ex.: Segunda da Casa com 15% OFF) para destacar itens no cardápio público."
          action={
            <Button onClick={openCreate} disabled={!writable || products.length === 0}>
              Criar primeira promoção
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {promotions.map((promo) => {
            const derived = derivePromotionStatus(promo, timezone);
            const statusMeta = getPromotionStatusMeta(derived);
            return (
              <Card key={promo.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">{promo.name}</h2>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      <Badge tone="info">Prioridade {promo.priority}</Badge>
                    </div>

                    <p className="text-xs text-slate-600">
                      {promo.schedule_type === 'once' ? (
                        <>
                          Pontual: {formatDateTimeInTz(promo.starts_at, timezone)} até{' '}
                          {formatDateTimeInTz(promo.ends_at, timezone)}
                        </>
                      ) : (
                        <>
                          Semanal ({formatWeekdaysSummary(promo.weekdays)}):{' '}
                          {formatTimeShort(promo.start_time)} às {formatTimeShort(promo.end_time)}
                          {promo.valid_from || promo.valid_until
                            ? ` • Validade: ${formatDateInTz(promo.valid_from, timezone)} a ${formatDateInTz(promo.valid_until, timezone)}`
                            : ' • Recorrência contínua'}
                        </>
                      )}
                    </p>

                    <p className="text-xs text-slate-500">
                      Benefício padrão:{' '}
                      <strong>
                        {promo.discount_type === 'percent_off'
                          ? `${promo.discount_value}% de desconto`
                          : promo.discount_type === 'amount_off'
                            ? `${formatBRL(promo.discount_value)} de desconto`
                            : `Preço promocional ${formatBRL(promo.discount_value)}`}
                      </strong>{' '}
                      • {promo.promotion_products.length} produto(s)
                    </p>

                    {promo.promotion_products.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {promo.promotion_products.map((pp) => {
                          const eff = effectiveMap.get(pp.product_id);
                          const isWinnerHere = eff?.promotion_id === promo.id;
                          return (
                            <span
                              key={pp.id}
                              className={`rounded-md px-2 py-0.5 text-[11px] ${
                                isWinnerHere
                                  ? 'bg-emerald-100 font-semibold text-emerald-900'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {pp.product?.name ?? 'Produto'}
                              {isWinnerHere && eff
                                ? ` (${formatBRL(eff.promotional_price)} ativa)`
                                : ''}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!writable}
                      onClick={() =>
                        toggleMutation.mutate({ id: promo.id, isActive: !promo.is_active })
                      }
                    >
                      {promo.is_active ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          Retomar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!writable}
                      onClick={() => openEdit(promo)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!writable}
                      aria-label={`Excluir ${promo.name}`}
                      onClick={() => setDeleteTarget(promo)}
                    >
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Criar / Editar Promoção */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar: ${editing.name}` : 'Nova Promoção Agendada'}
        maxWidthClass="max-w-2xl"
      >
        <form
          onSubmit={form.handleSubmit((values) =>
            saveMutation.mutate(values as PromotionFormValues)
          )}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input
                label="Nome da promoção"
                required
                {...form.register('name')}
                error={form.formState.errors.name?.message}
                placeholder="Ex.: Segunda da Adega"
              />
            </div>
            <Input
              label="Prioridade"
              type="number"
              {...form.register('priority')}
              hint="Maior vence em conflitos"
            />
          </div>

          <Textarea
            label="Descrição pública da oferta (opcional)"
            {...form.register('description')}
            rows={2}
          />

          {/* Regra de agendamento */}
          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <Select
              label="Tipo de agendamento"
              {...form.register('schedule_type')}
              options={[
                { value: 'weekly', label: 'Semanal recorrente (dias da semana e horário)' },
                { value: 'once', label: 'Pontual (data/hora início e término)' },
              ]}
            />

            {watchedScheduleType === 'once' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={`Início (${timezone})`}
                  type="datetime-local"
                  {...form.register('starts_at_local')}
                  error={form.formState.errors.starts_at_local?.message}
                />
                <Input
                  label={`Término exclusivo (${timezone})`}
                  type="datetime-local"
                  {...form.register('ends_at_local')}
                  error={form.formState.errors.ends_at_local?.message}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-800">Dias da semana</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const active = watchedWeekdays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleWeekday(day.value)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? 'border-zinc-950 bg-zinc-950 text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {day.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                  {form.formState.errors.weekdays?.message ? (
                    <p className="mt-1 text-xs font-medium text-rose-600">
                      {form.formState.errors.weekdays.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Horário inicial"
                    type="time"
                    {...form.register('start_time')}
                    error={form.formState.errors.start_time?.message}
                  />
                  <Input
                    label="Horário final (exclusivo)"
                    type="time"
                    {...form.register('end_time')}
                    error={form.formState.errors.end_time?.message}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Válida a partir de (opcional)"
                    type="date"
                    {...form.register('valid_from')}
                  />
                  <Input
                    label="Válida até (opcional)"
                    type="date"
                    {...form.register('valid_until')}
                    error={form.formState.errors.valid_until?.message}
                    hint="Deixe vazio para recorrência contínua"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Benefício */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Tipo de benefício padrão"
              {...form.register('discount_type')}
              options={[
                { value: 'percent_off', label: 'Desconto percentual (%)' },
                { value: 'amount_off', label: 'Desconto em reais (R$)' },
                { value: 'fixed_price', label: 'Preço promocional fixo (R$)' },
              ]}
            />
            <Input
              label={
                watchedDiscountType === 'percent_off'
                  ? 'Percentual de desconto (%)'
                  : watchedDiscountType === 'amount_off'
                    ? 'Valor do desconto (R$)'
                    : 'Preço final promocional (R$)'
              }
              type="number"
              step="0.01"
              min="0.01"
              {...form.register('discount_value')}
              error={form.formState.errors.discount_value?.message}
            />
          </div>

          {/* Produtos participantes */}
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Produtos participantes ({watchedProducts.length})
              </p>
              {form.formState.errors.products?.message ? (
                <p className="text-xs font-medium text-rose-600">
                  {form.formState.errors.products.message}
                </p>
              ) : null}
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {products.map((prod) => {
                const selection = watchedProducts.find((p) => p.product_id === prod.id);
                const selected = Boolean(selection);
                const effType =
                  selection?.discount_type_override ||
                  (watchedDiscountType as PromotionDiscountType);
                const effVal =
                  selection?.discount_type_override && selection.discount_value_override
                    ? Number(selection.discount_value_override)
                    : Number(watchedDiscountValue);
                const previewPromo = selected
                  ? calculatePromotionalPrice(prod.price, effType, effVal)
                  : null;

                return (
                  <div
                    key={prod.id}
                    className={`rounded-xl border p-3 text-sm ${
                      selected ? 'border-zinc-900 bg-stone-50' : 'border-stone-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleProduct(prod.id)}
                          className="h-4 w-4 rounded border-stone-300 text-zinc-950 accent-zinc-950"
                        />
                        <span className="font-medium text-slate-900">{prod.name}</span>
                        <span className="text-xs text-slate-500">
                          (Base: {formatBRL(prod.price)})
                        </span>
                      </label>

                      {selected ? (
                        previewPromo !== null ? (
                          <Badge tone="success">Oferta: {formatBRL(previewPromo)}</Badge>
                        ) : (
                          <Badge tone="danger">Desconto inválido</Badge>
                        )
                      ) : null}
                    </div>

                    {selected ? (
                      <div className="mt-2 grid gap-2 border-t border-stone-200 pt-2 sm:grid-cols-2">
                        <select
                          aria-label={`Regra personalizada para ${prod.name}`}
                          value={selection?.discount_type_override ?? ''}
                          onChange={(e) =>
                            updateProductOverride(
                              prod.id,
                              e.target.value as PromotionDiscountType | '',
                              String(selection?.discount_value_override ?? '')
                            )
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        >
                          <option value="">Usar regra padrão da promoção</option>
                          <option value="percent_off">Sobrescrever: % desconto</option>
                          <option value="amount_off">Sobrescrever: R$ desconto</option>
                          <option value="fixed_price">Sobrescrever: R$ preço fixo</option>
                        </select>
                        {selection?.discount_type_override ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="Valor personalizado"
                            value={
                              selection.discount_value_override !== null &&
                              selection.discount_value_override !== undefined
                                ? String(selection.discount_value_override)
                                : ''
                            }
                            onChange={(e) =>
                              updateProductOverride(
                                prod.id,
                                selection.discount_type_override ?? '',
                                e.target.value
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              {...form.register('is_active')}
              className="h-4 w-4 rounded border-stone-300 text-zinc-950 accent-zinc-950"
            />
            Promoção ativa (desmarque para salvar pausada)
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              Salvar promoção
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        title="Excluir promoção"
        description={`Deseja excluir permanentemente a promoção "${deleteTarget?.name}"?`}
        confirmLabel="Excluir"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

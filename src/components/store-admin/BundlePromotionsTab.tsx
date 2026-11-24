import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, Minus, Package, Pause, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { bundlesService, type SaveBundleInput } from '../../services/bundles.service';
import {
  formatBRL,
  formatDecimalForInput,
  parseDecimalInput,
} from '../../lib/formatters';
import type { ProductRow, PromotionBundleWithItems } from '../../types/domain';
import { Badge, Card } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { DecimalInput } from '../ui/DecimalInput';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { EmptyState, ErrorState, LoadingSpinner } from '../ui/Feedback';
import { useToast } from '../ui/Toast';

interface BundlePromotionsTabProps {
  storeId: string;
  products: ProductRow[];
  writable: boolean;
}

export function BundlePromotionsTab({
  storeId,
  products,
  writable,
}: BundlePromotionsTabProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionBundleWithItems | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromotionBundleWithItems | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [promoPriceText, setPromoPriceText] = useState('');
  const [highlightTop, setHighlightTop] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Array<{ product_id: string; quantity: number }>>(
    []
  );
  const [formError, setFormError] = useState<string | null>(null);

  const { data: bundles = [], isLoading, error, refetch } = useQuery({
    queryKey: ['promotion-bundles', storeId],
    queryFn: () => bundlesService.listByStore(storeId),
  });

  const activeProducts = useMemo(() => products.filter((p) => p.is_active), [products]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const regularTotal = useMemo(() => {
    let sum = 0;
    for (const item of selectedItems) {
      const prod = productMap.get(item.product_id);
      if (prod) {
        sum += prod.price * item.quantity;
      }
    }
    return Math.round(sum * 100) / 100;
  }, [selectedItems, productMap]);

  const parsedPromoPrice = parseDecimalInput(promoPriceText);
  const savings =
    parsedPromoPrice !== null && parsedPromoPrice > 0 && parsedPromoPrice < regularTotal
      ? Math.round((regularTotal - parsedPromoPrice) * 100) / 100
      : null;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['promotion-bundles', storeId] });
  }

  const saveMutation = useMutation({
    mutationFn: async (input: SaveBundleInput) => {
      if (editing) {
        return bundlesService.update(editing.id, storeId, input);
      }
      return bundlesService.create(storeId, input);
    },
    onSuccess: async () => {
      setModalOpen(false);
      setEditing(null);
      await refresh();
      toast.success(editing ? 'Promoção em lote atualizada!' : 'Promoção em lote criada!');
    },
    onError: (err) => {
      toast.error('Erro ao salvar lote', err instanceof Error ? err.message : 'Erro');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, nextActive }: { id: string; nextActive: boolean }) =>
      bundlesService.toggleActive(id, storeId, nextActive),
    onSuccess: async () => {
      await refresh();
      toast.success('Estado do lote atualizado.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bundlesService.remove(id, storeId),
    onSuccess: async () => {
      setDeleteTarget(null);
      await refresh();
      toast.success('Promoção em lote excluída.');
    },
  });

  function openCreate() {
    setEditing(null);
    setName('');
    setDescription('');
    setPromoPriceText('');
    setHighlightTop(true);
    setIsActive(true);
    setSelectedItems([]);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(bundle: PromotionBundleWithItems) {
    setEditing(bundle);
    setName(bundle.name);
    setDescription(bundle.description ?? '');
    setPromoPriceText(formatDecimalForInput(bundle.promo_price));
    setHighlightTop(bundle.highlight_top);
    setIsActive(bundle.is_active);
    setSelectedItems(
      bundle.items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
      }))
    );
    setFormError(null);
    setModalOpen(true);
  }

  function toggleItem(productId: string) {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.product_id === productId);
      if (exists) return prev.filter((i) => i.product_id !== productId);
      return [...prev, { product_id: productId, quantity: 1 }];
    });
    setFormError(null);
  }

  function updateQuantity(productId: string, nextQty: number) {
    const clamped = Math.max(1, Math.min(99, Math.floor(nextQty) || 1));
    setSelectedItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, quantity: clamped } : i))
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setFormError('Informe um nome para o lote (mínimo 2 caracteres).');
      return;
    }
    if (selectedItems.length === 0) {
      setFormError('Adicione pelo menos 1 item ao lote.');
      return;
    }
    if (parsedPromoPrice === null || parsedPromoPrice <= 0) {
      setFormError('Informe o valor promocional do lote.');
      return;
    }
    if (parsedPromoPrice >= regularTotal) {
      setFormError(
        `O valor em promoção precisa ser menor que a soma comum dos itens (${formatBRL(regularTotal)}).`
      );
      return;
    }

    setFormError(null);
    saveMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      promo_price: parsedPromoPrice,
      highlight_top: highlightTop,
      is_active: isActive,
      items: selectedItems,
    });
  }

  if (isLoading) return <LoadingSpinner label="Carregando promoções em lote..." />;
  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao carregar lotes.'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Promoções em Lote (Combos)</h2>
          <p className="text-sm text-slate-600">
            Monte combos combinando vários itens e quantidades com preço especial e opção de
            destaque no topo do cardápio.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!writable || activeProducts.length === 0}>
          <Plus className="h-4 w-4" />
          Novo lote / combo
        </Button>
      </div>

      {bundles.length === 0 ? (
        <EmptyState
          title="Nenhuma promoção em lote criada"
          description="Combine itens como 2 lanches + 1 refrigerante com um valor promocional único."
          action={
            <Button onClick={openCreate} disabled={!writable || activeProducts.length === 0}>
              Criar primeiro lote
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {bundles.map((bundle) => {
            const bundleRegularTotal = bundle.items.reduce(
              (acc, item) => acc + (item.product?.price ?? 0) * item.quantity,
              0
            );
            return (
              <Card key={bundle.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Package className="h-4 w-4 text-zinc-900" />
                      <h3 className="text-base font-bold text-slate-900">{bundle.name}</h3>
                      <Badge tone={bundle.is_active ? 'success' : 'neutral'}>
                        {bundle.is_active ? 'Ativo' : 'Pausado'}
                      </Badge>
                      {bundle.highlight_top ? (
                        <Badge tone="warning">
                          <Sparkles className="h-3 w-3" />
                          Destaque no topo
                        </Badge>
                      ) : null}
                    </div>

                    {bundle.description ? (
                      <p className="text-xs text-slate-600">{bundle.description}</p>
                    ) : null}

                    <div className="flex flex-wrap items-baseline gap-2 pt-0.5 text-sm">
                      <span className="text-xs text-slate-500 line-through">
                        Soma comum: {formatBRL(bundleRegularTotal)}
                      </span>
                      <span className="rounded-lg bg-emerald-100 px-2 py-0.5 font-extrabold text-emerald-900">
                        {formatBRL(bundle.promo_price)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {bundle.items.map((item) => (
                        <span
                          key={item.id}
                          className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {item.quantity}x {item.product?.name ?? 'Item'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!writable}
                      onClick={() =>
                        toggleMutation.mutate({ id: bundle.id, nextActive: !bundle.is_active })
                      }
                    >
                      {bundle.is_active ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          Ativar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!writable}
                      onClick={() => openEdit(bundle)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!writable}
                      aria-label={`Excluir lote ${bundle.name}`}
                      onClick={() => setDeleteTarget(bundle)}
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

      {/* Modal Criar / Editar Lote */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Promoção em Lote' : 'Nova Promoção em Lote (Combo)'}
        description="Escolha os itens e a quantidade de cada um. O sistema soma o valor comum automaticamente."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome do lote / combo"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Combo Sextou, Lote Família..."
            />
            <DecimalInput
              label="Valor do lote em promoção (R$)"
              required
              value={promoPriceText}
              onChange={(val) => {
                setPromoPriceText(val);
                setFormError(null);
              }}
              placeholder="Ex.: 69,90"
              hint="Digite somente números (ex.: 69,90)."
            />
          </div>

          <Textarea
            label="Descrição (opcional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Ideal para compartilhar na mesa."
          />

          {/* Resumo financeiro ao vivo */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Soma dos itens no valor comum</p>
              <p className="text-lg font-extrabold text-slate-900">{formatBRL(regularTotal)}</p>
            </div>
            {savings !== null && parsedPromoPrice !== null ? (
              <div className="text-right">
                <p className="text-xs font-semibold text-emerald-700">
                  Economia de {formatBRL(savings)}
                </p>
                <p className="text-lg font-extrabold text-emerald-800">
                  {formatBRL(parsedPromoPrice)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Selecione os itens e informe um valor menor que a soma comum.
              </p>
            )}
          </div>

          {/* Seleção de itens e quantidades */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              Itens do lote ({selectedItems.length} selecionados)
            </p>
            <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {activeProducts.map((prod) => {
                const selected = selectedItems.find((i) => i.product_id === prod.id);
                return (
                  <div
                    key={prod.id}
                    className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm ${
                      selected ? 'bg-stone-50' : ''
                    }`}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={Boolean(selected)}
                        onChange={() => toggleItem(prod.id)}
                        className="h-4 w-4 rounded border-stone-300 text-zinc-950 accent-zinc-950"
                      />
                      <span className="truncate font-medium text-slate-900">{prod.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        ({formatBRL(prod.price)})
                      </span>
                    </label>

                    {selected ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Diminuir quantidade de ${prod.name}`}
                          onClick={() => updateQuantity(prod.id, selected.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Quantidade de ${prod.name}`}
                          value={String(selected.quantity)}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            if (!digits) return;
                            updateQuantity(prod.id, Number(digits));
                          }}
                          className="h-7 w-11 rounded-lg border border-slate-300 bg-white text-center text-xs font-bold text-slate-900"
                        />
                        <button
                          type="button"
                          aria-label={`Aumentar quantidade de ${prod.name}`}
                          onClick={() => updateQuantity(prod.id, selected.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={highlightTop}
                onChange={(e) => setHighlightTop(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-zinc-950 accent-zinc-950"
              />
              <Sparkles className="h-4 w-4 text-amber-500" />
              Destacar no topo da página
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-zinc-950 accent-zinc-950"
              />
              Lote ativo no cardápio
            </label>
          </div>

          {formError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700">
              {formError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {editing ? 'Salvar alterações' : 'Criar lote'}
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
        title="Excluir promoção em lote"
        description={`Deseja excluir o lote "${deleteTarget?.name}"? Os produtos individuais não serão afetados.`}
        confirmLabel="Excluir lote"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

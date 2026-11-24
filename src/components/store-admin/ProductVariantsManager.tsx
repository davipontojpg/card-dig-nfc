import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { variantsService } from '../../services/variants.service';
import { productsService } from '../../services/products.service';
import type { ProductRow } from '../../types/domain';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/Feedback';
import { useToast } from '../ui/Toast';

interface ProductVariantsManagerProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  product: ProductRow | null;
  disabled?: boolean;
}

export function ProductVariantsManager({
  open,
  onClose,
  storeId,
  product,
  disabled = false,
}: ProductVariantsManagerProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const productId = product?.id ?? '';

  const [variantLabel, setVariantLabel] = useState(product?.variant_label ?? '');
  const [newVariantName, setNewVariantName] = useState('');

  useEffect(() => {
    if (open && product) {
      setVariantLabel(product.variant_label ?? '');
      setNewVariantName('');
    }
  }, [open, product]);

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['product-variants', storeId, productId],
    queryFn: () => variantsService.listByProduct(storeId, productId),
    enabled: open && Boolean(productId),
  });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['product-variants', storeId, productId] }),
      queryClient.invalidateQueries({ queryKey: ['store-variants', storeId] }),
      queryClient.invalidateQueries({ queryKey: ['products', storeId] }),
    ]);
  }

  const saveLabelMutation = useMutation({
    mutationFn: () =>
      productsService.update(productId, storeId, {
        variant_label: variantLabel.trim() || null,
      }),
    onSuccess: async () => {
      await refresh();
      toast.success('Título das variantes salvo!');
    },
    onError: (err) => {
      toast.error('Erro ao salvar título', err instanceof Error ? err.message : 'Erro');
    },
  });

  const createVariantMutation = useMutation({
    mutationFn: (name: string) =>
      variantsService.create(storeId, productId, {
        name,
        is_available: true,
        sort_order: variants.length + 1,
      }),
    onSuccess: async () => {
      setNewVariantName('');
      await refresh();
      toast.success('Variante adicionada!');
    },
    onError: (err) => {
      toast.error('Erro ao adicionar variante', err instanceof Error ? err.message : 'Erro');
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      variantsService.update(id, storeId, { is_available: isAvailable }),
    onSuccess: refresh,
    onError: (err) => {
      toast.error('Erro ao atualizar variante', err instanceof Error ? err.message : 'Erro');
    },
  });

  const removeVariantMutation = useMutation({
    mutationFn: (id: string) => variantsService.remove(id, storeId),
    onSuccess: async () => {
      await refresh();
      toast.success('Variante excluída.');
    },
    onError: (err) => {
      toast.error('Erro ao excluir variante', err instanceof Error ? err.message : 'Erro');
    },
  });

  function handleAddVariant(e: FormEvent) {
    e.preventDefault();
    const clean = newVariantName.trim();
    if (!clean) return;
    createVariantMutation.mutate(clean);
  }

  if (!product) return null;

  const labelChanged = (variantLabel.trim() || null) !== (product.variant_label ?? null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Variantes — ${product.name}`}
      description="Opcional. Cadastre sabores, tamanhos ou versões do item. Variantes esgotadas aparecem apagadas e bloqueadas; variantes excluídas deixam de aparecer."
      maxWidthClass="max-w-xl"
    >
      {isLoading ? (
        <LoadingSpinner label="Carregando variantes..." />
      ) : (
        <div className="space-y-5">
          {/* Título opcional das variantes (ex.: Sabores) */}
          {!disabled ? (
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="Nome do grupo (opcional)"
                  value={variantLabel}
                  maxLength={40}
                  onChange={(e) => setVariantLabel(e.target.value)}
                  placeholder="Ex.: Sabores, Tamanhos, Tipos..."
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!labelChanged}
                isLoading={saveLabelMutation.isPending}
                onClick={() => saveLabelMutation.mutate()}
              >
                Salvar título
              </Button>
            </div>
          ) : null}

          {/* Adicionar nova variante rapidamente */}
          {!disabled ? (
            <form onSubmit={handleAddVariant} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="Nova variante"
                  value={newVariantName}
                  maxLength={80}
                  onChange={(e) => setNewVariantName(e.target.value)}
                  placeholder="Ex.: Manga, Morango, Maçã Verde..."
                />
              </div>
              <Button
                type="submit"
                disabled={!newVariantName.trim()}
                isLoading={createVariantMutation.isPending}
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </form>
          ) : null}

          {/* Lista de variantes */}
          {variants.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              Nenhuma variante cadastrada. Este item será exibido normalmente sem seleção de
              variante.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {variants.map((variant) => (
                <div
                  key={variant.id}
                  className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 ${
                    !variant.is_available ? 'bg-slate-50/80' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`truncate text-sm font-medium ${
                        variant.is_available
                          ? 'text-slate-900'
                          : 'text-slate-400 line-through'
                      }`}
                    >
                      {variant.name}
                    </span>
                    <Badge tone={variant.is_available ? 'success' : 'danger'}>
                      {variant.is_available ? 'Disponível' : 'Esgotado'}
                    </Badge>
                  </div>

                  {!disabled ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={toggleAvailabilityMutation.isPending}
                        onClick={() =>
                          toggleAvailabilityMutation.mutate({
                            id: variant.id,
                            isAvailable: !variant.is_available,
                          })
                        }
                      >
                        {variant.is_available ? 'Marcar esgotado' : 'Marcar disponível'}
                      </Button>
                      <button
                        type="button"
                        aria-label={`Excluir variante ${variant.name}`}
                        disabled={removeVariantMutation.isPending}
                        onClick={() => removeVariantMutation.mutate(variant.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

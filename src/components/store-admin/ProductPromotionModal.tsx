import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Tag, Trash2 } from 'lucide-react';
import { productsService } from '../../services/products.service';
import {
  formatBRL,
  formatDecimalForInput,
  parseDecimalInput,
} from '../../lib/formatters';
import type { ProductRow } from '../../types/domain';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DecimalInput } from '../ui/DecimalInput';
import { useToast } from '../ui/Toast';

interface ProductPromotionModalProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  product: ProductRow | null;
  disabled?: boolean;
}

export function ProductPromotionModal({
  open,
  onClose,
  storeId,
  product,
  disabled = false,
}: ProductPromotionModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [promoPriceText, setPromoPriceText] = useState('');
  const [highlightTop, setHighlightTop] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open && product) {
      setPromoPriceText(formatDecimalForInput(product.promo_price));
      setHighlightTop(Boolean(product.promo_highlight_top));
      setValidationError(null);
    }
  }, [open, product]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['products', storeId] });
  }

  const saveMutation = useMutation({
    mutationFn: async (input: { promo_price: number | null; promo_highlight_top: boolean }) => {
      if (!product) return;
      await productsService.update(product.id, storeId, input);
    },
    onSuccess: async (_data, variables) => {
      await refresh();
      onClose();
      if (variables.promo_price === null) {
        toast.success('Promoção removida do produto.');
      } else {
        toast.success('Promoção salva no produto!');
      }
    },
    onError: (err) => {
      toast.error('Erro ao salvar promoção', err instanceof Error ? err.message : 'Erro');
    },
  });

  if (!product) return null;

  const parsedPromo = parseDecimalInput(promoPriceText);
  const hasExistingPromo = product.promo_price !== null;
  const savings =
    parsedPromo !== null && parsedPromo > 0 && parsedPromo < product.price
      ? Math.round((product.price - parsedPromo) * 100) / 100
      : null;
  const savingsPercent =
    savings !== null && product.price > 0 ? Math.round((savings / product.price) * 100) : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    if (parsedPromo === null || parsedPromo <= 0) {
      setValidationError('Informe um valor promocional maior que R$ 0,00.');
      return;
    }
    if (parsedPromo >= product.price) {
      setValidationError(
        `O valor promocional precisa ser menor que o preço normal (${formatBRL(product.price)}).`
      );
      return;
    }
    setValidationError(null);
    saveMutation.mutate({
      promo_price: parsedPromo,
      promo_highlight_top: highlightTop,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Promoção — ${product.name}`}
      description="Defina o valor promocional direto neste produto. Você pode editar ou excluir manualmente quando quiser."
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-600">Preço normal atual</span>
          <strong className="text-base text-slate-900">{formatBRL(product.price)}</strong>
        </div>

        <DecimalInput
          label="Valor do produto na promoção (R$)"
          required
          disabled={disabled}
          value={promoPriceText}
          onChange={(val) => {
            setPromoPriceText(val);
            setValidationError(null);
          }}
          placeholder="Ex.: 19,90"
          hint="Digite o valor diretamente (somente números)."
          error={validationError ?? undefined}
        />

        {savings !== null && parsedPromo !== null ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900">
            <span className="flex items-center gap-1.5 font-semibold">
              <Tag className="h-3.5 w-3.5 text-emerald-700" />
              Economia de {formatBRL(savings)} ({savingsPercent}% OFF)
            </span>
            <span className="font-bold">
              <span className="mr-1.5 font-normal text-slate-500 line-through">
                {formatBRL(product.price)}
              </span>
              {formatBRL(parsedPromo)}
            </span>
          </div>
        ) : null}

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 text-sm">
          <input
            type="checkbox"
            disabled={disabled}
            checked={highlightTop}
            onChange={(e) => setHighlightTop(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-zinc-950 accent-zinc-950"
          />
          <span>
            <span className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Destacar no topo da página
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Exibe este produto na vitrine de ofertas em destaque no topo do cardápio digital.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          {hasExistingPromo && !disabled ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate({
                  promo_price: null,
                  promo_highlight_top: false,
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir promoção
            </Button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {!disabled ? (
              <Button type="submit" isLoading={saveMutation.isPending}>
                Salvar promoção
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </Modal>
  );
}

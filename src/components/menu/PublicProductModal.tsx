import { getAccessibleTextColor, formatBRL } from '../../lib/formatters';
import { storageService } from '../../services/storage.service';
import type { PublicMenuProduct } from '../../types/domain';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Tag, AlertCircle } from 'lucide-react';

interface PublicProductModalProps {
  product: PublicMenuProduct | null;
  accentColor: string;
  onClose: () => void;
}

export function PublicProductModal({ product, accentColor, onClose }: PublicProductModalProps) {
  if (!product) return null;

  const imageUrl = storageService.getPublicUrl(product.image_path);
  const contrastText = getAccessibleTextColor(accentColor);

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title={product.name}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        {imageUrl ? (
          <div className="overflow-hidden rounded-2xl bg-slate-100">
            <img
              src={imageUrl}
              alt={product.name}
              className="h-56 w-full object-cover"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {!product.is_available ? (
            <Badge tone="danger">
              <AlertCircle className="h-3.5 w-3.5" />
              Indisponível no momento
            </Badge>
          ) : null}
          {product.is_featured ? <Badge tone="info">Destaque da casa</Badge> : null}
          {product.promotion && product.is_available ? (
            <Badge tone="success">
              <Tag className="h-3.5 w-3.5" />
              {product.promotion.name}
            </Badge>
          ) : null}
        </div>

        {product.description ? (
          <p className="text-sm leading-relaxed text-slate-700">{product.description}</p>
        ) : null}

        <div className="rounded-xl bg-slate-50 p-4">
          {product.promotion && product.is_available ? (
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-sm text-slate-500 line-through">
                {formatBRL(product.promotion.original_price)}
              </span>
              <span
                className="rounded-lg px-2.5 py-1 text-xl font-extrabold"
                style={{ backgroundColor: accentColor, color: contrastText }}
              >
                {formatBRL(product.promotion.promotional_price)}
              </span>
            </div>
          ) : (
            <p className="text-xl font-extrabold text-slate-900">{formatBRL(product.price)}</p>
          )}
          {product.promotion?.description && product.is_available ? (
            <p className="mt-1.5 text-xs text-slate-600">{product.promotion.description}</p>
          ) : null}
        </div>

        {product.option_groups.length > 0 ? (
          <div className="space-y-3 pt-1">
            <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">
              Adicionais e Opções (Consulta)
            </h3>
            {product.option_groups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-slate-200 bg-white p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{group.name}</h4>
                    {group.description ? (
                      <p className="text-xs text-slate-500">{group.description}</p>
                    ) : null}
                  </div>
                  <Badge tone={group.is_required ? 'warning' : 'neutral'}>
                    {group.is_required ? 'Obrigatório' : 'Opcional'}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Orientação: escolha de {group.min_selection} até {group.max_selection}{' '}
                  {group.max_selection === 1 ? 'opção' : 'opções'}
                </p>

                {group.options.length > 0 ? (
                  <ul className="mt-2.5 divide-y divide-slate-100">
                    {group.options.map((opt) => (
                      <li
                        key={opt.id}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{opt.name}</p>
                          {opt.description ? (
                            <p className="text-xs text-slate-500">{opt.description}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 font-semibold text-slate-900">
                          {opt.extra_price > 0
                            ? `+ ${formatBRL(opt.extra_price)}`
                            : 'Sem acréscimo'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">Nenhuma opção ativa neste grupo.</p>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}


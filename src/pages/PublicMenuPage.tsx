import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Clock,
  Eye,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Store,
  Tag,
  UtensilsCrossed,
} from 'lucide-react';
import { publicMenuService } from '../services/public-menu.service';
import { storageService } from '../services/storage.service';
import {
  formatBRL,
  formatDateTimeInTz,
  formatTimeShort,
  getAccessibleTextColor,
} from '../lib/formatters';
import type { PublicMenuProduct } from '../types/domain';
import { PublicProductModal } from '../components/menu/PublicProductModal';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ErrorState, LoadingSpinner } from '../components/ui/Feedback';

export function PublicMenuPage() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const isPreviewRequest = searchParams.get('preview') === '1';
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<PublicMenuProduct | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public-menu', slug, isPreviewRequest ? 'preview' : 'public'],
    queryFn: () =>
      isPreviewRequest
        ? publicMenuService.getPreviewBySlug(slug)
        : publicMenuService.getBySlug(slug),
    enabled: Boolean(slug),
    staleTime: 15_000,
  });

  const filteredCategories = useMemo(() => {
    if (!data || data.status !== 'ok' || !data.categories) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.categories;
    return data.categories
      .map((cat) => ({
        ...cat,
        products: cat.products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description ?? '').toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.products.length > 0);
  }, [data, search]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <LoadingSpinner label="Carregando cardápio..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <ErrorState
          title="Erro de conexão"
          message={
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o cardápio agora.'
          }
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!data || data.status === 'not_found') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8">
          <Store className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Cardápio não encontrado</h1>
          <p className="mt-2 text-sm text-slate-600">
            O endereço consultado não corresponde a nenhum estabelecimento cadastrado.
          </p>
        </div>
      </main>
    );
  }

  if (data.status === 'unpublished') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8">
          <Clock className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Cardápio em preparação</h1>
          <p className="mt-2 text-sm text-slate-600">
            Este estabelecimento ainda não publicou o cardápio digital. Tente novamente em breve.
          </p>
        </div>
      </main>
    );
  }

  if (data.status === 'unavailable' || !data.store) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8">
          <AlertCircle className="mx-auto h-10 w-10 text-slate-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Cardápio temporariamente indisponível
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Este cardápio não está disponível para consulta pública no momento.
          </p>
        </div>
      </main>
    );
  }

  const { store, features, categories = [], active_promotions = [] } = data;
  const accentColor = store.primary_color || '#0f766e';
  const contrastText = getAccessibleTextColor(accentColor);
  const logoUrl = storageService.getPublicUrl(store.logo_path);
  const promotionsEnabled = Boolean(features?.basic_promotions || features?.scheduled_promotions);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {data.is_preview ? (
        <div
          role="status"
          className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-zinc-950 px-4 py-2 text-center text-xs font-medium text-white"
        >
          <Eye className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span>
            Modo prévia — visível apenas para você e para o operador
            {data.lifecycle_status === 'pending_setup' ? ' (cardápio ainda não publicado)' : ''}.
          </span>
        </div>
      ) : null}

      {/* Cabeçalho do estabelecimento */}
      <header
        className="px-4 pt-8 pb-6 shadow-xs"
        style={{ backgroundColor: accentColor, color: contrastText }}
      >
        <div className="mx-auto flex max-w-3xl items-start gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`Logotipo de ${store.name}`}
              className="h-16 w-16 shrink-0 rounded-2xl border border-white/25 bg-white object-cover sm:h-20 sm:w-20"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-xl font-bold sm:h-20 sm:w-20">
              {store.name.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            {store.business_type ? (
              <p className="text-xs font-semibold tracking-wider uppercase opacity-85">
                {store.business_type}
              </p>
            ) : null}
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {store.name}
            </h1>
            {store.description ? (
              <p className="mt-1.5 text-sm leading-relaxed opacity-90">{store.description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-90">
              {store.public_address ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {store.public_address}
                </span>
              ) : null}
              {store.public_phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {store.public_phone}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Busca e navegação por categorias */}
      {categories.length > 0 ? (
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
          <div className="mx-auto max-w-3xl space-y-2.5 px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-3.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                aria-label="Buscar no cardápio"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar item no cardápio..."
                className="w-full rounded-xl border border-stone-300 bg-stone-50 py-2 pr-3 pl-9 text-sm focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>

            <nav
              aria-label="Categorias do cardápio"
              className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5"
            >
              {categories.map((cat) => (
                <a
                  key={cat.id}
                  href={`#cat-${cat.id}`}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {cat.name}
                </a>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        {/* Destaque de ofertas vigentes (apenas com scheduled_promotions ativo) */}
        {promotionsEnabled && active_promotions.length > 0 ? (
          <section
            aria-label="Ofertas vigentes"
            className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"
          >
            <div className="flex items-center gap-2 text-emerald-900">
              <Tag className="h-4 w-4 text-emerald-700" />
              <h2 className="text-sm font-bold tracking-wide uppercase">Ofertas vigentes agora</h2>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {active_promotions.map((promo) => (
                <div
                  key={promo.promotion_id}
                  className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-800"
                >
                  <p className="font-bold text-emerald-800">{promo.name}</p>
                  {promo.description ? (
                    <p className="text-slate-600">{promo.description}</p>
                  ) : null}
                  {promo.schedule_type === 'once' && promo.ends_at ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Válida até {formatDateTimeInTz(promo.ends_at, store.timezone)}
                    </p>
                  ) : promo.end_time ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Hoje até {formatTimeShort(promo.end_time)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <UtensilsCrossed className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 text-base font-semibold text-slate-900">Cardápio vazio</h2>
            <p className="mt-1 text-sm text-slate-500">
              Este estabelecimento ainda não cadastrou itens disponíveis para visualização.
            </p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">
              Nenhum produto encontrado para "{search}".
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearch('')}>
              Limpar busca
            </Button>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <section
              key={category.id}
              id={`cat-${category.id}`}
              className="scroll-mt-32 space-y-3"
            >
              <div>
                <h2 className="text-xl font-bold text-slate-900">{category.name}</h2>
                {category.description ? (
                  <p className="mt-0.5 text-sm text-slate-500">{category.description}</p>
                ) : null}
              </div>

              <div className="grid gap-3">
                {category.products.map((product) => {
                  const thumbUrl = storageService.getPublicUrl(product.image_path);
                  const hasPromo =
                    promotionsEnabled && product.is_available && Boolean(product.promotion);

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className={`group flex w-full items-stretch justify-between gap-3 rounded-2xl border bg-white p-3.5 text-left transition-shadow hover:shadow-md ${
                        !product.is_available
                          ? 'border-slate-200 bg-slate-50/80 opacity-75'
                          : hasPromo
                            ? 'border-emerald-300'
                            : 'border-slate-200'
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="text-base font-bold text-slate-900">{product.name}</h3>
                            {product.is_featured && product.is_available ? (
                              <Badge tone="info">
                                <Sparkles className="h-3 w-3" />
                                Destaque
                              </Badge>
                            ) : null}
                            {!product.is_available ? (
                              <Badge tone="danger">
                                <AlertCircle className="h-3 w-3" />
                                Indisponível
                              </Badge>
                            ) : null}
                            {hasPromo && product.promotion ? (
                              <Badge tone="success">
                                <Tag className="h-3 w-3" />
                                {product.promotion.name}
                              </Badge>
                            ) : null}
                          </div>

                          {product.description ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
                              {product.description}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {hasPromo && product.promotion ? (
                            <>
                              <span className="text-xs text-slate-500 line-through">
                                {formatBRL(product.promotion.original_price)}
                              </span>
                              <span
                                className="rounded-lg px-2 py-0.5 text-sm font-extrabold"
                                style={{ backgroundColor: accentColor, color: contrastText }}
                              >
                                {formatBRL(product.promotion.promotional_price)}
                              </span>
                            </>
                          ) : (
                            <span className="text-base font-extrabold text-slate-900">
                              {formatBRL(product.price)}
                            </span>
                          )}

                          {product.option_groups.length > 0 ? (
                            <span className="text-[11px] font-medium text-slate-500">
                              • Ver adicionais ({product.option_groups.length})
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={product.name}
                          loading="lazy"
                          decoding="async"
                          className={`h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28 ${
                            !product.is_available ? 'grayscale' : ''
                          }`}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="mt-10 border-t border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">{store.name}</p>
        {store.public_address ? <p className="mt-1">{store.public_address}</p> : null}
        {store.public_phone ? <p className="mt-0.5">{store.public_phone}</p> : null}
        <p className="mt-3 text-[11px] text-slate-400">
          Cardápio digital informativo • Valores em reais (BRL)
        </p>
      </footer>

      <PublicProductModal
        product={selectedProduct}
        accentColor={accentColor}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}


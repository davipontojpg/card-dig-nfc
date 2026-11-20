import { useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Edit3,
  Eye,
  ImagePlus,
  ListPlus,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useStoreWorkspace } from '../app/route-guards/StoreMemberGuard';
import { categoriesService } from '../services/categories.service';
import { productsService } from '../services/products.service';
import { optionsService } from '../services/options.service';
import { storageService } from '../services/storage.service';
import { productSchema, type ProductFormValues } from '../lib/validators/product.schema';
import { formatBRL } from '../lib/formatters';
import { isSubscriptionWritable } from '../lib/permissions';
import type { ProductRow, PublicMenuProduct } from '../types/domain';
import { Badge, Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { EmptyState, ErrorState, LoadingSpinner } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';
import { ProductOptionsManager } from '../components/store-admin/ProductOptionsManager';
import { PublicProductModal } from '../components/menu/PublicProductModal';

export function ProductsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { access } = useStoreWorkspace();
  const storeId = access.store.id;
  const writable = isSubscriptionWritable(access);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);

  const [optionsProduct, setOptionsProduct] = useState<ProductRow | null>(null);
  const [previewProduct, setPreviewProduct] = useState<PublicMenuProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['categories', storeId],
    queryFn: () => categoriesService.listByStore(storeId),
  });

  const {
    data: products = [],
    isLoading: prodLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['products', storeId],
    queryFn: () => productsService.listByStore(storeId),
  });

  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      category_id: '',
      name: '',
      description: '',
      price: 0,
      is_active: true,
      is_available: true,
      is_featured: false,
      sort_order: 0,
    },
  });

  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (categoryFilter !== 'all' && p.category_id !== categoryFilter) return false;
      if (statusFilter === 'active' && !p.is_active) return false;
      if (statusFilter === 'inactive' && p.is_active) return false;
      if (statusFilter === 'unavailable' && (!p.is_active || p.is_available)) return false;
      if (statusFilter === 'featured' && !p.is_featured) return false;
      return true;
    });
  }, [products, search, categoryFilter, statusFilter]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products', storeId] }),
      queryClient.invalidateQueries({ queryKey: ['categories', storeId] }),
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      let imagePath = editing?.image_path ?? null;

      if (removeExistingPhoto && imagePath) {
        await storageService.removeMenuImage(storeId, imagePath);
        imagePath = null;
      }

      if (selectedFile) {
        imagePath = await storageService.uploadMenuImage(
          storeId,
          'products',
          selectedFile,
          editing?.image_path
        );
      }

      const payload = {
        category_id: values.category_id,
        name: values.name,
        description: values.description || null,
        price: values.price,
        image_path: imagePath,
        is_active: values.is_active,
        is_available: values.is_available,
        is_featured: values.is_featured,
        sort_order: values.sort_order,
      };

      if (editing) {
        return productsService.update(editing.id, storeId, payload);
      }
      return productsService.create(storeId, payload);
    },
    onSuccess: async () => {
      closeFormModal();
      await refresh();
      toast.success(editing ? 'Produto atualizado!' : 'Produto cadastrado!');
    },
    onError: (err) => {
      toast.error('Erro ao salvar produto', err instanceof Error ? err.message : 'Erro');
    },
  });

  const quickToggleMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ProductRow> }) =>
      productsService.update(id, storeId, updates),
    onSuccess: refresh,
    onError: (err) => {
      toast.error('Não foi possível alterar estado', err instanceof Error ? err.message : 'Erro');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (product: ProductRow) => {
      await productsService.remove(product.id, storeId);
      if (product.image_path) {
        await storageService.removeMenuImage(storeId, product.image_path).catch(() => undefined);
      }
    },
    onSuccess: async () => {
      setDeleteTarget(null);
      await refresh();
      toast.success('Produto excluído.');
    },
    onError: (err) => {
      toast.error('Erro ao excluir produto', err instanceof Error ? err.message : 'Erro');
    },
  });

  function resetPhotoState() {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    setSelectedFile(null);
    setPreviewObjectUrl(null);
    setRemoveExistingPhoto(false);
  }

  function closeFormModal() {
    setFormModalOpen(false);
    setEditing(null);
    resetPhotoState();
  }

  function openCreate() {
    setEditing(null);
    resetPhotoState();
    form.reset({
      category_id: categories[0]?.id ?? '',
      name: '',
      description: '',
      price: 0,
      is_active: true,
      is_available: true,
      is_featured: false,
      sort_order: products.length + 1,
    });
    setFormModalOpen(true);
  }

  function openEdit(product: ProductRow) {
    setEditing(product);
    resetPhotoState();
    form.reset({
      category_id: product.category_id,
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      is_active: product.is_active,
      is_available: product.is_available,
      is_featured: product.is_featured,
      sort_order: product.sort_order,
    });
    setFormModalOpen(true);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      storageService.validateImageFile(file);
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      setSelectedFile(file);
      setPreviewObjectUrl(URL.createObjectURL(file));
      setRemoveExistingPhoto(false);
    } catch (err) {
      toast.error('Imagem inválida', err instanceof Error ? err.message : 'Formato inválido.');
    }
  }

  async function openPreview(product: ProductRow) {
    const groups = await optionsService.listByProduct(storeId, product.id).catch(() => []);
    setPreviewProduct({
      id: product.id,
      category_id: product.category_id,
      name: product.name,
      description: product.description,
      price: product.price,
      image_path: product.image_path,
      is_available: product.is_available,
      is_featured: product.is_featured,
      sort_order: product.sort_order,
      promotion: null,
      option_groups: groups
        .filter((g) => g.is_active)
        .map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          is_required: g.is_required,
          min_selection: g.min_selection,
          max_selection: g.max_selection,
          sort_order: g.sort_order,
          options: g.options
            .filter((o) => o.is_active)
            .map((o) => ({
              id: o.id,
              name: o.name,
              description: o.description,
              extra_price: o.extra_price,
              sort_order: o.sort_order,
            })),
        })),
    });
  }

  if (catLoading || prodLoading) return <LoadingSpinner label="Carregando produtos..." />;
  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao carregar produtos.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const currentModalPhotoUrl = previewObjectUrl
    ? previewObjectUrl
    : !removeExistingPhoto
      ? storageService.getPublicUrl(editing?.image_path)
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-sm text-slate-600">
            Cadastre itens, preços em BRL, fotos, adicionais e alterne disponibilidade em um toque.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!writable || categories.length === 0}>
          <Plus className="h-4 w-4" />
          Novo produto
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          title="Crie uma categoria primeiro"
          description="Para cadastrar produtos no cardápio, é necessário ter ao menos uma categoria criada."
          action={
            <Link to="/app/categorias">
              <Button>Ir para Categorias</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  aria-label="Pesquisar produto por nome"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <select
                aria-label="Filtrar por categoria"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Todas as categorias</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por situação"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Todas as situações</option>
                <option value="active">Somente ativos</option>
                <option value="inactive">Arquivados / inativos</option>
                <option value="unavailable">Indisponíveis</option>
                <option value="featured">Destaques</option>
              </select>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <EmptyState
              title="Nenhum produto encontrado"
              description="Cadastre um novo produto ou limpe os filtros de busca."
              action={
                <Button onClick={openCreate} disabled={!writable}>
                  Cadastrar produto
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3">
              {filtered.map((product) => {
                const thumbUrl = storageService.getPublicUrl(product.image_path);
                return (
                  <Card key={product.id} className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3.5">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={product.name}
                            className="h-16 w-16 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
                            Sem foto
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-bold text-slate-900">{product.name}</h2>
                            {product.is_featured ? (
                              <Badge tone="info">
                                <Star className="h-3 w-3" />
                                Destaque
                              </Badge>
                            ) : null}
                            {!product.is_active ? (
                              <Badge tone="neutral">Arquivado</Badge>
                            ) : !product.is_available ? (
                              <Badge tone="danger">Indisponível</Badge>
                            ) : (
                              <Badge tone="success">Disponível</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {categoryNameMap.get(product.category_id) ?? 'Categoria'} •{' '}
                            <strong className="text-slate-900">{formatBRL(product.price)}</strong>
                          </p>
                          {product.description ? (
                            <p className="mt-1 line-clamp-1 text-xs text-slate-600">
                              {product.description}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant={product.is_available ? 'outline' : 'secondary'}
                          size="sm"
                          disabled={!writable}
                          onClick={() =>
                            quickToggleMutation.mutate({
                              id: product.id,
                              updates: { is_available: !product.is_available },
                            })
                          }
                        >
                          {product.is_available ? 'Marcar indisponível' : 'Marcar disponível'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOptionsProduct(product)}
                        >
                          <ListPlus className="h-3.5 w-3.5" />
                          Adicionais
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Pré-visualizar ${product.name}`}
                          onClick={() => void openPreview(product)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!writable}
                          onClick={() => openEdit(product)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!writable}
                          aria-label={`Excluir ${product.name}`}
                          onClick={() => setDeleteTarget(product)}
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
        </>
      )}

      {/* Modal Criar / Editar Produto */}
      <Modal
        open={formModalOpen}
        onClose={closeFormModal}
        title={editing ? `Editar: ${editing.name}` : 'Novo Produto'}
        maxWidthClass="max-w-xl"
      >
        <form
          onSubmit={form.handleSubmit((values) =>
            saveMutation.mutate(values as ProductFormValues)
          )}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome do produto"
              required
              {...form.register('name')}
              error={form.formState.errors.name?.message}
            />
            <Select
              label="Categoria"
              required
              {...form.register('category_id')}
              error={form.formState.errors.category_id?.message}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Preço-base (R$)"
              type="number"
              step="0.01"
              min="0"
              required
              {...form.register('price')}
              error={form.formState.errors.price?.message}
            />
            <Input
              label="Ordem de exibição"
              type="number"
              min="0"
              {...form.register('sort_order')}
              error={form.formState.errors.sort_order?.message}
            />
          </div>

          <Textarea
            label="Descrição (opcional)"
            {...form.register('description')}
            error={form.formState.errors.description?.message}
          />

          {/* Foto do produto */}
          <div className="space-y-2 rounded-xl border border-slate-200 p-3.5">
            <p className="text-sm font-medium text-slate-800">Foto do produto (opcional)</p>
            {currentModalPhotoUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={currentModalPhotoUrl}
                  alt="Pré-visualização do produto"
                  className="h-20 w-20 rounded-xl object-cover"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
                    setSelectedFile(null);
                    setPreviewObjectUrl(null);
                    setRemoveExistingPhoto(true);
                  }}
                >
                  Remover foto
                </Button>
              </div>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <ImagePlus className="h-4 w-4" />
              {currentModalPhotoUrl ? 'Substituir imagem' : 'Enviar ou tirar foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
            <p className="text-[11px] text-slate-500">
              JPEG, PNG ou WebP até 5 MB. Otimizada automaticamente antes do envio.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                {...form.register('is_active')}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              Ativo no cardápio
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                {...form.register('is_available')}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              Disponível hoje
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                {...form.register('is_featured')}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              Produto em destaque
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeFormModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              Salvar produto
            </Button>
          </div>
        </form>
      </Modal>

      {optionsProduct ? (
        <ProductOptionsManager
          open={Boolean(optionsProduct)}
          onClose={() => setOptionsProduct(null)}
          storeId={storeId}
          productId={optionsProduct.id}
          productName={optionsProduct.name}
          disabled={!writable}
        />
      ) : null}

      <PublicProductModal
        product={previewProduct}
        accentColor={access.store.primary_color}
        onClose={() => setPreviewProduct(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Se preferir apenas ocultar temporariamente, edite e desmarque "Ativo no cardápio".`}
        confirmLabel="Excluir produto"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}


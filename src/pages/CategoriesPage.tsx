import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Edit3, Plus, Trash2 } from 'lucide-react';
import { useStoreWorkspace } from '../app/route-guards/StoreMemberGuard';
import { categoriesService, type CategoryWithCount } from '../services/categories.service';
import { categorySchema, type CategoryFormValues } from '../lib/validators/category.schema';
import { isSubscriptionWritable } from '../lib/permissions';
import { Badge, Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { EmptyState, ErrorState, LoadingSpinner } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';

export function CategoriesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { access } = useStoreWorkspace();
  const storeId = access.store.id;
  const writable = isSubscriptionWritable(access);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryWithCount | null>(null);
  const [deactivateWarning, setDeactivateWarning] = useState<CategoryFormValues | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(null);

  const { data: categories = [], isLoading, error, refetch } = useQuery({
    queryKey: ['categories', storeId],
    queryFn: () => categoriesService.listByStore(storeId),
  });

  const form = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      sort_order: 0,
      is_active: true,
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['categories', storeId] });
  }

  const saveMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      if (editing) {
        return categoriesService.update(editing.id, storeId, {
          name: values.name,
          description: values.description || null,
          sort_order: values.sort_order,
          is_active: values.is_active,
        });
      }
      return categoriesService.create(storeId, {
        name: values.name,
        description: values.description || null,
        sort_order: values.sort_order,
        is_active: values.is_active,
      });
    },
    onSuccess: async () => {
      setModalOpen(false);
      setEditing(null);
      setDeactivateWarning(null);
      await refresh();
      toast.success(editing ? 'Categoria atualizada.' : 'Categoria criada.');
    },
    onError: (err) => {
      toast.error('Erro ao salvar categoria', err instanceof Error ? err.message : 'Erro');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ a, b }: { a: CategoryWithCount; b: CategoryWithCount }) => {
      const orderA = a.sort_order;
      const orderB = b.sort_order === a.sort_order ? a.sort_order + 1 : b.sort_order;
      await Promise.all([
        categoriesService.update(a.id, storeId, { sort_order: orderB }),
        categoriesService.update(b.id, storeId, { sort_order: orderA }),
      ]);
    },
    onSuccess: refresh,
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) => categoriesService.remove(categoryId, storeId),
    onSuccess: async () => {
      setDeleteTarget(null);
      await refresh();
      toast.success('Categoria excluída.');
    },
    onError: (err) => {
      toast.error(
        'Não foi possível excluir categoria',
        err instanceof Error ? err.message : 'Verifique se há produtos vinculados.'
      );
    },
  });

  function openCreate() {
    setEditing(null);
    form.reset({
      name: '',
      description: '',
      sort_order: categories.length + 1,
      is_active: true,
    });
    setModalOpen(true);
  }

  function openEdit(cat: CategoryWithCount) {
    setEditing(cat);
    form.reset({
      name: cat.name,
      description: cat.description ?? '',
      sort_order: cat.sort_order,
      is_active: cat.is_active,
    });
    setModalOpen(true);
  }

  function handleFormSubmit(raw: unknown) {
    const values = raw as CategoryFormValues;
    if (editing && editing.is_active && !values.is_active && editing.activeProductCount > 0) {
      setDeactivateWarning(values);
      return;
    }
    saveMutation.mutate(values);
  }

  if (isLoading) return <LoadingSpinner label="Carregando categorias..." />;
  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao carregar categorias.'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categorias do Cardápio</h1>
          <p className="text-sm text-slate-600">
            Organize as seções exibidas aos clientes no cardápio público.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!writable}>
          <Plus className="h-4 w-4" />
          Nova categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          title="Nenhuma categoria cadastrada"
          description="Crie sua primeira categoria (ex.: Bebidas, Lanches, Porções) antes de cadastrar produtos."
          action={
            <Button onClick={openCreate} disabled={!writable}>
              Criar primeira categoria
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {categories.map((cat, index) => (
            <Card
              key={cat.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    #{cat.sort_order}
                  </span>
                  <h2 className="font-semibold text-slate-900">{cat.name}</h2>
                  <Badge tone={cat.is_active ? 'success' : 'neutral'}>
                    {cat.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
                {cat.description ? (
                  <p className="mt-1 text-xs text-slate-600">{cat.description}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-500">
                  {cat.productCount} produto(s) associado(s) ({cat.activeProductCount} ativo(s))
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Mover ${cat.name} para cima`}
                  disabled={!writable || index === 0}
                  onClick={() =>
                    reorderMutation.mutate({ a: cat, b: categories[index - 1] })
                  }
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Mover ${cat.name} para baixo`}
                  disabled={!writable || index === categories.length - 1}
                  onClick={() =>
                    reorderMutation.mutate({ a: cat, b: categories[index + 1] })
                  }
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!writable}
                  onClick={() => openEdit(cat)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!writable || cat.productCount > 0}
                  title={
                    cat.productCount > 0
                      ? 'Remova ou mova os produtos antes de excluir a categoria'
                      : 'Excluir categoria'
                  }
                  aria-label={`Excluir ${cat.name}`}
                  onClick={() => setDeleteTarget(cat)}
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar categoria' : 'Nova categoria'}
      >
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
          <Input
            label="Nome da categoria"
            required
            {...form.register('name')}
            error={form.formState.errors.name?.message}
            placeholder="Ex.: Cervejas Artesanais"
          />
          <Textarea
            label="Descrição (opcional)"
            {...form.register('description')}
            error={form.formState.errors.description?.message}
          />
          <Input
            label="Ordem de exibição"
            type="number"
            min="0"
            {...form.register('sort_order')}
            error={form.formState.errors.sort_order?.message}
          />
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              {...form.register('is_active')}
              className="h-4 w-4 rounded border-stone-300 text-zinc-950 accent-zinc-950"
            />
            Categoria ativa e visível no cardápio público
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateWarning)}
        onClose={() => setDeactivateWarning(null)}
        onConfirm={() => {
          if (deactivateWarning) saveMutation.mutate(deactivateWarning);
        }}
        title="Categoria possui produtos ativos"
        description={`A categoria "${editing?.name}" possui ${editing?.activeProductCount ?? 0} produto(s) ativo(s). Desativá-la ocultará a seção e seus produtos do cardápio público. Deseja continuar?`}
        confirmLabel="Desativar categoria"
        isLoading={saveMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        title="Excluir categoria"
        description={`Deseja excluir permanentemente a categoria "${deleteTarget?.name}"?`}
        confirmLabel="Excluir"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}


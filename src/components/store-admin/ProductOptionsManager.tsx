import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { optionsService } from '../../services/options.service';
import {
  optionGroupSchema,
  productOptionSchema,
  type OptionGroupFormValues,
  type ProductOptionFormValues,
} from '../../lib/validators/option.schema';
import { formatBRL } from '../../lib/formatters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/Feedback';
import { useToast } from '../ui/Toast';

interface ProductOptionsManagerProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  productId: string;
  productName: string;
  disabled?: boolean;
}

export function ProductOptionsManager({
  open,
  onClose,
  storeId,
  productId,
  productName,
  disabled = false,
}: ProductOptionsManagerProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [addingOptionGroupId, setAddingOptionGroupId] = useState<string | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['product-options', storeId, productId],
    queryFn: () => optionsService.listByProduct(storeId, productId),
    enabled: open && Boolean(productId),
  });

  const groupForm = useForm({
    resolver: zodResolver(optionGroupSchema),
    defaultValues: {
      name: '',
      description: '',
      is_required: false,
      min_selection: 0,
      max_selection: 1,
      sort_order: 0,
      is_active: true,
    },
  });

  const optionForm = useForm({
    resolver: zodResolver(productOptionSchema),
    defaultValues: {
      name: '',
      description: '',
      extra_price: 0,
      sort_order: 0,
      is_active: true,
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['product-options', storeId, productId] });
  }

  const createGroupMutation = useMutation({
    mutationFn: (values: OptionGroupFormValues) =>
      optionsService.createGroup(storeId, productId, {
        name: values.name,
        description: values.description || null,
        is_required: values.is_required,
        min_selection: values.min_selection,
        max_selection: values.max_selection,
        sort_order: values.sort_order,
        is_active: values.is_active,
      }),
    onSuccess: async () => {
      groupForm.reset({
        name: '',
        description: '',
        is_required: false,
        min_selection: 0,
        max_selection: 1,
        sort_order: groups.length + 1,
        is_active: true,
      });
      await refresh();
      toast.success('Grupo de adicionais criado.');
    },
    onError: (err) => {
      toast.error('Erro ao criar grupo', err instanceof Error ? err.message : 'Erro');
    },
  });

  const removeGroupMutation = useMutation({
    mutationFn: (groupId: string) => optionsService.removeGroup(groupId, storeId),
    onSuccess: async () => {
      await refresh();
      toast.success('Grupo removido.');
    },
  });

  const createOptionMutation = useMutation({
    mutationFn: ({ groupId, values }: { groupId: string; values: ProductOptionFormValues }) =>
      optionsService.createOption(storeId, groupId, {
        name: values.name,
        description: values.description || null,
        extra_price: values.extra_price,
        sort_order: values.sort_order,
        is_active: values.is_active,
      }),
    onSuccess: async () => {
      optionForm.reset({
        name: '',
        description: '',
        extra_price: 0,
        sort_order: 0,
        is_active: true,
      });
      setAddingOptionGroupId(null);
      await refresh();
      toast.success('Opção adicionada.');
    },
    onError: (err) => {
      toast.error('Erro ao adicionar opção', err instanceof Error ? err.message : 'Erro');
    },
  });

  const removeOptionMutation = useMutation({
    mutationFn: (optionId: string) => optionsService.removeOption(optionId, storeId),
    onSuccess: async () => {
      await refresh();
    },
  });

  const toggleGroupActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      optionsService.updateGroup(id, storeId, { is_active: isActive }),
    onSuccess: refresh,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Adicionais — ${productName}`}
      description="Configure grupos e acréscimos informativos exibidos aos consumidores."
      maxWidthClass="max-w-2xl"
    >
      {isLoading ? (
        <LoadingSpinner label="Carregando adicionais..." />
      ) : (
        <div className="space-y-6">
          {/* Lista de grupos existentes */}
          {groups.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              Nenhum grupo de adicionais cadastrado para este produto ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{group.name}</h3>
                        <Badge tone={group.is_required ? 'warning' : 'neutral'}>
                          {group.is_required ? 'Obrigatório' : 'Opcional'}
                        </Badge>
                        <Badge tone={group.is_active ? 'success' : 'neutral'}>
                          {group.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        Mín: {group.min_selection} • Máx: {group.max_selection}
                        {group.description ? ` • ${group.description}` : ''}
                      </p>
                    </div>

                    {!disabled ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            toggleGroupActiveMutation.mutate({
                              id: group.id,
                              isActive: !group.is_active,
                            })
                          }
                        >
                          {group.is_active ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Excluir grupo ${group.name}`}
                          onClick={() => removeGroupMutation.mutate(group.id)}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {/* Opções do grupo */}
                  <div className="divide-y divide-slate-100 rounded-lg bg-slate-50 px-3">
                    {group.options.map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between gap-2 py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium text-slate-800">{opt.name}</span>
                          {opt.description ? (
                            <span className="ml-2 text-xs text-slate-500">{opt.description}</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {opt.extra_price > 0 ? `+ ${formatBRL(opt.extra_price)}` : 'Incluso'}
                          </span>
                          {!disabled ? (
                            <button
                              type="button"
                              aria-label={`Remover opção ${opt.name}`}
                              onClick={() => removeOptionMutation.mutate(opt.id)}
                              className="rounded p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {!disabled ? (
                    addingOptionGroupId === group.id ? (
                      <form
                        onSubmit={optionForm.handleSubmit((values) =>
                          createOptionMutation.mutate({
                            groupId: group.id,
                            values: values as ProductOptionFormValues,
                          })
                        )}
                        className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-3"
                      >
                        <Input
                          label="Nome da opção"
                          required
                          {...optionForm.register('name')}
                          error={optionForm.formState.errors.name?.message}
                          placeholder="Ex.: Batata rústica"
                        />
                        <Input
                          label="Acréscimo (R$)"
                          type="number"
                          step="0.01"
                          min="0"
                          {...optionForm.register('extra_price')}
                          error={optionForm.formState.errors.extra_price?.message}
                        />
                        <div className="flex items-end gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            isLoading={createOptionMutation.isPending}
                          >
                            Adicionar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAddingOptionGroupId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddingOptionGroupId(group.id)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar opção
                      </Button>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* Formulário novo grupo */}
          {!disabled ? (
            <form
              onSubmit={groupForm.handleSubmit((values) =>
                createGroupMutation.mutate(values as OptionGroupFormValues)
              )}
              className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-900">Novo Grupo de Adicionais</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Nome do grupo"
                  required
                  {...groupForm.register('name')}
                  error={groupForm.formState.errors.name?.message}
                  placeholder="Ex.: Escolha o acompanhamento"
                />
                <Input
                  label="Descrição (opcional)"
                  {...groupForm.register('description')}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <Input
                  label="Mínimo"
                  type="number"
                  min="0"
                  {...groupForm.register('min_selection')}
                  error={groupForm.formState.errors.min_selection?.message}
                />
                <Input
                  label="Máximo"
                  type="number"
                  min="1"
                  {...groupForm.register('max_selection')}
                  error={groupForm.formState.errors.max_selection?.message}
                />
                <Input
                  label="Ordem"
                  type="number"
                  min="0"
                  {...groupForm.register('sort_order')}
                />
                <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-800">
                  <input
                    type="checkbox"
                    {...groupForm.register('is_required')}
                    className="h-4 w-4 rounded border-stone-300 text-zinc-950 accent-zinc-950"
                  />
                  Obrigatório
                </label>
              </div>

              <div className="flex justify-end">
                <Button type="submit" isLoading={createGroupMutation.isPending}>
                  <Plus className="h-4 w-4" />
                  Criar grupo
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      )}
    </Modal>
  );
}


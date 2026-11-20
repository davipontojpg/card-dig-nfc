import { useState, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ImagePlus, XCircle } from 'lucide-react';
import { useStoreWorkspace } from '../app/route-guards/StoreMemberGuard';
import { storesService } from '../services/stores.service';
import { storageService } from '../services/storage.service';
import {
  storeAppearanceSchema,
  type StoreAppearanceFormValues,
} from '../lib/validators/store.schema';
import {
  COMMON_TIMEZONES,
  getAccessibleTextColor,
  normalizeSlug,
} from '../lib/formatters';
import { isSubscriptionWritable } from '../lib/permissions';
import { Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useToast } from '../components/ui/Toast';

const COLOR_PRESETS = ['#0f766e', '#4338ca', '#b45309', '#be123c', '#15803d', '#0f172a'];

export function StoreAppearancePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { access, refetchAccess } = useStoreWorkspace();
  const { store, role } = access;
  const isOwnerOrAdmin = role === 'owner' || role === 'platform_admin';
  const writable = isOwnerOrAdmin && isSubscriptionWritable(access);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [slugState, setSlugState] = useState<'idle' | 'available' | 'taken'>('idle');

  const form = useForm<StoreAppearanceFormValues>({
    resolver: zodResolver(storeAppearanceSchema),
    defaultValues: {
      name: store.name,
      slug: store.slug,
      business_type: store.business_type ?? '',
      description: store.description ?? '',
      public_phone: store.public_phone ?? '',
      public_address: store.public_address ?? '',
      primary_color: store.primary_color,
      timezone: store.timezone,
      is_published: store.is_published,
    },
  });

  const watchedSlug = useWatch({ control: form.control, name: 'slug' });
  const watchedColor = useWatch({ control: form.control, name: 'primary_color' });
  const slugChanged = normalizeSlug(watchedSlug) !== store.slug;

  const saveMutation = useMutation({
    mutationFn: async (values: StoreAppearanceFormValues) => {
      let nextLogoPath = store.logo_path;

      if (removeLogo && nextLogoPath) {
        await storageService.removeMenuImage(store.id, nextLogoPath);
        nextLogoPath = null;
      }

      if (logoFile) {
        nextLogoPath = await storageService.uploadMenuImage(
          store.id,
          'branding',
          logoFile,
          store.logo_path
        );
      }

      return storesService.updateAppearance(store.id, {
        name: values.name,
        slug: values.slug,
        business_type: values.business_type || null,
        description: values.description || null,
        logo_path: nextLogoPath,
        primary_color: values.primary_color,
        public_phone: values.public_phone || null,
        public_address: values.public_address || null,
        timezone: values.timezone,
        is_published: values.is_published,
      });
    },
    onSuccess: async () => {
      setLogoFile(null);
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      setLogoPreviewUrl(null);
      setRemoveLogo(false);
      await refetchAccess();
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Identidade visual atualizada!');
    },
    onError: (err) => {
      toast.error('Erro ao atualizar aparência', err instanceof Error ? err.message : 'Erro');
    },
  });

  async function handleCheckSlug() {
    const clean = normalizeSlug(watchedSlug || '');
    form.setValue('slug', clean);
    if (clean === store.slug) {
      setSlugState('available');
      return;
    }
    try {
      const ok = await storesService.checkSlugAvailability(clean, store.id);
      setSlugState(ok ? 'available' : 'taken');
    } catch {
      setSlugState('idle');
    }
  }

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      storageService.validateImageFile(file);
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      setLogoFile(file);
      setLogoPreviewUrl(URL.createObjectURL(file));
      setRemoveLogo(false);
    } catch (err) {
      toast.error('Logo inválido', err instanceof Error ? err.message : 'Formato inválido.');
    }
  }

  const displayedLogo = logoPreviewUrl
    ? logoPreviewUrl
    : !removeLogo
      ? storageService.getPublicUrl(store.logo_path)
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Identidade Visual e Publicação</h1>
        <p className="text-sm text-slate-600">
          Personalize nome, logotipo, cor principal e informações exibidas no cardápio público.
        </p>
      </div>

      {!isOwnerOrAdmin ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Você está conectado como <strong>Editor</strong>. Somente o proprietário pode alterar
          identidade visual, slug ou publicação do estabelecimento.
        </div>
      ) : null}

      <form
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        className="space-y-6"
      >
        <Card className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome público do estabelecimento"
              required
              disabled={!writable}
              {...form.register('name')}
              error={form.formState.errors.name?.message}
            />
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="Slug da URL pública"
                    required
                    disabled={!writable}
                    {...form.register('slug', {
                      onChange: () => setSlugState('idle'),
                    })}
                    error={form.formState.errors.slug?.message}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!writable}
                  onClick={() => void handleCheckSlug()}
                >
                  Verificar
                </Button>
              </div>
              {slugState === 'available' ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Slug disponível.
                </p>
              ) : null}
              {slugState === 'taken' ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                  <XCircle className="h-3.5 w-3.5" /> Slug indisponível ou reservado.
                </p>
              ) : null}
              {slugChanged ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alterar o slug invalida QR Codes e tags
                  NFC gravadas com o endereço antigo.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Categoria / tipo de negócio"
              disabled={!writable}
              {...form.register('business_type')}
            />
            <Select
              label="Fuso horário"
              disabled={!writable}
              {...form.register('timezone')}
              options={COMMON_TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
            />
          </div>

          <Textarea
            label="Descrição curta do estabelecimento"
            disabled={!writable}
            {...form.register('description')}
            error={form.formState.errors.description?.message}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Telefone / WhatsApp público"
              disabled={!writable}
              {...form.register('public_phone')}
            />
            <Input
              label="Endereço público"
              disabled={!writable}
              {...form.register('public_address')}
            />
          </div>
        </Card>

        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">Logotipo e Cor Principal</h2>

          <div className="flex flex-wrap items-center gap-4">
            {displayedLogo ? (
              <img
                src={displayedLogo}
                alt="Logotipo do estabelecimento"
                className="h-20 w-20 rounded-2xl border border-slate-200 object-cover"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl text-xl font-bold"
                style={{
                  backgroundColor: watchedColor || '#0f766e',
                  color: getAccessibleTextColor(watchedColor || '#0f766e'),
                }}
              >
                {store.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            {writable ? (
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <ImagePlus className="h-4 w-4" />
                  {displayedLogo ? 'Trocar logo' : 'Enviar logo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleLogoChange}
                    className="sr-only"
                  />
                </label>
                {displayedLogo ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
                      setLogoFile(null);
                      setLogoPreviewUrl(null);
                      setRemoveLogo(true);
                    }}
                  >
                    Remover logo
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Input
              label="Cor principal (#RRGGBB)"
              disabled={!writable}
              {...form.register('primary_color')}
              error={form.formState.errors.primary_color?.message}
            />
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  disabled={!writable}
                  aria-label={`Selecionar cor ${hex}`}
                  onClick={() => form.setValue('primary_color', hex)}
                  className="h-8 w-8 rounded-full border-2 border-white shadow ring-1 ring-slate-300"
                  style={{ backgroundColor: hex }}
                />
              ))}
              <span
                className="ml-2 rounded-lg px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: /^#[0-9a-fA-F]{6}$/.test(watchedColor)
                    ? watchedColor
                    : '#0f766e',
                  color: getAccessibleTextColor(watchedColor || '#0f766e'),
                }}
              >
                Prévia de contraste em botões
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="flex items-start gap-2.5 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                disabled={!writable}
                {...form.register('is_published')}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span>
                Publicar cardápio ao público
                <span className="block text-xs font-normal text-slate-500">
                  Disponível apenas quando o estabelecimento estiver ativo e com assinatura válida.
                </span>
              </span>
            </label>
          </div>
        </Card>

        {writable ? (
          <div className="flex justify-end">
            <Button type="submit" isLoading={saveMutation.isPending}>
              Salvar aparência
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  );
}


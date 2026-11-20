import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { platformService } from '../services/platform.service';
import { provisioningService } from '../services/provisioning.service';
import {
  provisionStoreSchema,
  type ProvisionStoreFormValues,
} from '../lib/validators/store.schema';
import {
  COMMON_TIMEZONES,
  DEFAULT_TIMEZONE,
  formatBRL,
  normalizeSlug,
} from '../lib/formatters';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';

export function PlatformNewStorePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>(
    'idle'
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => platformService.listPlans(),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProvisionStoreFormValues>({
    resolver: zodResolver(provisionStoreSchema),
    defaultValues: {
      name: '',
      slug: '',
      business_type: '',
      description: '',
      public_phone: '',
      public_address: '',
      primary_color: '#0f766e',
      timezone: DEFAULT_TIMEZONE,
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      internal_notes: '',
      plan_id: '',
      subscription_status: 'trialing',
      setup_fee_status: 'pending',
      started_at: new Date().toISOString().slice(0, 10),
      current_period_start: '',
      current_period_end: '',
      next_billing_at: '',
      onboarding_status: 'pending_data',
    },
  });

  const watchedName = useWatch({ control, name: 'name' });
  const watchedSlug = useWatch({ control, name: 'slug' });
  const watchedPlanId = useWatch({ control, name: 'plan_id' });

  useEffect(() => {
    if (plans.length > 0 && !watchedPlanId) {
      setValue('plan_id', plans[0].id);
    }
  }, [plans, watchedPlanId, setValue]);

  useEffect(() => {
    if (!slugTouched && watchedName) {
      setValue('slug', normalizeSlug(watchedName), { shouldValidate: false });
    }
  }, [watchedName, slugTouched, setValue]);

  async function handleCheckSlug() {
    const clean = normalizeSlug(watchedSlug || '');
    setValue('slug', clean);
    if (clean.length < 3) {
      setSlugStatus('taken');
      return;
    }
    setSlugStatus('checking');
    try {
      const available = await platformService.checkSlugAvailability(clean);
      setSlugStatus(available ? 'available' : 'taken');
    } catch {
      setSlugStatus('idle');
    }
  }

  const selectedPlan = plans.find((p) => p.id === watchedPlanId);

  async function onSubmit(values: ProvisionStoreFormValues) {
    setSubmitError(null);
    try {
      const toIso = (d: string | null | undefined) =>
        d ? new Date(`${d}T12:00:00Z`).toISOString() : null;

      const result = await provisioningService.provisionStore({
        ...values,
        started_at: toIso(values.started_at),
        current_period_start: toIso(values.current_period_start),
        current_period_end: toIso(values.current_period_end),
        next_billing_at: toIso(values.next_billing_at),
        redirect_to: `${window.location.origin}/auth/set-password`,
      });

      await queryClient.invalidateQueries({ queryKey: ['platform-stores'] });
      await queryClient.invalidateQueries({ queryKey: ['platform-dashboard'] });

      if (result.owner_invite_status === 'sent') {
        toast.success('Estabelecimento criado!', result.message);
      } else {
        toast.info('Estabelecimento criado com pendência de acesso', result.message);
      }

      navigate(`/platform/stores/${result.store_id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Erro inesperado ao provisionar estabelecimento.'
      );
    }
  }

  if (plansLoading) return <LoadingSpinner label="Carregando catálogo de planos..." />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cadastrar Novo Estabelecimento</h1>
        <p className="text-sm text-slate-600">
          Cria o tenant, assinatura comercial, checklist de onboarding e envia o convite de acesso
          ao proprietário pelo servidor.
        </p>
      </div>

      {submitError ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {submitError}
        </div>
      ) : null}

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-6">
        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">1. Dados do Estabelecimento</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome comercial / público"
              required
              {...register('name')}
              error={errors.name?.message}
              placeholder="Ex.: Cantina da Praça"
            />
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="Slug da URL pública"
                    required
                    {...register('slug', {
                      onChange: () => {
                        setSlugTouched(true);
                        setSlugStatus('idle');
                      },
                    })}
                    error={errors.slug?.message}
                    hint={`Cardápio ficará em /m/${watchedSlug || 'seu-slug'}`}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mb-5"
                  onClick={() => void handleCheckSlug()}
                >
                  Verificar
                </Button>
              </div>
              {slugStatus === 'available' ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Slug disponível.
                </p>
              ) : null}
              {slugStatus === 'taken' ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600">
                  <XCircle className="h-3.5 w-3.5" /> Slug indisponível ou reservado.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Categoria / tipo de negócio"
              {...register('business_type')}
              placeholder="Adega, Restaurante, Pizzaria..."
            />
            <Input label="Telefone público" {...register('public_phone')} placeholder="(11) 99999-0000" />
            <Select
              label="Fuso horário"
              {...register('timezone')}
              options={COMMON_TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
              error={errors.timezone?.message}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Endereço público (opcional)" {...register('public_address')} />
            <Input
              label="Cor principal (#RRGGBB)"
              {...register('primary_color')}
              error={errors.primary_color?.message}
            />
          </div>

          <Textarea label="Descrição pública (opcional)" {...register('description')} rows={2} />
        </Card>

        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">
            2. Responsável e Dados Internos (Privados)
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Nome do responsável"
              required
              {...register('contact_name')}
              error={errors.contact_name?.message}
            />
            <Input
              label="E-mail de acesso do proprietário"
              type="email"
              required
              {...register('contact_email')}
              error={errors.contact_email?.message}
            />
            <Input label="Telefone interno de contato" {...register('contact_phone')} />
          </div>
          <Textarea
            label="Observações internas do operador"
            {...register('internal_notes')}
            hint="Visível somente no painel central da plataforma."
          />
        </Card>

        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">
            3. Plano Contratado, Condições Comerciais e Onboarding
          </h2>

          <div className="grid gap-3 md:grid-cols-3">
            {plans.map((plan) => {
              const isSelected = plan.id === watchedPlanId;
              return (
                <label
                  key={plan.id}
                  className={`cursor-pointer rounded-2xl border p-4 transition-colors ${
                    isSelected
                      ? 'border-zinc-950 bg-stone-50 ring-1 ring-zinc-950'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    value={plan.id}
                    {...register('plan_id')}
                    className="sr-only"
                  />
                  <p className="text-sm font-bold text-slate-900">{plan.name}</p>
                  <p className="mt-1 text-lg font-extrabold text-zinc-950">
                    {formatBRL(plan.monthly_price)}/mês
                  </p>
                  <p className="text-xs text-slate-600">
                    Implantação: {formatBRL(plan.setup_fee)}
                  </p>
                </label>
              );
            })}
          </div>

          {selectedPlan ? (
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              Snapshot inicial que será gravado na assinatura:{' '}
              <strong>{formatBRL(selectedPlan.monthly_price)}/mês</strong> e taxa de implantação{' '}
              <strong>{formatBRL(selectedPlan.setup_fee)}</strong>.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Status inicial da assinatura"
              {...register('subscription_status')}
              options={[
                { value: 'trialing', label: 'Avaliação / Implantação' },
                { value: 'active', label: 'Ativa' },
                { value: 'past_due', label: 'Em atraso' },
                { value: 'suspended', label: 'Suspensa' },
              ]}
            />
            <Select
              label="Taxa de implantação"
              {...register('setup_fee_status')}
              options={[
                { value: 'pending', label: 'Pendente' },
                { value: 'paid', label: 'Paga' },
                { value: 'waived', label: 'Isenta' },
              ]}
            />
            <Select
              label="Status inicial do onboarding"
              {...register('onboarding_status')}
              options={[
                { value: 'pending_data', label: 'Aguardando dados' },
                { value: 'in_setup', label: 'Em configuração' },
                { value: 'awaiting_client', label: 'Aguardando cliente' },
                { value: 'ready', label: 'Pronto' },
                { value: 'completed', label: 'Concluído' },
              ]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Input label="Início do contrato" type="date" {...register('started_at')} />
            <Input label="Início do período" type="date" {...register('current_period_start')} />
            <Input label="Fim do período" type="date" {...register('current_period_end')} />
            <Input label="Próxima cobrança" type="date" {...register('next_billing_at')} />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/platform/stores')}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Criar estabelecimento e enviar convite
          </Button>
        </div>
      </form>
    </div>
  );
}


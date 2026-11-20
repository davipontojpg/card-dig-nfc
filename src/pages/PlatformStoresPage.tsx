import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Copy, ExternalLink, Plus, Search } from 'lucide-react';
import { platformService } from '../services/platform.service';
import { buildPublicMenuUrl } from '../lib/env';
import { formatBRL, formatDateInTz } from '../lib/formatters';
import {
  getLifecycleStatusMeta,
  getOnboardingStatusMeta,
  getSubscriptionStatusMeta,
} from '../lib/permissions';
import { Badge, Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingSpinner } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';

export function PlatformStoresPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [subFilter, setSubFilter] = useState('all');
  const [onboardingFilter, setOnboardingFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'created_desc' | 'name_asc' | 'billing_asc'>('created_desc');

  const { data: stores = [], isLoading, error, refetch } = useQuery({
    queryKey: ['platform-stores'],
    queryFn: () => platformService.listStores(),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => platformService.listPlans(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = stores.filter((item) => {
      if (q) {
        const hay = [
          item.store.name,
          item.store.slug,
          item.internal?.contact_name ?? '',
          item.internal?.contact_email ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (planFilter !== 'all' && item.plan?.code !== planFilter) return false;
      if (subFilter !== 'all' && item.subscription?.status !== subFilter) return false;
      if (onboardingFilter !== 'all' && item.store.onboarding_status !== onboardingFilter)
        return false;
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'name_asc') return a.store.name.localeCompare(b.store.name, 'pt-BR');
      if (sortBy === 'billing_asc') {
        const ba = a.subscription?.next_billing_at ?? '9999-12-31';
        const bb = b.subscription?.next_billing_at ?? '9999-12-31';
        return ba.localeCompare(bb);
      }
      return b.store.created_at.localeCompare(a.store.created_at);
    });

    return list;
  }, [stores, search, planFilter, subFilter, onboardingFilter, sortBy]);

  async function copyUrl(slug: string) {
    const url = buildPublicMenuUrl(slug);
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado', url);
  }

  if (isLoading) return <LoadingSpinner label="Carregando estabelecimentos..." />;
  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao listar estabelecimentos.'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estabelecimentos</h1>
          <p className="text-sm text-slate-600">
            Cadastre clientes, acompanhe implantações e controle planos e acessos.
          </p>
        </div>
        <Link to="/platform/stores/new">
          <Button>
            <Plus className="h-4 w-4" />
            Novo estabelecimento
          </Button>
        </Link>
      </div>

      {/* Filtros e Pesquisa */}
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              aria-label="Pesquisar estabelecimento"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, slug, responsável ou e-mail..."
              className="w-full rounded-xl border border-stone-300 bg-white py-2 pr-3 pl-9 text-sm focus:border-zinc-950 focus:outline-none"
            />
          </div>

          <select
            aria-label="Filtrar por plano"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">Todos os planos</option>
            {plans.map((p) => (
              <option key={p.id} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por status da assinatura"
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">Todas as assinaturas</option>
            <option value="trialing">Avaliação / Implantação</option>
            <option value="active">Ativa</option>
            <option value="past_due">Em atraso</option>
            <option value="suspended">Suspensa</option>
            <option value="canceled">Cancelada</option>
          </select>

          <div className="flex gap-2">
            <select
              aria-label="Filtrar por onboarding"
              value={onboardingFilter}
              onChange={(e) => setOnboardingFilter(e.target.value)}
              className="w-1/2 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm"
            >
              <option value="all">Onboarding</option>
              <option value="pending_data">Aguardando dados</option>
              <option value="in_setup">Em configuração</option>
              <option value="awaiting_client">Aguardando cliente</option>
              <option value="ready">Pronto</option>
              <option value="completed">Concluído</option>
            </select>
            <select
              aria-label="Ordenar estabelecimentos"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'created_desc' | 'name_asc' | 'billing_asc')
              }
              className="w-1/2 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm"
            >
              <option value="created_desc">Mais recentes</option>
              <option value="name_asc">Nome (A-Z)</option>
              <option value="billing_asc">Próx. cobrança</option>
            </select>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum estabelecimento encontrado"
          description="Ajuste os filtros aplicados ou cadastre um novo estabelecimento."
          action={
            <Link to="/platform/stores/new">
              <Button>Novo estabelecimento</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(({ store, internal, subscription, plan }) => {
            const lifecycleMeta = getLifecycleStatusMeta(store.lifecycle_status);
            const onboardingMeta = getOnboardingStatusMeta(store.onboarding_status);
            const subMeta = subscription ? getSubscriptionStatusMeta(subscription.status) : null;

            return (
              <Card key={store.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/platform/stores/${store.id}`}
                        className="text-base font-bold text-zinc-950 hover:underline"
                      >
                        {store.name}
                      </Link>
                      <Badge tone={lifecycleMeta.tone}>{lifecycleMeta.label}</Badge>
                      {subMeta ? <Badge tone={subMeta.tone}>{subMeta.label}</Badge> : null}
                      <Badge tone={onboardingMeta.tone}>{onboardingMeta.label}</Badge>
                    </div>

                    <p className="text-xs text-slate-600">
                      <span className="font-mono text-slate-700">/m/{store.slug}</span> •{' '}
                      Responsável: {internal?.contact_name || '—'} (
                      {internal?.contact_email || 'sem e-mail'})
                    </p>

                    <p className="text-xs text-slate-500">
                      Plano: <strong>{plan?.name ?? '—'}</strong> • Mensalidade:{' '}
                      <strong>
                        {subscription ? formatBRL(subscription.monthly_price_snapshot) : '—'}
                      </strong>{' '}
                      • Implantação:{' '}
                      <strong>
                        {subscription ? formatBRL(subscription.setup_fee_snapshot) : '—'}
                      </strong>{' '}
                      • Criado em {formatDateInTz(store.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {store.is_published && store.lifecycle_status === 'active' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void copyUrl(store.slug)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copiar URL
                        </Button>
                        <Link to={`/m/${store.slug}`} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir
                          </Button>
                        </Link>
                      </>
                    ) : null}
                    <Link to={`/platform/stores/${store.id}`}>
                      <Button size="sm">Gerenciar</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


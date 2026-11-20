import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { platformService } from '../services/platform.service';
import { formatBRL, formatDateInTz } from '../lib/formatters';
import { getSubscriptionStatusMeta } from '../lib/permissions';
import { Badge, Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingSpinner } from '../components/ui/Feedback';

export function PlatformDashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform-dashboard'],
    queryFn: () => platformService.getDashboardMetrics(),
  });

  if (isLoading) return <LoadingSpinner label="Carregando indicadores da plataforma..." />;
  if (error || !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Falha ao carregar dashboard central.'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral da Plataforma</h1>
          <p className="text-sm text-slate-600">
            Acompanhamento operacional de estabelecimentos, assinaturas e implantações.
          </p>
        </div>
        <Link to="/platform/stores/new">
          <Button>
            <Plus className="h-4 w-4" />
            Novo estabelecimento
          </Button>
        </Link>
      </div>

      {/* KPIs principais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Estabelecimentos</span>
            <Building2 className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.total_stores}</p>
          <p className="mt-1 text-xs text-slate-500">
            {data.by_lifecycle.active} ativos • {data.by_lifecycle.pending_setup} em implantação
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">MRR Operacional Estimado</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{formatBRL(data.estimated_mrr)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Estimativa operacional ({data.active_billing_subscriptions_count} assinaturas ativas) —
            não representa contabilidade.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Onboarding Pendente</span>
            <ClipboardList className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.pending_onboarding_count}</p>
          <p className="mt-1 text-xs text-slate-500">
            Clientes aguardando dados, configuração ou publicação.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Atenção Comercial</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {data.by_subscription_status.past_due + data.by_subscription_status.suspended}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {data.by_subscription_status.past_due} em atraso •{' '}
            {data.by_subscription_status.suspended} suspensas
          </p>
        </Card>
      </div>

      {data.total_stores === 0 ? (
        <EmptyState
          title="Nenhum estabelecimento cadastrado ainda"
          description="Cadastre o primeiro cliente para atribuir um plano, iniciar o onboarding e enviar o convite seguro ao proprietário."
          action={
            <Link to="/platform/stores/new">
              <Button>
                <Plus className="h-4 w-4" />
                Cadastrar primeiro cliente
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900">
              Distribuição por Plano e Situação
            </h2>
            <div className="mt-4 space-y-3">
              {data.by_plan.map((item) => (
                <div
                  key={item.plan_code}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5"
                >
                  <span className="text-sm font-medium text-slate-800">{item.plan_name}</span>
                  <Badge tone="info">{item.count} clientes</Badge>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-xs text-slate-600 sm:grid-cols-3">
              <div>
                <span className="font-semibold text-slate-900">{data.by_lifecycle.active}</span>{' '}
                ativos
              </div>
              <div>
                <span className="font-semibold text-slate-900">
                  {data.by_lifecycle.pending_setup}
                </span>{' '}
                em implantação
              </div>
              <div>
                <span className="font-semibold text-slate-900">{data.by_lifecycle.suspended}</span>{' '}
                suspensos
              </div>
              <div>
                <span className="font-semibold text-slate-900">{data.by_lifecycle.archived}</span>{' '}
                arquivados
              </div>
              <div>
                <span className="font-semibold text-slate-900">
                  {data.by_subscription_status.trialing}
                </span>{' '}
                em avaliação
              </div>
              <div>
                <span className="font-semibold text-slate-900">
                  {data.by_subscription_status.canceled}
                </span>{' '}
                cancelados
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Próximos Vencimentos (30 dias)
              </h2>
              <CalendarClock className="h-4 w-4 text-slate-400" />
            </div>

            {data.upcoming_billings.length === 0 ? (
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Nenhuma cobrança manual prevista para os próximos 30 dias.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {data.upcoming_billings.map((item) => {
                  const subMeta = getSubscriptionStatusMeta(item.status);
                  return (
                    <div
                      key={item.store_id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/platform/stores/${item.store_id}`}
                          className="truncate text-sm font-semibold text-indigo-700 hover:underline"
                        >
                          {item.store_name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {item.plan_name} • Vence em {formatDateInTz(item.next_billing_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatBRL(item.monthly_price_snapshot)}
                        </p>
                        <Badge tone={subMeta.tone}>{subMeta.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}


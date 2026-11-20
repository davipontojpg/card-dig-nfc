import { useQuery } from '@tanstack/react-query';
import { Check, Info } from 'lucide-react';
import { platformService } from '../services/platform.service';
import { formatBRL } from '../lib/formatters';
import { Badge, Card } from '../components/ui/Badge';
import { ErrorState, LoadingSpinner } from '../components/ui/Feedback';

export function PlatformPlansPage() {
  const { data: plans = [], isLoading, error, refetch } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => platformService.listPlans(),
  });

  if (isLoading) return <LoadingSpinner label="Carregando catálogo de planos..." />;
  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao carregar planos.'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Catálogo de Planos Comerciais</h1>
        <p className="text-sm text-slate-600">
          Os preços abaixo são referência para novas contratações. Clientes já ativos preservam seus
          snapshots individuais na assinatura.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                <Badge tone="info">{plan.code}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">{plan.description}</p>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500 uppercase">Mensalidade</p>
                <p className="text-2xl font-extrabold text-slate-900">
                  {formatBRL(plan.monthly_price)}
                  <span className="text-sm font-normal text-slate-500">/mês</span>
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Taxa única de implantação: <strong>{formatBRL(plan.setup_fee)}</strong>
                </p>
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Recursos liberados (feature_key)
                </p>
                {plan.features.map((feat) => (
                  <div key={feat.feature_key} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <span className="font-medium">{feat.name}</span>{' '}
                      <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-600">
                        {feat.feature_key}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-indigo-200 bg-indigo-50/70 p-4 text-sm text-indigo-950">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
          <p>
            <strong>Observação comercial:</strong> a inclusão de suporte a NFC no plano não inclui
            automaticamente chips, etiquetas físicas, placas, impressão ou frete, que devem ser
            orçados separadamente. Alterações futuras no catálogo devem ser versionadas via
            migration SQL.
          </p>
        </div>
      </Card>
    </div>
  );
}


import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import type { FeatureKey } from '../../types/database';
import { hasFeature } from '../../lib/permissions';
import { useStoreWorkspace } from './StoreMemberGuard';
import { Card } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

interface StoreFeatureGuardProps {
  featureKey: FeatureKey;
  title: string;
  requiredPlanHint: string;
  description: string;
  children: ReactNode;
}

export function StoreFeatureGuard({
  featureKey,
  title,
  requiredPlanHint,
  description,
  children,
}: StoreFeatureGuardProps) {
  const { access } = useStoreWorkspace();
  const allowed = access.has_service_access && hasFeature(access.features, featureKey);

  if (!allowed) {
    const reasonText = !access.has_service_access
      ? 'A assinatura ou ciclo de vida do estabelecimento está restrito no momento. Consulte a situação do contrato para regularizar o acesso.'
      : description;

    return (
      <Card className="mx-auto max-w-2xl p-6 sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-amber-700 uppercase">
                {!access.has_service_access ? 'Acesso suspenso ou pendente' : requiredPlanHint}
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{reasonText}</p>
            <div className="pt-1">
              <Link to="/app/conta">
                <Button variant="outline">Ver plano e status da assinatura</Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
}


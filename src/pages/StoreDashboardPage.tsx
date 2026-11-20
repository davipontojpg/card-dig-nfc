import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ExternalLink,
  FolderKanban,
  Lock,
  Palette,
  Percent,
  QrCode,
  UtensilsCrossed,
} from 'lucide-react';
import { useStoreWorkspace } from '../app/route-guards/StoreMemberGuard';
import { categoriesService } from '../services/categories.service';
import { productsService } from '../services/products.service';
import { hasFeature } from '../lib/permissions';
import { buildPublicMenuUrl } from '../lib/env';
import { Card, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/Feedback';

export function StoreDashboardPage() {
  const { access } = useStoreWorkspace();
  const { store, subscription, features, has_service_access } = access;
  const hasPromotions = has_service_access && hasFeature(features, 'scheduled_promotions');
  const hasNfc = has_service_access && hasFeature(features, 'nfc_access');

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['categories', store.id],
    queryFn: () => categoriesService.listByStore(store.id),
  });

  const { data: products = [], isLoading: prodLoading } = useQuery({
    queryKey: ['products', store.id],
    queryFn: () => productsService.listByStore(store.id),
  });

  if (catLoading || prodLoading) {
    return <LoadingSpinner label="Carregando resumo do estabelecimento..." />;
  }

  const activeProducts = products.filter((p) => p.is_active).length;
  const unavailableProducts = products.filter((p) => p.is_active && !p.is_available).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Olá, {store.name}</h1>
          <p className="text-sm text-slate-600">
            Plano <strong>{subscription.plan_name}</strong> • URL pública:{' '}
            <span className="font-mono text-xs">{buildPublicMenuUrl(store.slug)}</span>
          </p>
        </div>
        <Link to={`/m/${store.slug}`} target="_blank" rel="noreferrer">
          <Button variant="outline">
            <ExternalLink className="h-4 w-4" />
            Visualizar cardápio público
          </Button>
        </Link>
      </div>

      {/* Resumo numérico */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase">Categorias</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{categories.length}</p>
          <p className="mt-1 text-xs text-slate-500">
            {categories.filter((c) => c.is_active).length} ativas no cardápio
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase">Produtos ativos</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{activeProducts}</p>
          <p className="mt-1 text-xs text-slate-500">
            {unavailableProducts} marcados como indisponíveis
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase">Recursos contratados</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="success">QR Code</Badge>
            <Badge tone={hasNfc ? 'success' : 'neutral'}>
              {hasNfc ? 'NFC Liberado' : 'NFC (Plano superior)'}
            </Badge>
            <Badge tone={hasPromotions ? 'success' : 'neutral'}>
              {hasPromotions ? 'Promoções' : 'Promoções (Plano 3)'}
            </Badge>
          </div>
        </Card>
      </div>

      {/* Atalhos mobile-first */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/app/produtos" className="block">
          <Card className="h-full p-5 transition-shadow hover:shadow-md">
            <UtensilsCrossed className="h-6 w-6 text-zinc-900" />
            <h2 className="mt-3 text-base font-semibold text-slate-900">Gerenciar Produtos</h2>
            <p className="mt-1 text-sm text-slate-600">
              Cadastre itens, ajuste preços, altere disponibilidade rapidamente e adicione opcionais.
            </p>
          </Card>
        </Link>

        <Link to="/app/categorias" className="block">
          <Card className="h-full p-5 transition-shadow hover:shadow-md">
            <FolderKanban className="h-6 w-6 text-zinc-900" />
            <h2 className="mt-3 text-base font-semibold text-slate-900">Organizar Categorias</h2>
            <p className="mt-1 text-sm text-slate-600">
              Defina a ordem de exibição das seções do seu cardápio.
            </p>
          </Card>
        </Link>

        <Link to="/app/acesso" className="block">
          <Card className="h-full p-5 transition-shadow hover:shadow-md">
            <QrCode className="h-6 w-6 text-zinc-900" />
            <h2 className="mt-3 text-base font-semibold text-slate-900">QR Code e NFC</h2>
            <p className="mt-1 text-sm text-slate-600">
              Baixe o QR Code para suas mesas e consulte o guia de tags NFC quando contratado.
            </p>
          </Card>
        </Link>

        <Link to="/app/promocoes" className="block">
          <Card className="h-full p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <Percent className="h-6 w-6 text-zinc-900" />
              {!hasPromotions ? <Lock className="h-4 w-4 text-slate-400" /> : null}
            </div>
            <h2 className="mt-3 text-base font-semibold text-slate-900">Promoções Agendadas</h2>
            <p className="mt-1 text-sm text-slate-600">
              {hasPromotions
                ? 'Programe descontos pontuais ou semanais recorrentes com atualização automática.'
                : 'Recurso exclusivo do plano Cardápio + NFC + Promoções.'}
            </p>
          </Card>
        </Link>

        <Link to="/app/aparencia" className="block">
          <Card className="h-full p-5 transition-shadow hover:shadow-md">
            <Palette className="h-6 w-6 text-zinc-900" />
            <h2 className="mt-3 text-base font-semibold text-slate-900">Aparência e Publicação</h2>
            <p className="mt-1 text-sm text-slate-600">
              Atualize logotipo, cor principal, contato público e publicação do cardápio.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}


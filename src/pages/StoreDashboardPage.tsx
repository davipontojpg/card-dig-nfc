import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  Eye,
  FolderKanban,
  Lock,
  Palette,
  Percent,
  QrCode,
  Send,
  UtensilsCrossed,
} from 'lucide-react';
import { useStoreWorkspace } from '../app/route-guards/StoreMemberGuard';
import { categoriesService } from '../services/categories.service';
import { productsService } from '../services/products.service';
import { storesService } from '../services/stores.service';
import {
  getOnboardingStatusMeta,
  hasAnyPromotionFeature,
  hasFeature,
  isSubscriptionWritable,
} from '../lib/permissions';
import { buildPublicMenuUrl } from '../lib/env';
import { formatDateTimeInTz } from '../lib/formatters';
import { Card, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';

export function StoreDashboardPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { access, refetchAccess } = useStoreWorkspace();
  const { store, subscription, features, role } = access;
  const canEdit = isSubscriptionWritable(access);
  const isOwnerOrAdmin = role === 'owner' || role === 'platform_admin';
  const isPendingSetup = store.lifecycle_status === 'pending_setup';

  const hasPromotions = canEdit && hasAnyPromotionFeature(features);
  const hasScheduledPromotions = canEdit && hasFeature(features, 'scheduled_promotions');
  const hasNfc = canEdit && hasFeature(features, 'nfc_access');

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['categories', store.id],
    queryFn: () => categoriesService.listByStore(store.id),
  });

  const { data: products = [], isLoading: prodLoading } = useQuery({
    queryKey: ['products', store.id],
    queryFn: () => productsService.listByStore(store.id),
  });

  const submitReviewMutation = useMutation({
    mutationFn: () => storesService.submitOnboardingReview(store.id),
    onSuccess: async () => {
      await refetchAccess();
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success(
        'Enviado para revisão!',
        'O operador vai conferir seu cardápio e liberar a publicação.'
      );
    },
    onError: (err) => {
      toast.error(
        'Não foi possível enviar para revisão',
        err instanceof Error ? err.message : 'Erro desconhecido'
      );
    },
  });

  if (catLoading || prodLoading) {
    return <LoadingSpinner label="Carregando resumo do estabelecimento..." />;
  }

  const activeCategories = categories.filter((c) => c.is_active).length;
  const activeProducts = products.filter((p) => p.is_active).length;
  const unavailableProducts = products.filter((p) => p.is_active && !p.is_available).length;

  const hasLogo = Boolean(store.logo_path);
  const hasCategories = activeCategories > 0;
  const hasProducts = activeProducts > 0;
  const completedStepsCount = [hasLogo, hasCategories, hasProducts].filter(Boolean).length;
  const progressPercent = Math.round((completedStepsCount / 3) * 100);
  const onboardingMeta = getOnboardingStatusMeta(store.onboarding_status);

  const menuLink =
    isPendingSetup || !store.is_published ? `/m/${store.slug}?preview=1` : `/m/${store.slug}`;

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
        <Link to={menuLink} target="_blank" rel="noreferrer">
          <Button variant="outline" className="w-full sm:w-auto">
            {isPendingSetup || !store.is_published ? (
              <>
                <Eye className="h-4 w-4" />
                Ver prévia do cardápio
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" />
                Visualizar cardápio público
              </>
            )}
          </Button>
        </Link>
      </div>

      {/* Guia mobile-first de implantação inicial (aparece somente antes da primeira publicação) */}
      {isPendingSetup ? (
        <Card className="space-y-5 border-zinc-200 p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Configure seu cardápio</h2>
                <Badge tone={onboardingMeta.tone}>{onboardingMeta.label}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Complete os passos abaixo direto pelo celular. Após a primeira revisão e publicação,
                qualquer alteração futura entra no ar na hora, sem precisar de nova revisão.
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-700">
              {completedStepsCount} de 3 prontos ({progressPercent}%)
            </span>
          </div>

          {/* Barra de progresso */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-zinc-950 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Observações de ajuste vindas da revisão */}
          {store.onboarding_status === 'awaiting_client' && store.onboarding_review_notes ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <p className="font-semibold">Ajustes solicitados pelo operador:</p>
                  <p className="mt-1 text-sm">{store.onboarding_review_notes}</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Lista de passos grandes e fáceis de tocar no celular */}
          <div className="space-y-2.5">
            <Link
              to="/app/aparencia"
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-zinc-400 hover:bg-stone-50"
            >
              <div className="flex items-start gap-3">
                {hasLogo ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    1. Identidade visual e logotipo
                  </p>
                  <p className="text-xs text-slate-600">
                    {hasLogo
                      ? 'Logotipo enviado. Toque para ajustar cor, telefone ou descrição.'
                      : 'Envie o logotipo da galeria do celular, escolha a cor principal e adicione contato.'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </Link>

            <Link
              to="/app/categorias"
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-zinc-400 hover:bg-stone-50"
            >
              <div className="flex items-start gap-3">
                {hasCategories ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    2. Categorias do cardápio
                  </p>
                  <p className="text-xs text-slate-600">
                    {hasCategories
                      ? `${activeCategories} ${activeCategories === 1 ? 'categoria ativa' : 'categorias ativas'}.`
                      : 'Crie seções como Lanches, Bebidas, Porções ou Sobremesas.'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </Link>

            <Link
              to="/app/produtos"
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-zinc-400 hover:bg-stone-50"
            >
              <div className="flex items-start gap-3">
                {hasProducts ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    3. Produtos, fotos e preços
                  </p>
                  <p className="text-xs text-slate-600">
                    {hasProducts
                      ? `${activeProducts} ${activeProducts === 1 ? 'produto ativo cadastrado' : 'produtos ativos cadastrados'}.`
                      : 'Adicione seus itens com preço, descrição e foto pelo celular.'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </Link>
          </div>

          {/* Barra de ações finais (empilhada no mobile) */}
          <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              {store.onboarding_status === 'ready' && store.onboarding_submitted_at ? (
                <span>
                  Enviado para revisão em{' '}
                  <strong>{formatDateTimeInTz(store.onboarding_submitted_at, store.timezone)}</strong>.
                </span>
              ) : (
                <span>Confira a prévia no celular antes de enviar para revisão.</span>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link to={`/m/${store.slug}?preview=1`} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full sm:w-auto">
                  <Eye className="h-4 w-4" />
                  Ver prévia no celular
                </Button>
              </Link>

              {isOwnerOrAdmin && canEdit ? (
                <Button
                  className="w-full sm:w-auto"
                  isLoading={submitReviewMutation.isPending}
                  onClick={() => submitReviewMutation.mutate()}
                >
                  <Send className="h-4 w-4" />
                  {store.onboarding_status === 'ready'
                    ? 'Reenviar para revisão'
                    : store.onboarding_status === 'awaiting_client'
                      ? 'Enviar ajustes para revisão'
                      : 'Enviar para revisão'}
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {/* Resumo numérico */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase">Categorias</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{categories.length}</p>
          <p className="mt-1 text-xs text-slate-500">{activeCategories} ativas no cardápio</p>
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
              {hasScheduledPromotions
                ? 'Promoções Agendadas'
                : hasPromotions
                  ? 'Promoções Comuns'
                  : 'Promoções (Plano 2+)'}
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
            <h2 className="mt-3 text-base font-semibold text-slate-900">
              {hasScheduledPromotions ? 'Promoções e Agendamentos' : 'Promoções'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {hasScheduledPromotions
                ? 'Crie promoções comuns ou programe descontos pontuais e semanais recorrentes.'
                : hasPromotions
                  ? 'Crie promoções comuns ativas no cardápio. Agendamentos semanais no plano superior.'
                  : 'Disponível a partir do plano Cardápio + NFC.'}
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

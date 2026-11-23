import type { ReactNode } from 'react';
import { NavLink, Link } from 'react-router';
import {
  AlertTriangle,
  ArrowLeftRight,
  ExternalLink,
  FolderKanban,
  LayoutDashboard,
  Lock,
  LogOut,
  Palette,
  Percent,
  QrCode,
  Shield,
  UtensilsCrossed,
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { useStoreWorkspace } from '../../app/route-guards/StoreMemberGuard';
import {
  getLifecycleStatusMeta,
  getSubscriptionStatusMeta,
  hasAnyPromotionFeature,
  isSubscriptionWritable,
} from '../../lib/permissions';
import { formatDateTimeInTz } from '../../lib/formatters';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function StoreAdminLayout({ children }: { children: ReactNode }) {
  const { workspaces, selectStore, signOut } = useAuth();
  const { access } = useStoreWorkspace();
  const { store, subscription, features, has_service_access, role } = access;
  const membershipsCount = workspaces?.memberships.length ?? 0;

  const hasPromotions = hasAnyPromotionFeature(features);
  const canEdit = isSubscriptionWritable(access);
  const subMeta = getSubscriptionStatusMeta(subscription.status);
  const lifecycleMeta = getLifecycleStatusMeta(store.lifecycle_status);
  const isPendingSetup = store.lifecycle_status === 'pending_setup';
  const menuLink =
    isPendingSetup || !store.is_published ? `/m/${store.slug}?preview=1` : `/m/${store.slug}`;
  const menuLinkLabel = isPendingSetup || !store.is_published ? 'Prévia do cardápio' : 'Ver cardápio público';

  const navItems = [
    { to: '/app', label: 'Início', icon: LayoutDashboard, end: true, locked: false },
    { to: '/app/produtos', label: 'Produtos', icon: UtensilsCrossed, end: false, locked: false },
    { to: '/app/categorias', label: 'Categorias', icon: FolderKanban, end: false, locked: false },
    {
      to: '/app/promocoes',
      label: 'Promoções',
      icon: Percent,
      end: false,
      locked: !hasPromotions,
    },
    { to: '/app/aparencia', label: 'Aparência', icon: Palette, end: false, locked: false },
    { to: '/app/acesso', label: 'QR & NFC', icon: QrCode, end: false, locked: false },
    { to: '/app/conta', label: 'Plano', icon: Shield, end: false, locked: false },
  ];

  const showWarningBanner =
    !canEdit ||
    subscription.status === 'past_due' ||
    isPendingSetup;

  return (
    <div className="min-h-screen bg-stone-50 pb-20 text-zinc-950 lg:flex lg:pb-0">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-stone-200 bg-white lg:flex">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: store.primary_color }}
            >
              {store.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{store.name}</p>
              <p className="truncate text-xs text-slate-500">
                {subscription.plan_name} • {role === 'owner' ? 'Proprietário' : 'Editor'}
              </p>
            </div>
          </div>
          {membershipsCount > 1 ? (
            <button
              type="button"
              onClick={() => selectStore(null)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Trocar estabelecimento
            </button>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Navegação do estabelecimento">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-zinc-950 text-white'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-zinc-950'
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {item.locked ? <Lock className="h-3.5 w-3.5 text-slate-400" /> : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-slate-100 p-4">
          <Link
            to={menuLink}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {menuLinkLabel}
          </Link>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: store.primary_color }}
            >
              {store.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{store.name}</p>
              <p className="truncate text-[11px] text-slate-500">{subscription.plan_name}</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <Badge tone={lifecycleMeta.tone}>{lifecycleMeta.label}</Badge>
            <Badge tone={subMeta.tone}>Assinatura: {subMeta.label}</Badge>
            {store.is_published && has_service_access ? (
              <Badge tone="success">Publicado</Badge>
            ) : (
              <Badge tone="neutral">Não publicado</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {membershipsCount > 1 ? (
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => selectStore(null)}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <Link to={menuLink} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {isPendingSetup || !store.is_published ? 'Prévia' : 'Cardápio'}
                </span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => void signOut()}
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {showWarningBanner ? (
          <div
            role="status"
            className={`border-b px-4 py-3 text-sm lg:px-8 ${
              isPendingSetup && store.onboarding_status === 'ready'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  isPendingSetup && store.onboarding_status === 'ready'
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }`}
              />
              <div>
                {isPendingSetup ? (
                  store.onboarding_status === 'awaiting_client' && store.onboarding_review_notes ? (
                    <p>
                      <strong>Ajustes solicitados na revisão:</strong> {store.onboarding_review_notes}{' '}
                      <Link to="/app" className="font-semibold underline">
                        Ver passos e reenviar
                      </Link>
                      .
                    </p>
                  ) : store.onboarding_status === 'ready' ? (
                    <p>
                      <strong>Enviado para revisão inicial:</strong> o operador vai conferir seu
                      cardápio e liberar a publicação. Depois de publicado, suas alterações entram no
                      ar imediatamente.
                    </p>
                  ) : (
                    <p>
                      <strong>Modo implantação:</strong> você já pode subir seu logotipo, escolher
                      cores e cadastrar categorias e produtos. Quando terminar, clique em{' '}
                      <Link to="/app" className="font-semibold underline">
                        Enviar para revisão no Início
                      </Link>
                      .
                    </p>
                  )
                ) : subscription.status === 'past_due' && canEdit ? (
                  <p>
                    <strong>Assinatura em atraso:</strong> seu acesso permanece em período de
                    tolerância até{' '}
                    <strong>{formatDateTimeInTz(subscription.grace_until, store.timezone)}</strong>.
                    Entre em contato com o suporte comercial para regularização.
                  </p>
                ) : (
                  <p>
                    <strong>Acesso restrito ({subMeta.label}):</strong> a publicação pública e as
                    edições do cardápio estão bloqueadas no momento.{' '}
                    <Link to="/app/conta" className="underline">
                      Ver detalhes do plano
                    </Link>
                    .
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {/* Bottom Mobile Navigation */}
      <nav
        aria-label="Menu rápido mobile"
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white px-1 py-1.5 lg:hidden"
      >
        {navItems.slice(0, 6).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium ${
                  isActive ? 'text-zinc-950 font-semibold' : 'text-stone-500'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}


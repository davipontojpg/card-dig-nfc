import { useState, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router';
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { Button } from '../ui/Button';

export function PlatformLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { workspaces, signOut } = useAuth();

  const navItems = [
    { to: '/platform', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/platform/stores', label: 'Estabelecimentos', icon: Building2, end: false },
    { to: '/platform/plans', label: 'Planos comerciais', icon: CreditCard, end: true },
    ...(workspaces?.platform_role === 'super_admin'
      ? [{ to: '/platform/admins', label: 'Operadores', icon: ShieldCheck, end: true }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-stone-100 text-zinc-950 lg:flex">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-100 lg:flex">
        <div className="border-b border-zinc-800 px-5 py-5">
          <Link to="/platform" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent font-display text-base font-extrabold text-white">
              T
            </span>
            <div>
              <p className="font-display text-base font-bold tracking-tight text-white">Tápio</p>
              <p className="text-xs text-zinc-400">Console do Operador</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Navegação da plataforma">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-zinc-950'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <div className="mb-3">
            <p className="truncate text-sm font-medium text-white">
              {workspaces?.full_name || workspaces?.email || 'Operador'}
            </p>
            <p className="text-xs text-zinc-400">
              {workspaces?.platform_role === 'super_admin' ? 'Super Admin' : 'Operador'}
            </p>
          </div>
          <Button
            variant="outline-dark"
            size="sm"
            className="w-full"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3 text-white lg:hidden">
        <Link to="/platform" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-display text-sm font-extrabold text-white">
            T
          </span>
          <span className="font-display text-sm font-bold">Tápio Console</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          className="rounded-lg p-2 text-zinc-200 hover:bg-zinc-800"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileOpen ? (
        <div className="border-b border-zinc-800 bg-zinc-950 px-4 pb-4 text-zinc-100 lg:hidden">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                      isActive ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:bg-zinc-900'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-3 border-t border-zinc-800 pt-3">
            <Button
              variant="outline-dark"
              size="sm"
              className="w-full"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}


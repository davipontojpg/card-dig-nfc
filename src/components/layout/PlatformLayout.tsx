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
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 lg:flex">
        <div className="border-b border-slate-800 px-5 py-5">
          <Link to="/platform" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
              MF
            </span>
            <div>
              <p className="text-sm font-bold text-white">MenuFlow SaaS</p>
              <p className="text-xs text-slate-400">Console do Operador</p>
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
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="mb-3">
            <p className="truncate text-sm font-medium text-white">
              {workspaces?.full_name || workspaces?.email || 'Operador'}
            </p>
            <p className="text-xs text-slate-400">
              {workspaces?.platform_role === 'super_admin' ? 'Super Admin' : 'Operador'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 text-white lg:hidden">
        <Link to="/platform" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold">
            MF
          </span>
          <span className="text-sm font-bold">MenuFlow Console</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          className="rounded-lg p-2 text-slate-200 hover:bg-slate-800"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileOpen ? (
        <div className="border-b border-slate-800 bg-slate-950 px-4 pb-4 text-slate-100 lg:hidden">
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
                      isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-900'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-3 border-t border-slate-800 pt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-slate-700 bg-slate-900 text-slate-200"
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


import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { authService } from '../services/auth.service';
import { useAuth } from '../features/auth/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Badge';

export function PlatformLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, workspaces, sessionExpired, clearSessionExpired, refetchWorkspaces } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session && workspaces?.is_platform_admin) {
    const dest = (location.state as { from?: string } | null)?.from || '/platform';
    return <Navigate to={dest} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    clearSessionExpired();
    setLoading(true);
    try {
      await authService.signInWithPassword(email, password);
      await refetchWorkspaces();
      const dest = (location.state as { from?: string } | null)?.from || '/platform';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <Card className="w-full max-w-md border-stone-200 p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-950 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-950">Console do Operador</h1>
            <p className="text-xs text-stone-500">Acesso restrito à administração do SaaS</p>
          </div>
        </div>

        {sessionExpired ? (
          <div
            role="status"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
          >
            Sua sessão foi encerrada ou expirou. Entre novamente para continuar.
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input
            label="E-mail do operador"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operador@suaempresa.com.br"
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full" isLoading={loading}>
            Entrar no Console Central
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-stone-200 pt-4 text-xs text-stone-500">
          <Link to="/login" className="hover:text-zinc-950">
            Painel do estabelecimento
          </Link>
          <Link to="/" className="hover:text-zinc-950">
            Voltar ao início
          </Link>
        </div>
      </Card>
    </div>
  );
}


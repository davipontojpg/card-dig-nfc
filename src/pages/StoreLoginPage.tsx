import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Store } from 'lucide-react';
import { authService } from '../services/auth.service';
import { useAuth } from '../features/auth/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';

export function StoreLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { session, workspaces, sessionExpired, clearSessionExpired, refetchWorkspaces } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session && (workspaces?.memberships.length ?? 0) > 0) {
    const dest = (location.state as { from?: string } | null)?.from || '/app';
    return <Navigate to={dest} replace />;
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    clearSessionExpired();
    setLoading(true);
    try {
      await authService.signInWithPassword(email, password);
      await refetchWorkspaces();
      const dest = (location.state as { from?: string } | null)?.from || '/app';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível entrar. Verifique e-mail e senha.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.resetPasswordForEmail(
        email,
        `${window.location.origin}/auth/set-password`
      );
      toast.success(
        'Link de recuperação enviado',
        'Verifique sua caixa de entrada para definir uma nova senha.'
      );
      setResetMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao solicitar redefinição de senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Painel do Estabelecimento</h1>
            <p className="text-xs text-slate-500">
              Gerencie seu cardápio, preços, adicionais e promoções
            </p>
          </div>
        </div>

        {sessionExpired ? (
          <div
            role="status"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
          >
            Sua sessão expirou. Faça login novamente para continuar.
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

        {!resetMode ? (
          <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
            <Input
              label="E-mail de acesso"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="proprietario@restaurante.com.br"
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
              Entrar no meu painel
            </Button>
            <button
              type="button"
              onClick={() => {
                setResetMode(true);
                setError(null);
              }}
              className="block w-full text-center text-xs font-medium text-indigo-600 hover:underline"
            >
              Primeiro acesso ou esqueci minha senha
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleReset(e)} className="space-y-4">
            <Input
              label="E-mail cadastrado"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              hint="Enviaremos um link seguro para você cadastrar ou redefinir sua senha."
            />
            <Button type="submit" className="w-full" isLoading={loading}>
              Enviar link por e-mail
            </Button>
            <button
              type="button"
              onClick={() => {
                setResetMode(false);
                setError(null);
              }}
              className="block w-full text-center text-xs font-medium text-slate-600 hover:underline"
            >
              Voltar para o login
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
          <Link to="/platform/login" className="hover:text-indigo-600">
            Acesso do operador SaaS
          </Link>
          <Link to="/" className="hover:text-indigo-600">
            Início
          </Link>
        </div>
      </Card>
    </div>
  );
}


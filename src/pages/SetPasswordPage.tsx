import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { KeyRound } from 'lucide-react';
import { authService } from '../services/auth.service';
import { useAuth } from '../features/auth/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';

export function SetPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { session, workspaces, refetchWorkspaces } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas informadas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await authService.updatePassword(password);
      await refetchWorkspaces();
      toast.success('Senha definida com sucesso!');
      if (workspaces?.is_platform_admin) {
        navigate('/platform', { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível definir a senha. O link de convite pode ter expirado.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-950 text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-950">
              Definir senha de acesso
            </h1>
            <p className="text-xs text-stone-500">
              Conclua seu cadastro para acessar seu estabelecimento
            </p>
          </div>
        </div>

        {!session ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Abra esta página através do link enviado em seu e-mail de convite ou solicite uma
              nova recuperação de senha.
            </p>
            <Link to="/login">
              <Button className="w-full">Ir para o login</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
              >
                {error}
              </div>
            ) : null}
            <Input
              label="Nova senha"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Mínimo de 8 caracteres."
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button type="submit" className="w-full" isLoading={loading}>
              Salvar senha e continuar
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}


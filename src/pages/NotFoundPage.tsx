import { Link } from 'react-router';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-sm font-semibold text-indigo-600">Erro 404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Página não encontrada</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        O endereço acessado não existe ou foi movido. Verifique o link do cardápio ou retorne ao
        início.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/">
          <Button>Voltar ao início</Button>
        </Link>
        <Link to="/login">
          <Button variant="outline">Entrar no painel</Button>
        </Link>
      </div>
    </div>
  );
}


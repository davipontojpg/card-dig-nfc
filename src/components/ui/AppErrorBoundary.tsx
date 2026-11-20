import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Settings } from 'lucide-react';
import { Button } from './Button';

export function EnvConfigErrorScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-amber-300 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Configuração de ambiente pendente
            </h1>
            <p className="mt-1 text-sm text-slate-600">{message}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            Preencha no arquivo <code className="rounded bg-slate-200 px-1.5 py-0.5">.env.local</code>:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed">
            <li>
              <code>VITE_SUPABASE_URL</code>: URL do projeto no Supabase (<em>Project Settings → Data API</em>).
            </li>
            <li>
              <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>: chave pública (<code>sb_publishable_...</code> ou chave pública <code>anon</code> em <em>Project Settings → API Keys</em>). Nunca use <code>service_role</code> nem <code>sb_secret_</code>.
            </li>
            <li>
              <code>VITE_PUBLIC_APP_URL</code>: URL pública da aplicação (ex.: <code>http://localhost:5173</code>).
            </li>
          </ul>
          <p className="mt-3 text-xs text-slate-600">
            Após salvar o arquivo <code>.env.local</code>, pare (<code>Ctrl + C</code>) e reinicie{' '}
            <code>npm run dev</code> no terminal e recarregue esta página.
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" />
            Recarregar página
          </Button>
        </div>
      </div>
    </main>
  );
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro inesperado ao renderizar a aplicação.',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Erro capturado pelo AppErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
          <div
            role="alert"
            className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm sm:p-8"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">
              Não foi possível exibir esta tela
            </h1>
            <p className="mt-2 text-sm text-slate-600">{this.state.errorMessage}</p>
            <div className="mt-5">
              <Button onClick={() => window.location.reload()}>
                <RotateCcw className="h-4 w-4" />
                Recarregar aplicação
              </Button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}


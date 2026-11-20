import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import { AppErrorBoundary, EnvConfigErrorScreen } from './components/ui/AppErrorBoundary';
import { envValidation } from './lib/env';

export default function App() {
  if (!envValidation.ok) {
    return <EnvConfigErrorScreen message={envValidation.error} />;
  }

  return (
    <AppErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </AppErrorBoundary>
  );
}

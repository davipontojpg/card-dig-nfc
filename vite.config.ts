import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function validateEnvOnBuild(): Plugin {
  return {
    name: 'validate-env-on-build',
    configResolved(config) {
      if (config.command !== 'build') return;

      const fileEnv = loadEnv(config.mode, process.cwd(), 'VITE_');
      const mergedEnv: Record<string, string | undefined> = { ...fileEnv };

      for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith('VITE_') && value !== undefined) {
          mergedEnv[key] = value;
        }
      }

      // Bloquear qualquer exposição acidental de segredos ou service_role no frontend
      for (const [key, value] of Object.entries(mergedEnv)) {
        const upperKey = key.toUpperCase();
        const trimmedVal = (value ?? '').trim();
        if (upperKey.includes('SERVICE_ROLE') || upperKey.includes('SECRET')) {
          throw new Error(
            `[Segurança] A variável "${key}" não pode ser exposta com prefixo VITE_ no frontend.`
          );
        }
        if (trimmedVal.startsWith('sb_secret_')) {
          throw new Error(
            `[Segurança] A variável "${key}" contém uma chave secreta (sb_secret_). Use apenas a chave pública (VITE_SUPABASE_PUBLISHABLE_KEY).`
          );
        }
      }

      const errors: string[] = [];
      const supabaseUrl = mergedEnv.VITE_SUPABASE_URL?.trim() ?? '';
      const publishableKey =
        mergedEnv.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
        mergedEnv.VITE_SUPABASE_ANON_KEY?.trim() ||
        '';
      const publicAppUrl = mergedEnv.VITE_PUBLIC_APP_URL?.trim() ?? '';

      if (!supabaseUrl) {
        errors.push('VITE_SUPABASE_URL é obrigatória.');
      } else {
        try {
          new URL(supabaseUrl);
        } catch {
          errors.push('VITE_SUPABASE_URL deve ser uma URL válida.');
        }
      }

      if (!publishableKey) {
        errors.push(
          'VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) é obrigatória.'
        );
      }

      if (!publicAppUrl) {
        errors.push('VITE_PUBLIC_APP_URL é obrigatória.');
      } else {
        try {
          new URL(publicAppUrl);
        } catch {
          errors.push('VITE_PUBLIC_APP_URL deve ser uma URL válida.');
        }
      }

      if (errors.length > 0) {
        throw new Error(
          `[Build bloqueado] Variáveis de ambiente públicas inválidas ou ausentes:\n- ${errors.join(
            '\n- '
          )}\nConsulte .env.example e docs/DEPLOYMENT.md.`
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), validateEnvOnBuild()],
});


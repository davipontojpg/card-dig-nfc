import { z } from 'zod';

const envSchema = z.object({
  supabaseUrl: z.string().url('VITE_SUPABASE_URL deve ser uma URL válida.'),
  supabasePublicKey: z
    .string()
    .min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) é obrigatória.'),
  publicAppUrl: z.string().url('VITE_PUBLIC_APP_URL deve ser uma URL válida.'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export type EnvValidationResult =
  | { ok: true; data: EnvConfig }
  | { ok: false; error: string };

function readPublicEnv(): { validation: EnvValidationResult; config: EnvConfig } {
  const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
  const rawPublishable =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
    '';
  const rawAppUrl =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim() ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

  const safeAppUrl = rawAppUrl.replace(/\/+$/, '') || 'http://localhost:5173';
  const fallbackConfig: EnvConfig = {
    supabaseUrl: 'https://unconfigured.supabase.invalid',
    supabasePublicKey: 'unconfigured',
    publicAppUrl: safeAppUrl,
  };

  if (rawPublishable.startsWith('sb_secret_')) {
    return {
      validation: {
        ok: false,
        error:
          'Configuração inválida: nunca utilize uma chave secreta (sb_secret_) no frontend.',
      },
      config: fallbackConfig,
    };
  }

  const parsed = envSchema.safeParse({
    supabaseUrl: rawUrl,
    supabasePublicKey: rawPublishable,
    publicAppUrl: safeAppUrl,
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => i.message).join(' ');
    return {
      validation: {
        ok: false,
        error: `Variáveis de ambiente públicas ausentes ou inválidas: ${details}`,
      },
      config: fallbackConfig,
    };
  }

  return {
    validation: { ok: true, data: parsed.data },
    config: parsed.data,
  };
}

const evaluated = readPublicEnv();

export const envValidation: EnvValidationResult = evaluated.validation;
export const env: EnvConfig = evaluated.config;

export function isLocalOrPreviewUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.pages.dev') ||
      host.endsWith('.vercel.app') ||
      host.endsWith('.netlify.app')
    );
  } catch {
    return true;
  }
}

export function buildPublicMenuUrl(slug: string): string {
  return `${env.publicAppUrl}/m/${slug}`;
}

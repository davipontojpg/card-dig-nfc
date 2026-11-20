import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface VerifiedOperatorContext {
  operatorUserId: string;
  operatorRole: 'super_admin' | 'operator';
  adminClient: SupabaseClient;
}

function resolveAdminSecretKey(): string {
  const customSecret = Deno.env.get('SERVICE_SECRET_KEY')?.trim();
  if (customSecret) return customSecret;

  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')?.trim();
  if (secretKeysRaw) {
    if (secretKeysRaw.startsWith('{')) {
      try {
        const parsed = JSON.parse(secretKeysRaw) as Record<string, unknown>;
        if (typeof parsed.default === 'string' && parsed.default.trim()) {
          return parsed.default.trim();
        }
        const firstValue = Object.values(parsed).find(
          (val): val is string => typeof val === 'string' && val.trim().length > 0
        );
        if (firstValue) return firstValue.trim();
      } catch {
        // Ignorar JSON malformado e tentar fallbacks
      }
    } else {
      return secretKeysRaw;
    }
  }

  const singleSecret = Deno.env.get('SUPABASE_SECRET_KEY')?.trim();
  if (singleSecret) return singleSecret;

  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
}

export async function requireActivePlatformAdmin(req: Request): Promise<
  | { ok: true; context: VerifiedOperatorContext }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    return { ok: false, status: 401, error: 'Cabeçalho Authorization ausente ou inválido.' };
  }

  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return { ok: false, status: 401, error: 'Token JWT de autenticação ausente.' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const adminKey = resolveAdminSecretKey();

  if (!supabaseUrl || !adminKey) {
    return {
      ok: false,
      status: 500,
      error:
        'Configuração de ambiente da Edge Function incompleta no servidor (chave secreta ausente).',
    };
  }

  const adminClient = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Valida assinatura e vigência do token (compatível com ES256 e chaves legadas)
  const {
    data: { user },
    error: authError,
  } = await adminClient.auth.getUser(jwt);

  if (authError || !user) {
    return {
      ok: false,
      status: 401,
      error: `Sessão inválida ou expirada (${authError?.message ?? 'token ausente'}). Faça login novamente.`,
    };
  }

  const { data: adminRow, error: adminError } = await adminClient
    .from('platform_admins')
    .select('user_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (adminError) {
    const isLegacyDisabled = /legacy api keys are disabled/i.test(adminError.message);
    const hint = isLegacyDisabled
      ? ' Configure a secret SERVICE_SECRET_KEY com a chave sb_secret_ do projeto via Supabase CLI.'
      : '';
    return {
      ok: false,
      status: 500,
      error: `Erro ao validar operador no servidor (${adminError.code ?? 'db'}): ${adminError.message}.${hint}`,
    };
  }

  if (!adminRow) {
    return {
      ok: false,
      status: 403,
      error: `Acesso negado: sua conta logada (${user.email ?? user.id}) não está cadastrada como operadora ativa em platform_admins.`,
    };
  }

  return {
    ok: true,
    context: {
      operatorUserId: user.id,
      operatorRole: adminRow.role as 'super_admin' | 'operator',
      adminClient,
    },
  };
}

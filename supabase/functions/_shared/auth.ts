import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface VerifiedOperatorContext {
  operatorUserId: string;
  operatorRole: 'super_admin' | 'operator';
  adminClient: SupabaseClient;
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
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      status: 500,
      error: 'Configuração de ambiente da Edge Function incompleta no servidor.',
    };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Valida assinatura e vigência do token (compatível com ES256 e chaves legadas)
  const {
    data: { user },
    error: authError,
  } = await adminClient.auth.getUser(jwt);

  if (authError || !user) {
    return { ok: false, status: 401, error: 'Sessão inválida ou expirada. Faça login novamente.' };
  }

  const { data: adminRow, error: adminError } = await adminClient
    .from('platform_admins')
    .select('user_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (adminError || !adminRow) {
    return {
      ok: false,
      status: 403,
      error: 'Acesso negado: usuário não é operador ativo da plataforma.',
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

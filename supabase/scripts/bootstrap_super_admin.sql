-- ============================================================================
-- Provisionamento Manual e Seguro do Primeiro Super Admin
--
-- Pré-requisito:
-- 1. Crie o usuário operador no Supabase Dashboard -> Authentication -> Users
--    (ou via convite administrativo) com e-mail verificado e senha forte.
-- 2. Substitua 'operador@seudominio.com.br' abaixo pelo e-mail exato criado.
-- 3. Execute este script no SQL Editor do Supabase (como postgres/service_role).
-- ============================================================================

do $$
declare
  v_email text := 'operador@seudominio.com.br';
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    raise exception 'Usuário Auth não encontrado para o e-mail %. Crie-o primeiro no Supabase Auth.', v_email;
  end if;

  insert into public.profiles (id, email, full_name)
  values (v_user_id, lower(v_email), 'Super Admin Inicial')
  on conflict (id) do update
    set email = excluded.email;

  insert into public.platform_admins (user_id, role, is_active)
  values (v_user_id, 'super_admin', true)
  on conflict (user_id) do update
    set role = 'super_admin',
        is_active = true;

  raise notice 'Super admin provisionado com sucesso para user_id=%', v_user_id;
end $$;


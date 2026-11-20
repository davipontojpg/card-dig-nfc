-- ============================================================================
-- Suíte Completa de Testes de Banco, Planos, RLS, Promoções e Storage (PG 16)
-- ============================================================================

begin;

create or replace function pg_temp.assert_true(p_cond boolean, p_msg text)
returns void
language plpgsql
as $$
begin
  if coalesce(p_cond, false) is not true then
    raise exception 'ASSERTION FAILED: %', p_msg;
  end if;
end;
$$;

create or replace function pg_temp.set_actor(p_role text, p_user_id uuid default null)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user_id::text, ''), true);
  perform set_config('request.jwt.claim.role', p_role, true);
  execute format('set local role %I', p_role);
end;
$$;

-- ============================================================================
-- 1. Validar Seed dos 3 Planos Exatos & Matriz de Recursos
-- ============================================================================
do $$
declare
  v_count integer;
  v_m1 numeric(10,2);
  v_s1 numeric(10,2);
  v_m2 numeric(10,2);
  v_s2 numeric(10,2);
  v_m3 numeric(10,2);
  v_s3 numeric(10,2);
begin
  select count(*) into v_count from public.plans;
  perform pg_temp.assert_true(v_count = 3, 'Devem existir exatamente 3 planos no catálogo.');

  select monthly_price, setup_fee into v_m1, v_s1 from public.plans where code = 'menu';
  select monthly_price, setup_fee into v_m2, v_s2 from public.plans where code = 'menu_nfc';
  select monthly_price, setup_fee into v_m3, v_s3 from public.plans where code = 'menu_nfc_promotions';

  perform pg_temp.assert_true(v_m1 = 19.90 and v_s1 = 100.00, 'Plano menu deve ser R$ 19,90 e R$ 100,00.');
  perform pg_temp.assert_true(v_m2 = 49.90 and v_s2 = 150.00, 'Plano menu_nfc deve ser R$ 49,90 e R$ 150,00.');
  perform pg_temp.assert_true(v_m3 = 59.90 and v_s3 = 100.00, 'Plano menu_nfc_promotions deve ser R$ 59,90 e R$ 100,00.');

  perform pg_temp.assert_true(
    (select array_agg(feature_key order by feature_key) from public.plan_features pf join public.plans p on p.id = pf.plan_id where p.code = 'menu')
    = array['digital_menu', 'qr_code'],
    'Plano menu deve conter exatamente digital_menu e qr_code.'
  );
  perform pg_temp.assert_true(
    (select array_agg(feature_key order by feature_key) from public.plan_features pf join public.plans p on p.id = pf.plan_id where p.code = 'menu_nfc')
    = array['basic_promotions', 'digital_menu', 'nfc_access', 'qr_code'],
    'Plano menu_nfc deve conter digital_menu, qr_code, nfc_access e basic_promotions.'
  );
  perform pg_temp.assert_true(
    (select array_agg(feature_key order by feature_key) from public.plan_features pf join public.plans p on p.id = pf.plan_id where p.code = 'menu_nfc_promotions')
    = array['basic_promotions', 'digital_menu', 'nfc_access', 'qr_code', 'scheduled_promotions'],
    'Plano menu_nfc_promotions deve conter os 5 recursos.'
  );
end $$;

-- ============================================================================
-- 2. Fixture de Identidades & Estabelecimentos (Planos 1, 2 e 3)
-- ============================================================================
do $$
declare
  v_super_id uuid := '11111111-1111-1111-1111-111111111111';
  v_oper_id uuid := '22222222-2222-2222-2222-222222222222';
  v_inactive_admin_id uuid := '33333333-3333-3333-3333-333333333333';
  v_owner_a uuid := '44444444-4444-4444-4444-444444444444';
  v_editor_a uuid := '55555555-5555-5555-5555-555555555555';
  v_owner_b uuid := '66666666-6666-6666-6666-666666666666';
  v_owner_c uuid := '77777777-7777-7777-7777-777777777777';

  v_plan_1 uuid;
  v_plan_2 uuid;
  v_plan_3 uuid;

  v_store_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_store_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_store_c uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  v_cat_a uuid := 'a1111111-1111-1111-1111-111111111111';
  v_cat_b uuid := 'b1111111-1111-1111-1111-111111111111';
  v_cat_c uuid := 'c1111111-1111-1111-1111-111111111111';

  v_prod_a uuid := 'a2222222-2222-2222-2222-222222222222';
  v_prod_c1 uuid := 'c2222222-2222-2222-2222-222222222222';
  v_prod_c2 uuid := 'c3333333-3333-3333-3333-333333333333';
  v_prod_c_unavail uuid := 'c4444444-4444-4444-4444-444444444444';

  v_grp_c uuid := 'c5555555-5555-5555-5555-555555555555';
  v_promo_once uuid := 'd1111111-1111-1111-1111-111111111111';
  v_promo_weekly uuid := 'd2222222-2222-2222-2222-222222222222';
  v_promo_high uuid := 'd3333333-3333-3333-3333-333333333333';

  v_res jsonb;
  v_failed boolean;
  v_cnt integer;
  v_snap numeric(10,2);
begin
  -- Inserir usuários Auth (trigger handle_auth_user_sync cria profiles)
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_super_id, 'super@saas.test', '{"full_name":"Super Admin"}'),
    (v_oper_id, 'operador@saas.test', '{"full_name":"Operador SaaS"}'),
    (v_inactive_admin_id, 'inativo@saas.test', '{"full_name":"Admin Inativo"}'),
    (v_owner_a, 'owner_a@loja.test', '{"full_name":"Dono Loja A"}'),
    (v_editor_a, 'editor_a@loja.test', '{"full_name":"Editor Loja A"}'),
    (v_owner_b, 'owner_b@loja.test', '{"full_name":"Dono Loja B"}'),
    (v_owner_c, 'owner_c@loja.test', '{"full_name":"Dono Loja C"}');

  insert into public.platform_admins (user_id, role, is_active) values
    (v_super_id, 'super_admin', true),
    (v_oper_id, 'operator', true),
    (v_inactive_admin_id, 'operator', false);

  select id into v_plan_1 from public.plans where code = 'menu';
  select id into v_plan_2 from public.plans where code = 'menu_nfc';
  select id into v_plan_3 from public.plans where code = 'menu_nfc_promotions';

  -- Criar 3 lojas como operador ativo
  perform pg_temp.set_actor('authenticated', v_oper_id);

  insert into public.stores (id, name, slug, primary_color, timezone, is_published, lifecycle_status, onboarding_status) values
    (v_store_a, 'Adega Alfa', 'adega-alfa', '#0f766e', 'America/Sao_Paulo', true, 'active', 'completed'),
    (v_store_b, 'Cafeteria Beta', 'cafeteria-beta', '#b45309', 'America/Sao_Paulo', true, 'active', 'completed'),
    (v_store_c, 'Bistrô Gama', 'bistro-gama', '#4338ca', 'America/Sao_Paulo', true, 'active', 'completed');

  insert into public.store_internal_records (store_id, contact_name, contact_email, internal_notes, owner_invite_status) values
    (v_store_a, 'João Alfa', 'owner_a@loja.test', 'SEGREDO INTERNO A', 'accepted'),
    (v_store_b, 'Maria Beta', 'owner_b@loja.test', 'SEGREDO INTERNO B', 'accepted'),
    (v_store_c, 'Carlos Gama', 'owner_c@loja.test', 'SEGREDO INTERNO C', 'accepted');

  insert into public.store_subscriptions (store_id, plan_id, status, monthly_price_snapshot, setup_fee_snapshot, setup_fee_status, started_at) values
    (v_store_a, v_plan_1, 'active', 19.90, 100.00, 'paid', now()),
    (v_store_b, v_plan_2, 'active', 49.90, 150.00, 'paid', now()),
    (v_store_c, v_plan_3, 'active', 59.90, 100.00, 'paid', now());

  insert into public.store_memberships (store_id, user_id, role) values
    (v_store_a, v_owner_a, 'owner'),
    (v_store_a, v_editor_a, 'editor'),
    (v_store_b, v_owner_b, 'owner'),
    (v_store_c, v_owner_c, 'owner');

  -- ============================================================================
  -- 3. Testes de Permissões da Plataforma (super_admin vs operator vs inativo)
  -- ============================================================================
  perform pg_temp.set_actor('authenticated', v_inactive_admin_id);
  select count(*) into v_cnt from public.store_internal_records;
  perform pg_temp.assert_true(v_cnt = 0, 'Operador inativo não pode ler store_internal_records.');

  v_failed := false;
  begin
    perform public.platform_dashboard_metrics();
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Operador inativo não pode chamar platform_dashboard_metrics.');

  -- Operador comum não pode promover admin ou editar planos
  perform pg_temp.set_actor('authenticated', v_oper_id);
  v_failed := false;
  begin
    perform public.platform_manage_admin(v_owner_a, 'operator', true);
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Operador comum não pode gerenciar outros operadores.');

  -- Super admin não pode desativar o último super_admin ativo
  perform pg_temp.set_actor('authenticated', v_super_id);
  v_failed := false;
  begin
    perform public.platform_manage_admin(v_super_id, 'operator', false);
  exception when others then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Não é permitido remover o último super_admin ativo.');

  -- Alteração de preço de catálogo não altera snapshots de assinaturas existentes
  update public.plans set monthly_price = 99.90 where id = v_plan_1;
  select monthly_price_snapshot into v_snap from public.store_subscriptions where store_id = v_store_a;
  perform pg_temp.assert_true(v_snap = 19.90, 'Alterar catálogo de plano não deve mudar snapshot de cliente existente.');
  update public.plans set monthly_price = 19.90 where id = v_plan_1;

  -- ============================================================================
  -- 4. Isolamento Multi-Tenant, Roles e Bloqueio de Recursos por Plano (RLS)
  -- ============================================================================
  perform pg_temp.set_actor('authenticated', v_owner_a);

  -- Owner A cria categoria e produto na loja A
  insert into public.categories (id, store_id, name, sort_order) values (v_cat_a, v_store_a, 'Vinhos', 1);
  insert into public.products (id, store_id, category_id, name, price) values (v_prod_a, v_store_a, v_cat_a, 'Vinho Tinto', 80.00);

  -- Owner A não pode ler Store B nem Store Internal Records
  select count(*) into v_cnt from public.stores where id = v_store_b;
  perform pg_temp.assert_true(v_cnt = 0, 'Owner A não pode ler Store B.');
  select count(*) into v_cnt from public.store_internal_records;
  perform pg_temp.assert_true(v_cnt = 0, 'Owner A não pode ler store_internal_records.');

  -- Owner A não pode se autoatribuir membership na Store B
  v_failed := false;
  begin
    insert into public.store_memberships (store_id, user_id, role) values (v_store_b, v_owner_a, 'owner');
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Usuário não pode criar membership para si próprio.');

  -- Owner A não pode alterar lifecycle_status ou onboarding_status
  v_failed := false;
  begin
    update public.stores set lifecycle_status = 'suspended' where id = v_store_a;
  exception when others then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Owner não pode alterar lifecycle_status.');

  -- Owner A (Plano 1) NÃO pode criar promoção nem chamar get_promotion_conflicts
  v_failed := false;
  begin
    insert into public.promotions (store_id, name, schedule_type, discount_type, discount_value, starts_at, ends_at)
    values (v_store_a, 'Hack Promo', 'once', 'percent_off', 10, now(), now() + interval '1 day');
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Plano 1 não pode inserir promoção via RLS.');

  v_failed := false;
  begin
    perform public.get_promotion_conflicts(v_store_a);
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Plano 1 não pode chamar get_promotion_conflicts.');

  -- Editor A não lê store_subscriptions nem altera stores
  perform pg_temp.set_actor('authenticated', v_editor_a);
  select count(*) into v_cnt from public.store_subscriptions;
  perform pg_temp.assert_true(v_cnt = 0, 'Editor não pode ler store_subscriptions.');
  update public.stores set name = 'Hack Nome' where id = v_store_a;
  get diagnostics v_cnt = row_count;
  perform pg_temp.assert_true(v_cnt = 0, 'Editor não pode atualizar stores.');

  -- Owner B (Plano 2 - possui basic_promotions, mas NÃO scheduled_promotions)
  perform pg_temp.set_actor('authenticated', v_owner_b);
  insert into public.categories (id, store_id, name, sort_order) values (v_cat_b, v_store_b, 'Cafés', 1);

  -- Plano 2 PODE criar promoção comum ('always')
  insert into public.promotions (store_id, name, schedule_type, discount_type, discount_value, is_active)
  values (v_store_b, 'Promoção Comum Plano 2', 'always', 'percent_off', 10, true);

  -- Plano 2 NÃO pode criar promoção agendada ('once' ou 'weekly')
  v_failed := false;
  begin
    insert into public.promotions (store_id, name, schedule_type, discount_type, discount_value, starts_at, ends_at)
    values (v_store_b, 'Hack Plano 2 Once', 'once', 'percent_off', 10, now(), now() + interval '1 day');
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Plano 2 não pode inserir promoção agendada pontual via RLS.');

  v_failed := false;
  begin
    insert into public.promotions (store_id, name, schedule_type, discount_type, discount_value, weekdays, start_time, end_time)
    values (v_store_b, 'Hack Plano 2 Weekly', 'weekly', 'percent_off', 10, array[1]::smallint[], '18:00:00', '22:00:00');
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Plano 2 não pode inserir promoção agendada semanal via RLS.');

  -- FK composta impede produto da loja B apontar para categoria da loja A
  v_failed := false;
  begin
    insert into public.products (store_id, category_id, name, price)
    values (v_store_b, v_cat_a, 'Produto Cruzado', 25.00);
  exception when foreign_key_violation then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'FK composta deve impedir produto apontar para categoria de outro tenant.');

  -- ============================================================================
  -- 5. Promoções (Plano 3), Timezone America/Sao_Paulo, Conflitos e Cálculo
  -- ============================================================================
  perform pg_temp.set_actor('authenticated', v_owner_c);

  insert into public.categories (id, store_id, name, sort_order) values (v_cat_c, v_store_c, 'Pratos', 1);
  insert into public.products (id, store_id, category_id, name, price, is_active, is_available, is_featured, sort_order) values
    (v_prod_c1, v_store_c, v_cat_c, 'Combo Cerveja', 50.00, true, true, true, 1),
    (v_prod_c2, v_store_c, v_cat_c, 'Hambúrguer Casa', 40.00, true, true, false, 2),
    (v_prod_c_unavail, v_store_c, v_cat_c, 'Prato Esgotado', 60.00, true, false, false, 3);

  insert into public.option_groups (id, store_id, product_id, name, is_required, min_selection, max_selection)
  values (v_grp_c, v_store_c, v_prod_c1, 'Escolha o acompanhamento', false, 0, 2);
  insert into public.product_options (store_id, option_group_id, name, extra_price)
  values (v_store_c, v_grp_c, 'Amendoim', 5.00);

  -- Promoção pontual: 2026-11-20 18:00 BRT (-03) até 2026-11-20 20:00 BRT (-03)
  insert into public.promotions (
    id, store_id, name, schedule_type, discount_type, discount_value,
    starts_at, ends_at, priority, is_active
  ) values (
    v_promo_once, v_store_c, 'Happy Hour Pontual', 'once', 'amount_off', 10.00,
    '2026-11-20 18:00:00-03'::timestamptz,
    '2026-11-20 20:00:00-03'::timestamptz,
    5, true
  );
  insert into public.promotion_products (store_id, promotion_id, product_id)
  values
    (v_store_c, v_promo_once, v_prod_c1),
    (v_store_c, v_promo_once, v_prod_c_unavail);

  -- Promoção semanal: toda segunda-feira (1) das 18:00 às 22:00 BRT, com valid_from/until
  insert into public.promotions (
    id, store_id, name, schedule_type, discount_type, discount_value,
    weekdays, start_time, end_time, valid_from, valid_until, priority, is_active
  ) values (
    v_promo_weekly, v_store_c, 'Segunda 10% OFF', 'weekly', 'percent_off', 10.00,
    array[1]::smallint[], '18:00:00', '22:00:00', '2026-11-01', '2026-11-30', 10, true
  );
  insert into public.promotion_products (store_id, promotion_id, product_id, discount_type_override, discount_value_override)
  values
    (v_store_c, v_promo_weekly, v_prod_c1, null, null),
    (v_store_c, v_promo_weekly, v_prod_c2, 'fixed_price', 31.90);

  -- Promoção de maior prioridade sobre o mesmo produto (conflito determinístico)
  insert into public.promotions (
    id, store_id, name, schedule_type, discount_type, discount_value,
    weekdays, start_time, end_time, priority, is_active
  ) values (
    v_promo_high, v_store_c, 'Segunda VIP', 'weekly', 'fixed_price', 35.00,
    array[1]::smallint[], '18:00:00', '22:00:00', 50, true
  );
  insert into public.promotion_products (store_id, promotion_id, product_id)
  values (v_store_c, v_promo_high, v_prod_c1);

  -- Validar erro ao tentar criar desconto >= preço-base
  v_failed := false;
  begin
    insert into public.promotion_products (store_id, promotion_id, product_id, discount_type_override, discount_value_override)
    values (v_store_c, v_promo_high, v_prod_c2, 'fixed_price', 40.00);
  exception when others then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Preço promocional igual ou maior ao base deve ser rejeitado.');

  -- ============================================================================
  -- 6. Testes Públicos (anon) e Janelas Temporais Exatas (sem mutar relógio)
  -- ============================================================================
  perform pg_temp.set_actor('anon', null);

  -- Anon não lê tabelas diretamente
  v_failed := false;
  begin
    perform count(*) from public.stores;
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Anon não deve ter acesso direto à tabela stores.');

  -- Testar RPC pública em instantes controlados via role postgres/admin para get_public_menu_at
  reset role;

  -- Antes da promoção pontual (17:59:59 BRT) -> sem promoção
  v_res := public.get_public_menu_at('bistro-gama', '2026-11-20 17:59:59-03'::timestamptz);
  perform pg_temp.assert_true((v_res ->> 'status') = 'ok', 'Cardápio público deve retornar ok.');
  perform pg_temp.assert_true(jsonb_array_length(v_res -> 'active_promotions') = 0, 'Antes do início não deve haver promoção vigente.');

  -- Durante a promoção pontual (18:00:00 BRT - início inclusivo)
  v_res := public.get_public_menu_at('bistro-gama', '2026-11-20 18:00:00-03'::timestamptz);
  perform pg_temp.assert_true(jsonb_array_length(v_res -> 'active_promotions') = 1, 'No início exato a promoção pontual deve vigorar.');
  -- Produto indisponível não recebe promoção mesmo vinculado!
  perform pg_temp.assert_true(
    (v_res -> 'categories' -> 0 -> 'products' -> 2 -> 'promotion') = 'null'::jsonb,
    'Produto indisponível não pode receber promoção pública.'
  );

  -- Exatamente no fim da promoção pontual (20:00:00 BRT - fim exclusivo)
  v_res := public.get_public_menu_at('bistro-gama', '2026-11-20 20:00:00-03'::timestamptz);
  perform pg_temp.assert_true(jsonb_array_length(v_res -> 'active_promotions') = 0, 'No horário exato de fim a promoção deve encerrar.');

  -- Teste crítico de Fuso Horário: Segunda-feira 21:30 BRT = Terça-feira 00:30 UTC!
  -- Deve continuar vigente na segunda-feira em America/Sao_Paulo e resolver conflito para Segunda VIP (priority 50)!
  v_res := public.get_public_menu_at('bistro-gama', '2026-11-24 00:30:00+00'::timestamptz);
  perform pg_temp.assert_true(
    (v_res -> 'categories' -> 0 -> 'products' -> 0 -> 'promotion' ->> 'name') = 'Segunda VIP',
    'Na segunda 21:30 BRT (00:30 UTC terça) a promoção semanal de segunda deve vigorar e vencer por priority=50.'
  );
  perform pg_temp.assert_true(
    ((v_res -> 'categories' -> 0 -> 'products' -> 0 -> 'promotion' ->> 'promotional_price')::numeric) = 35.00,
    'Preço promocional de Segunda VIP deve ser R$ 35,00.'
  );
  perform pg_temp.assert_true(
    ((v_res -> 'categories' -> 0 -> 'products' -> 1 -> 'promotion' ->> 'promotional_price')::numeric) = 31.90,
    'Override fixed_price em Hambúrguer Casa deve ser R$ 31,90.'
  );

  -- Exatamente às 22:00:00 BRT (01:00 UTC) -> promoção semanal encerra
  v_res := public.get_public_menu_at('bistro-gama', '2026-11-24 01:00:00+00'::timestamptz);
  perform pg_temp.assert_true(jsonb_array_length(v_res -> 'active_promotions') = 0, 'Às 22:00 BRT exatas promoção semanal deve encerrar.');

  -- Pausar promoção semanal e validar remoção imediata
  update public.promotions set is_active = false where id = v_promo_high;
  v_res := public.get_public_menu_at('bistro-gama', '2026-11-24 00:30:00+00'::timestamptz);
  perform pg_temp.assert_true(
    (v_res -> 'categories' -> 0 -> 'products' -> 0 -> 'promotion' ->> 'name') = 'Segunda 10% OFF',
    'Ao pausar Segunda VIP, deve assumir Segunda 10% OFF (R$ 45,00).'
  );
  perform pg_temp.assert_true(
    ((v_res -> 'categories' -> 0 -> 'products' -> 0 -> 'promotion' ->> 'promotional_price')::numeric) = 45.00,
    '10% de desconto sobre R$ 50,00 deve resultar em R$ 45,00.'
  );

  -- Garantir ausência de campos internos no payload público
  perform pg_temp.assert_true((v_res -> 'store' ? 'internal_notes') = false, 'Payload público não pode expor internal_notes.');
  perform pg_temp.assert_true((v_res -> 'store' ? 'contact_email') = false, 'Payload público não pode expor contact_email.');

  -- ============================================================================
  -- 7. Período de Tolerância (grace_until) e Suspensão
  -- ============================================================================
  update public.store_subscriptions
  set status = 'past_due',
      grace_until = '2026-11-25 12:00:00-03'::timestamptz
  where store_id = v_store_c;

  perform pg_temp.assert_true(
    public.store_has_service_access(v_store_c, '2026-11-25 11:59:59-03'::timestamptz) = true,
    'past_due dentro de grace_until deve manter acesso.'
  );
  perform pg_temp.assert_true(
    public.store_has_service_access(v_store_c, '2026-11-25 12:00:01-03'::timestamptz) = false,
    'past_due após grace_until deve bloquear acesso.'
  );

  -- Testar RPC oficial get_public_menu como anon para loja suspensa
  update public.store_subscriptions set status = 'suspended' where store_id = v_store_c;
  perform pg_temp.set_actor('anon', null);
  v_res := public.get_public_menu('bistro-gama');
  perform pg_temp.assert_true((v_res ->> 'status') = 'unavailable', 'Loja suspensa deve retornar status unavailable.');

  -- ============================================================================
  -- 8. Storage RLS (Multi-Tenant, Papel e Extensão)
  -- ============================================================================
  perform pg_temp.set_actor('authenticated', v_owner_a);
  insert into storage.objects (bucket_id, name, owner)
  values ('menu-media', v_store_a::text || '/products/item-1.webp', v_owner_a);

  -- Bloquear upload na pasta de outro estabelecimento
  v_failed := false;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('menu-media', v_store_b::text || '/products/hack.webp', v_owner_a);
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Storage RLS deve bloquear upload em pasta de outro tenant.');

  -- Bloquear SVG malicioso
  v_failed := false;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('menu-media', v_store_a::text || '/products/xss.svg', v_owner_a);
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Storage RLS deve bloquear arquivos SVG.');

  -- Editor não pode enviar logo (branding exige owner)
  perform pg_temp.set_actor('authenticated', v_editor_a);
  v_failed := false;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('menu-media', v_store_a::text || '/branding/logo.png', v_editor_a);
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Editor não pode fazer upload em branding (somente owner).');

  -- ============================================================================
  -- 9. Proteção contra exclusão de loja ativa e imutabilidade de auditoria
  -- ============================================================================
  reset role;
  v_failed := false;
  begin
    delete from public.stores where id = v_store_a;
  exception when others then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Não deve ser possível excluir estabelecimento ativo.');

  -- Auditoria é append-only
  perform pg_temp.set_actor('authenticated', v_super_id);
  perform public.platform_update_store_lifecycle(v_store_a, 'suspended', 'Teste auditoria');
  reset role;
  v_failed := false;
  begin
    delete from public.platform_audit_logs;
  exception when others then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'Logs de auditoria devem ser imutáveis (append-only).');

  raise notice 'TODOS OS TESTES DE BANCO, RLS, PLANOS, PROMOÇÕES E STORAGE PASSARAM!';
end $$;

rollback;


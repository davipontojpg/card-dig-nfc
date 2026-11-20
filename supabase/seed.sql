-- ============================================================================
-- Seed de Desenvolvimento (APENAS AMBIENTE LOCAL / DEMO)
-- NÃO executar em produção com dados fictícios como se fossem clientes reais.
-- Os 3 planos comerciais oficiais já são semeados pela migration 0006.
-- ============================================================================

-- Exemplo opcional para testar o cardápio público /m/bistro-demo em desenvolvimento:
do $$
declare
  v_plan_id uuid;
  v_store_id uuid;
  v_cat_bebidas uuid;
  v_cat_porcoes uuid;
  v_prod_combo uuid;
  v_group_acomp uuid;
  v_promo_id uuid;
begin
  select id into v_plan_id from public.plans where code = 'menu_nfc_promotions';
  if v_plan_id is null then
    return;
  end if;

  if exists (select 1 from public.stores where slug = 'bistro-demo') then
    return;
  end if;

  insert into public.stores (
    name, slug, business_type, description, primary_color,
    public_phone, public_address, timezone, is_published,
    lifecycle_status, onboarding_status
  ) values (
    'Bistrô Demonstração',
    'bistro-demo',
    'Restaurante & Adega',
    'Dados de demonstração para testes locais de desenvolvimento.',
    '#0f766e',
    '(11) 99999-0000',
    'Rua Exemplo, 100 - São Paulo/SP',
    'America/Sao_Paulo',
    true,
    'active',
    'completed'
  ) returning id into v_store_id;

  insert into public.store_internal_records (
    store_id, contact_name, contact_email, owner_invite_status, internal_notes
  ) values (
    v_store_id, 'Contato Demo', 'demo@exemplo.local', 'not_sent', 'Registro apenas para dev local.'
  );

  insert into public.store_subscriptions (
    store_id, plan_id, status, monthly_price_snapshot, setup_fee_snapshot, setup_fee_status, started_at
  ) values (
    v_store_id, v_plan_id, 'active', 59.90, 100.00, 'waived', now()
  );

  insert into public.categories (store_id, name, description, sort_order, is_active)
  values (v_store_id, 'Bebidas & Combos', 'Seleção especial da casa', 1, true)
  returning id into v_cat_bebidas;

  insert into public.categories (store_id, name, description, sort_order, is_active)
  values (v_store_id, 'Porções', 'Para compartilhar na mesa', 2, true)
  returning id into v_cat_porcoes;

  insert into public.products (
    store_id, category_id, name, description, price, is_active, is_available, is_featured, sort_order
  ) values (
    v_store_id, v_cat_bebidas, 'Combo de cerveja artesanal', 'Balde com 4 unidades long neck bem geladas.', 48.00, true, true, true, 1
  ) returning id into v_prod_combo;

  insert into public.products (
    store_id, category_id, name, description, price, is_active, is_available, is_featured, sort_order
  ) values (
    v_store_id, v_cat_porcoes, 'Tábua de frios da casa', 'Queijos selecionados, salame italiano e azeitonas.', 59.90, true, true, false, 1
  );

  insert into public.option_groups (
    store_id, product_id, name, description, is_required, min_selection, max_selection, sort_order, is_active
  ) values (
    v_store_id, v_prod_combo, 'Escolha o acompanhamento', 'Adicionais opcionais informativos', false, 0, 2, 1, true
  ) returning id into v_group_acomp;

  insert into public.product_options (store_id, option_group_id, name, extra_price, sort_order, is_active)
  values
    (v_store_id, v_group_acomp, 'Amendoim torrado', 5.00, 1, true),
    (v_store_id, v_group_acomp, 'Batata rústica', 8.00, 2, true),
    (v_store_id, v_group_acomp, 'Salame fatiado', 12.00, 3, true);

  insert into public.promotions (
    store_id, name, description, schedule_type, discount_type, discount_value,
    weekdays, start_time, end_time, priority, is_active
  ) values (
    v_store_id,
    'Segunda da Casa',
    '15% de desconto todas as segundas-feiras.',
    'weekly',
    'percent_off',
    15.00,
    array[1]::smallint[],
    '17:00:00',
    '23:00:00',
    10,
    true
  ) returning id into v_promo_id;

  insert into public.promotion_products (store_id, promotion_id, product_id)
  values (v_store_id, v_promo_id, v_prod_combo);
end $$;

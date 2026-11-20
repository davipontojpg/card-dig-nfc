-- ============================================================================
-- Migration 0004: Promotions Engine & Secure Public Menu RPC
-- ============================================================================

-- 1. Avalia vigência de uma promoção em um instante p_at e fuso p_timezone
create or replace function public.is_promotion_active_at(
  p_promotion public.promotions,
  p_timezone text,
  p_at timestamptz default now()
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_local_ts timestamp;
  v_local_date date;
  v_local_time time;
  v_local_dow smallint;
begin
  if not p_promotion.is_active then
    return false;
  end if;

  if p_promotion.schedule_type = 'once' then
    return p_at >= p_promotion.starts_at and p_at < p_promotion.ends_at;
  end if;

  -- Recorrência semanal avaliada no fuso horário do estabelecimento
  v_local_ts := p_at at time zone p_timezone;
  v_local_date := v_local_ts::date;
  v_local_time := v_local_ts::time;
  v_local_dow := extract(dow from v_local_ts)::smallint;

  if p_promotion.valid_from is not null and v_local_date < p_promotion.valid_from then
    return false;
  end if;

  if p_promotion.valid_until is not null and v_local_date > p_promotion.valid_until then
    return false;
  end if;

  if not (v_local_dow = any(p_promotion.weekdays)) then
    return false;
  end if;

  return v_local_time >= p_promotion.start_time and v_local_time < p_promotion.end_time;
end;
$$;

-- 2. Retorna no máximo 1 promoção vigente por produto (resolução determinística)
create or replace function public.get_active_product_promotions(
  p_store_id uuid,
  p_at timestamptz default now()
)
returns table (
  product_id uuid,
  promotion_id uuid,
  promotion_name text,
  promotion_description text,
  schedule_type text,
  discount_type text,
  discount_value numeric(10,2),
  original_price numeric(10,2),
  promotional_price numeric(10,2),
  ends_at timestamptz,
  end_time time
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_timezone text;
begin
  if not public.store_has_feature(p_store_id, 'scheduled_promotions', p_at) then
    return;
  end if;

  select s.timezone into v_timezone
  from public.stores s
  where s.id = p_store_id;

  if v_timezone is null then
    return;
  end if;

  return query
  with candidate_promos as (
    select
      pp.product_id,
      pr.id as promotion_id,
      pr.name as promotion_name,
      pr.description as promotion_description,
      pr.schedule_type,
      coalesce(pp.discount_type_override, pr.discount_type) as effective_type,
      coalesce(pp.discount_value_override, pr.discount_value) as effective_value,
      p.price as original_price,
      public.calculate_promotional_price(
        p.price,
        coalesce(pp.discount_type_override, pr.discount_type),
        coalesce(pp.discount_value_override, pr.discount_value)
      ) as promotional_price,
      pr.ends_at,
      pr.end_time,
      pr.priority,
      pr.created_at
    from public.promotion_products pp
    join public.promotions pr on pr.id = pp.promotion_id and pr.store_id = pp.store_id
    join public.products p on p.id = pp.product_id and p.store_id = pp.store_id
    where pp.store_id = p_store_id
      and p.is_active = true
      and p.is_available = true
      and public.is_promotion_active_at(pr, v_timezone, p_at)
  )
  select distinct on (cp.product_id)
    cp.product_id,
    cp.promotion_id,
    cp.promotion_name,
    cp.promotion_description,
    cp.schedule_type,
    cp.effective_type as discount_type,
    cp.effective_value as discount_value,
    cp.original_price,
    cp.promotional_price,
    cp.ends_at,
    cp.end_time
  from candidate_promos cp
  where cp.promotional_price is not null
  order by cp.product_id, cp.priority desc, cp.created_at asc, cp.promotion_id asc;
end;
$$;

revoke all on function public.get_active_product_promotions(uuid, timestamptz) from public;

-- 3. Relatório de conflitos entre promoções ativas do mesmo estabelecimento
create or replace function public.get_promotion_conflicts(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conflicts jsonb;
  v_effective jsonb;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if not public.is_platform_admin(v_uid) and not public.has_store_role(p_store_id, v_uid, null) then
    raise exception 'Acesso negado ao estabelecimento.' using errcode = '42501';
  end if;

  if not public.store_has_feature(p_store_id, 'scheduled_promotions') then
    raise exception 'O plano atual do estabelecimento não inclui o recurso scheduled_promotions.' using errcode = '42501';
  end if;

  with active_rules as (
    select
      pp.product_id,
      prod.name as product_name,
      pr.id as promo_id,
      pr.name as promo_name,
      pr.priority,
      pr.created_at,
      pr.schedule_type,
      pr.starts_at,
      pr.ends_at,
      pr.weekdays,
      pr.start_time,
      pr.end_time,
      pr.valid_from,
      pr.valid_until
    from public.promotion_products pp
    join public.promotions pr on pr.id = pp.promotion_id and pr.store_id = pp.store_id
    join public.products prod on prod.id = pp.product_id and prod.store_id = pp.store_id
    where pp.store_id = p_store_id
      and pr.is_active = true
  ),
  ordered_pairs as (
    select
      a.product_id,
      a.product_name,
      a.promo_id as promo_a_id,
      a.promo_name as promo_a_name,
      a.priority as promo_a_priority,
      a.created_at as promo_a_created_at,
      b.promo_id as promo_b_id,
      b.promo_name as promo_b_name,
      b.priority as promo_b_priority,
      b.created_at as promo_b_created_at
    from active_rules a
    join active_rules b
      on a.product_id = b.product_id
     and a.promo_id < b.promo_id
    where (
      -- Ambos pontuais: janelas se sobrepõem
      (a.schedule_type = 'once' and b.schedule_type = 'once'
        and a.starts_at < b.ends_at and b.starts_at < a.ends_at)
      or
      -- Ambos semanais: compartilham dia da semana, faixa horária e validade
      (a.schedule_type = 'weekly' and b.schedule_type = 'weekly'
        and a.weekdays && b.weekdays
        and a.start_time < b.end_time and b.start_time < a.end_time
        and coalesce(a.valid_from, '-infinity'::date) <= coalesce(b.valid_until, 'infinity'::date)
        and coalesce(b.valid_from, '-infinity'::date) <= coalesce(a.valid_until, 'infinity'::date))
      or
      -- Um pontual e um semanal: potencial sobreposição sinalizada ao operador/lojista
      (a.schedule_type <> b.schedule_type)
    )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', op.product_id,
        'product_name', op.product_name,
        'winning_promotion_id', case
          when (op.promo_a_priority > op.promo_b_priority)
            or (op.promo_a_priority = op.promo_b_priority and op.promo_a_created_at <= op.promo_b_created_at)
          then op.promo_a_id else op.promo_b_id end,
        'winning_promotion_name', case
          when (op.promo_a_priority > op.promo_b_priority)
            or (op.promo_a_priority = op.promo_b_priority and op.promo_a_created_at <= op.promo_b_created_at)
          then op.promo_a_name else op.promo_b_name end,
        'conflicting_promotion_id', case
          when (op.promo_a_priority > op.promo_b_priority)
            or (op.promo_a_priority = op.promo_b_priority and op.promo_a_created_at <= op.promo_b_created_at)
          then op.promo_b_id else op.promo_a_id end,
        'conflicting_promotion_name', case
          when (op.promo_a_priority > op.promo_b_priority)
            or (op.promo_a_priority = op.promo_b_priority and op.promo_a_created_at <= op.promo_b_created_at)
          then op.promo_b_name else op.promo_a_name end,
        'reason', 'Períodos potencialmente coincidentes: prevalece maior prioridade e, em empate, a promoção mais antiga.'
      )
    ),
    '[]'::jsonb
  )
  into v_conflicts
  from ordered_pairs op;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', gap.product_id,
        'promotion_id', gap.promotion_id,
        'promotion_name', gap.promotion_name,
        'promotional_price', gap.promotional_price
      )
    ),
    '[]'::jsonb
  )
  into v_effective
  from public.get_active_product_promotions(p_store_id, now()) gap;

  return jsonb_build_object(
    'conflicts', v_conflicts,
    'effective_now', v_effective
  );
end;
$$;

revoke all on function public.get_promotion_conflicts(uuid) from public;
grant execute on function public.get_promotion_conflicts(uuid) to authenticated;

-- 4. Função pública determinística e testável por instante (p_at)
create or replace function public.get_public_menu_at(
  p_slug text,
  p_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_store public.stores%rowtype;
  v_has_access boolean;
  v_has_promos boolean;
  v_categories jsonb;
  v_active_promos jsonb;
begin
  select * into v_store
  from public.stores
  where slug = lower(trim(coalesce(p_slug, '')));

  if not found or v_store.lifecycle_status = 'archived' then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not v_store.is_published then
    return jsonb_build_object('status', 'unpublished');
  end if;

  v_has_access := public.store_has_service_access(v_store.id, p_at);
  if not v_has_access then
    return jsonb_build_object('status', 'unavailable');
  end if;

  v_has_promos := public.store_has_feature(v_store.id, 'scheduled_promotions', p_at);

  with active_promos as (
    select *
    from public.get_active_product_promotions(v_store.id, p_at)
  ),
  groups_by_product as (
    select
      og.product_id,
      jsonb_agg(
        jsonb_build_object(
          'id', og.id,
          'name', og.name,
          'description', og.description,
          'is_required', og.is_required,
          'min_selection', og.min_selection,
          'max_selection', og.max_selection,
          'sort_order', og.sort_order,
          'options', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', po.id,
                  'name', po.name,
                  'description', po.description,
                  'extra_price', po.extra_price,
                  'sort_order', po.sort_order
                )
                order by po.sort_order asc, po.name asc
              )
              from public.product_options po
              where po.option_group_id = og.id
                and po.store_id = v_store.id
                and po.is_active = true
            ),
            '[]'::jsonb
          )
        )
        order by og.sort_order asc, og.name asc
      ) as groups_json
    from public.option_groups og
    where og.store_id = v_store.id
      and og.is_active = true
    group by og.product_id
  ),
  products_by_cat as (
    select
      p.category_id,
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'category_id', p.category_id,
          'name', p.name,
          'description', p.description,
          'price', p.price,
          'image_path', p.image_path,
          'is_available', p.is_available,
          'is_featured', p.is_featured,
          'sort_order', p.sort_order,
          'promotion', case
            when v_has_promos and ap.promotion_id is not null then
              jsonb_build_object(
                'promotion_id', ap.promotion_id,
                'name', ap.promotion_name,
                'description', ap.promotion_description,
                'discount_type', ap.discount_type,
                'discount_value', ap.discount_value,
                'original_price', ap.original_price,
                'promotional_price', ap.promotional_price,
                'schedule_type', ap.schedule_type
              )
            else null
          end,
          'option_groups', coalesce(gbp.groups_json, '[]'::jsonb)
        )
        order by p.sort_order asc, p.name asc
      ) as products_json
    from public.products p
    left join active_promos ap on ap.product_id = p.id
    left join groups_by_product gbp on gbp.product_id = p.id
    where p.store_id = v_store.id
      and p.is_active = true
    group by p.category_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'description', c.description,
        'sort_order', c.sort_order,
        'products', coalesce(pbc.products_json, '[]'::jsonb)
      )
      order by c.sort_order asc, c.name asc
    ),
    '[]'::jsonb
  )
  into v_categories
  from public.categories c
  left join products_by_cat pbc on pbc.category_id = c.id
  where c.store_id = v_store.id
    and c.is_active = true
    and pbc.products_json is not null;

  if v_has_promos then
    select coalesce(
      jsonb_agg(distinct_promo.obj),
      '[]'::jsonb
    )
    into v_active_promos
    from (
      select distinct on (ap.promotion_id)
        jsonb_build_object(
          'promotion_id', ap.promotion_id,
          'name', ap.promotion_name,
          'description', ap.promotion_description,
          'schedule_type', ap.schedule_type,
          'ends_at', ap.ends_at,
          'end_time', ap.end_time
        ) as obj
      from public.get_active_product_promotions(v_store.id, p_at) ap
    ) distinct_promo;
  else
    v_active_promos := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'evaluated_at', p_at,
    'store', jsonb_build_object(
      'id', v_store.id,
      'name', v_store.name,
      'slug', v_store.slug,
      'business_type', v_store.business_type,
      'description', v_store.description,
      'logo_path', v_store.logo_path,
      'primary_color', v_store.primary_color,
      'public_phone', v_store.public_phone,
      'public_address', v_store.public_address,
      'timezone', v_store.timezone
    ),
    'features', jsonb_build_object(
      'digital_menu', true,
      'qr_code', public.store_has_feature(v_store.id, 'qr_code', p_at),
      'scheduled_promotions', v_has_promos
    ),
    'categories', v_categories,
    'active_promotions', v_active_promos
  );
end;
$$;

-- RPC oficial consumida pelo cliente público (sempre usa now() do banco)
create or replace function public.get_public_menu(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.get_public_menu_at(p_slug, now());
$$;

revoke all on function public.get_public_menu_at(text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated;


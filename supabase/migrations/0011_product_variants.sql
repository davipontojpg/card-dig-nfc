-- ============================================================================
-- Migration 0011: Product Variants (Sabores / Tamanhos / Opções do Item)
-- - Permite variantes opcionais por produto (ex.: Monster -> Manga, Morango...)
-- - Suporta marcar variante como esgotada (is_available = false) ou excluir
-- - Atualiza get_public_menu_at e get_store_menu_preview para expor variantes
-- ============================================================================

-- 1. Título opcional das variantes no produto (ex.: "Sabores", "Tamanhos")
alter table public.products
  add column if not exists variant_label text null;

-- 2. Tabela product_variants com isolamento multi-tenant via FK composta
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, store_id) references public.products(id, store_id) on delete cascade
);

create index if not exists idx_product_variants_store_product
  on public.product_variants (store_id, product_id, sort_order, name);

drop trigger if exists trg_product_variants_updated_at on public.product_variants;
create trigger trg_product_variants_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

-- 3. RLS e permissões
alter table public.product_variants enable row level security;

revoke all on public.product_variants from anon;
grant select, insert, update, delete on public.product_variants to authenticated;
grant all on public.product_variants to service_role;

drop policy if exists "product_variants_select_admin_or_member" on public.product_variants;
create policy "product_variants_select_admin_or_member"
on public.product_variants for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or public.has_store_role(store_id, (select auth.uid()), null)
);

drop policy if exists "product_variants_insert_admin_or_editor_with_feature" on public.product_variants;
create policy "product_variants_insert_admin_or_editor_with_feature"
on public.product_variants for insert to authenticated
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
);

drop policy if exists "product_variants_update_admin_or_editor_with_feature" on public.product_variants;
create policy "product_variants_update_admin_or_editor_with_feature"
on public.product_variants for update to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
)
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
);

drop policy if exists "product_variants_delete_admin_or_editor_with_feature" on public.product_variants;
create policy "product_variants_delete_admin_or_editor_with_feature"
on public.product_variants for delete to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
);

-- 4. Atualizar get_public_menu_at para retornar variant_label e variants
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
  v_has_basic_promos boolean;
  v_has_scheduled_promos boolean;
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

  v_has_basic_promos := public.store_has_feature(v_store.id, 'basic_promotions', p_at);
  v_has_scheduled_promos := public.store_has_feature(v_store.id, 'scheduled_promotions', p_at);
  v_has_promos := v_has_basic_promos or v_has_scheduled_promos;

  with active_promos as (
    select *
    from public.get_active_product_promotions(v_store.id, p_at)
  ),
  variants_by_product as (
    select
      pv.product_id,
      jsonb_agg(
        jsonb_build_object(
          'id', pv.id,
          'name', pv.name,
          'is_available', pv.is_available,
          'sort_order', pv.sort_order
        )
        order by pv.sort_order asc, pv.name asc
      ) as variants_json
    from public.product_variants pv
    where pv.store_id = v_store.id
    group by pv.product_id
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
          'variant_label', p.variant_label,
          'variants', coalesce(vbp.variants_json, '[]'::jsonb),
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
    left join variants_by_product vbp on vbp.product_id = p.id
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
      'basic_promotions', v_has_basic_promos,
      'scheduled_promotions', v_has_scheduled_promos
    ),
    'categories', v_categories,
    'active_promotions', v_active_promos
  );
end;
$$;

revoke all on function public.get_public_menu_at(text, timestamptz) from public, anon, authenticated;

-- 5. Atualizar get_store_menu_preview para retornar variant_label e variants
create or replace function public.get_store_menu_preview(
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz := now();
  v_store public.stores%rowtype;
  v_has_basic_promos boolean;
  v_has_scheduled_promos boolean;
  v_has_promos boolean;
  v_categories jsonb;
  v_active_promos jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select * into v_store
  from public.stores
  where slug = lower(trim(coalesce(p_slug, '')));

  if not found or v_store.lifecycle_status = 'archived' then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not public.is_platform_admin(v_uid)
     and not public.has_store_role(v_store.id, v_uid, null) then
    return jsonb_build_object('status', 'unavailable');
  end if;

  v_has_basic_promos := public.store_has_workspace_feature(v_store.id, 'basic_promotions', v_at);
  v_has_scheduled_promos := public.store_has_workspace_feature(v_store.id, 'scheduled_promotions', v_at);
  v_has_promos := v_has_basic_promos or v_has_scheduled_promos;

  with candidate_promos as (
    select
      pp.product_id,
      pr.id as promotion_id,
      pr.name as promotion_name,
      pr.description as promotion_description,
      pr.schedule_type,
      coalesce(pp.discount_type_override, pr.discount_type) as discount_type,
      coalesce(pp.discount_value_override, pr.discount_value) as discount_value,
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
    where v_has_promos
      and pp.store_id = v_store.id
      and p.is_active = true
      and p.is_available = true
      and (
        (pr.schedule_type = 'always' and (v_has_basic_promos or v_has_scheduled_promos))
        or (pr.schedule_type in ('once', 'weekly') and v_has_scheduled_promos)
      )
      and public.is_promotion_active_at(pr, v_store.timezone, v_at)
  ),
  active_promos as (
    select distinct on (cp.product_id)
      cp.product_id,
      cp.promotion_id,
      cp.promotion_name,
      cp.promotion_description,
      cp.schedule_type,
      cp.discount_type,
      cp.discount_value,
      cp.original_price,
      cp.promotional_price,
      cp.ends_at,
      cp.end_time
    from candidate_promos cp
    where cp.promotional_price is not null
    order by cp.product_id, cp.priority desc, cp.created_at asc, cp.promotion_id asc
  ),
  variants_by_product as (
    select
      pv.product_id,
      jsonb_agg(
        jsonb_build_object(
          'id', pv.id,
          'name', pv.name,
          'is_available', pv.is_available,
          'sort_order', pv.sort_order
        )
        order by pv.sort_order asc, pv.name asc
      ) as variants_json
    from public.product_variants pv
    where pv.store_id = v_store.id
    group by pv.product_id
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
          'variant_label', p.variant_label,
          'variants', coalesce(vbp.variants_json, '[]'::jsonb),
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
    left join variants_by_product vbp on vbp.product_id = p.id
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
    with candidate_promos as (
      select
        pp.product_id,
        pr.id as promotion_id,
        pr.name as promotion_name,
        pr.description as promotion_description,
        pr.schedule_type,
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
      where pp.store_id = v_store.id
        and p.is_active = true
        and p.is_available = true
        and (
          (pr.schedule_type = 'always' and (v_has_basic_promos or v_has_scheduled_promos))
          or (pr.schedule_type in ('once', 'weekly') and v_has_scheduled_promos)
        )
        and public.is_promotion_active_at(pr, v_store.timezone, v_at)
    ),
    effective_promos as (
      select distinct on (cp.product_id)
        cp.promotion_id,
        cp.promotion_name,
        cp.promotion_description,
        cp.schedule_type,
        cp.ends_at,
        cp.end_time
      from candidate_promos cp
      where cp.promotional_price is not null
      order by cp.product_id, cp.priority desc, cp.created_at asc, cp.promotion_id asc
    )
    select coalesce(
      jsonb_agg(distinct_promo.obj),
      '[]'::jsonb
    )
    into v_active_promos
    from (
      select distinct on (ep.promotion_id)
        jsonb_build_object(
          'promotion_id', ep.promotion_id,
          'name', ep.promotion_name,
          'description', ep.promotion_description,
          'schedule_type', ep.schedule_type,
          'ends_at', ep.ends_at,
          'end_time', ep.end_time
        ) as obj
      from effective_promos ep
    ) distinct_promo;
  else
    v_active_promos := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'is_preview', true,
    'lifecycle_status', v_store.lifecycle_status,
    'is_published', v_store.is_published,
    'evaluated_at', v_at,
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
      'qr_code', public.store_has_workspace_feature(v_store.id, 'qr_code', v_at),
      'basic_promotions', v_has_basic_promos,
      'scheduled_promotions', v_has_scheduled_promos
    ),
    'categories', v_categories,
    'active_promotions', v_active_promos
  );
end;
$$;

revoke all on function public.get_store_menu_preview(text) from public, anon;
grant execute on function public.get_store_menu_preview(text) to authenticated;

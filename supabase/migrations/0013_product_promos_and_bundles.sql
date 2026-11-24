-- ============================================================================
-- Migration 0013: Direct Product Promotions & Bundle/Combo Promotions
-- - Adiciona promo_price e promo_highlight_top diretamente em products
-- - Cria promotion_bundles e promotion_bundle_items (promoções em lote/combo)
-- - Atualiza get_public_menu_at e get_store_menu_preview para expor promoções
--   diretas, destaques no topo e combos em lote
-- ============================================================================

-- 1. Promoção comum direta no produto
alter table public.products
  add column if not exists promo_price numeric(10,2) null,
  add column if not exists promo_highlight_top boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_promo_price_valid_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_promo_price_valid_check
      check (promo_price is null or (promo_price > 0 and promo_price < price));
  end if;
end $$;

-- 2. Tabelas de Promoções em Lote (Combos)
create table if not exists public.promotion_bundles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text null,
  promo_price numeric(10,2) not null check (promo_price > 0),
  highlight_top boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, store_id)
);

create index if not exists idx_promotion_bundles_store_active
  on public.promotion_bundles (store_id, is_active, sort_order, created_at);

create trigger trg_promotion_bundles_updated_at
before update on public.promotion_bundles
for each row execute function public.set_updated_at();

create table if not exists public.promotion_bundle_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  bundle_id uuid not null,
  product_id uuid not null,
  quantity integer not null default 1 check (quantity >= 1 and quantity <= 99),
  created_at timestamptz not null default now(),
  unique (bundle_id, product_id),
  foreign key (bundle_id, store_id) references public.promotion_bundles(id, store_id) on delete cascade,
  foreign key (product_id, store_id) references public.products(id, store_id) on delete cascade
);

create index if not exists idx_promotion_bundle_items_store_bundle
  on public.promotion_bundle_items (store_id, bundle_id);

-- 3. RLS e permissões para promotion_bundles e promotion_bundle_items
alter table public.promotion_bundles enable row level security;
alter table public.promotion_bundle_items enable row level security;

revoke all on public.promotion_bundles from anon;
revoke all on public.promotion_bundle_items from anon;
grant select, insert, update, delete on public.promotion_bundles to authenticated;
grant select, insert, update, delete on public.promotion_bundle_items to authenticated;
grant all on public.promotion_bundles to service_role;
grant all on public.promotion_bundle_items to service_role;

create policy "promotion_bundles_select_entitled_only"
on public.promotion_bundles for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), null)
    and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
  )
);

create policy "promotion_bundles_insert_entitled_only"
on public.promotion_bundles for insert to authenticated
with check (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
);

create policy "promotion_bundles_update_entitled_only"
on public.promotion_bundles for update to authenticated
using (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
)
with check (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
);

create policy "promotion_bundles_delete_entitled_only"
on public.promotion_bundles for delete to authenticated
using (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
);

create policy "promotion_bundle_items_select_entitled_only"
on public.promotion_bundle_items for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), null)
    and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
  )
);

create policy "promotion_bundle_items_insert_entitled_only"
on public.promotion_bundle_items for insert to authenticated
with check (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
);

create policy "promotion_bundle_items_update_entitled_only"
on public.promotion_bundle_items for update to authenticated
using (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
)
with check (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
);

create policy "promotion_bundle_items_delete_entitled_only"
on public.promotion_bundle_items for delete to authenticated
using (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
);

-- 4. Atualizar get_public_menu_at para expor promoções diretas, destaques e combos em lote
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
  v_highlighted_products jsonb;
  v_bundles jsonb;
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
            when v_has_promos and p.is_available and p.promo_price is not null and p.promo_price > 0 and p.promo_price < p.price then
              jsonb_build_object(
                'promotion_id', 'direct-' || p.id::text,
                'name', 'Promoção',
                'description', null,
                'discount_type', 'fixed_price',
                'discount_value', p.promo_price,
                'original_price', p.price,
                'promotional_price', p.promo_price,
                'schedule_type', 'always',
                'highlight_top', p.promo_highlight_top
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

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', p.id,
          'name', p.name,
          'original_price', p.price,
          'promotional_price', p.promo_price,
          'image_path', p.image_path
        )
        order by p.sort_order asc, p.name asc
      ),
      '[]'::jsonb
    )
    into v_highlighted_products
    from public.products p
    where p.store_id = v_store.id
      and p.is_active = true
      and p.is_available = true
      and p.promo_highlight_top = true
      and p.promo_price is not null
      and p.promo_price > 0
      and p.promo_price < p.price;
  else
    v_active_promos := '[]'::jsonb;
    v_highlighted_products := '[]'::jsonb;
  end if;

  if v_has_scheduled_promos then
    with bundle_items_agg as (
      select
        pbi.bundle_id,
        sum(p.price * pbi.quantity) as regular_total,
        jsonb_agg(
          jsonb_build_object(
            'product_id', p.id,
            'product_name', p.name,
            'quantity', pbi.quantity,
            'unit_price', p.price,
            'image_path', p.image_path
          )
          order by p.name asc
        ) as items_json
      from public.promotion_bundle_items pbi
      join public.products p on p.id = pbi.product_id and p.store_id = pbi.store_id
      where pbi.store_id = v_store.id
        and p.is_active = true
      group by pbi.bundle_id
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', pb.id,
          'name', pb.name,
          'description', pb.description,
          'regular_total', round(bia.regular_total, 2),
          'promo_price', pb.promo_price,
          'highlight_top', pb.highlight_top,
          'items', bia.items_json
        )
        order by pb.highlight_top desc, pb.sort_order asc, pb.created_at asc
      ),
      '[]'::jsonb
    )
    into v_bundles
    from public.promotion_bundles pb
    join bundle_items_agg bia on bia.bundle_id = pb.id
    where pb.store_id = v_store.id
      and pb.is_active = true
      and bia.regular_total > pb.promo_price;
  else
    v_bundles := '[]'::jsonb;
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
    'active_promotions', v_active_promos,
    'highlighted_products', v_highlighted_products,
    'bundles', v_bundles
  );
end;
$$;

revoke all on function public.get_public_menu_at(text, timestamptz) from public, anon, authenticated;

-- 5. Atualizar get_store_menu_preview da mesma forma
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
  v_highlighted_products jsonb;
  v_bundles jsonb;
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
            when v_has_promos and p.is_available and p.promo_price is not null and p.promo_price > 0 and p.promo_price < p.price then
              jsonb_build_object(
                'promotion_id', 'direct-' || p.id::text,
                'name', 'Promoção',
                'description', null,
                'discount_type', 'fixed_price',
                'discount_value', p.promo_price,
                'original_price', p.price,
                'promotional_price', p.promo_price,
                'schedule_type', 'always',
                'highlight_top', p.promo_highlight_top
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

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', p.id,
          'name', p.name,
          'original_price', p.price,
          'promotional_price', p.promo_price,
          'image_path', p.image_path
        )
        order by p.sort_order asc, p.name asc
      ),
      '[]'::jsonb
    )
    into v_highlighted_products
    from public.products p
    where p.store_id = v_store.id
      and p.is_active = true
      and p.is_available = true
      and p.promo_highlight_top = true
      and p.promo_price is not null
      and p.promo_price > 0
      and p.promo_price < p.price;
  else
    v_active_promos := '[]'::jsonb;
    v_highlighted_products := '[]'::jsonb;
  end if;

  if v_has_scheduled_promos then
    with bundle_items_agg as (
      select
        pbi.bundle_id,
        sum(p.price * pbi.quantity) as regular_total,
        jsonb_agg(
          jsonb_build_object(
            'product_id', p.id,
            'product_name', p.name,
            'quantity', pbi.quantity,
            'unit_price', p.price,
            'image_path', p.image_path
          )
          order by p.name asc
        ) as items_json
      from public.promotion_bundle_items pbi
      join public.products p on p.id = pbi.product_id and p.store_id = pbi.store_id
      where pbi.store_id = v_store.id
        and p.is_active = true
      group by pbi.bundle_id
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', pb.id,
          'name', pb.name,
          'description', pb.description,
          'regular_total', round(bia.regular_total, 2),
          'promo_price', pb.promo_price,
          'highlight_top', pb.highlight_top,
          'items', bia.items_json
        )
        order by pb.highlight_top desc, pb.sort_order asc, pb.created_at asc
      ),
      '[]'::jsonb
    )
    into v_bundles
    from public.promotion_bundles pb
    join bundle_items_agg bia on bia.bundle_id = pb.id
    where pb.store_id = v_store.id
      and pb.is_active = true
      and bia.regular_total > pb.promo_price;
  else
    v_bundles := '[]'::jsonb;
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
    'active_promotions', v_active_promos,
    'highlighted_products', v_highlighted_products,
    'bundles', v_bundles
  );
end;
$$;

revoke all on function public.get_store_menu_preview(text) from public, anon;
grant execute on function public.get_store_menu_preview(text) to authenticated;

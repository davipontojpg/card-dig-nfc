-- ============================================================================
-- Migration 0002: Tenant Menu, Options & Scheduled Promotions Schema
-- ============================================================================

-- 1. Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, store_id)
);

create index idx_categories_store_sort
  on public.categories (store_id, sort_order, name);

create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

-- 2. Products (FK composta impede vincular produto a categoria de outro tenant)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text null,
  price numeric(10,2) not null check (price >= 0 and (not is_active or price > 0)),
  image_path text null,
  is_active boolean not null default true,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, store_id),
  foreign key (category_id, store_id) references public.categories(id, store_id) on delete restrict
);

create index idx_products_store_category_sort
  on public.products (store_id, category_id, sort_order, name);
create index idx_products_store_active_featured
  on public.products (store_id, is_active, is_featured);

create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- 3. Option Groups (adicionais orientativos)
create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null,
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text null,
  is_required boolean not null default false,
  min_selection integer not null default 0 check (min_selection >= 0),
  max_selection integer not null default 1 check (max_selection >= 1 and max_selection >= min_selection),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_required or min_selection >= 1),
  unique (id, store_id),
  foreign key (product_id, store_id) references public.products(id, store_id) on delete cascade
);

create index idx_option_groups_store_product
  on public.option_groups (store_id, product_id, sort_order);

create trigger trg_option_groups_updated_at
before update on public.option_groups
for each row execute function public.set_updated_at();

-- 4. Product Options
create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  option_group_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text null,
  extra_price numeric(10,2) not null default 0 check (extra_price >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (option_group_id, store_id) references public.option_groups(id, store_id) on delete cascade
);

create index idx_product_options_store_group
  on public.product_options (store_id, option_group_id, sort_order);

create trigger trg_product_options_updated_at
before update on public.product_options
for each row execute function public.set_updated_at();

-- 5. Promotions (agendamento pontual e semanal recorrente por regras)
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text null,
  schedule_type text not null check (schedule_type in ('once', 'weekly')),
  discount_type text not null check (discount_type in ('percent_off', 'amount_off', 'fixed_price')),
  discount_value numeric(10,2) not null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  weekdays smallint[] null,
  start_time time null,
  end_time time null,
  valid_from date null,
  valid_until date null,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, store_id),
  check (
    (discount_type = 'percent_off' and discount_value > 0 and discount_value < 100)
    or (discount_type in ('amount_off', 'fixed_price') and discount_value > 0)
  ),
  check (
    (
      schedule_type = 'once'
      and starts_at is not null
      and ends_at is not null
      and ends_at > starts_at
      and weekdays is null
      and start_time is null
      and end_time is null
      and valid_from is null
      and valid_until is null
    )
    or (
      schedule_type = 'weekly'
      and starts_at is null
      and ends_at is null
      and weekdays is not null
      and cardinality(weekdays) >= 1
      and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
      and start_time is not null
      and end_time is not null
      and end_time > start_time
      and (valid_from is null or valid_until is null or valid_until >= valid_from)
    )
  )
);

create index idx_promotions_store_active_priority
  on public.promotions (store_id, is_active, priority desc, created_at asc);

create trigger trg_promotions_updated_at
before update on public.promotions
for each row execute function public.set_updated_at();

create or replace function public.normalize_promotion_weekdays()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.schedule_type = 'weekly' and new.weekdays is not null then
    select array_agg(distinct d order by d)
      into new.weekdays
      from unnest(new.weekdays) as d;
  end if;
  return new;
end;
$$;

create trigger trg_promotions_normalize_weekdays
before insert or update of schedule_type, weekdays on public.promotions
for each row execute function public.normalize_promotion_weekdays();

-- 6. Promotion Products (vínculo N:N com override opcional por produto)
create table public.promotion_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  promotion_id uuid not null,
  product_id uuid not null,
  discount_type_override text null
    check (discount_type_override is null or discount_type_override in ('percent_off', 'amount_off', 'fixed_price')),
  discount_value_override numeric(10,2) null,
  created_at timestamptz not null default now(),
  unique (promotion_id, product_id),
  foreign key (promotion_id, store_id) references public.promotions(id, store_id) on delete cascade,
  foreign key (product_id, store_id) references public.products(id, store_id) on delete cascade,
  check (
    (discount_type_override is null and discount_value_override is null)
    or (
      discount_type_override is not null
      and discount_value_override is not null
      and (
        (discount_type_override = 'percent_off' and discount_value_override > 0 and discount_value_override < 100)
        or (discount_type_override in ('amount_off', 'fixed_price') and discount_value_override > 0)
      )
    )
  )
);

create index idx_promotion_products_store_product
  on public.promotion_products (store_id, product_id);

-- Função determinística de cálculo de preço promocional
create or replace function public.calculate_promotional_price(
  p_base_price numeric,
  p_discount_type text,
  p_discount_value numeric
)
returns numeric(10,2)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_result numeric;
begin
  if p_base_price is null or p_base_price <= 0 or p_discount_value is null then
    return null;
  end if;

  if p_discount_type = 'percent_off' then
    if p_discount_value <= 0 or p_discount_value >= 100 then
      return null;
    end if;
    v_result := round(p_base_price * (1 - (p_discount_value / 100.0)), 2);
  elsif p_discount_type = 'amount_off' then
    if p_discount_value <= 0 then
      return null;
    end if;
    v_result := round(p_base_price - p_discount_value, 2);
  elsif p_discount_type = 'fixed_price' then
    if p_discount_value <= 0 then
      return null;
    end if;
    v_result := round(p_discount_value, 2);
  else
    return null;
  end if;

  if v_result is null or v_result <= 0 or v_result >= p_base_price then
    return null;
  end if;

  return v_result::numeric(10,2);
end;
$$;

-- Valida que o desconto aplicado ao produto resulta em valor > 0 e < preço-base
create or replace function public.validate_promotion_product_price()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_base_price numeric(10,2);
  v_promo_type text;
  v_promo_value numeric(10,2);
  v_effective_type text;
  v_effective_value numeric(10,2);
  v_calc numeric(10,2);
begin
  select price into v_base_price
  from public.products
  where id = new.product_id and store_id = new.store_id;

  select discount_type, discount_value
    into v_promo_type, v_promo_value
  from public.promotions
  where id = new.promotion_id and store_id = new.store_id;

  v_effective_type := coalesce(new.discount_type_override, v_promo_type);
  v_effective_value := coalesce(new.discount_value_override, v_promo_value);
  v_calc := public.calculate_promotional_price(v_base_price, v_effective_type, v_effective_value);

  if v_calc is null then
    raise exception 'Desconto inválido para o produto (preço promocional deve ser maior que zero e menor que o preço-base R$ %).', v_base_price;
  end if;

  return new;
end;
$$;

create trigger trg_promotion_products_validate_price
before insert or update on public.promotion_products
for each row execute function public.validate_promotion_product_price();


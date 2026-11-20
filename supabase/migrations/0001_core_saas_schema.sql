-- ============================================================================
-- Migration 0001: Core SaaS Multi-Tenant Schema (Platform, Tenants, Billing)
-- ============================================================================

-- Helper: updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Helper: append-only protection for audit & event logs
create or replace function public.prevent_append_only_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Registros de auditoria/eventos são imutáveis (append-only).';
end;
$$;

-- 1. Profiles (mirror mínimo de auth.users para consultas internas e relacionamentos)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text null,
  email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.guard_profile_email_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.email is distinct from old.email then
    raise exception 'O e-mail do perfil é sincronizado apenas pelo sistema de autenticação.';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard_email
before update on public.profiles
for each row execute function public.guard_profile_email_update();

create or replace function public.handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();
  return new;
end;
$$;

create trigger trg_on_auth_user_created_or_updated
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_auth_user_sync();

-- 2. Platform Admins (única fonte de verdade para operadores do SaaS)
create table public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('super_admin', 'operator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id) on delete set null
);

-- 3. Stores (somente dados do tenant/públicos — sem dados internos comerciais)
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(slug) between 3 and 63
    and slug not in (
      'login', 'app', 'admin', 'platform', 'm', 'api', 'auth', 'assets',
      'static', 'health', 'status', 'robots', 'sitemap', 'docs', 'support',
      'billing', 'settings', 'onboarding'
    )
  ),
  business_type text null,
  description text null,
  logo_path text null,
  primary_color text not null default '#0f766e' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  public_phone text null,
  public_address text null,
  timezone text not null default 'America/Sao_Paulo',
  is_published boolean not null default false,
  lifecycle_status text not null default 'pending_setup'
    check (lifecycle_status in ('pending_setup', 'active', 'suspended', 'archived')),
  onboarding_status text not null default 'pending_data'
    check (onboarding_status in ('pending_data', 'in_setup', 'awaiting_client', 'ready', 'completed')),
  created_by_platform_admin uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_stores_lifecycle on public.stores (lifecycle_status, created_at desc);
create index idx_stores_onboarding on public.stores (onboarding_status);

create or replace function public.validate_store_timezone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from pg_timezone_names where name = new.timezone
  ) then
    raise exception 'Fuso horário inválido: %', new.timezone;
  end if;
  return new;
end;
$$;

create trigger trg_stores_validate_timezone
before insert or update of timezone on public.stores
for each row execute function public.validate_store_timezone();

create trigger trg_stores_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

-- 4. Store Internal Records (isolado para operadores — impede vazamento via PostgREST)
create table public.store_internal_records (
  store_id uuid primary key references public.stores(id) on delete cascade,
  contact_name text null,
  contact_email text null,
  contact_phone text null,
  internal_notes text null,
  subscription_internal_notes text null,
  owner_invite_status text not null default 'not_sent'
    check (owner_invite_status in ('not_sent', 'sent', 'failed', 'accepted', 'linked_existing')),
  owner_invited_at timestamptz null,
  owner_invite_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_store_internal_records_updated_at
before update on public.store_internal_records
for each row execute function public.set_updated_at();

-- 5. Store Memberships
create table public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create index idx_store_memberships_user_store on public.store_memberships (user_id, store_id);

-- 6. Plans, Feature Catalog & Plan Features
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  monthly_price numeric(10,2) not null check (monthly_price >= 0),
  setup_fee numeric(10,2) not null check (setup_fee >= 0),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_plans_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

create table public.feature_catalog (
  feature_key text primary key,
  name text not null,
  description text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.plan_features (
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_key text not null references public.feature_catalog(feature_key) on delete restrict,
  primary key (plan_id, feature_key)
);

-- 7. Store Subscriptions (com snapshots comerciais imutáveis a alterações do catálogo)
create table public.store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'suspended', 'canceled')),
  monthly_price_snapshot numeric(10,2) not null check (monthly_price_snapshot >= 0),
  setup_fee_snapshot numeric(10,2) not null check (setup_fee_snapshot >= 0),
  setup_fee_status text not null default 'pending'
    check (setup_fee_status in ('pending', 'paid', 'waived')),
  started_at timestamptz null,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  next_billing_at timestamptz null,
  last_payment_at timestamptz null,
  grace_until timestamptz null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    current_period_end is null
    or current_period_start is null
    or current_period_end >= current_period_start
  )
);

create index idx_store_subscriptions_status_billing
  on public.store_subscriptions (status, next_billing_at);

create trigger trg_store_subscriptions_updated_at
before update on public.store_subscriptions
for each row execute function public.set_updated_at();

-- Proteger exclusão acidental de estabelecimento ativo ou com assinatura ativa
create or replace function public.prevent_delete_active_store()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.lifecycle_status <> 'archived' then
    raise exception 'Arquive o estabelecimento antes de excluí-lo definitivamente.';
  end if;

  if exists (
    select 1
    from public.store_subscriptions
    where store_id = old.id
      and status in ('trialing', 'active', 'past_due')
  ) then
    raise exception 'Não é possível excluir estabelecimento com assinatura em vigência.';
  end if;

  return old;
end;
$$;

create trigger trg_stores_prevent_active_delete
before delete on public.stores
for each row execute function public.prevent_delete_active_store();

-- 8. Subscription Events (append-only)
create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  subscription_id uuid null references public.store_subscriptions(id) on delete restrict,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  event_type text not null,
  old_values jsonb null,
  new_values jsonb null,
  reason text null,
  created_at timestamptz not null default now()
);

create index idx_subscription_events_store_created
  on public.subscription_events (store_id, created_at desc);

create trigger trg_subscription_events_append_only
before update or delete on public.subscription_events
for each row execute function public.prevent_append_only_mutation();

-- 9. Store Onboarding Tasks
create table public.store_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  task_key text not null,
  title text not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'blocked')),
  notes text null,
  sort_order integer not null default 0,
  completed_at timestamptz null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, task_key)
);

create index idx_onboarding_tasks_store_order
  on public.store_onboarding_tasks (store_id, sort_order);

create trigger trg_store_onboarding_tasks_updated_at
before update on public.store_onboarding_tasks
for each row execute function public.set_updated_at();

-- 10. Platform Audit Logs (append-only)
create table public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  store_id uuid null references public.stores(id) on delete restrict,
  action text not null,
  entity_type text null,
  entity_id uuid null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index idx_platform_audit_logs_store_created
  on public.platform_audit_logs (store_id, created_at desc);
create index idx_platform_audit_logs_created
  on public.platform_audit_logs (created_at desc);

create trigger trg_platform_audit_logs_append_only
before update or delete on public.platform_audit_logs
for each row execute function public.prevent_append_only_mutation();


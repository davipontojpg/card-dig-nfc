-- ============================================================================
-- Migration 0003: Authorization Functions, Operational RPCs & Strict RLS
-- ============================================================================

-- 1. Core Authorization Helpers (SECURITY DEFINER com search_path fixo)

create or replace function public.is_platform_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = coalesce(p_user_id, auth.uid())
      and pa.is_active = true
  );
$$;

create or replace function public.is_platform_super_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = coalesce(p_user_id, auth.uid())
      and pa.is_active = true
      and pa.role = 'super_admin'
  );
$$;

create or replace function public.has_store_role(
  p_store_id uuid,
  p_user_id uuid default auth.uid(),
  p_required_role text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = p_store_id
      and sm.user_id = coalesce(p_user_id, auth.uid())
      and (
        p_required_role is null
        or (p_required_role = 'owner' and sm.role = 'owner')
        or (p_required_role = 'editor' and sm.role in ('owner', 'editor'))
      )
  );
$$;

create or replace function public.store_has_service_access(
  p_store_id uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stores s
    join public.store_subscriptions ss on ss.store_id = s.id
    where s.id = p_store_id
      and s.lifecycle_status = 'active'
      and (
        ss.status in ('trialing', 'active')
        or (
          ss.status = 'past_due'
          and ss.grace_until is not null
          and p_at <= ss.grace_until
        )
      )
  );
$$;

create or replace function public.store_has_feature(
  p_store_id uuid,
  p_feature_key text,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stores s
    join public.store_subscriptions ss on ss.store_id = s.id
    join public.plan_features pf on pf.plan_id = ss.plan_id
    join public.feature_catalog fc on fc.feature_key = pf.feature_key
    where s.id = p_store_id
      and s.lifecycle_status = 'active'
      and (
        ss.status in ('trialing', 'active')
        or (
          ss.status = 'past_due'
          and ss.grace_until is not null
          and p_at <= ss.grace_until
        )
      )
      and pf.feature_key = p_feature_key
      and fc.is_active = true
  );
$$;

revoke all on function public.is_platform_admin(uuid) from public;
revoke all on function public.is_platform_super_admin(uuid) from public;
revoke all on function public.has_store_role(uuid, uuid, text) from public;
revoke all on function public.store_has_service_access(uuid, timestamptz) from public;
revoke all on function public.store_has_feature(uuid, text, timestamptz) from public;

grant execute on function public.is_platform_admin(uuid) to authenticated;
grant execute on function public.is_platform_super_admin(uuid) to authenticated;
grant execute on function public.has_store_role(uuid, uuid, text) to authenticated;
grant execute on function public.store_has_service_access(uuid, timestamptz) to authenticated;
grant execute on function public.store_has_feature(uuid, text, timestamptz) to authenticated;

-- 2. Guard trigger: proprietários não alteram lifecycle/onboarding/created_by nem publicam sem acesso ativo
create or replace function public.guard_stores_protected_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_platform_admin(auth.uid()) then
    if new.lifecycle_status is distinct from old.lifecycle_status
       or new.onboarding_status is distinct from old.onboarding_status
       or new.created_by_platform_admin is distinct from old.created_by_platform_admin then
      raise exception 'Apenas operadores da plataforma podem alterar status operacional ou implantação.';
    end if;

    if new.is_published = true and not public.store_has_service_access(new.id) then
      raise exception 'Não é possível publicar o cardápio enquanto o estabelecimento ou assinatura não estiver ativo.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_stores_guard_protected_columns
before update on public.stores
for each row execute function public.guard_stores_protected_columns();

-- 3. RPCs de Workspace, Acesso e Operação Central

create or replace function public.get_my_workspaces()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile record;
  v_admin record;
  v_memberships jsonb;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  select id, email, full_name into v_profile
  from public.profiles
  where id = v_uid;

  select role, is_active into v_admin
  from public.platform_admins
  where user_id = v_uid and is_active = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'store_id', s.id,
        'store_name', s.name,
        'slug', s.slug,
        'role', sm.role,
        'lifecycle_status', s.lifecycle_status,
        'subscription_status', ss.status,
        'plan_code', p.code,
        'plan_name', p.name,
        'has_service_access', public.store_has_service_access(s.id),
        'features', coalesce(
          (
            select jsonb_agg(pf.feature_key order by pf.feature_key)
            from public.plan_features pf
            join public.feature_catalog fc on fc.feature_key = pf.feature_key
            where pf.plan_id = ss.plan_id
              and fc.is_active = true
              and public.store_has_service_access(s.id)
          ),
          '[]'::jsonb
        )
      )
      order by s.name asc
    ),
    '[]'::jsonb
  )
  into v_memberships
  from public.store_memberships sm
  join public.stores s on s.id = sm.store_id
  join public.store_subscriptions ss on ss.store_id = s.id
  join public.plans p on p.id = ss.plan_id
  where sm.user_id = v_uid;

  return jsonb_build_object(
    'user_id', v_uid,
    'email', v_profile.email,
    'full_name', v_profile.full_name,
    'is_platform_admin', (v_admin.role is not null),
    'platform_role', v_admin.role,
    'memberships', v_memberships
  );
end;
$$;

create or replace function public.get_store_access_context(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_member_role text;
  v_effective_role text;
  v_store public.stores%rowtype;
  v_sub public.store_subscriptions%rowtype;
  v_plan public.plans%rowtype;
  v_has_access boolean;
  v_features jsonb;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  v_is_admin := public.is_platform_admin(v_uid);
  select role into v_member_role
  from public.store_memberships
  where store_id = p_store_id and user_id = v_uid;

  if not v_is_admin and v_member_role is null then
    raise exception 'Acesso negado ao estabelecimento solicitado.' using errcode = '42501';
  end if;

  v_effective_role := coalesce(v_member_role, 'platform_admin');

  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception 'Estabelecimento não encontrado.' using errcode = 'P0002';
  end if;

  select * into v_sub from public.store_subscriptions where store_id = p_store_id;
  select * into v_plan from public.plans where id = v_sub.plan_id;

  v_has_access := public.store_has_service_access(p_store_id);

  if v_has_access then
    select coalesce(jsonb_agg(pf.feature_key order by pf.feature_key), '[]'::jsonb)
    into v_features
    from public.plan_features pf
    join public.feature_catalog fc on fc.feature_key = pf.feature_key
    where pf.plan_id = v_sub.plan_id and fc.is_active = true;
  else
    v_features := '[]'::jsonb;
  end if;

  -- Editores não recebem valores comerciais da assinatura
  return jsonb_build_object(
    'store', to_jsonb(v_store),
    'role', v_effective_role,
    'has_service_access', v_has_access,
    'features', v_features,
    'subscription', jsonb_build_object(
      'id', v_sub.id,
      'plan_id', v_sub.plan_id,
      'plan_code', v_plan.code,
      'plan_name', v_plan.name,
      'status', v_sub.status,
      'monthly_price_snapshot', case when v_effective_role in ('owner', 'platform_admin') then v_sub.monthly_price_snapshot else null end,
      'setup_fee_snapshot', case when v_effective_role in ('owner', 'platform_admin') then v_sub.setup_fee_snapshot else null end,
      'setup_fee_status', case when v_effective_role in ('owner', 'platform_admin') then v_sub.setup_fee_status else null end,
      'started_at', v_sub.started_at,
      'current_period_start', v_sub.current_period_start,
      'current_period_end', v_sub.current_period_end,
      'next_billing_at', v_sub.next_billing_at,
      'last_payment_at', case when v_effective_role in ('owner', 'platform_admin') then v_sub.last_payment_at else null end,
      'grace_until', v_sub.grace_until
    )
  );
end;
$$;

create or replace function public.check_slug_availability(
  p_slug text,
  p_exclude_store_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 63 then
    return false;
  end if;

  if v_slug in (
    'login', 'app', 'admin', 'platform', 'm', 'api', 'auth', 'assets',
    'static', 'health', 'status', 'robots', 'sitemap', 'docs', 'support',
    'billing', 'settings', 'onboarding'
  ) then
    return false;
  end if;

  return not exists (
    select 1
    from public.stores s
    where s.slug = v_slug
      and (p_exclude_store_id is null or s.id <> p_exclude_store_id)
  );
end;
$$;

create or replace function public.platform_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_by_lifecycle jsonb;
  v_by_sub jsonb;
  v_by_plan jsonb;
  v_mrr numeric(12,2);
  v_mrr_count integer;
  v_pending_onboarding integer;
  v_upcoming jsonb;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Acesso restrito a operadores da plataforma.' using errcode = '42501';
  end if;

  select count(*)::integer into v_total from public.stores;

  select jsonb_build_object(
    'pending_setup', count(*) filter (where lifecycle_status = 'pending_setup'),
    'active', count(*) filter (where lifecycle_status = 'active'),
    'suspended', count(*) filter (where lifecycle_status = 'suspended'),
    'archived', count(*) filter (where lifecycle_status = 'archived')
  )
  into v_by_lifecycle
  from public.stores;

  select jsonb_build_object(
    'trialing', count(*) filter (where status = 'trialing'),
    'active', count(*) filter (where status = 'active'),
    'past_due', count(*) filter (where status = 'past_due'),
    'suspended', count(*) filter (where status = 'suspended'),
    'canceled', count(*) filter (where status = 'canceled')
  )
  into v_by_sub
  from public.store_subscriptions;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'plan_code', p.code,
        'plan_name', p.name,
        'count', coalesce(cnt.c, 0)
      )
      order by p.display_order asc
    ),
    '[]'::jsonb
  )
  into v_by_plan
  from public.plans p
  left join (
    select plan_id, count(*)::integer as c
    from public.store_subscriptions
    group by plan_id
  ) cnt on cnt.plan_id = p.id;

  -- MRR operacional estimado: somente assinaturas ativas de lojas ativas
  select
    coalesce(sum(ss.monthly_price_snapshot), 0)::numeric(12,2),
    count(*)::integer
  into v_mrr, v_mrr_count
  from public.store_subscriptions ss
  join public.stores s on s.id = ss.store_id
  where s.lifecycle_status = 'active'
    and ss.status = 'active';

  select count(*)::integer
  into v_pending_onboarding
  from public.stores
  where onboarding_status <> 'completed'
    and lifecycle_status <> 'archived';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'store_id', s.id,
        'store_name', s.name,
        'slug', s.slug,
        'plan_name', p.name,
        'next_billing_at', ss.next_billing_at,
        'monthly_price_snapshot', ss.monthly_price_snapshot,
        'status', ss.status
      )
      order by ss.next_billing_at asc
    ),
    '[]'::jsonb
  )
  into v_upcoming
  from public.store_subscriptions ss
  join public.stores s on s.id = ss.store_id
  join public.plans p on p.id = ss.plan_id
  where ss.next_billing_at is not null
    and ss.status in ('trialing', 'active', 'past_due')
    and s.lifecycle_status <> 'archived'
    and ss.next_billing_at <= now() + interval '30 days';

  return jsonb_build_object(
    'total_stores', v_total,
    'by_lifecycle', v_by_lifecycle,
    'by_subscription_status', v_by_sub,
    'by_plan', v_by_plan,
    'estimated_mrr', v_mrr,
    'active_billing_subscriptions_count', v_mrr_count,
    'pending_onboarding_count', v_pending_onboarding,
    'upcoming_billings', v_upcoming
  );
end;
$$;

create or replace function public.platform_update_subscription(
  p_store_id uuid,
  p_plan_id uuid,
  p_status text,
  p_setup_fee_status text,
  p_monthly_price_snapshot numeric default null,
  p_setup_fee_snapshot numeric default null,
  p_started_at timestamptz default null,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_next_billing_at timestamptz default null,
  p_last_payment_at timestamptz default null,
  p_grace_until timestamptz default null,
  p_subscription_internal_notes text default null,
  p_reason text default null
)
returns public.store_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.store_subscriptions%rowtype;
  v_plan public.plans%rowtype;
  v_new public.store_subscriptions%rowtype;
  v_new_monthly numeric(10,2);
  v_new_setup numeric(10,2);
  v_event_type text := 'updated';
begin
  if not public.is_platform_admin(v_uid) then
    raise exception 'Acesso restrito a operadores da plataforma.' using errcode = '42501';
  end if;

  select * into v_old from public.store_subscriptions where store_id = p_store_id for update;
  if not found then
    raise exception 'Assinatura do estabelecimento não encontrada.' using errcode = 'P0002';
  end if;

  select * into v_plan from public.plans where id = p_plan_id;
  if not found then
    raise exception 'Plano selecionado não encontrado.' using errcode = 'P0002';
  end if;

  if p_plan_id is distinct from v_old.plan_id then
    v_new_monthly := coalesce(p_monthly_price_snapshot, v_plan.monthly_price);
    v_new_setup := coalesce(p_setup_fee_snapshot, v_plan.setup_fee);
    v_event_type := 'plan_changed';
  else
    v_new_monthly := coalesce(p_monthly_price_snapshot, v_old.monthly_price_snapshot);
    v_new_setup := coalesce(p_setup_fee_snapshot, v_old.setup_fee_snapshot);
    if p_status is distinct from v_old.status then
      v_event_type := case p_status
        when 'active' then case when v_old.status in ('suspended', 'canceled') then 'reactivated' else 'activated' end
        when 'past_due' then 'marked_past_due'
        when 'suspended' then 'suspended'
        when 'canceled' then 'canceled'
        else 'status_changed'
      end;
    elsif p_setup_fee_status is distinct from v_old.setup_fee_status then
      v_event_type := case p_setup_fee_status
        when 'paid' then 'setup_fee_paid'
        when 'waived' then 'setup_fee_waived'
        else 'setup_fee_updated'
      end;
    end if;
  end if;

  update public.store_subscriptions
  set
    plan_id = p_plan_id,
    status = p_status,
    setup_fee_status = p_setup_fee_status,
    monthly_price_snapshot = v_new_monthly,
    setup_fee_snapshot = v_new_setup,
    started_at = p_started_at,
    current_period_start = p_current_period_start,
    current_period_end = p_current_period_end,
    next_billing_at = p_next_billing_at,
    last_payment_at = p_last_payment_at,
    grace_until = p_grace_until,
    updated_by = v_uid
  where id = v_old.id
  returning * into v_new;

  if p_subscription_internal_notes is not null then
    insert into public.store_internal_records (store_id, subscription_internal_notes)
    values (p_store_id, p_subscription_internal_notes)
    on conflict (store_id) do update
      set subscription_internal_notes = excluded.subscription_internal_notes;
  end if;

  insert into public.subscription_events (
    store_id,
    subscription_id,
    actor_user_id,
    event_type,
    old_values,
    new_values,
    reason
  ) values (
    p_store_id,
    v_old.id,
    v_uid,
    v_event_type,
    jsonb_build_object(
      'plan_id', v_old.plan_id,
      'status', v_old.status,
      'monthly_price_snapshot', v_old.monthly_price_snapshot,
      'setup_fee_snapshot', v_old.setup_fee_snapshot,
      'setup_fee_status', v_old.setup_fee_status,
      'grace_until', v_old.grace_until
    ),
    jsonb_build_object(
      'plan_id', v_new.plan_id,
      'status', v_new.status,
      'monthly_price_snapshot', v_new.monthly_price_snapshot,
      'setup_fee_snapshot', v_new.setup_fee_snapshot,
      'setup_fee_status', v_new.setup_fee_status,
      'grace_until', v_new.grace_until
    ),
    nullif(trim(coalesce(p_reason, '')), '')
  );

  insert into public.platform_audit_logs (
    actor_user_id,
    store_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_uid,
    p_store_id,
    'subscription.' || v_event_type,
    'store_subscriptions',
    v_new.id,
    jsonb_build_object(
      'plan_code', v_plan.code,
      'old_status', v_old.status,
      'new_status', v_new.status,
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    )
  );

  return v_new;
end;
$$;

create or replace function public.platform_update_store_lifecycle(
  p_store_id uuid,
  p_lifecycle_status text,
  p_reason text default null
)
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.stores%rowtype;
  v_new public.stores%rowtype;
begin
  if not public.is_platform_admin(v_uid) then
    raise exception 'Acesso restrito a operadores da plataforma.' using errcode = '42501';
  end if;

  select * into v_old from public.stores where id = p_store_id for update;
  if not found then
    raise exception 'Estabelecimento não encontrado.' using errcode = 'P0002';
  end if;

  update public.stores
  set
    lifecycle_status = p_lifecycle_status,
    is_published = case when p_lifecycle_status in ('suspended', 'archived', 'pending_setup') then false else is_published end
  where id = p_store_id
  returning * into v_new;

  insert into public.platform_audit_logs (
    actor_user_id,
    store_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_uid,
    p_store_id,
    'store.lifecycle_' || p_lifecycle_status,
    'stores',
    p_store_id,
    jsonb_build_object(
      'old_lifecycle_status', v_old.lifecycle_status,
      'new_lifecycle_status', v_new.lifecycle_status,
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    )
  );

  return v_new;
end;
$$;

create or replace function public.platform_manage_admin(
  p_target_user_id uuid,
  p_role text,
  p_is_active boolean
)
returns public.platform_admins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_other_super_admins integer;
  v_result public.platform_admins%rowtype;
begin
  if not public.is_platform_super_admin(v_uid) then
    raise exception 'Somente super_admin pode gerenciar operadores da plataforma.' using errcode = '42501';
  end if;

  if p_role not in ('super_admin', 'operator') then
    raise exception 'Papel administrativo inválido: %', p_role;
  end if;

  -- Nunca permitir desativar ou rebaixar o último super_admin ativo
  if not (p_role = 'super_admin' and p_is_active = true) then
    select count(*)::integer into v_other_super_admins
    from public.platform_admins
    where role = 'super_admin'
      and is_active = true
      and user_id <> p_target_user_id;

    if v_other_super_admins = 0 and exists (
      select 1 from public.platform_admins
      where user_id = p_target_user_id and role = 'super_admin' and is_active = true
    ) then
      raise exception 'Não é permitido remover ou desativar o último super_admin ativo da plataforma.';
    end if;
  end if;

  insert into public.platform_admins (user_id, role, is_active, created_by)
  values (p_target_user_id, p_role, p_is_active, v_uid)
  on conflict (user_id) do update
    set role = excluded.role,
        is_active = excluded.is_active
  returning * into v_result;

  insert into public.platform_audit_logs (
    actor_user_id,
    store_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_uid,
    null,
    'platform_admin.upserted',
    'platform_admins',
    p_target_user_id,
    jsonb_build_object('role', p_role, 'is_active', p_is_active)
  );

  return v_result;
end;
$$;

revoke all on function public.get_my_workspaces() from public;
revoke all on function public.get_store_access_context(uuid) from public;
revoke all on function public.check_slug_availability(text, uuid) from public;
revoke all on function public.platform_dashboard_metrics() from public;
revoke all on function public.platform_update_subscription(uuid, uuid, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, text, text) from public;
revoke all on function public.platform_update_store_lifecycle(uuid, text, text) from public;
revoke all on function public.platform_manage_admin(uuid, text, boolean) from public;

grant execute on function public.get_my_workspaces() to authenticated;
grant execute on function public.get_store_access_context(uuid) to authenticated;
grant execute on function public.check_slug_availability(text, uuid) to authenticated;
grant execute on function public.platform_dashboard_metrics() to authenticated;
grant execute on function public.platform_update_subscription(uuid, uuid, text, text, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.platform_update_store_lifecycle(uuid, text, text) to authenticated;
grant execute on function public.platform_manage_admin(uuid, text, boolean) to authenticated;

-- 4. Habilitar RLS em TODAS as tabelas e definir políticas estritas

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.stores enable row level security;
alter table public.store_internal_records enable row level security;
alter table public.store_memberships enable row level security;
alter table public.plans enable row level security;
alter table public.feature_catalog enable row level security;
alter table public.plan_features enable row level security;
alter table public.store_subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.store_onboarding_tasks enable row level security;
alter table public.platform_audit_logs enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.option_groups enable row level security;
alter table public.product_options enable row level security;
alter table public.promotions enable row level security;
alter table public.promotion_products enable row level security;

-- Revogar acesso direto de anon nas tabelas (consumidor acessa somente via get_public_menu RPC)
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.plans, public.feature_catalog, public.plan_features to authenticated;

-- Profiles
create policy "profiles_select_self_or_admin_or_store_owner"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin(auth.uid())
  or exists (
    select 1
    from public.store_memberships sm_target
    join public.store_memberships sm_actor on sm_actor.store_id = sm_target.store_id
    where sm_target.user_id = profiles.id
      and sm_actor.user_id = auth.uid()
      and sm_actor.role = 'owner'
  )
);

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Platform admins
create policy "platform_admins_select_self_or_active_admin"
on public.platform_admins for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin(auth.uid()));

create policy "platform_admins_manage_super_admin_only"
on public.platform_admins for all to authenticated
using (public.is_platform_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()));

-- Catalog tables
create policy "plans_read_authenticated"
on public.plans for select to authenticated
using (true);

create policy "plans_write_super_admin"
on public.plans for all to authenticated
using (public.is_platform_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()));

create policy "feature_catalog_read_authenticated"
on public.feature_catalog for select to authenticated
using (true);

create policy "feature_catalog_write_super_admin"
on public.feature_catalog for all to authenticated
using (public.is_platform_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()));

create policy "plan_features_read_authenticated"
on public.plan_features for select to authenticated
using (true);

create policy "plan_features_write_super_admin"
on public.plan_features for all to authenticated
using (public.is_platform_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()));

-- Stores
create policy "stores_select_admin_or_member"
on public.stores for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_store_role(id, auth.uid(), null)
);

create policy "stores_insert_admin_only"
on public.stores for insert to authenticated
with check (public.is_platform_admin(auth.uid()));

create policy "stores_update_admin_or_owner"
on public.stores for update to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_store_role(id, auth.uid(), 'owner')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_store_role(id, auth.uid(), 'owner')
);

create policy "stores_delete_super_admin_only"
on public.stores for delete to authenticated
using (public.is_platform_super_admin(auth.uid()));

-- Store Internal Records (EXCLUSIVO operadores da plataforma)
create policy "store_internal_records_admin_only"
on public.store_internal_records for all to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

-- Store Onboarding Tasks (EXCLUSIVO operadores da plataforma)
create policy "store_onboarding_tasks_admin_only"
on public.store_onboarding_tasks for all to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

-- Store Memberships (membro não pode se autoatribuir ou elevar papel)
create policy "store_memberships_select_admin_self_or_owner"
on public.store_memberships for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or user_id = auth.uid()
  or public.has_store_role(store_id, auth.uid(), 'owner')
);

create policy "store_memberships_write_admin_only"
on public.store_memberships for all to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

-- Store Subscriptions (editor não vê dados financeiros contratuais)
create policy "store_subscriptions_select_admin_or_owner"
on public.store_subscriptions for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_store_role(store_id, auth.uid(), 'owner')
);

create policy "store_subscriptions_write_admin_only"
on public.store_subscriptions for all to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

-- Subscription Events & Platform Audit Logs (operadores apenas, append-only)
create policy "subscription_events_select_admin_only"
on public.subscription_events for select to authenticated
using (public.is_platform_admin(auth.uid()));

create policy "subscription_events_insert_admin_only"
on public.subscription_events for insert to authenticated
with check (public.is_platform_admin(auth.uid()));

create policy "platform_audit_logs_select_admin_only"
on public.platform_audit_logs for select to authenticated
using (public.is_platform_admin(auth.uid()));

create policy "platform_audit_logs_insert_admin_only"
on public.platform_audit_logs for insert to authenticated
with check (public.is_platform_admin(auth.uid()));

-- Categories
create policy "categories_select_admin_or_member"
on public.categories for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_store_role(store_id, auth.uid(), null)
);

create policy "categories_write_admin_or_editor_with_feature"
on public.categories for all to authenticated
using (
  public.is_platform_admin(auth.uid())
  or (
    public.has_store_role(store_id, auth.uid(), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
)
with check (
  public.is_platform_admin(auth.uid())
  or (
    public.has_store_role(store_id, auth.uid(), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

-- Products
create policy "products_select_admin_or_member"
on public.products for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_store_role(store_id, auth.uid(), null)
);

create policy "products_write_admin_or_editor_with_feature"
on public.products for all to authenticated
using (
  public.is_platform_admin(auth.uid())
  or (
    public.has_store_role(store_id, auth.uid(), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
)
with check (
  public.is_platform_admin(auth.uid())
  or (
    public.has_store_role(store_id, auth.uid(), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

-- Option Groups
create policy "option_groups_select_admin_or_member"
on public.option_groups for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_store_role(store_id, auth.uid(), null)
);

create policy "option_groups_write_admin_or_editor_with_feature"
on public.option_groups for all to authenticated
using (
  public.is_platform_admin(auth.uid())
  or (
    public.has_store_role(store_id, auth.uid(), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
)
with check (
  public.is_platform_admin(auth.uid())
  or (
    public.has_store_role(store_id, auth.uid(), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

-- Product Options
create policy "product_options_select_admin_or_member"
on public.product_options for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_store_role(store_id, auth.uid(), null)
);

create policy "product_options_write_admin_or_editor_with_feature"
on public.product_options for all to authenticated
using (
  public.is_platform_admin(auth.uid())
  or (
    public.has_store_role(store_id, auth.uid(), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
)
with check (
  public.is_platform_admin(auth.uid())
  or (
    public.has_store_role(store_id, auth.uid(), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

-- Promotions & Promotion Products (EXIGEM feature scheduled_promotions no backend)
create policy "promotions_select_entitled_only"
on public.promotions for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or (
    public.has_store_role(store_id, auth.uid(), null)
    and public.store_has_feature(store_id, 'scheduled_promotions')
  )
);

create policy "promotions_write_entitled_only"
on public.promotions for all to authenticated
using (
  (
    public.is_platform_admin(auth.uid())
    or public.has_store_role(store_id, auth.uid(), 'editor')
  )
  and public.store_has_feature(store_id, 'scheduled_promotions')
)
with check (
  (
    public.is_platform_admin(auth.uid())
    or public.has_store_role(store_id, auth.uid(), 'editor')
  )
  and public.store_has_feature(store_id, 'scheduled_promotions')
);

create policy "promotion_products_select_entitled_only"
on public.promotion_products for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or (
    public.has_store_role(store_id, auth.uid(), null)
    and public.store_has_feature(store_id, 'scheduled_promotions')
  )
);

create policy "promotion_products_write_entitled_only"
on public.promotion_products for all to authenticated
using (
  (
    public.is_platform_admin(auth.uid())
    or public.has_store_role(store_id, auth.uid(), 'editor')
  )
  and public.store_has_feature(store_id, 'scheduled_promotions')
)
with check (
  (
    public.is_platform_admin(auth.uid())
    or public.has_store_role(store_id, auth.uid(), 'editor')
  )
  and public.store_has_feature(store_id, 'scheduled_promotions')
);


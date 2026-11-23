-- ============================================================================
-- Migration 0010: Self-Service Onboarding (Draft Editing) + Review + Preview
-- - Permite que o proprietário/editor configure logo, aparência, categorias,
--   produtos e promoções durante lifecycle_status = 'pending_setup'
-- - Mantém cardápio público (/m/:slug) bloqueado até aprovação/ativação
-- - Após ativado ('active'), dono edita livremente sem precisar de revisão
-- - Adiciona prévia privada autenticada (get_store_menu_preview)
-- - Adiciona RPCs de envio para revisão e decisão do operador
-- ============================================================================

-- 1. Novas colunas de acompanhamento de revisão em stores
alter table public.stores
  add column if not exists onboarding_review_notes text,
  add column if not exists onboarding_submitted_at timestamptz;

-- 2. Helpers que separam "pode editar workspace" de "pode publicar ao público"
create or replace function public.store_can_edit_workspace(
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
      and s.lifecycle_status in ('pending_setup', 'active')
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

create or replace function public.store_has_workspace_feature(
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
      and s.lifecycle_status in ('pending_setup', 'active')
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

revoke all on function public.store_can_edit_workspace(uuid, timestamptz) from public;
revoke all on function public.store_has_workspace_feature(uuid, text, timestamptz) from public;
grant execute on function public.store_can_edit_workspace(uuid, timestamptz) to authenticated;
grant execute on function public.store_has_workspace_feature(uuid, text, timestamptz) to authenticated;

-- 3. Atualizar guard trigger em stores para proteger colunas de revisão e manter bloqueio de publicação em pending_setup
create or replace function public.guard_stores_protected_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bypass_store_guard', true) = 'true' then
    return new;
  end if;

  if auth.uid() is not null and not public.is_platform_admin(auth.uid()) then
    if new.lifecycle_status is distinct from old.lifecycle_status
       or new.onboarding_status is distinct from old.onboarding_status
       or new.onboarding_review_notes is distinct from old.onboarding_review_notes
       or new.onboarding_submitted_at is distinct from old.onboarding_submitted_at
       or new.created_by_platform_admin is distinct from old.created_by_platform_admin then
      raise exception 'Apenas operadores da plataforma podem alterar status operacional ou revisão de implantação.';
    end if;

    if new.is_published = true and not public.store_has_service_access(new.id) then
      raise exception 'Não é possível publicar o cardápio enquanto o estabelecimento ou assinatura não estiver ativo.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_stores_protected_columns() from public, anon, authenticated;

-- 4. Atualizar storage helper para permitir upload de logo e fotos de produtos durante pending_setup
create or replace function public.can_manage_store_media(
  p_bucket_id text,
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_folders text[];
  v_store_id uuid;
  v_folder text;
begin
  if p_bucket_id <> 'menu-media' or auth.uid() is null then
    return false;
  end if;

  if lower(coalesce(p_object_name, '')) !~ '^[^/]+/(products|branding)/[^/]+\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  v_folders := storage.foldername(p_object_name);
  if array_length(v_folders, 1) <> 2 then
    return false;
  end if;

  v_folder := v_folders[2];
  begin
    v_store_id := v_folders[1]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if public.is_platform_admin(auth.uid()) then
    return true;
  end if;

  return public.has_store_role(
    v_store_id,
    auth.uid(),
    case when v_folder = 'branding' then 'owner' else 'editor' end
  ) and public.store_can_edit_workspace(v_store_id);
end;
$$;

revoke all on function public.can_manage_store_media(text, text) from public;
grant execute on function public.can_manage_store_media(text, text) to authenticated;

-- 5. Atualizar get_my_workspaces e get_store_access_context para expor can_edit_workspace
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
        'can_edit_workspace', public.store_can_edit_workspace(s.id),
        'features', coalesce(
          (
            select jsonb_agg(pf.feature_key order by pf.feature_key)
            from public.plan_features pf
            join public.feature_catalog fc on fc.feature_key = pf.feature_key
            where pf.plan_id = ss.plan_id
              and fc.is_active = true
              and public.store_can_edit_workspace(s.id)
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
  v_can_edit boolean;
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
  v_can_edit := public.store_can_edit_workspace(p_store_id);

  if v_can_edit then
    select coalesce(jsonb_agg(pf.feature_key order by pf.feature_key), '[]'::jsonb)
    into v_features
    from public.plan_features pf
    join public.feature_catalog fc on fc.feature_key = pf.feature_key
    where pf.plan_id = v_sub.plan_id and fc.is_active = true;
  else
    v_features := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'store', to_jsonb(v_store),
    'role', v_effective_role,
    'has_service_access', v_has_access,
    'can_edit_workspace', v_can_edit,
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
      'last_payment_at', v_sub.last_payment_at,
      'grace_until', v_sub.grace_until
    )
  );
end;
$$;

-- 6. Atualizar políticas RLS de escrita de cardápio para usar store_has_workspace_feature
-- Categories
drop policy if exists "categories_insert_admin_or_editor_with_feature" on public.categories;
drop policy if exists "categories_update_admin_or_editor_with_feature" on public.categories;
drop policy if exists "categories_delete_admin_or_editor_with_feature" on public.categories;

create policy "categories_insert_admin_or_editor_with_feature"
on public.categories for insert to authenticated
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
);

create policy "categories_update_admin_or_editor_with_feature"
on public.categories for update to authenticated
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

create policy "categories_delete_admin_or_editor_with_feature"
on public.categories for delete to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
);

-- Products
drop policy if exists "products_insert_admin_or_editor_with_feature" on public.products;
drop policy if exists "products_update_admin_or_editor_with_feature" on public.products;
drop policy if exists "products_delete_admin_or_editor_with_feature" on public.products;

create policy "products_insert_admin_or_editor_with_feature"
on public.products for insert to authenticated
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
);

create policy "products_update_admin_or_editor_with_feature"
on public.products for update to authenticated
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

create policy "products_delete_admin_or_editor_with_feature"
on public.products for delete to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
);

-- Option Groups
drop policy if exists "option_groups_insert_admin_or_editor_with_feature" on public.option_groups;
drop policy if exists "option_groups_update_admin_or_editor_with_feature" on public.option_groups;
drop policy if exists "option_groups_delete_admin_or_editor_with_feature" on public.option_groups;

create policy "option_groups_insert_admin_or_editor_with_feature"
on public.option_groups for insert to authenticated
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
);

create policy "option_groups_update_admin_or_editor_with_feature"
on public.option_groups for update to authenticated
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

create policy "option_groups_delete_admin_or_editor_with_feature"
on public.option_groups for delete to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
);

-- Product Options
drop policy if exists "product_options_insert_admin_or_editor_with_feature" on public.product_options;
drop policy if exists "product_options_update_admin_or_editor_with_feature" on public.product_options;
drop policy if exists "product_options_delete_admin_or_editor_with_feature" on public.product_options;

create policy "product_options_insert_admin_or_editor_with_feature"
on public.product_options for insert to authenticated
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
);

create policy "product_options_update_admin_or_editor_with_feature"
on public.product_options for update to authenticated
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

create policy "product_options_delete_admin_or_editor_with_feature"
on public.product_options for delete to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_workspace_feature(store_id, 'digital_menu')
  )
);

-- Promotions
drop policy if exists "promotions_select_entitled_only" on public.promotions;
drop policy if exists "promotions_insert_entitled_only" on public.promotions;
drop policy if exists "promotions_update_entitled_only" on public.promotions;
drop policy if exists "promotions_delete_entitled_only" on public.promotions;

create policy "promotions_select_entitled_only"
on public.promotions for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), null)
    and (
      public.store_has_workspace_feature(store_id, 'basic_promotions')
      or public.store_has_workspace_feature(store_id, 'scheduled_promotions')
    )
  )
);

create policy "promotions_insert_entitled_only"
on public.promotions for insert to authenticated
with check (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and (
    (
      schedule_type = 'always'
      and (
        public.store_has_workspace_feature(store_id, 'basic_promotions')
        or public.store_has_workspace_feature(store_id, 'scheduled_promotions')
      )
    )
    or (
      schedule_type in ('once', 'weekly')
      and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
    )
  )
);

create policy "promotions_update_entitled_only"
on public.promotions for update to authenticated
using (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and (
    (
      schedule_type = 'always'
      and (
        public.store_has_workspace_feature(store_id, 'basic_promotions')
        or public.store_has_workspace_feature(store_id, 'scheduled_promotions')
      )
    )
    or (
      schedule_type in ('once', 'weekly')
      and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
    )
  )
)
with check (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and (
    (
      schedule_type = 'always'
      and (
        public.store_has_workspace_feature(store_id, 'basic_promotions')
        or public.store_has_workspace_feature(store_id, 'scheduled_promotions')
      )
    )
    or (
      schedule_type in ('once', 'weekly')
      and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
    )
  )
);

create policy "promotions_delete_entitled_only"
on public.promotions for delete to authenticated
using (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and (
    (
      schedule_type = 'always'
      and (
        public.store_has_workspace_feature(store_id, 'basic_promotions')
        or public.store_has_workspace_feature(store_id, 'scheduled_promotions')
      )
    )
    or (
      schedule_type in ('once', 'weekly')
      and public.store_has_workspace_feature(store_id, 'scheduled_promotions')
    )
  )
);

-- Promotion Products
drop policy if exists "promotion_products_select_entitled_only" on public.promotion_products;
drop policy if exists "promotion_products_insert_entitled_only" on public.promotion_products;
drop policy if exists "promotion_products_update_entitled_only" on public.promotion_products;
drop policy if exists "promotion_products_delete_entitled_only" on public.promotion_products;

create policy "promotion_products_select_entitled_only"
on public.promotion_products for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), null)
    and (
      public.store_has_workspace_feature(store_id, 'basic_promotions')
      or public.store_has_workspace_feature(store_id, 'scheduled_promotions')
    )
  )
);

create policy "promotion_products_insert_entitled_only"
on public.promotion_products for insert to authenticated
with check (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and (
    public.store_has_workspace_feature(store_id, 'basic_promotions')
    or public.store_has_workspace_feature(store_id, 'scheduled_promotions')
  )
);

create policy "promotion_products_update_entitled_only"
on public.promotion_products for update to authenticated
using (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and (
    public.store_has_workspace_feature(store_id, 'basic_promotions')
    or public.store_has_workspace_feature(store_id, 'scheduled_promotions')
  )
)
with check (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and (
    public.store_has_workspace_feature(store_id, 'basic_promotions')
    or public.store_has_workspace_feature(store_id, 'scheduled_promotions')
  )
);

create policy "promotion_products_delete_entitled_only"
on public.promotion_products for delete to authenticated
using (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and (
    public.store_has_workspace_feature(store_id, 'basic_promotions')
    or public.store_has_workspace_feature(store_id, 'scheduled_promotions')
  )
);

-- 7. RPC: Dono envia o estabelecimento em implantação para revisão do operador
create or replace function public.store_submit_onboarding_review(
  p_store_id uuid
)
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_store public.stores%rowtype;
  v_updated public.stores%rowtype;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if not public.is_platform_admin(v_uid) and not public.has_store_role(p_store_id, v_uid, 'owner') then
    raise exception 'Apenas o proprietário do estabelecimento pode enviar para revisão.' using errcode = '42501';
  end if;

  select * into v_store
  from public.stores
  where id = p_store_id;

  if not found then
    raise exception 'Estabelecimento não encontrado.' using errcode = 'P0002';
  end if;

  if v_store.lifecycle_status <> 'pending_setup' then
    raise exception 'Este estabelecimento já saiu da etapa de implantação. Alterações já ficam visíveis automaticamente sem nova revisão.';
  end if;

  perform set_config('app.bypass_store_guard', 'true', true);

  update public.stores
  set onboarding_status = 'ready',
      onboarding_submitted_at = now(),
      onboarding_review_notes = null
  where id = p_store_id
  returning * into v_updated;

  return v_updated;
end;
$$;

revoke all on function public.store_submit_onboarding_review(uuid) from public;
grant execute on function public.store_submit_onboarding_review(uuid) to authenticated;

-- 8. RPC: Operador aprova e publica ou solicita ajustes durante a implantação
create or replace function public.platform_review_store_onboarding(
  p_store_id uuid,
  p_decision text,
  p_notes text default null
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
  v_clean_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if not public.is_platform_admin(v_uid) then
    raise exception 'Apenas operadores da plataforma podem revisar implantações.' using errcode = '42501';
  end if;

  if p_decision not in ('approve_and_publish', 'request_changes') then
    raise exception 'Decisão de revisão inválida: %', p_decision;
  end if;

  select * into v_old
  from public.stores
  where id = p_store_id;

  if not found then
    raise exception 'Estabelecimento não encontrado.' using errcode = 'P0002';
  end if;

  if p_decision = 'approve_and_publish' then
    update public.stores
    set lifecycle_status = 'active',
        is_published = true,
        onboarding_status = 'completed',
        onboarding_review_notes = null
    where id = p_store_id
    returning * into v_new;

    update public.store_onboarding_tasks
    set status = 'done',
        completed_at = coalesce(completed_at, now()),
        updated_by = v_uid
    where store_id = p_store_id
      and task_key = 'publish_store'
      and status <> 'done';

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
      'store.onboarding_approved_and_published',
      'stores',
      p_store_id,
      jsonb_build_object(
        'old_lifecycle_status', v_old.lifecycle_status,
        'old_onboarding_status', v_old.onboarding_status,
        'notes', v_clean_notes
      )
    );
  else
    if v_clean_notes is null then
      raise exception 'Informe uma observação explicando o que o estabelecimento precisa ajustar.';
    end if;

    update public.stores
    set lifecycle_status = 'pending_setup',
        is_published = false,
        onboarding_status = 'awaiting_client',
        onboarding_review_notes = v_clean_notes
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
      'store.onboarding_changes_requested',
      'stores',
      p_store_id,
      jsonb_build_object(
        'old_onboarding_status', v_old.onboarding_status,
        'notes', v_clean_notes
      )
    );
  end if;

  return v_new;
end;
$$;

revoke all on function public.platform_review_store_onboarding(uuid, text, text) from public;
grant execute on function public.platform_review_store_onboarding(uuid, text, text) to authenticated;

-- 9. RPC: Prévia privada do cardápio (somente dono, editor ou operador autenticado)
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

-- 10. Atualizar get_promotion_conflicts para funcionar também durante pending_setup
create or replace function public.get_promotion_conflicts(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_has_basic boolean;
  v_has_scheduled boolean;
  v_conflicts jsonb;
  v_effective jsonb;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if not public.is_platform_admin(v_uid) and not public.has_store_role(p_store_id, v_uid, null) then
    raise exception 'Acesso negado ao estabelecimento.' using errcode = '42501';
  end if;

  v_has_basic := public.store_has_workspace_feature(p_store_id, 'basic_promotions');
  v_has_scheduled := public.store_has_workspace_feature(p_store_id, 'scheduled_promotions');

  if not v_has_basic and not v_has_scheduled then
    raise exception 'O plano atual do estabelecimento não inclui o recurso de promoções.' using errcode = '42501';
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
      and (
        (pr.schedule_type = 'always' and (v_has_basic or v_has_scheduled))
        or (pr.schedule_type in ('once', 'weekly') and v_has_scheduled)
      )
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
      (a.schedule_type = 'always' or b.schedule_type = 'always')
      or
      (a.schedule_type = 'once' and b.schedule_type = 'once'
        and a.starts_at < b.ends_at and b.starts_at < a.ends_at)
      or
      (a.schedule_type = 'weekly' and b.schedule_type = 'weekly'
        and a.weekdays && b.weekdays
        and a.start_time < b.end_time and b.start_time < a.end_time
        and coalesce(a.valid_from, '-infinity'::date) <= coalesce(b.valid_until, 'infinity'::date)
        and coalesce(b.valid_from, '-infinity'::date) <= coalesce(a.valid_until, 'infinity'::date))
      or
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


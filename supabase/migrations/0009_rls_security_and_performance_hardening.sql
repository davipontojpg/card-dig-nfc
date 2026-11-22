-- ============================================================================
-- Migration 0009: Hardening de Segurança e Performance (RLS, Triggers e FKs)
-- - Revoga EXECUTE público/autenticado em funções de trigger SECURITY DEFINER
-- - Otimiza todas as 33 políticas RLS usando (select auth.uid()) (InitPlan)
-- - Elimina sobreposição de políticas permissivas em SELECT (split FOR ALL -> INSERT/UPDATE/DELETE)
-- - Cria índices cobrindo as 14 foreign keys sem índice
-- ============================================================================

-- 1. Revogar EXECUTE direto em funções de trigger SECURITY DEFINER
revoke all on function public.guard_stores_protected_columns() from public, anon, authenticated;
revoke all on function public.handle_auth_user_sync() from public, anon, authenticated;

-- 2. Recriar políticas RLS otimizadas com (select auth.uid()) e sem sobreposição em SELECT

-- Profiles
drop policy if exists "profiles_select_self_or_admin_or_store_owner" on public.profiles;
create policy "profiles_select_self_or_admin_or_store_owner"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or public.is_platform_admin((select auth.uid()))
  or exists (
    select 1
    from public.store_memberships sm_target
    join public.store_memberships sm_actor on sm_actor.store_id = sm_target.store_id
    where sm_target.user_id = profiles.id
      and sm_actor.user_id = (select auth.uid())
      and sm_actor.role = 'owner'
  )
);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Platform admins
drop policy if exists "platform_admins_select_self_or_active_admin" on public.platform_admins;
create policy "platform_admins_select_self_or_active_admin"
on public.platform_admins for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_platform_admin((select auth.uid()))
);

drop policy if exists "platform_admins_manage_super_admin_only" on public.platform_admins;
drop policy if exists "platform_admins_insert_super_admin_only" on public.platform_admins;
drop policy if exists "platform_admins_update_super_admin_only" on public.platform_admins;
drop policy if exists "platform_admins_delete_super_admin_only" on public.platform_admins;

create policy "platform_admins_insert_super_admin_only"
on public.platform_admins for insert to authenticated
with check (public.is_platform_super_admin((select auth.uid())));

create policy "platform_admins_update_super_admin_only"
on public.platform_admins for update to authenticated
using (public.is_platform_super_admin((select auth.uid())))
with check (public.is_platform_super_admin((select auth.uid())));

create policy "platform_admins_delete_super_admin_only"
on public.platform_admins for delete to authenticated
using (public.is_platform_super_admin((select auth.uid())));

-- Catalog tables: plans
drop policy if exists "plans_write_super_admin" on public.plans;
drop policy if exists "plans_insert_super_admin" on public.plans;
drop policy if exists "plans_update_super_admin" on public.plans;
drop policy if exists "plans_delete_super_admin" on public.plans;

create policy "plans_insert_super_admin"
on public.plans for insert to authenticated
with check (public.is_platform_super_admin((select auth.uid())));

create policy "plans_update_super_admin"
on public.plans for update to authenticated
using (public.is_platform_super_admin((select auth.uid())))
with check (public.is_platform_super_admin((select auth.uid())));

create policy "plans_delete_super_admin"
on public.plans for delete to authenticated
using (public.is_platform_super_admin((select auth.uid())));

-- Catalog tables: feature_catalog
drop policy if exists "feature_catalog_write_super_admin" on public.feature_catalog;
drop policy if exists "feature_catalog_insert_super_admin" on public.feature_catalog;
drop policy if exists "feature_catalog_update_super_admin" on public.feature_catalog;
drop policy if exists "feature_catalog_delete_super_admin" on public.feature_catalog;

create policy "feature_catalog_insert_super_admin"
on public.feature_catalog for insert to authenticated
with check (public.is_platform_super_admin((select auth.uid())));

create policy "feature_catalog_update_super_admin"
on public.feature_catalog for update to authenticated
using (public.is_platform_super_admin((select auth.uid())))
with check (public.is_platform_super_admin((select auth.uid())));

create policy "feature_catalog_delete_super_admin"
on public.feature_catalog for delete to authenticated
using (public.is_platform_super_admin((select auth.uid())));

-- Catalog tables: plan_features
drop policy if exists "plan_features_write_super_admin" on public.plan_features;
drop policy if exists "plan_features_insert_super_admin" on public.plan_features;
drop policy if exists "plan_features_update_super_admin" on public.plan_features;
drop policy if exists "plan_features_delete_super_admin" on public.plan_features;

create policy "plan_features_insert_super_admin"
on public.plan_features for insert to authenticated
with check (public.is_platform_super_admin((select auth.uid())));

create policy "plan_features_update_super_admin"
on public.plan_features for update to authenticated
using (public.is_platform_super_admin((select auth.uid())))
with check (public.is_platform_super_admin((select auth.uid())));

create policy "plan_features_delete_super_admin"
on public.plan_features for delete to authenticated
using (public.is_platform_super_admin((select auth.uid())));

-- Stores
drop policy if exists "stores_select_admin_or_member" on public.stores;
create policy "stores_select_admin_or_member"
on public.stores for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or public.has_store_role(id, (select auth.uid()), null)
);

drop policy if exists "stores_insert_admin_only" on public.stores;
create policy "stores_insert_admin_only"
on public.stores for insert to authenticated
with check (public.is_platform_admin((select auth.uid())));

drop policy if exists "stores_update_admin_or_owner" on public.stores;
create policy "stores_update_admin_or_owner"
on public.stores for update to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or public.has_store_role(id, (select auth.uid()), 'owner')
)
with check (
  public.is_platform_admin((select auth.uid()))
  or public.has_store_role(id, (select auth.uid()), 'owner')
);

drop policy if exists "stores_delete_super_admin_only" on public.stores;
create policy "stores_delete_super_admin_only"
on public.stores for delete to authenticated
using (public.is_platform_super_admin((select auth.uid())));

-- Store Internal Records
drop policy if exists "store_internal_records_admin_only" on public.store_internal_records;
create policy "store_internal_records_admin_only"
on public.store_internal_records for all to authenticated
using (public.is_platform_admin((select auth.uid())))
with check (public.is_platform_admin((select auth.uid())));

-- Store Onboarding Tasks
drop policy if exists "store_onboarding_tasks_admin_only" on public.store_onboarding_tasks;
create policy "store_onboarding_tasks_admin_only"
on public.store_onboarding_tasks for all to authenticated
using (public.is_platform_admin((select auth.uid())))
with check (public.is_platform_admin((select auth.uid())));

-- Store Memberships
drop policy if exists "store_memberships_select_admin_self_or_owner" on public.store_memberships;
create policy "store_memberships_select_admin_self_or_owner"
on public.store_memberships for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or user_id = (select auth.uid())
  or public.has_store_role(store_id, (select auth.uid()), 'owner')
);

drop policy if exists "store_memberships_write_admin_only" on public.store_memberships;
drop policy if exists "store_memberships_insert_admin_only" on public.store_memberships;
drop policy if exists "store_memberships_update_admin_only" on public.store_memberships;
drop policy if exists "store_memberships_delete_admin_only" on public.store_memberships;

create policy "store_memberships_insert_admin_only"
on public.store_memberships for insert to authenticated
with check (public.is_platform_admin((select auth.uid())));

create policy "store_memberships_update_admin_only"
on public.store_memberships for update to authenticated
using (public.is_platform_admin((select auth.uid())))
with check (public.is_platform_admin((select auth.uid())));

create policy "store_memberships_delete_admin_only"
on public.store_memberships for delete to authenticated
using (public.is_platform_admin((select auth.uid())));

-- Store Subscriptions
drop policy if exists "store_subscriptions_select_admin_or_owner" on public.store_subscriptions;
create policy "store_subscriptions_select_admin_or_owner"
on public.store_subscriptions for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or public.has_store_role(store_id, (select auth.uid()), 'owner')
);

drop policy if exists "store_subscriptions_write_admin_only" on public.store_subscriptions;
drop policy if exists "store_subscriptions_insert_admin_only" on public.store_subscriptions;
drop policy if exists "store_subscriptions_update_admin_only" on public.store_subscriptions;
drop policy if exists "store_subscriptions_delete_admin_only" on public.store_subscriptions;

create policy "store_subscriptions_insert_admin_only"
on public.store_subscriptions for insert to authenticated
with check (public.is_platform_admin((select auth.uid())));

create policy "store_subscriptions_update_admin_only"
on public.store_subscriptions for update to authenticated
using (public.is_platform_admin((select auth.uid())))
with check (public.is_platform_admin((select auth.uid())));

create policy "store_subscriptions_delete_admin_only"
on public.store_subscriptions for delete to authenticated
using (public.is_platform_admin((select auth.uid())));

-- Subscription Events & Platform Audit Logs
drop policy if exists "subscription_events_select_admin_only" on public.subscription_events;
create policy "subscription_events_select_admin_only"
on public.subscription_events for select to authenticated
using (public.is_platform_admin((select auth.uid())));

drop policy if exists "subscription_events_insert_admin_only" on public.subscription_events;
create policy "subscription_events_insert_admin_only"
on public.subscription_events for insert to authenticated
with check (public.is_platform_admin((select auth.uid())));

drop policy if exists "platform_audit_logs_select_admin_only" on public.platform_audit_logs;
create policy "platform_audit_logs_select_admin_only"
on public.platform_audit_logs for select to authenticated
using (public.is_platform_admin((select auth.uid())));

drop policy if exists "platform_audit_logs_insert_admin_only" on public.platform_audit_logs;
create policy "platform_audit_logs_insert_admin_only"
on public.platform_audit_logs for insert to authenticated
with check (public.is_platform_admin((select auth.uid())));

-- Categories
drop policy if exists "categories_select_admin_or_member" on public.categories;
create policy "categories_select_admin_or_member"
on public.categories for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or public.has_store_role(store_id, (select auth.uid()), null)
);

drop policy if exists "categories_write_admin_or_editor_with_feature" on public.categories;
drop policy if exists "categories_insert_admin_or_editor_with_feature" on public.categories;
drop policy if exists "categories_update_admin_or_editor_with_feature" on public.categories;
drop policy if exists "categories_delete_admin_or_editor_with_feature" on public.categories;

create policy "categories_insert_admin_or_editor_with_feature"
on public.categories for insert to authenticated
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

create policy "categories_update_admin_or_editor_with_feature"
on public.categories for update to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
)
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

create policy "categories_delete_admin_or_editor_with_feature"
on public.categories for delete to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

-- Products
drop policy if exists "products_select_admin_or_member" on public.products;
create policy "products_select_admin_or_member"
on public.products for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or public.has_store_role(store_id, (select auth.uid()), null)
);

drop policy if exists "products_write_admin_or_editor_with_feature" on public.products;
drop policy if exists "products_insert_admin_or_editor_with_feature" on public.products;
drop policy if exists "products_update_admin_or_editor_with_feature" on public.products;
drop policy if exists "products_delete_admin_or_editor_with_feature" on public.products;

create policy "products_insert_admin_or_editor_with_feature"
on public.products for insert to authenticated
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

create policy "products_update_admin_or_editor_with_feature"
on public.products for update to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
)
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

create policy "products_delete_admin_or_editor_with_feature"
on public.products for delete to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

-- Option Groups
drop policy if exists "option_groups_select_admin_or_member" on public.option_groups;
create policy "option_groups_select_admin_or_member"
on public.option_groups for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or public.has_store_role(store_id, (select auth.uid()), null)
);

drop policy if exists "option_groups_write_admin_or_editor_with_feature" on public.option_groups;
drop policy if exists "option_groups_insert_admin_or_editor_with_feature" on public.option_groups;
drop policy if exists "option_groups_update_admin_or_editor_with_feature" on public.option_groups;
drop policy if exists "option_groups_delete_admin_or_editor_with_feature" on public.option_groups;

create policy "option_groups_insert_admin_or_editor_with_feature"
on public.option_groups for insert to authenticated
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

create policy "option_groups_update_admin_or_editor_with_feature"
on public.option_groups for update to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
)
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

create policy "option_groups_delete_admin_or_editor_with_feature"
on public.option_groups for delete to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

-- Product Options
drop policy if exists "product_options_select_admin_or_member" on public.product_options;
create policy "product_options_select_admin_or_member"
on public.product_options for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or public.has_store_role(store_id, (select auth.uid()), null)
);

drop policy if exists "product_options_write_admin_or_editor_with_feature" on public.product_options;
drop policy if exists "product_options_insert_admin_or_editor_with_feature" on public.product_options;
drop policy if exists "product_options_update_admin_or_editor_with_feature" on public.product_options;
drop policy if exists "product_options_delete_admin_or_editor_with_feature" on public.product_options;

create policy "product_options_insert_admin_or_editor_with_feature"
on public.product_options for insert to authenticated
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

create policy "product_options_update_admin_or_editor_with_feature"
on public.product_options for update to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
)
with check (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

create policy "product_options_delete_admin_or_editor_with_feature"
on public.product_options for delete to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), 'editor')
    and public.store_has_feature(store_id, 'digital_menu')
  )
);

-- Promotions (preservando basic_promotions vs scheduled_promotions da migration 0007)
drop policy if exists "promotions_select_entitled_only" on public.promotions;
create policy "promotions_select_entitled_only"
on public.promotions for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), null)
    and (
      public.store_has_feature(store_id, 'basic_promotions')
      or public.store_has_feature(store_id, 'scheduled_promotions')
    )
  )
);

drop policy if exists "promotions_write_entitled_only" on public.promotions;
drop policy if exists "promotions_insert_entitled_only" on public.promotions;
drop policy if exists "promotions_update_entitled_only" on public.promotions;
drop policy if exists "promotions_delete_entitled_only" on public.promotions;

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
        public.store_has_feature(store_id, 'basic_promotions')
        or public.store_has_feature(store_id, 'scheduled_promotions')
      )
    )
    or (
      schedule_type in ('once', 'weekly')
      and public.store_has_feature(store_id, 'scheduled_promotions')
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
        public.store_has_feature(store_id, 'basic_promotions')
        or public.store_has_feature(store_id, 'scheduled_promotions')
      )
    )
    or (
      schedule_type in ('once', 'weekly')
      and public.store_has_feature(store_id, 'scheduled_promotions')
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
        public.store_has_feature(store_id, 'basic_promotions')
        or public.store_has_feature(store_id, 'scheduled_promotions')
      )
    )
    or (
      schedule_type in ('once', 'weekly')
      and public.store_has_feature(store_id, 'scheduled_promotions')
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
        public.store_has_feature(store_id, 'basic_promotions')
        or public.store_has_feature(store_id, 'scheduled_promotions')
      )
    )
    or (
      schedule_type in ('once', 'weekly')
      and public.store_has_feature(store_id, 'scheduled_promotions')
    )
  )
);

-- Promotion Products
drop policy if exists "promotion_products_select_entitled_only" on public.promotion_products;
create policy "promotion_products_select_entitled_only"
on public.promotion_products for select to authenticated
using (
  public.is_platform_admin((select auth.uid()))
  or (
    public.has_store_role(store_id, (select auth.uid()), null)
    and (
      public.store_has_feature(store_id, 'basic_promotions')
      or public.store_has_feature(store_id, 'scheduled_promotions')
    )
  )
);

drop policy if exists "promotion_products_write_entitled_only" on public.promotion_products;
drop policy if exists "promotion_products_insert_entitled_only" on public.promotion_products;
drop policy if exists "promotion_products_update_entitled_only" on public.promotion_products;
drop policy if exists "promotion_products_delete_entitled_only" on public.promotion_products;

create policy "promotion_products_insert_entitled_only"
on public.promotion_products for insert to authenticated
with check (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and (
    public.store_has_feature(store_id, 'basic_promotions')
    or public.store_has_feature(store_id, 'scheduled_promotions')
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
    public.store_has_feature(store_id, 'basic_promotions')
    or public.store_has_feature(store_id, 'scheduled_promotions')
  )
)
with check (
  (
    public.is_platform_admin((select auth.uid()))
    or public.has_store_role(store_id, (select auth.uid()), 'editor')
  )
  and (
    public.store_has_feature(store_id, 'basic_promotions')
    or public.store_has_feature(store_id, 'scheduled_promotions')
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
    public.store_has_feature(store_id, 'basic_promotions')
    or public.store_has_feature(store_id, 'scheduled_promotions')
  )
);

-- 3. Índices cobrindo todas as 14 foreign keys sem índice
create index if not exists idx_option_groups_product_store
  on public.option_groups (product_id, store_id);

create index if not exists idx_plan_features_feature_key
  on public.plan_features (feature_key);

create index if not exists idx_platform_admins_created_by
  on public.platform_admins (created_by);

create index if not exists idx_platform_audit_logs_actor_user_id
  on public.platform_audit_logs (actor_user_id);

create index if not exists idx_product_options_option_group_store
  on public.product_options (option_group_id, store_id);

create index if not exists idx_products_category_store
  on public.products (category_id, store_id);

create index if not exists idx_promotion_products_product_store
  on public.promotion_products (product_id, store_id);

create index if not exists idx_promotion_products_promotion_store
  on public.promotion_products (promotion_id, store_id);

create index if not exists idx_store_onboarding_tasks_updated_by
  on public.store_onboarding_tasks (updated_by);

create index if not exists idx_store_subscriptions_plan_id
  on public.store_subscriptions (plan_id);

create index if not exists idx_store_subscriptions_updated_by
  on public.store_subscriptions (updated_by);

create index if not exists idx_stores_created_by_platform_admin
  on public.stores (created_by_platform_admin);

create index if not exists idx_subscription_events_actor_user_id
  on public.subscription_events (actor_user_id);

create index if not exists idx_subscription_events_subscription_id
  on public.subscription_events (subscription_id);

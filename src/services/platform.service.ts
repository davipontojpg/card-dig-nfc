import { supabase } from '../lib/supabase';
import type {
  Database,
  OnboardingStatus,
  OnboardingTaskStatus,
  PlatformAdminRole,
} from '../types/database';
import type {
  OnboardingTaskRow,
  PlanWithFeatures,
  PlatformAdminRow,
  PlatformAuditLogRow,
  PlatformDashboardMetrics,
  PlatformStoreListItem,
  ProfileRow,
  StoreInternalRecordRow,
  StoreMembershipRow,
  StoreRow,
  StoreSubscriptionRow,
  SubscriptionEventRow,
} from '../types/domain';

export interface PlatformStoreDetail {
  store: StoreRow;
  internal: StoreInternalRecordRow | null;
  subscription: StoreSubscriptionRow | null;
  plan: PlanWithFeatures | null;
  onboardingTasks: OnboardingTaskRow[];
  subscriptionEvents: SubscriptionEventRow[];
  auditLogs: PlatformAuditLogRow[];
  memberships: Array<StoreMembershipRow & { profile: ProfileRow | null }>;
  menuStats: {
    categoriesCount: number;
    productsCount: number;
    activeProductsCount: number;
  };
}

export const platformService = {
  async getDashboardMetrics(): Promise<PlatformDashboardMetrics> {
    const { data, error } = await supabase.rpc('platform_dashboard_metrics');
    if (error) throw error;
    return data as unknown as PlatformDashboardMetrics;
  },

  async listPlans(): Promise<PlanWithFeatures[]> {
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('*')
      .order('display_order', { ascending: true });
    if (plansError) throw plansError;

    const { data: planFeatures, error: pfError } = await supabase
      .from('plan_features')
      .select('plan_id, feature_key');
    if (pfError) throw pfError;

    const { data: catalog, error: catError } = await supabase
      .from('feature_catalog')
      .select('*')
      .eq('is_active', true);
    if (catError) throw catError;

    const catalogMap = new Map(catalog.map((f) => [f.feature_key, f]));
    return plans.map((plan) => ({
      ...plan,
      monthly_price: Number(plan.monthly_price),
      setup_fee: Number(plan.setup_fee),
      features: planFeatures
        .filter((pf) => pf.plan_id === plan.id)
        .map((pf) => catalogMap.get(pf.feature_key))
        .filter((f): f is NonNullable<typeof f> => Boolean(f)),
    }));
  },

  async listStores(): Promise<PlatformStoreListItem[]> {
    const [storesRes, internalsRes, subsRes, plansRes] = await Promise.all([
      supabase.from('stores').select('*').order('created_at', { ascending: false }),
      supabase.from('store_internal_records').select('*'),
      supabase.from('store_subscriptions').select('*'),
      supabase.from('plans').select('*'),
    ]);

    if (storesRes.error) throw storesRes.error;
    if (internalsRes.error) throw internalsRes.error;
    if (subsRes.error) throw subsRes.error;
    if (plansRes.error) throw plansRes.error;

    const internalByStore = new Map(internalsRes.data.map((i) => [i.store_id, i]));
    const subByStore = new Map(subsRes.data.map((s) => [s.store_id, s]));
    const planById = new Map(plansRes.data.map((p) => [p.id, p]));

    return storesRes.data.map((store) => {
      const sub = subByStore.get(store.id) ?? null;
      const plan = sub ? (planById.get(sub.plan_id) ?? null) : null;
      return {
        store,
        internal: internalByStore.get(store.id) ?? null,
        subscription: sub
          ? {
              ...sub,
              monthly_price_snapshot: Number(sub.monthly_price_snapshot),
              setup_fee_snapshot: Number(sub.setup_fee_snapshot),
            }
          : null,
        plan: plan
          ? {
              ...plan,
              monthly_price: Number(plan.monthly_price),
              setup_fee: Number(plan.setup_fee),
            }
          : null,
      };
    });
  },

  async getStoreDetail(storeId: string): Promise<PlatformStoreDetail> {
    const [
      storeRes,
      internalRes,
      subRes,
      plans,
      tasksRes,
      eventsRes,
      logsRes,
      membersRes,
      categoriesCountRes,
      productsCountRes,
      activeProductsCountRes,
    ] = await Promise.all([
      supabase.from('stores').select('*').eq('id', storeId).single(),
      supabase.from('store_internal_records').select('*').eq('store_id', storeId).maybeSingle(),
      supabase.from('store_subscriptions').select('*').eq('store_id', storeId).maybeSingle(),
      this.listPlans(),
      supabase
        .from('store_onboarding_tasks')
        .select('*')
        .eq('store_id', storeId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('subscription_events')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false }),
      supabase
        .from('platform_audit_logs')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('store_memberships').select('*').eq('store_id', storeId),
      supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('is_active', true),
    ]);

    if (storeRes.error) throw storeRes.error;
    if (internalRes.error) throw internalRes.error;
    if (subRes.error) throw subRes.error;
    if (tasksRes.error) throw tasksRes.error;
    if (eventsRes.error) throw eventsRes.error;
    if (logsRes.error) throw logsRes.error;
    if (membersRes.error) throw membersRes.error;

    const userIds = membersRes.data.map((m) => m.user_id);
    let profilesById = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      const profilesRes = await supabase.from('profiles').select('*').in('id', userIds);
      if (profilesRes.error) throw profilesRes.error;
      profilesById = new Map(profilesRes.data.map((p) => [p.id, p]));
    }

    const sub = subRes.data
      ? {
          ...subRes.data,
          monthly_price_snapshot: Number(subRes.data.monthly_price_snapshot),
          setup_fee_snapshot: Number(subRes.data.setup_fee_snapshot),
        }
      : null;

    const plan = sub ? (plans.find((p) => p.id === sub.plan_id) ?? null) : null;

    return {
      store: storeRes.data,
      internal: internalRes.data,
      subscription: sub,
      plan,
      onboardingTasks: tasksRes.data,
      subscriptionEvents: eventsRes.data,
      auditLogs: logsRes.data,
      memberships: membersRes.data.map((m) => ({
        ...m,
        profile: profilesById.get(m.user_id) ?? null,
      })),
      menuStats: {
        categoriesCount: categoriesCountRes.count ?? 0,
        productsCount: productsCountRes.count ?? 0,
        activeProductsCount: activeProductsCountRes.count ?? 0,
      },
    };
  },

  async checkSlugAvailability(slug: string, excludeStoreId?: string | null): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_slug_availability', {
      p_slug: slug,
      p_exclude_store_id: excludeStoreId ?? null,
    });
    if (error) throw error;
    return Boolean(data);
  },

  async updateStoreDetails(
    storeId: string,
    storeUpdates: Database['public']['Tables']['stores']['Update'],
    internalUpdates: Omit<Database['public']['Tables']['store_internal_records']['Update'], 'store_id'>
  ): Promise<void> {
    const [storeRes, internalRes] = await Promise.all([
      supabase.from('stores').update(storeUpdates).eq('id', storeId),
      supabase
        .from('store_internal_records')
        .upsert({ store_id: storeId, ...internalUpdates }, { onConflict: 'store_id' }),
    ]);

    if (storeRes.error) throw storeRes.error;
    if (internalRes.error) throw internalRes.error;
  },

  async updateStoreLifecycle(
    storeId: string,
    lifecycleStatus: StoreRow['lifecycle_status'],
    reason?: string | null
  ): Promise<StoreRow> {
    const { data, error } = await supabase.rpc('platform_update_store_lifecycle', {
      p_store_id: storeId,
      p_lifecycle_status: lifecycleStatus,
      p_reason: reason ?? null,
    });
    if (error) throw error;
    return data;
  },

  async updateOnboardingStatus(storeId: string, status: OnboardingStatus): Promise<void> {
    const { error } = await supabase
      .from('stores')
      .update({ onboarding_status: status })
      .eq('id', storeId);
    if (error) throw error;
  },

  async updateOnboardingTask(
    taskId: string,
    status: OnboardingTaskStatus,
    notes: string | null
  ): Promise<void> {
    const { error } = await supabase
      .from('store_onboarding_tasks')
      .update({
        status,
        notes,
        completed_at: status === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', taskId);
    if (error) throw error;
  },

  async listPlatformAdmins(): Promise<Array<PlatformAdminRow & { profile: ProfileRow | null }>> {
    const { data, error } = await supabase
      .from('platform_admins')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const userIds = data.map((a) => a.user_id);
    if (userIds.length === 0) return [];
    const profilesRes = await supabase.from('profiles').select('*').in('id', userIds);
    if (profilesRes.error) throw profilesRes.error;
    const profilesById = new Map(profilesRes.data.map((p) => [p.id, p]));

    return data.map((admin) => ({
      ...admin,
      profile: profilesById.get(admin.user_id) ?? null,
    }));
  },

  async findProfileByEmail(email: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async managePlatformAdmin(
    targetUserId: string,
    role: PlatformAdminRole,
    isActive: boolean
  ): Promise<PlatformAdminRow> {
    const { data, error } = await supabase.rpc('platform_manage_admin', {
      p_target_user_id: targetUserId,
      p_role: role,
      p_is_active: isActive,
    });
    if (error) throw error;
    return data;
  },
};

import type {
  Database,
  FeatureKey,
  OnboardingStatus,
  PlatformAdminRole,
  PromotionDiscountType,
  PromotionScheduleType,
  SetupFeeStatus,
  StoreLifecycleStatus,
  StoreMemberRole,
  SubscriptionStatus,
} from './database';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type PlatformAdminRow = Database['public']['Tables']['platform_admins']['Row'];
export type StoreRow = Database['public']['Tables']['stores']['Row'];
export type StoreInternalRecordRow = Database['public']['Tables']['store_internal_records']['Row'];
export type StoreMembershipRow = Database['public']['Tables']['store_memberships']['Row'];
export type PlanRow = Database['public']['Tables']['plans']['Row'];
export type FeatureCatalogRow = Database['public']['Tables']['feature_catalog']['Row'];
export type StoreSubscriptionRow = Database['public']['Tables']['store_subscriptions']['Row'];
export type SubscriptionEventRow = Database['public']['Tables']['subscription_events']['Row'];
export type OnboardingTaskRow = Database['public']['Tables']['store_onboarding_tasks']['Row'];
export type PlatformAuditLogRow = Database['public']['Tables']['platform_audit_logs']['Row'];
export type CategoryRow = Database['public']['Tables']['categories']['Row'];
export type ProductRow = Database['public']['Tables']['products']['Row'];
export type ProductVariantRow = Database['public']['Tables']['product_variants']['Row'];
export type OptionGroupRow = Database['public']['Tables']['option_groups']['Row'];
export type ProductOptionRow = Database['public']['Tables']['product_options']['Row'];
export type PromotionRow = Database['public']['Tables']['promotions']['Row'];
export type PromotionProductRow = Database['public']['Tables']['promotion_products']['Row'];
export type PromotionBundleRow = Database['public']['Tables']['promotion_bundles']['Row'];
export type PromotionBundleItemRow = Database['public']['Tables']['promotion_bundle_items']['Row'];

export interface WorkspaceMembership {
  store_id: string;
  store_name: string;
  slug: string;
  role: StoreMemberRole;
  lifecycle_status: StoreLifecycleStatus;
  subscription_status: SubscriptionStatus;
  plan_code: string;
  plan_name: string;
  has_service_access: boolean;
  can_edit_workspace?: boolean;
  features: FeatureKey[];
}

export interface WorkspaceContext {
  user_id: string;
  email: string | null;
  full_name: string | null;
  is_platform_admin: boolean;
  platform_role: PlatformAdminRole | null;
  memberships: WorkspaceMembership[];
}

export interface StoreAccessContext {
  store: StoreRow;
  role: StoreMemberRole | 'platform_admin';
  subscription: {
    id: string;
    plan_id: string;
    plan_code: string;
    plan_name: string;
    status: SubscriptionStatus;
    monthly_price_snapshot: number | null;
    setup_fee_snapshot: number | null;
    setup_fee_status: SetupFeeStatus | null;
    started_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    next_billing_at: string | null;
    last_payment_at: string | null;
    grace_until: string | null;
  };
  has_service_access: boolean;
  can_edit_workspace?: boolean;
  features: FeatureKey[];
}

export interface PlanWithFeatures extends PlanRow {
  features: FeatureCatalogRow[];
}

export interface PlatformStoreListItem {
  store: StoreRow;
  internal: StoreInternalRecordRow | null;
  subscription: StoreSubscriptionRow | null;
  plan: PlanRow | null;
}

export interface PlatformDashboardMetrics {
  total_stores: number;
  by_lifecycle: Record<StoreLifecycleStatus, number>;
  by_subscription_status: Record<SubscriptionStatus, number>;
  by_plan: Array<{
    plan_code: string;
    plan_name: string;
    count: number;
  }>;
  estimated_mrr: number;
  active_billing_subscriptions_count: number;
  pending_onboarding_count: number;
  upcoming_billings: Array<{
    store_id: string;
    store_name: string;
    slug: string;
    plan_name: string;
    next_billing_at: string;
    monthly_price_snapshot: number;
    status: SubscriptionStatus;
  }>;
}

export interface PublicOptionItem {
  id: string;
  name: string;
  description: string | null;
  extra_price: number;
  sort_order: number;
}

export interface PublicOptionGroup {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  min_selection: number;
  max_selection: number;
  sort_order: number;
  options: PublicOptionItem[];
}

export interface PublicAppliedPromotion {
  promotion_id: string;
  name: string;
  description: string | null;
  discount_type: PromotionDiscountType;
  discount_value: number;
  original_price: number;
  promotional_price: number;
  schedule_type: PromotionScheduleType;
}

export interface PublicProductVariant {
  id: string;
  name: string;
  is_available: boolean;
  sort_order: number;
}

export interface PublicMenuProduct {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_path: string | null;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
  variant_label?: string | null;
  variants?: PublicProductVariant[];
  promotion: PublicAppliedPromotion | null;
  option_groups: PublicOptionGroup[];
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  products: PublicMenuProduct[];
}

export interface PublicHighlightedProduct {
  product_id: string;
  name: string;
  original_price: number;
  promotional_price: number;
  image_path: string | null;
}

export interface PublicMenuBundleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  image_path: string | null;
}

export interface PublicMenuBundle {
  id: string;
  name: string;
  description: string | null;
  regular_total: number;
  promo_price: number;
  highlight_top: boolean;
  items: PublicMenuBundleItem[];
}

export interface PublicMenuResponse {
  status: 'ok' | 'not_found' | 'unpublished' | 'unavailable';
  is_preview?: boolean;
  lifecycle_status?: StoreLifecycleStatus;
  is_published?: boolean;
  evaluated_at?: string;
  store?: {
    id: string;
    name: string;
    slug: string;
    business_type: string | null;
    description: string | null;
    logo_path: string | null;
    primary_color: string;
    public_phone: string | null;
    public_address: string | null;
    timezone: string;
  };
  features?: {
    digital_menu: boolean;
    qr_code: boolean;
    basic_promotions?: boolean;
    scheduled_promotions: boolean;
  };
  categories?: PublicMenuCategory[];
  active_promotions?: Array<{
    promotion_id: string;
    name: string;
    description: string | null;
    schedule_type: PromotionScheduleType;
    ends_at: string | null;
    end_time: string | null;
  }>;
  highlighted_products?: PublicHighlightedProduct[];
  bundles?: PublicMenuBundle[];
}

export interface PromotionBundleWithItems extends PromotionBundleRow {
  items: Array<
    PromotionBundleItemRow & {
      product?: Pick<ProductRow, 'id' | 'name' | 'price' | 'is_active' | 'is_available' | 'image_path'>;
    }
  >;
}

export interface PromotionWithProducts extends PromotionRow {
  promotion_products: Array<
    PromotionProductRow & {
      product?: Pick<ProductRow, 'id' | 'name' | 'price' | 'is_active' | 'is_available'>;
    }
  >;
}

export interface PromotionConflictItem {
  product_id: string;
  product_name: string;
  winning_promotion_id: string;
  winning_promotion_name: string;
  conflicting_promotion_id: string;
  conflicting_promotion_name: string;
  reason: string;
}

export interface PromotionConflictReport {
  conflicts: PromotionConflictItem[];
  effective_now: Array<{
    product_id: string;
    promotion_id: string;
    promotion_name: string;
    promotional_price: number;
  }>;
}

export interface ProvisionStorePayload {
  name: string;
  slug: string;
  business_type?: string | null;
  description?: string | null;
  public_phone?: string | null;
  public_address?: string | null;
  primary_color: string;
  timezone: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string | null;
  internal_notes?: string | null;
  plan_id: string;
  subscription_status: SubscriptionStatus;
  setup_fee_status: SetupFeeStatus;
  started_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  next_billing_at?: string | null;
  onboarding_status: OnboardingStatus;
}

export interface ProvisionStoreResult {
  store_id: string;
  slug: string;
  owner_invite_status: 'sent' | 'failed' | 'not_sent';
  requires_existing_user_confirmation: boolean;
  message: string;
}


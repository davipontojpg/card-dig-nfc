export type PlatformAdminRole = 'super_admin' | 'operator';
export type StoreMemberRole = 'owner' | 'editor';
export type StoreLifecycleStatus = 'pending_setup' | 'active' | 'suspended' | 'archived';
export type OnboardingStatus = 'pending_data' | 'in_setup' | 'awaiting_client' | 'ready' | 'completed';
export type OnboardingTaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled';
export type SetupFeeStatus = 'pending' | 'paid' | 'waived';
export type OwnerInviteStatus = 'not_sent' | 'sent' | 'failed' | 'accepted' | 'linked_existing';
export type PromotionScheduleType = 'always' | 'once' | 'weekly';
export type PromotionDiscountType = 'percent_off' | 'amount_off' | 'fixed_price';
export type FeatureKey =
  | 'digital_menu'
  | 'qr_code'
  | 'nfc_access'
  | 'basic_promotions'
  | 'scheduled_promotions'
  | (string & {});

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
          role: PlatformAdminRole;
          is_active: boolean;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          user_id: string;
          role: PlatformAdminRole;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          role?: PlatformAdminRole;
          is_active?: boolean;
        };
        Relationships: [];
      };
      stores: {
        Row: {
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
          is_published: boolean;
          lifecycle_status: StoreLifecycleStatus;
          onboarding_status: OnboardingStatus;
          onboarding_review_notes: string | null;
          onboarding_submitted_at: string | null;
          created_by_platform_admin: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          business_type?: string | null;
          description?: string | null;
          logo_path?: string | null;
          primary_color?: string;
          public_phone?: string | null;
          public_address?: string | null;
          timezone?: string;
          is_published?: boolean;
          lifecycle_status?: StoreLifecycleStatus;
          onboarding_status?: OnboardingStatus;
          onboarding_review_notes?: string | null;
          onboarding_submitted_at?: string | null;
          created_by_platform_admin?: string | null;
        };
        Update: {
          name?: string;
          slug?: string;
          business_type?: string | null;
          description?: string | null;
          logo_path?: string | null;
          primary_color?: string;
          public_phone?: string | null;
          public_address?: string | null;
          timezone?: string;
          is_published?: boolean;
          lifecycle_status?: StoreLifecycleStatus;
          onboarding_status?: OnboardingStatus;
          onboarding_review_notes?: string | null;
          onboarding_submitted_at?: string | null;
        };
        Relationships: [];
      };
      store_internal_records: {
        Row: {
          store_id: string;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          internal_notes: string | null;
          subscription_internal_notes: string | null;
          owner_invite_status: OwnerInviteStatus;
          owner_invited_at: string | null;
          owner_invite_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          store_id: string;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          internal_notes?: string | null;
          subscription_internal_notes?: string | null;
          owner_invite_status?: OwnerInviteStatus;
          owner_invited_at?: string | null;
          owner_invite_error?: string | null;
        };
        Update: {
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          internal_notes?: string | null;
          subscription_internal_notes?: string | null;
          owner_invite_status?: OwnerInviteStatus;
          owner_invited_at?: string | null;
          owner_invite_error?: string | null;
        };
        Relationships: [];
      };
      store_memberships: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          role: StoreMemberRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          role: StoreMemberRole;
        };
        Update: {
          role?: StoreMemberRole;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          monthly_price: number;
          setup_fee: number;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          monthly_price: number;
          setup_fee: number;
          is_active?: boolean;
          display_order?: number;
        };
        Update: {
          name?: string;
          description?: string | null;
          monthly_price?: number;
          setup_fee?: number;
          is_active?: boolean;
          display_order?: number;
        };
        Relationships: [];
      };
      feature_catalog: {
        Row: {
          feature_key: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          feature_key: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      plan_features: {
        Row: {
          plan_id: string;
          feature_key: string;
        };
        Insert: {
          plan_id: string;
          feature_key: string;
        };
        Update: {
          plan_id?: string;
          feature_key?: string;
        };
        Relationships: [];
      };
      store_subscriptions: {
        Row: {
          id: string;
          store_id: string;
          plan_id: string;
          status: SubscriptionStatus;
          monthly_price_snapshot: number;
          setup_fee_snapshot: number;
          setup_fee_status: SetupFeeStatus;
          started_at: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          next_billing_at: string | null;
          last_payment_at: string | null;
          grace_until: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          plan_id: string;
          status?: SubscriptionStatus;
          monthly_price_snapshot: number;
          setup_fee_snapshot: number;
          setup_fee_status?: SetupFeeStatus;
          started_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          next_billing_at?: string | null;
          last_payment_at?: string | null;
          grace_until?: string | null;
          updated_by?: string | null;
        };
        Update: {
          plan_id?: string;
          status?: SubscriptionStatus;
          monthly_price_snapshot?: number;
          setup_fee_snapshot?: number;
          setup_fee_status?: SetupFeeStatus;
          started_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          next_billing_at?: string | null;
          last_payment_at?: string | null;
          grace_until?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      subscription_events: {
        Row: {
          id: string;
          store_id: string;
          subscription_id: string | null;
          actor_user_id: string | null;
          event_type: string;
          old_values: Json | null;
          new_values: Json | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          subscription_id?: string | null;
          actor_user_id?: string | null;
          event_type: string;
          old_values?: Json | null;
          new_values?: Json | null;
          reason?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      store_onboarding_tasks: {
        Row: {
          id: string;
          store_id: string;
          task_key: string;
          title: string;
          status: OnboardingTaskStatus;
          notes: string | null;
          sort_order: number;
          completed_at: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          task_key: string;
          title: string;
          status?: OnboardingTaskStatus;
          notes?: string | null;
          sort_order?: number;
          completed_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          title?: string;
          status?: OnboardingTaskStatus;
          notes?: string | null;
          sort_order?: number;
          completed_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      platform_audit_logs: {
        Row: {
          id: string;
          actor_user_id: string;
          store_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id: string;
          store_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json | null;
        };
        Update: never;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          description: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          category_id: string;
          name: string;
          description: string | null;
          price: number;
          image_path: string | null;
          is_active: boolean;
          is_available: boolean;
          is_featured: boolean;
          sort_order: number;
          variant_label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          category_id: string;
          name: string;
          description?: string | null;
          price: number;
          image_path?: string | null;
          is_active?: boolean;
          is_available?: boolean;
          is_featured?: boolean;
          sort_order?: number;
          variant_label?: string | null;
        };
        Update: {
          category_id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          image_path?: string | null;
          is_active?: boolean;
          is_available?: boolean;
          is_featured?: boolean;
          sort_order?: number;
          variant_label?: string | null;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          name: string;
          is_available: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          name: string;
          is_available?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          is_available?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      option_groups: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          name: string;
          description: string | null;
          is_required: boolean;
          min_selection: number;
          max_selection: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          name: string;
          description?: string | null;
          is_required?: boolean;
          min_selection?: number;
          max_selection?: number;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_required?: boolean;
          min_selection?: number;
          max_selection?: number;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      product_options: {
        Row: {
          id: string;
          store_id: string;
          option_group_id: string;
          name: string;
          description: string | null;
          extra_price: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          option_group_id: string;
          name: string;
          description?: string | null;
          extra_price?: number;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          extra_price?: number;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      promotions: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          description: string | null;
          schedule_type: PromotionScheduleType;
          discount_type: PromotionDiscountType;
          discount_value: number;
          starts_at: string | null;
          ends_at: string | null;
          weekdays: number[] | null;
          start_time: string | null;
          end_time: string | null;
          valid_from: string | null;
          valid_until: string | null;
          priority: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          description?: string | null;
          schedule_type: PromotionScheduleType;
          discount_type: PromotionDiscountType;
          discount_value: number;
          starts_at?: string | null;
          ends_at?: string | null;
          weekdays?: number[] | null;
          start_time?: string | null;
          end_time?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          priority?: number;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          schedule_type?: PromotionScheduleType;
          discount_type?: PromotionDiscountType;
          discount_value?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          weekdays?: number[] | null;
          start_time?: string | null;
          end_time?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          priority?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      promotion_products: {
        Row: {
          id: string;
          store_id: string;
          promotion_id: string;
          product_id: string;
          discount_type_override: PromotionDiscountType | null;
          discount_value_override: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          promotion_id: string;
          product_id: string;
          discount_type_override?: PromotionDiscountType | null;
          discount_value_override?: number | null;
        };
        Update: {
          discount_type_override?: PromotionDiscountType | null;
          discount_value_override?: number | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_platform_admin: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      is_platform_super_admin: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      has_store_role: {
        Args: { p_store_id: string; p_user_id?: string; p_required_role?: string | null };
        Returns: boolean;
      };
      store_has_service_access: {
        Args: { p_store_id: string; p_at?: string };
        Returns: boolean;
      };
      store_can_edit_workspace: {
        Args: { p_store_id: string; p_at?: string };
        Returns: boolean;
      };
      store_has_feature: {
        Args: { p_store_id: string; p_feature_key: string; p_at?: string };
        Returns: boolean;
      };
      store_has_workspace_feature: {
        Args: { p_store_id: string; p_feature_key: string; p_at?: string };
        Returns: boolean;
      };
      store_submit_onboarding_review: {
        Args: { p_store_id: string };
        Returns: Database['public']['Tables']['stores']['Row'];
      };
      platform_review_store_onboarding: {
        Args: { p_store_id: string; p_decision: string; p_notes?: string | null };
        Returns: Database['public']['Tables']['stores']['Row'];
      };
      get_store_menu_preview: {
        Args: { p_slug: string };
        Returns: Json;
      };
      get_my_workspaces: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_store_access_context: {
        Args: { p_store_id: string };
        Returns: Json;
      };
      check_slug_availability: {
        Args: { p_slug: string; p_exclude_store_id?: string | null };
        Returns: boolean;
      };
      platform_dashboard_metrics: {
        Args: Record<string, never>;
        Returns: Json;
      };
      platform_update_subscription: {
        Args: {
          p_store_id: string;
          p_plan_id: string;
          p_status: string;
          p_setup_fee_status: string;
          p_monthly_price_snapshot?: number | null;
          p_setup_fee_snapshot?: number | null;
          p_started_at?: string | null;
          p_current_period_start?: string | null;
          p_current_period_end?: string | null;
          p_next_billing_at?: string | null;
          p_last_payment_at?: string | null;
          p_grace_until?: string | null;
          p_subscription_internal_notes?: string | null;
          p_reason?: string | null;
        };
        Returns: Database['public']['Tables']['store_subscriptions']['Row'];
      };
      platform_update_store_lifecycle: {
        Args: {
          p_store_id: string;
          p_lifecycle_status: string;
          p_reason?: string | null;
        };
        Returns: Database['public']['Tables']['stores']['Row'];
      };
      platform_manage_admin: {
        Args: {
          p_target_user_id: string;
          p_role: string;
          p_is_active: boolean;
        };
        Returns: Database['public']['Tables']['platform_admins']['Row'];
      };
      get_promotion_conflicts: {
        Args: { p_store_id: string };
        Returns: Json;
      };
      get_public_menu: {
        Args: { p_slug: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}


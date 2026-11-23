import { supabase } from '../lib/supabase';
import type { StoreAccessContext, StoreRow } from '../types/domain';

export const storesService = {
  async getStoreAccessContext(storeId: string): Promise<StoreAccessContext> {
    const { data, error } = await supabase.rpc('get_store_access_context', {
      p_store_id: storeId,
    });
    if (error) throw error;
    return data as unknown as StoreAccessContext;
  },

  async updateAppearance(
    storeId: string,
    updates: Pick<
      StoreRow,
      | 'name'
      | 'slug'
      | 'business_type'
      | 'description'
      | 'logo_path'
      | 'primary_color'
      | 'public_phone'
      | 'public_address'
      | 'timezone'
      | 'is_published'
    >
  ): Promise<StoreRow> {
    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', storeId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async checkSlugAvailability(slug: string, excludeStoreId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_slug_availability', {
      p_slug: slug,
      p_exclude_store_id: excludeStoreId,
    });
    if (error) throw error;
    return Boolean(data);
  },

  async submitOnboardingReview(storeId: string): Promise<StoreRow> {
    const { data, error } = await supabase.rpc('store_submit_onboarding_review', {
      p_store_id: storeId,
    });
    if (error) throw error;
    return data;
  },
};


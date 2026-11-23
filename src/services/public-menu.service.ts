import { supabase } from '../lib/supabase';
import type { PublicMenuResponse } from '../types/domain';

export const publicMenuService = {
  async getBySlug(slug: string): Promise<PublicMenuResponse> {
    const { data, error } = await supabase.rpc('get_public_menu', {
      p_slug: slug.trim().toLowerCase(),
    });
    if (error) throw error;
    return data as unknown as PublicMenuResponse;
  },

  async getPreviewBySlug(slug: string): Promise<PublicMenuResponse> {
    const { data, error } = await supabase.rpc('get_store_menu_preview', {
      p_slug: slug.trim().toLowerCase(),
    });
    if (error) throw error;
    return data as unknown as PublicMenuResponse;
  },
};


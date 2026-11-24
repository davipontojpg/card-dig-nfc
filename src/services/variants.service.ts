import { supabase } from '../lib/supabase';
import type { ProductVariantRow } from '../types/domain';

export const variantsService = {
  async listByStore(storeId: string): Promise<ProductVariantRow[]> {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return data;
  },

  async listByProduct(storeId: string, productId: string): Promise<ProductVariantRow[]> {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('store_id', storeId)
      .eq('product_id', productId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return data;
  },

  async create(
    storeId: string,
    productId: string,
    payload: { name: string; is_available?: boolean; sort_order?: number }
  ): Promise<ProductVariantRow> {
    const { data, error } = await supabase
      .from('product_variants')
      .insert({
        store_id: storeId,
        product_id: productId,
        name: payload.name.trim(),
        is_available: payload.is_available ?? true,
        sort_order: payload.sort_order ?? 0,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(
    variantId: string,
    storeId: string,
    payload: Partial<Pick<ProductVariantRow, 'name' | 'is_available' | 'sort_order'>>
  ): Promise<ProductVariantRow> {
    const { data, error } = await supabase
      .from('product_variants')
      .update({
        ...payload,
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      })
      .eq('id', variantId)
      .eq('store_id', storeId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(variantId: string, storeId: string): Promise<void> {
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', variantId)
      .eq('store_id', storeId);
    if (error) throw error;
  },
};

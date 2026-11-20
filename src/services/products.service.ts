import { supabase } from '../lib/supabase';
import type { ProductRow } from '../types/domain';

export const productsService = {
  async listByStore(storeId: string): Promise<ProductRow[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return data.map((p) => ({ ...p, price: Number(p.price) }));
  },

  async create(
    storeId: string,
    payload: Pick<
      ProductRow,
      | 'category_id'
      | 'name'
      | 'description'
      | 'price'
      | 'image_path'
      | 'is_active'
      | 'is_available'
      | 'is_featured'
      | 'sort_order'
    >
  ): Promise<ProductRow> {
    const { data, error } = await supabase
      .from('products')
      .insert({
        store_id: storeId,
        ...payload,
      })
      .select('*')
      .single();
    if (error) throw error;
    return { ...data, price: Number(data.price) };
  },

  async update(
    productId: string,
    storeId: string,
    payload: Partial<
      Pick<
        ProductRow,
        | 'category_id'
        | 'name'
        | 'description'
        | 'price'
        | 'image_path'
        | 'is_active'
        | 'is_available'
        | 'is_featured'
        | 'sort_order'
      >
    >
  ): Promise<ProductRow> {
    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', productId)
      .eq('store_id', storeId)
      .select('*')
      .single();
    if (error) throw error;
    return { ...data, price: Number(data.price) };
  },

  async remove(productId: string, storeId: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('store_id', storeId);
    if (error) throw error;
  },
};


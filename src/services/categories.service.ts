import { supabase } from '../lib/supabase';
import type { CategoryRow } from '../types/domain';

export interface CategoryWithCount extends CategoryRow {
  productCount: number;
  activeProductCount: number;
}

export const categoriesService = {
  async listByStore(storeId: string): Promise<CategoryWithCount[]> {
    const [catRes, prodRes] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('store_id', storeId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase.from('products').select('id, category_id, is_active').eq('store_id', storeId),
    ]);

    if (catRes.error) throw catRes.error;
    if (prodRes.error) throw prodRes.error;

    return catRes.data.map((cat) => {
      const related = prodRes.data.filter((p) => p.category_id === cat.id);
      return {
        ...cat,
        productCount: related.length,
        activeProductCount: related.filter((p) => p.is_active).length,
      };
    });
  },

  async create(
    storeId: string,
    payload: Pick<CategoryRow, 'name' | 'description' | 'sort_order' | 'is_active'>
  ): Promise<CategoryRow> {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        store_id: storeId,
        name: payload.name,
        description: payload.description ?? null,
        sort_order: payload.sort_order,
        is_active: payload.is_active,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(
    categoryId: string,
    storeId: string,
    payload: Partial<Pick<CategoryRow, 'name' | 'description' | 'sort_order' | 'is_active'>>
  ): Promise<CategoryRow> {
    const { data, error } = await supabase
      .from('categories')
      .update(payload)
      .eq('id', categoryId)
      .eq('store_id', storeId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(categoryId: string, storeId: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)
      .eq('store_id', storeId);
    if (error) throw error;
  },
};


import { supabase } from '../lib/supabase';
import type { OptionGroupRow, ProductOptionRow } from '../types/domain';

export interface OptionGroupWithOptions extends OptionGroupRow {
  options: ProductOptionRow[];
}

export const optionsService = {
  async listByProduct(storeId: string, productId: string): Promise<OptionGroupWithOptions[]> {
    const [groupsRes, optsRes] = await Promise.all([
      supabase
        .from('option_groups')
        .select('*')
        .eq('store_id', storeId)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('product_options')
        .select('*')
        .eq('store_id', storeId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
    ]);

    if (groupsRes.error) throw groupsRes.error;
    if (optsRes.error) throw optsRes.error;

    return groupsRes.data.map((group) => ({
      ...group,
      options: optsRes.data
        .filter((o) => o.option_group_id === group.id)
        .map((o) => ({ ...o, extra_price: Number(o.extra_price) })),
    }));
  },

  async createGroup(
    storeId: string,
    productId: string,
    payload: Pick<
      OptionGroupRow,
      'name' | 'description' | 'is_required' | 'min_selection' | 'max_selection' | 'sort_order' | 'is_active'
    >
  ): Promise<OptionGroupRow> {
    const { data, error } = await supabase
      .from('option_groups')
      .insert({
        store_id: storeId,
        product_id: productId,
        ...payload,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateGroup(
    groupId: string,
    storeId: string,
    payload: Partial<
      Pick<
        OptionGroupRow,
        'name' | 'description' | 'is_required' | 'min_selection' | 'max_selection' | 'sort_order' | 'is_active'
      >
    >
  ): Promise<OptionGroupRow> {
    const { data, error } = await supabase
      .from('option_groups')
      .update(payload)
      .eq('id', groupId)
      .eq('store_id', storeId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async removeGroup(groupId: string, storeId: string): Promise<void> {
    const { error } = await supabase
      .from('option_groups')
      .delete()
      .eq('id', groupId)
      .eq('store_id', storeId);
    if (error) throw error;
  },

  async createOption(
    storeId: string,
    optionGroupId: string,
    payload: Pick<
      ProductOptionRow,
      'name' | 'description' | 'extra_price' | 'sort_order' | 'is_active'
    >
  ): Promise<ProductOptionRow> {
    const { data, error } = await supabase
      .from('product_options')
      .insert({
        store_id: storeId,
        option_group_id: optionGroupId,
        ...payload,
      })
      .select('*')
      .single();
    if (error) throw error;
    return { ...data, extra_price: Number(data.extra_price) };
  },

  async updateOption(
    optionId: string,
    storeId: string,
    payload: Partial<
      Pick<ProductOptionRow, 'name' | 'description' | 'extra_price' | 'sort_order' | 'is_active'>
    >
  ): Promise<ProductOptionRow> {
    const { data, error } = await supabase
      .from('product_options')
      .update(payload)
      .eq('id', optionId)
      .eq('store_id', storeId)
      .select('*')
      .single();
    if (error) throw error;
    return { ...data, extra_price: Number(data.extra_price) };
  },

  async removeOption(optionId: string, storeId: string): Promise<void> {
    const { error } = await supabase
      .from('product_options')
      .delete()
      .eq('id', optionId)
      .eq('store_id', storeId);
    if (error) throw error;
  },
};


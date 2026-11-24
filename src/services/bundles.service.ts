import { supabase } from '../lib/supabase';
import type { PromotionBundleRow, PromotionBundleWithItems } from '../types/domain';

export interface SaveBundleInput {
  name: string;
  description?: string | null;
  promo_price: number;
  highlight_top: boolean;
  is_active: boolean;
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
}

export const bundlesService = {
  async listByStore(storeId: string): Promise<PromotionBundleWithItems[]> {
    const [bundlesRes, itemsRes, productsRes] = await Promise.all([
      supabase
        .from('promotion_bundles')
        .select('*')
        .eq('store_id', storeId)
        .order('highlight_top', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('promotion_bundle_items').select('*').eq('store_id', storeId),
      supabase
        .from('products')
        .select('id, name, price, is_active, is_available, image_path')
        .eq('store_id', storeId),
    ]);

    if (bundlesRes.error) throw bundlesRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (productsRes.error) throw productsRes.error;

    const productMap = new Map(
      productsRes.data.map((p) => [p.id, { ...p, price: Number(p.price) }])
    );

    return bundlesRes.data.map((bundle) => ({
      ...bundle,
      promo_price: Number(bundle.promo_price),
      items: itemsRes.data
        .filter((i) => i.bundle_id === bundle.id)
        .map((i) => ({
          ...i,
          product: productMap.get(i.product_id),
        })),
    }));
  },

  async create(storeId: string, input: SaveBundleInput): Promise<PromotionBundleRow> {
    const { items, ...bundleFields } = input;
    const { data: bundle, error: bundleErr } = await supabase
      .from('promotion_bundles')
      .insert({
        store_id: storeId,
        name: bundleFields.name.trim(),
        description: bundleFields.description?.trim() || null,
        promo_price: bundleFields.promo_price,
        highlight_top: bundleFields.highlight_top,
        is_active: bundleFields.is_active,
      })
      .select('*')
      .single();

    if (bundleErr) throw bundleErr;

    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from('promotion_bundle_items').insert(
        items.map((item) => ({
          store_id: storeId,
          bundle_id: bundle.id,
          product_id: item.product_id,
          quantity: item.quantity,
        }))
      );
      if (itemsErr) {
        await supabase.from('promotion_bundles').delete().eq('id', bundle.id).eq('store_id', storeId);
        throw itemsErr;
      }
    }

    return { ...bundle, promo_price: Number(bundle.promo_price) };
  },

  async update(
    bundleId: string,
    storeId: string,
    input: SaveBundleInput
  ): Promise<PromotionBundleRow> {
    const { items, ...bundleFields } = input;
    const { data: bundle, error: bundleErr } = await supabase
      .from('promotion_bundles')
      .update({
        name: bundleFields.name.trim(),
        description: bundleFields.description?.trim() || null,
        promo_price: bundleFields.promo_price,
        highlight_top: bundleFields.highlight_top,
        is_active: bundleFields.is_active,
      })
      .eq('id', bundleId)
      .eq('store_id', storeId)
      .select('*')
      .single();

    if (bundleErr) throw bundleErr;

    const { error: delErr } = await supabase
      .from('promotion_bundle_items')
      .delete()
      .eq('bundle_id', bundleId)
      .eq('store_id', storeId);
    if (delErr) throw delErr;

    if (items.length > 0) {
      const { error: insErr } = await supabase.from('promotion_bundle_items').insert(
        items.map((item) => ({
          store_id: storeId,
          bundle_id: bundleId,
          product_id: item.product_id,
          quantity: item.quantity,
        }))
      );
      if (insErr) throw insErr;
    }

    return { ...bundle, promo_price: Number(bundle.promo_price) };
  },

  async toggleActive(bundleId: string, storeId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('promotion_bundles')
      .update({ is_active: isActive })
      .eq('id', bundleId)
      .eq('store_id', storeId);
    if (error) throw error;
  },

  async remove(bundleId: string, storeId: string): Promise<void> {
    const { error } = await supabase
      .from('promotion_bundles')
      .delete()
      .eq('id', bundleId)
      .eq('store_id', storeId);
    if (error) throw error;
  },
};

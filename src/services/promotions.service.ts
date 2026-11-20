import { supabase } from '../lib/supabase';
import type { PromotionDiscountType, PromotionScheduleType } from '../types/database';
import type {
  PromotionConflictReport,
  PromotionRow,
  PromotionWithProducts,
} from '../types/domain';

export interface SavePromotionInput {
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
  priority: number;
  is_active: boolean;
  products: Array<{
    product_id: string;
    discount_type_override?: PromotionDiscountType | null;
    discount_value_override?: number | null;
  }>;
}

export const promotionsService = {
  async listByStore(storeId: string): Promise<PromotionWithProducts[]> {
    const [promosRes, linksRes, productsRes] = await Promise.all([
      supabase
        .from('promotions')
        .select('*')
        .eq('store_id', storeId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase.from('promotion_products').select('*').eq('store_id', storeId),
      supabase
        .from('products')
        .select('id, name, price, is_active, is_available')
        .eq('store_id', storeId),
    ]);

    if (promosRes.error) throw promosRes.error;
    if (linksRes.error) throw linksRes.error;
    if (productsRes.error) throw productsRes.error;

    const productMap = new Map(
      productsRes.data.map((p) => [p.id, { ...p, price: Number(p.price) }])
    );

    return promosRes.data.map((promo) => ({
      ...promo,
      discount_value: Number(promo.discount_value),
      promotion_products: linksRes.data
        .filter((l) => l.promotion_id === promo.id)
        .map((l) => ({
          ...l,
          discount_value_override:
            l.discount_value_override !== null ? Number(l.discount_value_override) : null,
          product: productMap.get(l.product_id),
        })),
    }));
  },

  async getConflicts(storeId: string): Promise<PromotionConflictReport> {
    const { data, error } = await supabase.rpc('get_promotion_conflicts', {
      p_store_id: storeId,
    });
    if (error) throw error;
    return data as unknown as PromotionConflictReport;
  },

  async create(storeId: string, input: SavePromotionInput): Promise<PromotionRow> {
    const { products, ...promoFields } = input;
    const { data: promo, error: promoError } = await supabase
      .from('promotions')
      .insert({
        store_id: storeId,
        ...promoFields,
      })
      .select('*')
      .single();

    if (promoError) throw promoError;

    if (products.length > 0) {
      const { error: linksError } = await supabase.from('promotion_products').insert(
        products.map((p) => ({
          store_id: storeId,
          promotion_id: promo.id,
          product_id: p.product_id,
          discount_type_override: p.discount_type_override ?? null,
          discount_value_override: p.discount_value_override ?? null,
        }))
      );
      if (linksError) {
        await supabase.from('promotions').delete().eq('id', promo.id).eq('store_id', storeId);
        throw linksError;
      }
    }

    return { ...promo, discount_value: Number(promo.discount_value) };
  },

  async update(
    promotionId: string,
    storeId: string,
    input: SavePromotionInput
  ): Promise<PromotionRow> {
    const { products, ...promoFields } = input;
    const { data: promo, error: promoError } = await supabase
      .from('promotions')
      .update(promoFields)
      .eq('id', promotionId)
      .eq('store_id', storeId)
      .select('*')
      .single();

    if (promoError) throw promoError;

    const { error: delError } = await supabase
      .from('promotion_products')
      .delete()
      .eq('promotion_id', promotionId)
      .eq('store_id', storeId);
    if (delError) throw delError;

    if (products.length > 0) {
      const { error: insError } = await supabase.from('promotion_products').insert(
        products.map((p) => ({
          store_id: storeId,
          promotion_id: promotionId,
          product_id: p.product_id,
          discount_type_override: p.discount_type_override ?? null,
          discount_value_override: p.discount_value_override ?? null,
        }))
      );
      if (insError) throw insError;
    }

    return { ...promo, discount_value: Number(promo.discount_value) };
  },

  async toggleActive(promotionId: string, storeId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('promotions')
      .update({ is_active: isActive })
      .eq('id', promotionId)
      .eq('store_id', storeId);
    if (error) throw error;
  },

  async remove(promotionId: string, storeId: string): Promise<void> {
    const { error } = await supabase
      .from('promotions')
      .delete()
      .eq('id', promotionId)
      .eq('store_id', storeId);
    if (error) throw error;
  },
};


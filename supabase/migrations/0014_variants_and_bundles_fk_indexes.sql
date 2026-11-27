-- ============================================================================
-- Migration 0014: Covering Indexes for Composite FKs (Performance Advisors)
-- - Cobre as 3 FKs compostas criadas em product_variants e promotion_bundle_items
-- ============================================================================

create index if not exists idx_product_variants_product_store
  on public.product_variants (product_id, store_id);

create index if not exists idx_promotion_bundle_items_bundle_store
  on public.promotion_bundle_items (bundle_id, store_id);

create index if not exists idx_promotion_bundle_items_product_store
  on public.promotion_bundle_items (product_id, store_id);

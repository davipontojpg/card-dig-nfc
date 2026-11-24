-- ============================================================================
-- Migration 0012: Enable basic_promotions on base plan ('menu')
-- - Libera promoções comuns (schedule_type = 'always') também para o plano
--   Cardápio Digital ('menu'), mantendo promoções agendadas exclusivas do
--   plano completo ('menu_nfc_promotions').
-- ============================================================================

insert into public.plan_features (plan_id, feature_key)
select p.id, 'basic_promotions'
from public.plans p
where p.code = 'menu'
on conflict (plan_id, feature_key) do nothing;

update public.plans
set description = 'Cardápio digital público responsivo com painel de gestão, variantes, adicionais, promoções comuns e gerador de QR Code para mesas.'
where code = 'menu';

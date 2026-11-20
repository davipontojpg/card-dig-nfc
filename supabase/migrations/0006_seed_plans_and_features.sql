-- ============================================================================
-- Migration 0006: Idempotent Seed of Commercial Plans & Feature Catalog
-- Preços e taxas exatos da especificação v2.0.
-- Não altera snapshots (monthly_price_snapshot / setup_fee_snapshot) existentes.
-- ============================================================================

insert into public.feature_catalog (feature_key, name, description, is_active)
values
  (
    'digital_menu',
    'Cardápio Digital',
    'Publicação de cardápio público sem login, gestão de categorias, produtos, fotos e adicionais.',
    true
  ),
  (
    'qr_code',
    'QR Code para Mesas',
    'Geração e exportação de QR Code em PNG e SVG apontando para a URL pública permanente.',
    true
  ),
  (
    'nfc_access',
    'Pacote e Instruções NFC',
    'Área dedicada de implantação NFC no painel com URL pronta para gravação NTAG213 e guia técnico.',
    true
  ),
  (
    'scheduled_promotions',
    'Promoções Pontuais e Recorrentes',
    'Criação de ofertas pontuais e semanais recorrentes com cálculo por fuso horário e resolução de conflitos.',
    true
  )
on conflict (feature_key) do update
  set name = excluded.name,
      description = excluded.description,
      is_active = excluded.is_active;

insert into public.plans (code, name, description, monthly_price, setup_fee, is_active, display_order)
values
  (
    'menu',
    'Cardápio Digital',
    'Cardápio público, painel de gestão, produtos, categorias, fotos, adicionais, personalização básica e QR Code.',
    19.90,
    100.00,
    true,
    1
  ),
  (
    'menu_nfc',
    'Cardápio + NFC',
    'Tudo do plano Cardápio Digital mais suporte funcional e instruções técnicas para implantação de tags NFC.',
    49.90,
    150.00,
    true,
    2
  ),
  (
    'menu_nfc_promotions',
    'Cardápio + NFC + Promoções',
    'Tudo do plano anterior mais promoções pontuais e semanais recorrentes e elegibilidade prioritária a novos recursos especiais.',
    59.90,
    100.00,
    true,
    3
  )
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      monthly_price = excluded.monthly_price,
      setup_fee = excluded.setup_fee,
      is_active = excluded.is_active,
      display_order = excluded.display_order;

-- Matriz exata de recursos por plano (idempotente)
with mapping(plan_code, feature_key) as (
  values
    ('menu', 'digital_menu'),
    ('menu', 'qr_code'),
    ('menu_nfc', 'digital_menu'),
    ('menu_nfc', 'qr_code'),
    ('menu_nfc', 'nfc_access'),
    ('menu_nfc_promotions', 'digital_menu'),
    ('menu_nfc_promotions', 'qr_code'),
    ('menu_nfc_promotions', 'nfc_access'),
    ('menu_nfc_promotions', 'scheduled_promotions')
)
insert into public.plan_features (plan_id, feature_key)
select p.id, m.feature_key
from mapping m
join public.plans p on p.code = m.plan_code
on conflict (plan_id, feature_key) do nothing;


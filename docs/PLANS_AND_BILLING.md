# Planos Comerciais, Recursos e Assinaturas (MVP)

## 1. Planos Aprovados (`0006_seed_plans_and_features.sql` + `0007_basic_and_scheduled_promotions.sql`)

| Código (`code`) | Nome comercial | Mensalidade | Taxa de implantação | Recursos (`feature_key`) |
|---|---|---:|---:|---|
| `menu` | Cardápio Digital | **R$ 19,90/mês** | **R$ 100,00** | `digital_menu`, `qr_code`, `basic_promotions` |
| `menu_nfc` | Cardápio + NFC | **R$ 49,90/mês** | **R$ 150,00** | `digital_menu`, `qr_code`, `nfc_access`, `basic_promotions` |
| `menu_nfc_promotions` | Cardápio + NFC + Promoções | **R$ 59,90/mês** | **R$ 100,00** | `digital_menu`, `qr_code`, `nfc_access`, `basic_promotions`, `scheduled_promotions` |

### Notas Comerciais Importantes

- **Mídia física NFC**: a liberação do recurso `nfc_access` no plano 2 ou 3 contempla instruções, URL estável e suporte à implantação. Chips NFC, adesivos, displays acrílicos, impressão e frete devem ser orçados separadamente.
- **Taxa de adesão/implantação**: cobrada uma única vez na contratação inicial (`setup_fee_snapshot`), com status `pending`, `paid` ou `waived`. Renovações ou reativações não geram nova taxa automaticamente sem decisão explícita do operador.
- **Imutabilidade de contratos existentes**: alterar o preço de um plano no catálogo (`plans`) nunca altera `monthly_price_snapshot` ou `setup_fee_snapshot` das assinaturas já contratadas em `store_subscriptions`.

## 2. Estados da Assinatura e Acesso

A regra centralizada no banco (`public.store_has_service_access`) libera os recursos do plano somente quando:
- `stores.lifecycle_status = 'active'` **e**
  - `store_subscriptions.status IN ('trialing', 'active')`, **ou**
  - `store_subscriptions.status = 'past_due'` e `now() <= store_subscriptions.grace_until`.

Em `suspended`, `canceled`, `pending_setup`, `archived` ou `past_due` após o vencimento de `grace_until`:
- O cardápio público (`/m/:slug`) retorna indisponível (`unavailable` / `unpublished` / `not_found`).
- Alterações de cardápio e acesso aos módulos ficam bloqueadas.

## 3. Processo Manual de Cobrança no MVP

No MVP não há gateway de pagamento, cobrança recorrente automática, webhook financeiro ou emissão fiscal.
O operador acompanha vencimentos e registra pagamentos manualmente na aba **Plano e Assinatura** (`/platform/stores/:storeId`) utilizando `platform_update_subscription`, o que gera histórico auditável em `subscription_events` e `platform_audit_logs`.

## 4. Indicador de MRR no Dashboard

O MRR exibido no painel `/platform` soma `monthly_price_snapshot` exclusivamente das assinaturas com `status = 'active'` pertencentes a estabelecimentos com `lifecycle_status = 'active'`. Ele é identificado explicitamente na interface como **estimativa operacional**, não devendo ser usado como relatório contábil nem confirmação de recebimento bancário.


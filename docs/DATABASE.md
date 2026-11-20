# Modelagem de Dados e Migrations

## 1. Migrations Versionadas (`supabase/migrations/`)

| Arquivo | Escopo |
|---|---|
| `0001_core_saas_schema.sql` | `profiles`, `platform_admins`, `stores`, `store_internal_records`, `store_memberships`, `plans`, `feature_catalog`, `plan_features`, `store_subscriptions`, `subscription_events`, `store_onboarding_tasks`, `platform_audit_logs` e triggers de proteção |
| `0002_menu_and_promotions_schema.sql` | `categories`, `products`, `option_groups`, `product_options`, `promotions`, `promotion_products`, `calculate_promotional_price` e validações de integridade |
| `0003_auth_functions_and_rls.sql` | Funções `SECURITY DEFINER` de autorização, RPCs operacionais/dashboard e políticas RLS para todas as 18 tabelas |
| `0004_promotions_and_public_menu_rpc.sql` | Avaliação temporal de promoções (`is_promotion_active_at`), resolução de conflitos (`get_active_product_promotions`, `get_promotion_conflicts`) e `get_public_menu` / `get_public_menu_at` |
| `0005_storage_bucket_and_policies.sql` | Bucket `menu-media`, helper `can_manage_store_media` e políticas RLS em `storage.objects` |
| `0006_seed_plans_and_features.sql` | Seed idempotente do catálogo de recursos e dos 3 planos comerciais aprovados |

## 2. Principais Relacionamentos e Restrições Multi-Tenant

- **Separação de dados internos (`store_internal_records`)**: dados internos comerciais (`contact_name`, `contact_email`, `contact_phone`, `internal_notes`, `subscription_internal_notes`, estado de convite) ficam em tabela separada com RLS exclusiva de `platform_admins`.
- **Chaves estrangeiras compostas por tenant**:
  - `products (category_id, store_id) -> categories (id, store_id)`
  - `option_groups (product_id, store_id) -> products (id, store_id)`
  - `product_options (option_group_id, store_id) -> option_groups (id, store_id)`
  - `promotion_products (promotion_id, store_id) -> promotions (id, store_id)` e `(product_id, store_id) -> products (id, store_id)`
- **Preços monetários**: todas as colunas monetárias (`monthly_price`, `setup_fee`, `monthly_price_snapshot`, `setup_fee_snapshot`, `price`, `extra_price`, `discount_value`, `discount_value_override`) utilizam `numeric(10,2)`.
- **Proteção contra exclusão destrutiva**: trigger `prevent_delete_active_store` impede `DELETE` em `stores` enquanto `lifecycle_status <> 'archived'` ou enquanto existir assinatura vigente (`trialing`, `active`, `past_due`).
- **Logs append-only**: `subscription_events` e `platform_audit_logs` possuem trigger `prevent_append_only_mutation` bloqueando `UPDATE` e `DELETE`.

## 3. Motor de Promoções Semanal e Pontual

- Promoções pontuais (`schedule_type = 'once'`) validam `[starts_at, ends_at)` em `timestamptz`.
- Promoções semanais (`schedule_type = 'weekly'`) armazenam `weekdays smallint[]` (`0 = domingo` .. `6 = sábado`), `start_time`, `end_time` (`end_time > start_time`, sem cruzar meia-noite no MVP) e validade opcional `valid_from`/`valid_until`.
- Na consulta pública (`get_public_menu`), `p_at` (`now()`) é convertido para o fuso do estabelecimento (`p_at AT TIME ZONE store.timezone`, padrão `America/Sao_Paulo`).
- Conflitos no mesmo produto são resolvidos deterministicamente por `priority DESC, created_at ASC, promotion_id ASC`.
- Produtos indisponíveis (`is_available = false`) não recebem promoção na apresentação pública.


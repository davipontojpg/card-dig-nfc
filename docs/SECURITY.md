# Segurança, Isolamento Multi-Tenant e RLS

## 1. Identidades e Papéis

| Papel | Origem da autorização | Escopo |
|---|---|---|
| `super_admin` | `platform_admins` (`role = 'super_admin'`, `is_active = true`) | Gestão completa da plataforma e administração de operadores (`platform_manage_admin`). |
| `operator` | `platform_admins` (`role = 'operator'`, `is_active = true`) | Cadastro/gestão de estabelecimentos, onboarding, assinaturas e convites. Não altera `platform_admins`. |
| `owner` | `store_memberships` (`role = 'owner'`) | Administração completa do próprio estabelecimento, aparência, publicação, cardápio e consulta de assinatura (conforme plano). |
| `editor` | `store_memberships` (`role = 'editor'`) | Manutenção operacional de categorias, produtos, adicionais e promoções (conforme plano). Não altera `stores` nem lê `store_subscriptions`. |
| `anon` | Consumidor público | Sem acesso direto a tabelas; leitura restrita via RPC `get_public_menu(p_slug)`. |

Nenhuma autorização depende de `user_metadata` editável pelo usuário ou de filtros apenas no frontend.

## 2. Isolamento de Dados Internos vs. Estabelecimento

- Campos comerciais/privados do operador ficam na tabela `store_internal_records`, cuja RLS permite leitura e escrita **somente** para operadores ativos (`is_platform_admin(auth.uid())`).
- O trigger `guard_stores_protected_columns` impede que proprietários alterem `lifecycle_status`, `onboarding_status` ou publiquem o cardápio quando `store_has_service_access(id)` for falso.
- O próprio usuário não pode inserir nem atualizar `store_memberships` (escrita bloqueada por RLS para não operadores).

## 3. Controle de Funcionalidades por Plano (`feature_key`)

- A função `store_has_service_access(store_id)` centraliza a verificação de `lifecycle_status = 'active'` e status da assinatura (`trialing`, `active`, ou `past_due` enquanto `now() <= grace_until`).
- `store_has_feature(store_id, feature_key)` exige `store_has_service_access(store_id)` e presença da `feature_key` ativa no plano contratado.
- As tabelas `promotions` e `promotion_products`, bem como a RPC `get_promotion_conflicts`, exigem `store_has_feature(store_id, 'scheduled_promotions')` diretamente no PostgreSQL.

## 4. Funções `SECURITY DEFINER` e Edge Functions

- Todas as funções `SECURITY DEFINER` no PostgreSQL fixam `SET search_path = public` (e `storage` quando aplicável), revogam execução de `PUBLIC` e concedem apenas aos papéis mínimos necessários.
- As Edge Functions `provision-store` e `resend-store-invite`:
  - Utilizam `verify_jwt = false` no gateway (`supabase/config.toml` / `--no-verify-jwt`) para suportar tokens assimétricos `ES256` e chaves `sb_publishable_...`, executando a validação criptográfica do JWT diretamente no servidor via `adminClient.auth.getUser(jwt)` em `supabase/functions/_shared/auth.ts`.
  - Consultam `platform_admins` com `is_active = true` usando cliente servidor antes de executar `auth.admin`.
  - Nunca gravam tokens de convite em logs ou respostas.
  - Nunca expõem `SUPABASE_SERVICE_ROLE_KEY` ao frontend (o plugin `validateEnvOnBuild` em `vite.config.ts` bloqueia o build se qualquer variável `VITE_*` contiver `SERVICE_ROLE`, `SECRET` ou `sb_secret_`).

## 5. Storage (`menu-media`)

- Bucket `menu-media` aceita apenas JPEG, PNG e WebP até 5 MB.
- Caminhos permitidos pela função `can_manage_store_media`: `{store_id}/products/{arquivo}.{ext}` (editor ou owner com acesso ativo) e `{store_id}/branding/{arquivo}.{ext}` (somente owner com acesso ativo ou operador da plataforma).

## 6. Validação Automatizada

Execute `npm run test:db` para rodar todas as migrations e a suíte [`supabase/tests/rls_and_business_rules.sql`](../supabase/tests/rls_and_business_rules.sql) em PostgreSQL 16 real, validando isolamento entre tenants, roles, planos, tolerância (`grace_until`), promoções por fuso horário e políticas do Storage.


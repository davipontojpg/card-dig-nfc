# Arquitetura da Aplicação

## 1. Visão Multi-Tenant Compartilhada

Todos os estabelecimentos compartilham a mesma aplicação frontend, o mesmo projeto Supabase e o mesmo schema `public`, com isolamento lógico por `store_id`, chaves estrangeiras compostas e Row Level Security (RLS).

Não há banco de dados, schema ou deploy separado por cliente.

## 2. Domínios e Separação de Responsabilidades

1. **Domínio da Plataforma (`/platform/*`)**
   - Exclusivo para usuários ativos em `platform_admins` (`super_admin` ou `operator`).
   - Serviços: `src/services/platform.service.ts`, `src/services/provisioning.service.ts`, `src/services/subscriptions.service.ts`.
   - Guards: `src/app/route-guards/PlatformAdminGuard.tsx`.
   - Páginas: `PlatformDashboardPage`, `PlatformStoresPage`, `PlatformNewStorePage`, `PlatformStoreDetailPage`, `PlatformPlansPage`, `PlatformAdminsPage`.

2. **Domínio do Estabelecimento (`/app/*`)**
   - Acessível por usuários autenticados que possuam vínculo válido em `store_memberships` (`owner` ou `editor`).
   - Suporta múltiplos estabelecimentos por usuário: `AuthContext` resolve o `activeStoreId` entre os vínculos reais do banco e `StoreMemberGuard` carrega `get_store_access_context(store_id)`.
   - Recursos específicos do plano são protegidos por `StoreFeatureGuard` (UI) e pelas políticas RLS/RPCs no PostgreSQL.
   - Serviços: `stores.service.ts`, `categories.service.ts`, `products.service.ts`, `options.service.ts`, `promotions.service.ts`, `storage.service.ts`.

3. **Domínio Público (`/m/:slug`)**
   - Acessível sem autenticação (`anon`).
   - Consome exclusivamente a RPC `get_public_menu(p_slug)` via `public-menu.service.ts`.
   - Catálogo estritamente consultivo: sem carrinho, pedidos, checkout ou dados administrativos.

## 3. Camadas do Frontend

- `src/lib/env.ts`: validação Zod das variáveis públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` / fallback `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_APP_URL`).
- `src/lib/supabase.ts`: cliente oficial único `@supabase/supabase-js`.
- `src/lib/validators/`: schemas Zod v4 compartilhados com React Hook Form (`@hookform/resolvers` v5).
- `src/lib/permissions.ts`: verificação de `feature_key`, metadados de status e cálculo de pré-visualização de preços/estados.
- `src/services/`: camada de acesso a dados, RPCs, Edge Functions e Storage.
- `src/pages/` e `src/components/`: interface responsiva mobile-first desacoplada das chamadas diretas ao Supabase.

## 4. Provisionamento Privilegiado (Edge Functions)

Operações que exigem `SUPABASE_SERVICE_ROLE_KEY` (convite de usuários via Auth Admin e vínculo inicial) executam exclusivamente em Edge Functions Deno (`supabase/functions/provision-store` e `supabase/functions/resend-store-invite`), após validar o JWT do chamador e confirmar presença ativa em `platform_admins`.


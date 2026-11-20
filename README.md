# MenuFlow SaaS — Plataforma Multi-Tenant de Cardápios Digitais (NFC + QR Code)

Plataforma SaaS B2B multi-tenant para criação, gestão e publicação de cardápios digitais consultivos (sem carrinho, pedidos ou checkout), com dois painéis administrativos separados e acesso público ao consumidor via URL permanente, QR Code e etiquetas NFC.

## Visão geral das rotas

- **`/`**: Página institucional com apresentação dos planos comerciais e entradas para operadores e estabelecimentos.
- **`/platform/login` e `/platform/*`**: Console central exclusivo para operadores autorizados (`platform_admins`), com gestão de clientes, onboarding, planos, assinaturas manuais, convites e auditoria.
- **`/login` e `/app/*`**: Painel independente de cada estabelecimento (proprietários e editores), para gerenciar categorias, produtos, fotos, adicionais, identidade visual, QR Code, guia NFC e promoções agendadas (conforme plano).
- **`/auth/set-password`**: Definição/redefinição de senha via link seguro do Supabase Auth.
- **`/m/:slug`**: Cardápio público responsivo do estabelecimento, acessível sem login por URL, QR Code ou NFC.

## Stack principal

- **Frontend**: React 19, TypeScript (strict), Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`), React Router v7, TanStack Query, React Hook Form + Zod v4 (`@hookform/resolvers` v5), Lucide React, `qrcode`.
- **Backend / BaaS**: Supabase (PostgreSQL, Auth, Storage, RLS, RPCs e Edge Functions em Deno).
- **Testes**: Vitest + React Testing Library, suíte automatizada PostgreSQL 16 (`scripts/test-db.sh`) e Playwright (`e2e/`).
- **Hospedagem frontend**: Cloudflare Workers Static Assets / Cloudflare Pages (`wrangler.jsonc` com `not_found_handling: "single-page-application"`).

## Pré-requisitos

- Node.js 20+ e npm
- Projeto Supabase (ou ambiente PostgreSQL 16 local para rodar `npm run test:db`)
- Supabase CLI (opcional para deploy remoto de migrations e Edge Functions)

## Configuração local

1. Instale as dependências:

```bash
npm install
```

2. Crie `.env.local` a partir do modelo:

```bash
cp .env.example .env.local
```

Preencha:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_ANON_KEY` em projetos legados)
- `VITE_PUBLIC_APP_URL` (ex.: `http://localhost:5173` localmente; em produção usar domínio estável definitivo)

3. Aplique as migrations em `supabase/migrations/` (`0001` a `0006`) no seu projeto Supabase e configure o primeiro `super_admin` conforme [`supabase/scripts/bootstrap_super_admin.sql`](supabase/scripts/bootstrap_super_admin.sql).

4. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o frontend Vite localmente |
| `npm run build` | Valida variáveis públicas e gera bundle de produção em `dist/` |
| `npm run typecheck` | Verificação de tipos TypeScript (`tsc -b --noEmit`) |
| `npm run lint` | Análise estática com ESLint |
| `npm run test` | Executa testes unitários e de componentes (Vitest + RTL) |
| `npm run test:db` | Inicializa PostgreSQL 16 efêmero local, aplica todas as migrations e executa `supabase/tests/rls_and_business_rules.sql` |
| `npm run test:e2e` | Executa testes Playwright em `e2e/` (requer navegador Chromium instalado via `npx playwright install chromium`) |

## Documentação detalhada

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DATABASE.md`](docs/DATABASE.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/PLANS_AND_BILLING.md`](docs/PLANS_AND_BILLING.md)
- [`docs/ONBOARDING.md`](docs/ONBOARDING.md)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- [`docs/NFC_QR_SETUP.md`](docs/NFC_QR_SETUP.md)
- [`docs/DECISIONS.md`](docs/DECISIONS.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)

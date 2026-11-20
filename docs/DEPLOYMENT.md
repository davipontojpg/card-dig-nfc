# Guia de Implantação e Configuração Manual (Supabase + Cloudflare Pages)

Este documento lista passo a passo todas as ações que dependem do responsável humano para colocar o SaaS em produção.

## 1. Projeto Supabase

1. Crie ou selecione um projeto no [Supabase Dashboard](https://supabase.com/).
2. Copie a **Project URL** (`VITE_SUPABASE_URL`) e a **Publishable Key** (`VITE_SUPABASE_PUBLISHABLE_KEY`, ou `anon` em projetos legados).
3. Configure `.env.local` localmente a partir de `.env.example`.

## 2. Aplicar Migrations e Seed Oficial

Aplique em ordem numérica todos os arquivos de `supabase/migrations/`:
1. `0001_core_saas_schema.sql`
2. `0002_menu_and_promotions_schema.sql`
3. `0003_auth_functions_and_rls.sql`
4. `0004_promotions_and_public_menu_rpc.sql`
5. `0005_storage_bucket_and_policies.sql`
6. `0006_seed_plans_and_features.sql` (semeia os 3 planos comerciais oficiais com os valores exatos)

> **Atenção:** `supabase/seed.sql` é exclusivo para ambiente de desenvolvimento/demonstração. Não execute em produção como dados reais.

Via Supabase CLI (quando conectado ao projeto remoto):
```bash
supabase db push
```
Ou execute cada arquivo na ordem exata pelo **SQL Editor** do Supabase Dashboard.

## 3. Validar Storage (`menu-media`)

A migration `0005` cria o bucket `menu-media` (`public = true`, limite de 5 MB, MIME `image/jpeg`, `image/png`, `image/webp`) e as políticas em `storage.objects`. Confira em **Storage → Policies** se o bucket está ativo.

## 4. Configurar Secrets e Deploy das Edge Functions

**Nunca** coloque `SUPABASE_SERVICE_ROLE_KEY` em `.env.local` do frontend nem em variáveis `VITE_*`.

Configure os secrets diretamente no ambiente servidor do Supabase e faça o deploy das Edge Functions:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<sua-chave-service-role-ou-secret>"
supabase functions deploy provision-store
supabase functions deploy resend-store-invite
```
As funções utilizam `verify_jwt = true` (`supabase/config.toml`) e checam `platform_admins` internamente.

## 5. Provisionar o Primeiro `super_admin`

1. No Supabase Dashboard (**Authentication → Users**), crie manualmente o usuário do primeiro operador com e-mail real e senha forte (ou confirme o usuário).
2. Abra [`supabase/scripts/bootstrap_super_admin.sql`](../supabase/scripts/bootstrap_super_admin.sql), substitua o e-mail de exemplo pelo e-mail real criado e execute no **SQL Editor**.
3. Recomendado para produção: habilitar MFA (TOTP) na conta dos operadores da plataforma.

## 6. Configurar SMTP Próprio e URLs de Redirecionamento

Para envio confiável de convites comerciais:
1. Em **Authentication → SMTP Settings**, configure seu provedor SMTP transacional (Resend, Postmark, SES, Brevo etc.). Não dependa do limite padrão de e-mails de desenvolvimento do Supabase em produção.
2. Em **Authentication → URL Configuration**:
   - **Site URL**: `https://seu-dominio-estavel.com.br`
   - **Redirect URLs**: adicione `https://seu-dominio-estavel.com.br/auth/set-password` (e `http://localhost:5173/auth/set-password` para testes locais).

## 7. Publicação Frontend no Cloudflare Pages

1. Conecte o repositório GitHub ao **Cloudflare Pages**.
2. Configure o build:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - O arquivo `public/_redirects` (`/* /index.html 200`) já garante fallback SPA para `/platform/*`, `/app/*` e `/m/:slug`.
3. Configure as variáveis de ambiente no Cloudflare Pages:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_PUBLIC_APP_URL` = **`https://seu-dominio-estavel.com.br`** (domínio definitivo controlado por você — nunca grave tags NFC ou imprima lotes de QR Code apontando para URLs temporárias `.pages.dev` ou `localhost`).
4. Associe o domínio customizado definitivo no Cloudflare Pages antes de iniciar a impressão de materiais físicos dos clientes.

## 8. Validação Inicial Pós-Deploy

1. Acesse `/platform/login`, autentique-se com o `super_admin` e confirme o Dashboard Central.
2. Cadastre um estabelecimento piloto em `/platform/stores/new`, selecione o plano e confirme o recebimento do convite pelo proprietário.
3. Aceite o convite em `/auth/set-password`, faça login em `/login`, cadastre categorias/produtos e marque como publicado.
4. Abra `/m/<slug>` em janela anônima no celular e valide carregamento, QR Code e (se plano 2/3) módulo NFC.


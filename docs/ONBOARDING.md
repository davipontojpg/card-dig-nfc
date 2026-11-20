# Playbook de Onboarding de Clientes (Operador SaaS)

Este guia descreve o processo operacional padrão para implantar um novo estabelecimento usando o console `/platform`.

## 1. Coleta de Dados Antes do Cadastro

Solicite ao cliente:
- Nome comercial/público e slug desejado para `/m/:slug`.
- Tipo de negócio, descrição curta, telefone público e endereço (opcionais).
- Logotipo em PNG, JPEG ou WebP e cor principal desejada (`#RRGGBB`).
- Nome completo e e-mail exclusivo do proprietário (`owner`) que receberá o convite.
- Plano escolhido (`Cardápio Digital`, `Cardápio + NFC` ou `Cardápio + NFC + Promoções`).
- Lista inicial de categorias, produtos, preços e adicionais (caso a implantação inicial seja feita pela equipe operadora).

## 2. Cadastro Guiado (`/platform/stores/new`)

1. Preencha os dados públicos e verifique a disponibilidade do slug antes de enviar.
2. Informe os dados privados do responsável (`contact_name`, `contact_email`, `contact_phone`, `internal_notes`).
3. Selecione o plano contratado (o snapshot de mensalidade e taxa de implantação será preenchido a partir do catálogo no servidor) e informe a situação inicial da taxa (`pending`, `paid` ou `waived`) e datas.
4. Ao confirmar, a Edge Function `provision-store`:
   - Cria `stores` em `lifecycle_status = 'pending_setup'`, `store_internal_records`, `store_subscriptions`, `subscription_events` e o checklist inicial em `store_onboarding_tasks`.
   - Envia o convite de acesso via Auth Admin quando o e-mail ainda não existe.

## 3. Tratamento de Pendências de Convite

- **Falha de envio SMTP (`owner_invite_status = 'failed'`)**: o estabelecimento permanece salvo sem duplicar registros. Após revisar a configuração SMTP no Supabase, abra a aba **Acesso** em `/platform/stores/:storeId` e clique em **Reenviar convite**.
- **E-mail já possui conta existente (`owner_invite_status = 'not_sent'`)**: por segurança, a plataforma não vincula automaticamente contas pré-existentes apenas pelo texto digitado. Confirme com o proprietário e clique explicitamente em **Confirmar vinculação da conta existente** na aba **Acesso**.

## 4. Checklist de Implantação e Publicação

1. Acompanhe as tarefas da aba **Onboarding** (`receive_logo`, `receive_catalog`, `configure_identity`, `validate_menu`, `generate_qr`, `setup_nfc` quando aplicável, `invite_owner`, `publish_store`).
2. Confirme que o proprietário aceitou o convite, definiu sua senha em `/auth/set-password` e entrou em `/app`.
3. Na tela de detalhe do estabelecimento, clique em **Ativar estabelecimento** (`lifecycle_status = 'active'`).
4. Garanta que o cardápio esteja marcado como publicado (`is_published = true`) e valide a abertura em `/m/:slug`.


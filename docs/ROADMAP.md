# Roadmap Futuro (Fora do Escopo do MVP)

Os itens abaixo estão explicitamente **fora do MVP comercial** e não foram implementados nesta versão para preservar foco, segurança e simplicidade operacional:

1. **Recursos premium futuros do Plano 3 (`Cardápio + NFC + Promoções`)**:
   - Novas capacidades aprovadas deverão ser registradas em `feature_catalog`, associadas em `plan_features` via migration versionada e protegidas por `store_has_feature(store_id, '<nova_feature_key>')` com testes dedicados.
2. **Cobrança recorrente automatizada**:
   - Integração futura com gateway de pagamento/PIX recorrente, atualização automatizada de `store_subscriptions` via webhooks assinados e alertas automáticos de vencimento.
3. **Domínio personalizado por estabelecimento**:
   - Mapeamento CNAME/multi-domínio para clientes que desejarem endereço próprio fora de `/m/:slug`.
4. **MFA obrigatório para operadores da plataforma**:
   - Exigência de segundo fator (AAL2) antes de liberar rotas e RPCs de `/platform`.
5. **Auditoria e exportação LGPD para encerramento definitivo**:
   - Fluxo estruturado de exportação de catálogo e anonimização segura antes de exclusão definitiva de tenants arquivados.
6. **Observabilidade e métricas agregadas anônimas**:
   - Contagem básica de acessos sem cookies invasivos nem rastreamento individual de consumidores.

Não estão planejados no modelo consultivo atual: carrinho de compras, pedidos por mesa, delivery ou checkout de pagamento para consumidores finais, salvo mudança explícita de escopo do produto.


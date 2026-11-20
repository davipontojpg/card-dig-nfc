# Configuração de QR Code e Etiquetas NFC

## 1. URL Pública Estável

Tanto o QR Code quanto a etiqueta NFC apontam diretamente para a URL pública permanente do estabelecimento:

```text
https://<seu-dominio-estavel>/m/<slug-do-estabelecimento>
```

Nunca grave tags físicas ou imprima materiais definitivos enquanto `VITE_PUBLIC_APP_URL` apontar para `localhost` ou domínios temporários de preview. O painel `/app/acesso` exibe um alerta automático caso detecte URL instável.

## 2. QR Code (Disponível nos 3 Planos)

- Acesse `/app/acesso` no painel do estabelecimento.
- Faça o download em **PNG** (impressão rápida) ou **SVG** (gráfica/artes vetoriais).
- No MVP, o mesmo QR Code pode ser utilizado em todas as mesas e balcões, pois o sistema não controla comandas nem métricas individuais por mesa.
- Mantenha o QR Code visível mesmo em estabelecimentos com NFC, servindo como alternativa imediata para celulares sem suporte NFC ou com leitor desativado.

## 3. Etiquetas NFC (Planos `Cardápio + NFC` e `Cardápio + NFC + Promoções`)

### Especificação Recomendada

- **Chip recomendado:** **NTAG213** (13,56 MHz, ISO 14443-A), compatível com Android e iPhone (iOS) modernos para leitura de URL curta sem aplicativo adicional.
- **Conteúdo gravado:** exclusivamente o registro NDEF do tipo **URL / URI** contendo a URL pública `/m/:slug`. **Nunca** grave tokens administrativos, senhas ou dados privados na tag.

### Como Gravar com Aplicativo Externo (NFC Tools)

1. Copie a URL exata exibida na seção NFC em `/app/acesso`.
2. Abra o aplicativo **NFC Tools** (disponível para Android e iOS).
3. Toque em **Escrever → Adicionar registro → URL / URI**.
4. Cole a URL pública completa (`https://...`) e confirme.
5. Toque em **Escrever** e aproxime o aparelho da tag NFC.

### Cuidados Físicos e Teste Obrigatório

- **Superfícies metálicas:** mesas, suportes ou placas de metal interferem no campo eletromagnético da tag comum. Utilize tags **anti-metal com camada de ferrite** sempre que houver aplicação em metal.
- **Teste após fixação:** valide a leitura em Android e iOS **depois** de aplicar a tag no acrílico, adesivo ou mesa definitiva.
- **Bloqueio (Lock):** após confirmar que a URL definitiva está funcionando no suporte final e não precisará ser regravada, recomenda-se bloquear a tag para leitura apenas (Read-Only) quando o chip suportar, evitando sobrescritas por terceiros.
- **Aviso comercial:** chips, placas, adesivos, impressão e frete são itens físicos orçados separadamente dos valores de mensalidade e taxa de implantação do software.


# O que mudou — Controle de Acesso (catraca) + Gateway de Pagamento + revisão do Caixa

## 1. Passo obrigatório: rodar as migrações no Supabase

Vá no seu projeto Supabase → **SQL Editor** → **New query**, cole e rode, **nesta ordem**:

1. `database/migration_004_controle_acesso.sql`
2. `database/migration_005_catracas.sql`
3. `database/migration_006_gateway_pagamento.sql`
4. `database/migration_007_dispositivos_ip.sql`

(Se você nunca rodou as migrações 002/003 antigas, rode-as antes.)

## 2. Passo obrigatório: variável nova no `.env` do backend

Pra usar a tela **Gateway de Pagamento**, adicione no `backend/.env`:

```
GATEWAY_ENCRYPTION_KEY=<gere com: openssl rand -hex 32>
```

Sem isso, o resto do sistema funciona normal — só a tela de configurar
gateway (salvar uma chave nova) vai dar erro até você definir essa variável.
Seu Asaas que já estava configurado no `.env` (`ASAAS_API_KEY`) **continua
funcionando exatamente como antes**, como "padrão" — não precisa mexer em
nada pra continuar usando do jeito que já estava.

## 3. O que foi corrigido (bug real, não só o pedido de catraca)

O status "atrasado" das mensalidades só era recalculado quando alguém abria
as telas de **Dashboard** ou **Mensalidades**. Se a recepção usasse só as
telas de Alunos/Caixa/Catraca no dia, um aluno inadimplente conseguia
continuar "aparecendo" como em dia — inclusive pra decidir se ele entra ou
não na catraca. Corrigido em todos os pontos que decidem isso.

## 4. Controle de acesso (catraca)

- Nova página **Controle de Acesso**: quem está na academia agora, últimos
  acessos, liberação manual por CPF, lista de bloqueados.
- Histórico de entrada/saída de verdade (tabela `acessos`) — antes o sistema
  só checava "pode entrar?", sem guardar nada.
- Tela **Configurar catraca**: cadastro de cada equipamento físico (nome,
  marca, modelo, tipo de conexão), chave de integração, instruções
  específicas por marca.
- Permissão própria "Controle de Acesso" (antes misturada com "Relatórios").

### Control iD e Intelbras
Cadastre em Controle de Acesso → Configurar catraca, marque "Pergunta antes
de liberar (validação externa)" e siga as instruções que aparecem — a URL e
a chave já vêm prontas.

### Leitor facial EVO (e outros por IP/senha admin)
Pesquisei bastante e preciso ser transparente: **"EVO" é da Evo Sistemas
Inteligentes**, mas não encontrei documentação pública de uma API/protocolo
de integração de terceiros pra esse equipamento — diferente da Control iD,
que tem isso bem documentado.

O que implementei mesmo assim:
- Um modo de conexão "Avisa depois, tipo ADMS/iClock" — um protocolo comum
  usado por vários leitores biométricos de baixo custo vendidos no Brasil
  sob marcas diferentes. **É uma tentativa, não uma confirmação** de que o
  seu EVO fala esse protocolo especificamente. Vale testar (instruções na
  tela), mas pode não funcionar no seu modelo.
- Uma limitação física importante desse tipo de equipamento (não é algo que
  dá pra contornar só com código): ele decide sozinho e avisa o sistema
  DEPOIS que a pessoa já passou — diferente da Control iD, que pergunta
  antes. Então isso registra e AVISA em vermelho se alguém bloqueado passou
  mesmo assim, mas não impede a passagem em tempo real por si só.
- **Caminho mais seguro**: peça pro suporte da EVO (ou a revenda que vendeu
  o equipamento) o "manual de integração"/SDK do modelo exato. Com isso em
  mãos eu implemento certinho, sem chute.
- Campo novo "Código do dispositivo" na tela de editar aluno, pra mapear o
  aluno com o código/PIN cadastrado no equipamento (se ele não aceitar o
  CPF direto como código).

## 5. Gateway de pagamento — agora por academia

Antes, a chave do Asaas/Mercado Pago era **uma só pra todo o sistema** (via
`.env`) — se você tivesse mais de uma academia usando este sistema, o
dinheiro de todas cairia na mesma conta. Agora:

- Nova tela **Gateway de Pagamento** (menu admin): cada academia cadastra a
  própria conta Asaas e/ou Mercado Pago. Chave fica criptografada no banco.
- Baixa automática por webhook continua funcionando pros dois — e agora
  **revalida direto na API do gateway** (com a chave certa da academia)
  antes de dar baixa, em vez de confiar num token fixo só. Isso é mais
  seguro E resolve o problema de "qual chave usar" quando cada academia tem
  a sua.
- Boleto, PIX, e cobrança direta por cartão (via Asaas) continuam
  funcionando como antes, só que agora usando a chave certa de cada
  academia.
- Configure os webhooks no painel do Asaas/Mercado Pago de **cada academia**
  apontando pra mesma URL de sempre.

## 6. Caixa — painel de mensalidades atrasadas + revisão

- **Painel lateral no Caixa** mostrando as mensalidades atrasadas, com
  filtro por nome e botão "Receber" que já abre a cobrança pronta (mesmo
  fluxo de PIX que já existia) — sem precisar sair do Caixa.
- Mensagens de erro claras quando tipo/categoria/valor vêm errados.
- Validação de valor de abertura/fechamento de caixa.

## 7. Arquivos novos/alterados (resumo técnico)

- `database/migration_004_controle_acesso.sql`, `migration_005_catracas.sql`, `migration_006_gateway_pagamento.sql`, `migration_007_dispositivos_ip.sql` (novos)
- `backend/services/acessoService.js`, `criptografia.js` (novos)
- `backend/routes/acesso.routes.js` (reescrito, +catracas, +tipo_conexao)
- `backend/routes/dispositivoPush.routes.js` (novo, experimental)
- `backend/routes/configuracaoPagamento.routes.js` (novo)
- `backend/routes/webhooks.routes.js` (reescrito - multi-tenant)
- `backend/services/asaasService.js`, `mercadoPagoService.js`, `gatewayPagamento.js` (reescritos - credenciais por academia)
- `backend/routes/alunos.routes.js`, `caixa.routes.js` (correções)
- `backend/middleware/authorize.js` (+ módulo "acesso")
- `frontend/src/pages/ControleAcesso.jsx`, `ConfiguracaoPagamento.jsx` (novos)
- `frontend/src/pages/Caixa.jsx` (painel de atrasadas)
- `frontend/src/pages/AlunoPerfil.jsx` (+ campo código do dispositivo)
- `frontend/src/pages/Relatorios.jsx` (aba de acesso removida, virou página própria)
- `frontend/src/lib/permissoes.js`, `Funcionarios.jsx`, `App.jsx`, `Layout.jsx` (módulo "acesso" + novas rotas/menu)
- `integracoes/ponte-catraca/` (script-modelo pra catracas sem validação externa nativa)


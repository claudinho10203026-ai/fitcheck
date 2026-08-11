# O que mudou — Controle de Acesso (catraca) + revisão do Caixa

## 1. Passo obrigatório: rodar as migrações no Supabase

Vá no seu projeto Supabase → **SQL Editor** → **New query**, cole e rode, **nesta ordem**:

1. `database/migration_004_controle_acesso.sql`
2. `database/migration_005_catracas.sql`

(Se você nunca rodou as migrações 002/003 antigas, rode-as antes. Se já rodou, pode ignorar — essas duas novas não repetem nada delas.)

Sem isso, a tela de Controle de Acesso abre mas mostra tudo zerado (o backend foi feito pra não quebrar mesmo se você ainda não rodou a migração, mas obviamente nada funciona de verdade até rodar).

## 2. O que foi corrigido (bug real, não só o pedido de catraca)

O status "atrasado" das mensalidades só era recalculado quando alguém abria as
telas de **Dashboard** ou **Mensalidades**. Se a recepção usasse só as telas
de Alunos/Caixa/Catraca no dia, um aluno inadimplente conseguia continuar
"aparecendo" como em dia — inclusive pra decidir se ele entra ou não na
catraca. Corrigido em todos os pontos que decidem isso (catraca, lista de
alunos, perfil do aluno): agora todos comparam a data de vencimento
diretamente, e não só o rótulo salvo no banco.

## 3. O que foi construído (controle de acesso)

- **Nova aba/página "Controle de Acesso"** no menu (antes só existia um pedaço
  disso escondido dentro de Relatórios).
- **Histórico de entrada/saída** de verdade — antes o sistema só checava
  "pode entrar?", não guardava nada. Agora toda tentativa (liberada ou
  negada, pela catraca ou manual) fica registrada.
- **"Quem está na academia agora"** — contador ao vivo.
- **Liberação manual** com busca por CPF, pra usar sem catraca ou como
  reforço. Se o aluno estiver bloqueado, só quem tem permissão de
  "gerenciar" em Controle de Acesso pode liberar mesmo assim (fica marcado
  como "forçado" no histórico, com o nome de quem liberou).
- **Tela "Configurar catraca"**: gerar/copiar a chave de integração,
  cadastrar cada catraca física (nome, marca, modelo, local) e ver o
  passo a passo específico pra a marca escolhida.
- **Permissão própria** "Controle de Acesso" na tela de Funcionários —
  antes estava misturada com "Relatórios".

## 4. Control iD e Intelbras (as marcas que você vai usar)

Abra a tela **Controle de Acesso → Configurar catraca**, cadastre cada
equipamento e clique em "Ver instruções" — o passo a passo aparece ali,
específico pra marca escolhida. Resumo:

- **Control iD**: a maioria dos modelos (iDFace, iDAccess) tem uma opção
  nativa de "validação externa" — você aponta ela pra URL que a tela te dá,
  sem precisar de nenhum programa adicional.
- **Intelbras**: depende do modelo/firmware. Se o seu tiver "validação
  online"/webhook, é a mesma lógica do Control iD. Se não tiver, criei um
  modelo de "ponte" pronto em `integracoes/ponte-catraca/` — um programinha
  que roda num PC/Raspberry Pi na rede da catraca e fala com o sistema por
  você. Falta só ligar a parte específica do SDK Intelbras do seu modelo
  exato — me manda o manual/modelo quando tiver em mãos que eu completo.

Isso cobre "todas as catracas" no sentido que importa: qualquer equipamento
que suporte validação externa funciona direto; qualquer um que não suporte
usa a ponte genérica (só falta o cabo final até o SDK do fabricante, que eu
não posso adivinhar sem o manual do modelo específico).

## 5. Caixa — revisão

O Caixa já estava funcional (abre/fecha sessão, entradas/saídas, baixa
automática de mensalidade, PIX/boleto via Mercado Pago). O que eu ajustei:

- Mensagens de erro claras quando o tipo/categoria/valor vêm errados (antes
  caía num erro genérico de banco).
- Validação de valor de abertura/fechamento de caixa.

Não mudei nada da lógica de dinheiro em si — só travas de validação.

## 6. Arquivos novos/alterados (resumo técnico)

- `database/migration_004_controle_acesso.sql` (novo)
- `database/migration_005_catracas.sql` (novo)
- `backend/services/acessoService.js` (novo)
- `backend/routes/acesso.routes.js` (reescrito)
- `backend/routes/alunos.routes.js` (corrigido)
- `backend/middleware/authorize.js` (+ módulo "acesso")
- `backend/routes/caixa.routes.js` (validações)
- `frontend/src/pages/ControleAcesso.jsx` (novo)
- `frontend/src/pages/Relatorios.jsx` (aba de acesso removida, ficou só inadimplência)
- `frontend/src/lib/permissoes.js`, `frontend/src/pages/Funcionarios.jsx`, `frontend/src/App.jsx`, `frontend/src/components/Layout.jsx` (módulo "acesso")
- `integracoes/ponte-catraca/` (novo — script-modelo pra catracas sem validação externa nativa)

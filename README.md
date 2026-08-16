# Sistema de Gestão de Academia

Sistema completo para administração de academia: cadastro de alunos, matrículas,
geração de carnê/boleto de mensalidade, baixa de pagamentos, caixa não fiscal,
relatório de inadimplência e controle de acesso da equipe por tela.

**Stack:** PostgreSQL (Supabase) · Backend Node.js/Express (login e permissões próprios) · Frontend React (Vite + Tailwind)

## Estrutura do projeto

```
academia-sistema/
├── database/schema.sql     # Schema completo para rodar no Supabase
├── backend/                # API REST (Node + Express)
└── frontend/                # Interface (React + Vite + Tailwind)
```

## Como funciona o login

O login **não** usa e-mail nem o Supabase Auth. Cada academia é um "tenant"
isolado no banco, e o funcionário entra com três campos: **nome da academia**,
**usuário** e **senha**. Isso é 100% controlado pelo próprio backend (senha
com hash bcrypt, sessão em JWT) — o Supabase é usado só como banco Postgres.

Cada funcionário é `admin` (acesso total, inclusive gerenciar outros
funcionários) ou `membro` (acesso definido tela a tela pelo admin, na tela
**Funcionários**). Para cada tela — Alunos, Matrículas, Mensalidades, Caixa,
Relatórios — o admin escolhe: **Sem acesso**, **Visualizar** ou **Gerenciar**.
"Visualizar" mostra a tela sem os botões de criar/editar/excluir; "Gerenciar"
libera tudo. O Dashboard é sempre visível a qualquer funcionário logado.

## 1. Configurar o Supabase

1. Crie um projeto em [app.supabase.com](https://app.supabase.com).
2. Vá em **SQL Editor** → **New query**, cole todo o conteúdo de `database/schema.sql` e rode.
   Isso cria todas as tabelas, o bucket de storage para fotos de alunos, e habilita RLS
   (só o backend, com a chave `service_role`, acessa os dados).
3. Em **Project Settings → API**, anote o `Project URL` e a chave `service_role`.

> **Já tinha rodado o `schema.sql` antes desta versão?** Rode também
> `database/migration_ficha_completa.sql`, `database/migration_002_agendamento_acesso.sql`
> e `database/migration_003_asaas.sql` no SQL Editor (nessa ordem) — cada um só
> adiciona o que é novo, sem apagar nada do que já existe. Se está criando o
> banco do zero, ignore os três: o `schema.sql` já inclui tudo.

## 2. Rodar o backend

```bash
cd backend
cp .env.example .env    # preencha SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
npm install
npm start               # API em http://localhost:3001
```

`JWT_SECRET` é o segredo que assina o login — gere um valor aleatório, por exemplo
rodando `openssl rand -hex 32` no terminal.

## 3. Criar sua academia e o primeiro administrador (bootstrap)

Como o login é próprio (não tem tela de "criar conta" pública, de propósito -
isso evita que qualquer pessoa crie uma academia sozinha), a primeira academia
e o primeiro admin são criados uma única vez via SQL:

**a) Gere o hash da senha do admin** (já com `npm install` feito no backend):

```bash
cd backend
node -e "console.log(require('bcryptjs').hashSync('SUA_SENHA_AQUI', 10))"
```

Copie o hash gerado (algo como `$2a$10$...`).

**b) No SQL Editor do Supabase, rode:**

```sql
-- 1. cria a academia
insert into academias (nome) values ('Academia Exemplo') returning id;
-- copie o "id" retornado e cole nos dois inserts abaixo, no lugar de ACADEMIA_ID

-- 2. cria o primeiro admin (troque o usuário, nome e o hash gerado no passo a)
insert into funcionarios (academia_id, nome, usuario, senha_hash, tipo)
values ('ACADEMIA_ID', 'Seu Nome', 'admin', 'COLE_O_HASH_AQUI', 'admin');

-- 3. (opcional) planos iniciais - ajuste para os planos reais da academia
insert into planos (academia_id, nome, valor, duracao_meses, descricao) values
  ('ACADEMIA_ID', 'Mensal', 120.00, 1, 'Plano mensal'),
  ('ACADEMIA_ID', 'Trimestral', 330.00, 3, 'Plano trimestral com desconto'),
  ('ACADEMIA_ID', 'Anual', 1080.00, 12, 'Plano anual');
```

Pronto — esse é o único passo manual. Depois de logado como admin, você cria
os demais funcionários (membros da equipe) direto pela tela **Funcionários**,
sem precisar mexer em SQL de novo.

## 4. Rodar o frontend

```bash
cd frontend
cp .env.example .env    # confirme VITE_API_URL (padrão já aponta pro backend local)
npm install
npm run dev              # app em http://localhost:5173
```

Acesse `http://localhost:5173` e entre com o nome da academia + usuário +
senha que você criou no passo 3.

## 5. Gateway de pagamento: boleto, PIX e cartão de verdade (opcional)

O sistema funciona 100% no modo manual (baixa feita pela recepção) sem nenhuma
configuração extra. Para emitir boleto/PIX/cartão de verdade, dá pra usar **Asaas**
(recomendado) ou **Mercado Pago** — o backend detecta automaticamente qual dos dois
está configurado (`backend/services/gatewayPagamento.js`); se os dois estiverem
preenchidos, o Asaas tem prioridade.

### Asaas (recomendado para academia)

O Asaas foi desenhado para negócios por assinatura (é o que muita academia/escola
usa no Brasil): além de boleto e PIX, ele já manda **lembrete de cobrança automático**
por e-mail/SMS/WhatsApp pro aluno sem você precisar programar nada disso.

1. Crie uma conta em [asaas.com](https://www.asaas.com) (tem um ambiente **Sandbox**
   gratuito pra testar sem mexer com dinheiro real - use-o primeiro).
2. Pegue a API Key em **Integrações → API Key** (chave de sandbox começa com
   `$aact_hmlg_`, chave de produção começa com `$aact_prod_`).
3. No `.env` do backend, preencha `ASAAS_API_KEY` e defina `ASAAS_ENV=sandbox`
   (troque para `production` só depois de validar tudo).
4. Para os pagamentos confirmarem sozinhos (webhook): em **Integrações → Webhooks**,
   crie um webhook apontando para `https://SEU-BACKEND/api/webhooks/asaas`, escolha
   um token qualquer e cole o mesmo valor em `ASAAS_WEBHOOK_TOKEN` no `.env`.

O que já funciona com o Asaas configurado:
- **Boleto** e **PIX** (com QR code de verdade) por mensalidade, na tela Mensalidades.
- **Cartão de crédito** (cobrança avulsa, sem salvar o cartão) por mensalidade.
- **Receber PIX direto no Caixa**: ao registrar uma movimentação de "Mensalidade",
  aparece um botão "Cobrar via PIX" que gera o QR code na hora, aguarda o aluno pagar
  (verifica automaticamente a cada poucos segundos) e já lança a entrada no caixa
  assim que confirma.

### Mercado Pago (alternativa)

1. Gere um *Access Token* em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers).
2. Preencha `MERCADOPAGO_ACCESS_TOKEN` no `.env` do backend (só é usado se
   `ASAAS_API_KEY` estiver vazio).
3. Configure o webhook do Mercado Pago apontando para `https://SEU-BACKEND/api/webhooks/mercadopago`.

> Hoje as credenciais do gateway são únicas para todo o sistema (não por
> academia). Se for operar mais de uma academia com contas bancárias diferentes,
> isso precisaria virar uma credencial por academia — não incluído aqui para
> manter o escopo enxuto, mas é uma extensão natural do design atual.
>
> A API de qualquer gateway muda com frequência — antes de ir para produção, confira
> a documentação atual: [Asaas](https://docs.asaas.com) ou
> [Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs). Trocar de
> gateway no futuro é só mexer em `backend/services/`; o resto do sistema não
> depende do provedor específico.

## Telas incluídas

| Tela | Onde está | Quem acessa |
|---|---|---|
| Login | `/login` | Todos |
| Dashboard (resumo + adimplência) | `/` | Todo funcionário logado |
| Cadastro de alunos | `/alunos` | Permissão `alunos` |
| Perfil detalhado do aluno | `/alunos/:id` | Permissão `alunos` |
| Liberação de matrícula | `/matriculas` | Permissão `matriculas` |
| Mensalidades (lista + baixa) | `/mensalidades` | Permissão `mensalidades` |
| Criação de carnê/boleto | `/mensalidades/novo-carne` | Permissão `mensalidades` (gerenciar) |
| Caixa completo (não fiscal) | `/caixa` | Permissão `caixa` |
| Relatório de inadimplência e controle de acesso | `/relatorios` | Permissão `relatorios` |
| Agendamento com profissional escolhido | `/agendamentos` | Permissão `agendamentos` |
| Planos (tipo de mensalidade e preços) | `/planos` | Só admin |
| Funcionários (contas e permissões) | `/funcionarios` | Só admin |

## Ficha do aluno: médica e financeira

O perfil do aluno (`/alunos/:id`) tem 3 abas:

- **Geral**: contato, endereço, dados pessoais.
- **Ficha Médica**: dados físicos (peso/altura/objetivo), tipo sanguíneo, condições
  pré-existentes, **PAR-Q** (questionário padrão de 7 perguntas usado internacionalmente
  para triagem antes de atividade física — se alguma resposta indicar risco, a tela
  mostra um alerta), medicação de uso contínuo, alergias, cirurgias recentes, situação
  do atestado médico (apto / apto com restrição / inapto, com validade) e contato de
  emergência.
- **Financeiro**: resumo (total pago, em aberto/atraso, ticket médio — calculados a
  partir do histórico de mensalidades), desconto percentual, responsável financeiro
  (para quando quem paga não é o próprio aluno, ex: pai/mãe de menor de idade),
  observações, matrículas e histórico de mensalidades.

**Foto do aluno**: passe o mouse sobre a foto no perfil (ou toque, no celular) para
trocar. A imagem é redimensionada no navegador antes do envio (evita fotos gigantes de
câmera) e fica guardada no bucket `fotos-alunos` do Supabase Storage, criado
automaticamente pelo `schema.sql`/migração.

## Planos: tipo de mensalidade e preços

A tela **Planos** (só admin) cadastra e edita os planos oferecidos — nome, valor,
duração em meses e descrição. São esses planos que aparecem nos formulários de
matrícula e de geração de carnê/boleto.

## Agendamento com profissional escolhido

Qualquer funcionário pode ser marcado como "agendável" (checkbox + especialidade,
na tela **Funcionários**) — isso não muda o acesso dele ao sistema, só faz ele
aparecer como opção de profissional na tela **Agendamentos**. Lá, a equipe escolhe
o aluno, o profissional, data e horário; o sistema impede marcar dois agendamentos
sobrepostos para o mesmo profissional. Status possíveis: confirmado, realizado,
falta, cancelado.

## Controle de acesso / bloqueio de catraca

Um aluno é considerado **bloqueado** quando: o cadastro não está "ativo", OU não
tem nenhuma matrícula "ativa", OU tem alguma mensalidade "atrasada". Isso aparece
automaticamente na lista de alunos, no perfil do aluno, e na aba **Acesso/Catraca**
dentro de Relatórios (lista de bloqueados + consulta manual por CPF).

Para conectar isso a uma **catraca física**, a aba Acesso/Catraca (visível só
para admin) gera uma chave de integração e mostra a URL que o controlador da
catraca deve chamar antes de liberar a passagem:

```
GET /api/acesso/verificar?cpf=00000000000
X-Chave-Integracao: <chave gerada na tela>
```

A resposta é um JSON simples: `{ "liberado": true/false, "motivo": "...", "aluno": {...} }`.

> **Importante:** eu não tenho como testar isso contra uma catraca física de
> verdade (cada fabricante — Control iD, Henry, Topdata etc. — tem seu próprio
> protocolo e software de configuração, e isso não é algo que eu consiga acessar
> por aqui). O que entreguei é exatamente o "lado do software": a lógica de quem
> está liberado/bloqueado e um endpoint documentado pronto para o controlador da
> catraca consultar. O passo de configurar SEU equipamento específico para chamar
> essa URL depende da documentação/suporte do fabricante da sua catraca — a maioria
> dos modelos eletrônicos/biométricos tem um campo para "URL de verificação externa"
> ou webhook nas configurações do software que acompanha o equipamento.

## Segurança

- O frontend nunca fala com o Supabase diretamente — só com a API do backend,
  que usa a chave `service_role` (nunca exposta ao navegador).
- Toda rota da API filtra os dados pela academia do funcionário logado
  (`academia_id` extraído do token) e confere a permissão dele naquela tela
  antes de responder — a checagem de permissão no frontend é só uma
  conveniência de interface, quem garante o acesso de verdade é o backend.
- RLS está habilitado em todas as tabelas, mas sem nenhuma policy liberando
  `anon`/`authenticated`: só a chave `service_role` (usada exclusivamente
  pelo backend) consegue ler/escrever. É uma camada extra de proteção caso a
  URL do Supabase e alguma chave errada vazem.
- Senhas são armazenadas com hash bcrypt (nunca em texto puro).
- Não é possível remover/rebaixar o último admin ativo de uma academia (evita
  ficar sem ninguém com acesso total).

## Próximos passos sugeridos

- Se for usar o gateway, testar em modo sandbox do Mercado Pago antes de produção.
- Considerar limite de tentativas de login (rate limiting) se o sistema for
  exposto publicamente na internet.
- A ficha de anamnese hoje é preenchida pela equipe no sistema; se quiser que o
  próprio aluno preencha (e assine digitalmente) antes da matrícula, isso viraria
  um formulário público separado — não incluído aqui de propósito, pra manter o
  escopo no que foi pedido.
- Hoje o bloqueio de catraca é "tudo ou nada" no dia seguinte ao vencimento; se
  quiser um período de tolerância configurável (ex: 3 dias de carência antes de
  bloquear), é uma extensão pequena da mesma lógica em `acesso.routes.js`.
- Outras funcionalidades comuns em sistemas de academia que ainda não estão aqui
  (peça se quiser que eu implemente): ficha de treino/prescrição de exercícios,
  avaliação física periódica com histórico de evolução, portal do próprio aluno,
  check-in de frequência, turmas/aulas coletivas com vagas limitadas, e emissão
  de nota fiscal (NFS-e).
- O cartão de crédito hoje cobra uma vez por mensalidade (o funcionário digita os
  dados do cartão a cada cobrança). O Asaas também tem **assinaturas** nativas
  (cobrança recorrente automática, sem precisar digitar o cartão de novo todo
  mês) - é uma extensão possível de `backend/services/asaasService.js`, mas
  muda a forma como o carnê é gerado hoje (localmente, mês a mês), então não
  entrou nesta entrega para não arriscar o que já está funcionando.

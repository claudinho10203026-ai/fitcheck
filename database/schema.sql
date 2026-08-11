-- ============================================================================
-- SISTEMA DE GESTÃO DE ACADEMIA - SCHEMA POSTGRESQL (SUPABASE)
-- ============================================================================
-- Como usar:
-- 1. Acesse seu projeto em https://app.supabase.com
-- 2. Vá em "SQL Editor" -> "New query"
-- 3. Cole este arquivo inteiro e clique em "Run"
-- 4. Depois disso, veja o README para o passo de "bootstrap" (criar sua
--    academia e o primeiro usuário admin).
--
-- MODELO DE AUTENTICAÇÃO: este projeto usa login PRÓPRIO (não o Supabase
-- Auth), porque o login aqui é feito por "nome da academia + usuário + senha"
-- em vez de e-mail. O Supabase é usado só como banco Postgres. Toda a
-- autenticação/autorização roda no backend (ver backend/routes/auth.routes.js).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. ACADEMIAS (cada academia é um "tenant" isolado dentro do mesmo banco)
-- ============================================================================
create table if not exists academias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  -- Chave usada pelo controlador da catraca (hardware) para consultar
  -- GET /api/acesso/verificar - não é senha de funcionário, é só dessa
  -- academia para a integração de acesso. Gerada pela tela de Relatórios > Acesso.
  chave_integracao_catraca text unique,
  created_at timestamptz not null default now()
);

-- nome único (sem diferenciar maiúsculas/minúsculas) - é por ele que o login busca a academia
create unique index if not exists idx_academias_nome_lower on academias (lower(nome));

comment on table academias is 'Cada linha é uma academia cliente do sistema (multi-tenant)';

-- ============================================================================
-- 2. FUNCIONARIOS (quem faz login no sistema: admin ou membro da equipe)
-- ============================================================================
create table if not exists funcionarios (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,
  nome text not null,
  usuario text not null, -- login por usuário (não é e-mail)
  senha_hash text not null, -- gerado com bcrypt (backend), nunca texto puro
  tipo text not null default 'membro' check (tipo in ('admin', 'membro')),

  -- Permissões por tela, só usadas quando tipo = 'membro' (admin tem acesso total).
  -- Formato: {"alunos": "gerenciar", "matriculas": "visualizar", "mensalidades": "nenhum", ...}
  -- Valores possíveis por tela: 'nenhum' | 'visualizar' | 'gerenciar'
  permissoes jsonb not null default '{}'::jsonb,

  ativo boolean not null default true,

  -- Se este funcionário pode ser escolhido como profissional na tela de
  -- Agendamentos (ex: personal trainers, instrutores). Não afeta login/permissões.
  agendavel boolean not null default false,
  especialidade text, -- ex: "Musculação", "Pilates", "Funcional"

  created_at timestamptz not null default now()
);

-- usuário único dentro da mesma academia (duas academias podem ter cada uma um "joao")
create unique index if not exists idx_funcionarios_usuario_lower on funcionarios (academia_id, lower(usuario));
create index if not exists idx_funcionarios_academia on funcionarios (academia_id);

comment on table funcionarios is 'Equipe da academia que acessa o sistema (login + permissões por tela)';

-- ============================================================================
-- 3. PLANOS (planos de mensalidade oferecidos por cada academia)
-- ============================================================================
create table if not exists planos (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,
  nome text not null,
  valor numeric(10,2) not null check (valor >= 0),
  duracao_meses int not null default 1 check (duracao_meses > 0),
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_planos_academia on planos (academia_id);
comment on table planos is 'Planos de mensalidade (mensal, trimestral, anual, etc.) de cada academia';

-- ============================================================================
-- 4. ALUNOS (cadastro de alunos)
-- ============================================================================
create table if not exists alunos (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,
  nome text not null,
  cpf text not null,
  email text,
  telefone text,
  data_nascimento date,
  sexo text check (sexo in ('masculino', 'feminino', 'outro', null)),

  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,

  foto_url text,
  asaas_customer_id text, -- id do cliente no Asaas (evita recriar a cada cobrança)
  peso_kg numeric(5,2),
  altura_cm numeric(5,2),
  objetivo text,
  observacoes_medicas text,
  contato_emergencia_nome text,
  contato_emergencia_telefone text,

  -- Ficha médica estruturada (PAR-Q, condições, atestado, tipo sanguíneo etc).
  -- Fica em JSON em vez de uma coluna por campo porque é sempre lida/gravada
  -- como um bloco só (a tela de "Ficha Médica" no perfil do aluno) e evita
  -- uma tabela com 20+ colunas raramente consultadas isoladamente.
  -- Formato: { tipo_sanguineo, par_q: {q1..q7}, condicoes: {...}, medicamentos_uso_continuo,
  --            alergias, cirurgias_recentes, atestado: {apto, data_emissao, validade, medico_nome, medico_crm} }
  ficha_medica jsonb not null default '{}'::jsonb,

  -- Ficha financeira
  desconto_percentual numeric(5,2) not null default 0 check (desconto_percentual between 0 and 100),
  observacoes_financeiras text,
  responsavel_financeiro_nome text,
  responsavel_financeiro_cpf text,
  responsavel_financeiro_telefone text,

  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'suspenso')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table alunos is 'Cadastro completo dos alunos de cada academia';
create unique index if not exists idx_alunos_cpf_por_academia on alunos (academia_id, cpf);
create index if not exists idx_alunos_nome on alunos using gin (to_tsvector('portuguese', nome));
create index if not exists idx_alunos_academia on alunos (academia_id);
create index if not exists idx_alunos_status on alunos (status);

-- ============================================================================
-- 5. MATRICULAS (vínculo do aluno com um plano - liberação de matrícula)
-- ============================================================================
create table if not exists matriculas (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  plano_id uuid not null references planos(id),
  data_inicio date not null default current_date,
  data_fim date,
  status text not null default 'pendente' check (status in ('pendente', 'ativa', 'suspensa', 'cancelada')),
  liberada_por uuid references funcionarios(id),
  liberada_em timestamptz,
  observacoes text,
  created_at timestamptz not null default now()
);

comment on table matriculas is 'Matrículas dos alunos em planos - controla liberação de acesso';
create index if not exists idx_matriculas_academia on matriculas (academia_id);
create index if not exists idx_matriculas_aluno on matriculas (aluno_id);
create index if not exists idx_matriculas_status on matriculas (status);

-- ============================================================================
-- 6. FORMAS_PAGAMENTO (lista global de formas de pagamento - compartilhada
-- entre todas as academias, já que "Dinheiro/PIX/Cartão" são conceitos genéricos)
-- ============================================================================
create table if not exists formas_pagamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null default 'manual' check (tipo in ('manual', 'gateway')),
  ativo boolean not null default true
);

comment on table formas_pagamento is 'Formas de pagamento aceitas (dinheiro, cartão, PIX, boleto etc.) - lista global';

insert into formas_pagamento (nome, tipo) values
  ('Dinheiro', 'manual'),
  ('Cartão de Débito', 'manual'),
  ('Cartão de Crédito', 'manual'),
  ('PIX', 'manual'),
  ('Boleto (gateway)', 'gateway'),
  ('PIX (gateway)', 'gateway'),
  ('Cartão (gateway)', 'gateway')
on conflict (nome) do nothing;

-- ============================================================================
-- 7. MENSALIDADES (boletos/carnê de mensalidade)
-- ============================================================================
create table if not exists mensalidades (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  matricula_id uuid not null references matriculas(id) on delete cascade,

  numero_parcela int not null default 1,
  total_parcelas int not null default 1,
  valor numeric(10,2) not null check (valor >= 0),
  data_vencimento date not null,
  data_pagamento timestamptz,

  status text not null default 'em_aberto' check (status in ('em_aberto', 'pago', 'atrasado', 'cancelado')),

  forma_pagamento_id uuid references formas_pagamento(id),

  gateway_provider text,
  gateway_payment_id text,
  gateway_status text,
  gateway_link text,
  gateway_boleto_url text,
  gateway_linha_digitavel text,

  baixa_manual boolean not null default false,
  baixa_por uuid references funcionarios(id),

  created_at timestamptz not null default now()
);

comment on table mensalidades is 'Parcelas de mensalidade (boletos/carnê) de cada matrícula';
create index if not exists idx_mensalidades_academia on mensalidades (academia_id);
create index if not exists idx_mensalidades_aluno on mensalidades (aluno_id);
create index if not exists idx_mensalidades_status on mensalidades (status);
create index if not exists idx_mensalidades_vencimento on mensalidades (data_vencimento);
create index if not exists idx_mensalidades_gateway_payment on mensalidades (gateway_payment_id);

-- ============================================================================
-- 8. CAIXA_SESSOES (abertura/fechamento de caixa - não fiscal, por academia)
-- ============================================================================
create table if not exists caixa_sessoes (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,
  aberto_por uuid not null references funcionarios(id),
  data_abertura timestamptz not null default now(),
  valor_abertura numeric(10,2) not null default 0,

  fechado_por uuid references funcionarios(id),
  data_fechamento timestamptz,
  valor_fechamento_informado numeric(10,2),
  valor_fechamento_calculado numeric(10,2),

  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  observacoes text
);

comment on table caixa_sessoes is 'Sessões de caixa (abertura e fechamento do dia) - controle não fiscal, por academia';
create index if not exists idx_caixa_sessoes_academia on caixa_sessoes (academia_id);

-- Garante que cada academia só pode ter UMA sessão de caixa aberta por vez
create unique index if not exists idx_caixa_sessao_unica_aberta
  on caixa_sessoes (academia_id) where (status = 'aberto');

-- ============================================================================
-- 9. CAIXA_MOVIMENTACOES (lançamentos de entrada/saída do caixa)
-- ============================================================================
create table if not exists caixa_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,
  caixa_sessao_id uuid not null references caixa_sessoes(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida')),
  categoria text not null default 'outro' check (categoria in ('mensalidade', 'produto', 'sangria', 'suprimento', 'outro')),
  descricao text,
  valor numeric(10,2) not null check (valor > 0),
  forma_pagamento_id uuid references formas_pagamento(id),
  mensalidade_id uuid references mensalidades(id),
  registrado_por uuid references funcionarios(id),
  created_at timestamptz not null default now()
);

comment on table caixa_movimentacoes is 'Lançamentos financeiros dentro de uma sessão de caixa';
create index if not exists idx_movimentacoes_sessao on caixa_movimentacoes (caixa_sessao_id);
create index if not exists idx_movimentacoes_academia on caixa_movimentacoes (academia_id);

-- ============================================================================
-- 10. AGENDAMENTOS (aluno agenda um horário com um profissional/funcionário)
-- ============================================================================
create table if not exists agendamentos (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id), -- o profissional escolhido
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  servico text, -- ex: "Avaliação física", "Personal Training", "Pilates"
  status text not null default 'confirmado' check (status in ('confirmado', 'cancelado', 'realizado', 'falta')),
  observacoes text,
  criado_por uuid references funcionarios(id),
  created_at timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);

comment on table agendamentos is 'Agendamentos de aluno com um profissional/funcionário em um horário específico';
create index if not exists idx_agendamentos_academia_data on agendamentos (academia_id, data);
create index if not exists idx_agendamentos_funcionario on agendamentos (funcionario_id, data);
create index if not exists idx_agendamentos_aluno on agendamentos (aluno_id);

-- ============================================================================
-- STORAGE: bucket público para fotos de alunos (upload feito pelo backend
-- com a service_role key; leitura pública porque é só a foto de perfil)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('fotos-alunos', 'fotos-alunos', true)
on conflict (id) do nothing;

-- ============================================================================
-- FUNÇÃO: atualizar status de mensalidades vencidas automaticamente
-- ============================================================================
create or replace function public.atualizar_mensalidades_atrasadas()
returns void as $$
begin
  update mensalidades
  set status = 'atrasado'
  where status = 'em_aberto'
    and data_vencimento < current_date;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- TRIGGER: manter updated_at de alunos em dia
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_alunos_updated_at on alunos;
create trigger trg_alunos_updated_at
  before update on alunos
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- Este backend acessa o Supabase SEMPRE com a chave "service_role" (que
-- ignora RLS por padrão no Postgres/Supabase). O frontend NUNCA fala
-- diretamente com o Supabase. Por isso, deixamos RLS ligado mas sem nenhuma
-- policy liberando `anon`/`authenticated` - ou seja, só o backend (service_role)
-- consegue ler/escrever. Isso é só uma camada extra de proteção (defesa em
-- profundidade) caso a chave anon vaze; o controle de acesso "de verdade"
-- (quem vê o quê) é feito no backend, por academia_id e por permissão.
-- ============================================================================
alter table academias enable row level security;
alter table funcionarios enable row level security;
alter table planos enable row level security;
alter table alunos enable row level security;
alter table matriculas enable row level security;
alter table formas_pagamento enable row level security;
alter table mensalidades enable row level security;
alter table caixa_sessoes enable row level security;
alter table caixa_movimentacoes enable row level security;
alter table agendamentos enable row level security;

-- ============================================================================
-- FIM DO SCHEMA - veja o README para o passo de bootstrap (criar sua
-- academia + primeiro usuário admin)
-- ============================================================================

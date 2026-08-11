-- ============================================================================
-- MIGRAÇÃO 2: agendamento com profissional + bloqueio de catraca
-- ============================================================================
-- Rode se você já tinha rodado o schema.sql (ou a primeira migração) antes
-- desta atualização. Se está criando o banco do zero, ignore este arquivo -
-- o schema.sql já inclui tudo isso.
--
-- Como usar: SQL Editor do Supabase -> New query -> cole e rode.
-- ============================================================================

-- funcionário pode ser marcado como "agendável" (aparece no picker de profissional)
alter table funcionarios add column if not exists agendavel boolean not null default false;
alter table funcionarios add column if not exists especialidade text;

-- chave de integração da catraca (por academia)
alter table academias add column if not exists chave_integracao_catraca text;
do $$
begin
  alter table academias add constraint academias_chave_integracao_catraca_key unique (chave_integracao_catraca);
exception
  when duplicate_object then null;
end $$;

-- tabela de agendamentos
create table if not exists agendamentos (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id),
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  servico text,
  status text not null default 'confirmado' check (status in ('confirmado', 'cancelado', 'realizado', 'falta')),
  observacoes text,
  criado_por uuid references funcionarios(id),
  created_at timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);

create index if not exists idx_agendamentos_academia_data on agendamentos (academia_id, data);
create index if not exists idx_agendamentos_funcionario on agendamentos (funcionario_id, data);
create index if not exists idx_agendamentos_aluno on agendamentos (aluno_id);

alter table agendamentos enable row level security;

-- ============================================================================
-- FIM DA MIGRAÇÃO 2
-- ============================================================================

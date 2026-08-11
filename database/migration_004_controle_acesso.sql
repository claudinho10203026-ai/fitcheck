-- ============================================================================
-- MIGRAÇÃO 4: CONTROLE DE ACESSO (catraca) - log de entrada/saída
-- ============================================================================
-- Rode no SQL Editor do Supabase (New query -> cole -> Run). Pode rodar mesmo
-- que já tenha rodado as migrações 002/003 antes - é seguro rodar de novo
-- (tudo usa "if not exists"/"if exists").
--
-- O que isso adiciona:
-- 1) Tabela `acessos`: cada linha é UMA tentativa de passagem (entrada ou
--    saída), permitida ou negada, seja pela catraca (hardware) ou registrada
--    manualmente pela recepção. É o "extrato" de entrada/saída da academia.
-- 2) View `acesso_presencas_hoje`: calcula quem está DENTRO da academia agora
--    (última leitura liberada de hoje foi uma entrada, sem saída depois).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABELA: acessos
-- ----------------------------------------------------------------------------
create table if not exists acessos (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,

  -- Pode ser null quando o CPF lido não corresponde a nenhum aluno cadastrado
  -- nesta academia (ainda registramos a tentativa, pra aparecer no histórico
  -- e a recepção entender "alguém tentou passar um CPF desconhecido").
  aluno_id uuid references alunos(id) on delete set null,
  cpf_informado text,

  tipo text not null default 'entrada' check (tipo in ('entrada', 'saida')),
  liberado boolean not null,
  motivo text,

  -- 'catraca' = veio do hardware (autenticado por chave de integração)
  -- 'manual'  = a recepção registrou na tela de Controle de Acesso
  origem text not null default 'catraca' check (origem in ('catraca', 'manual')),

  -- Nome opcional do equipamento, útil pra academias com mais de uma catraca
  -- (ex: "Catraca Principal", "Catraca Estacionamento"). Enviado como
  -- ?dispositivo=... na chamada da catraca, ou digitado na liberação manual.
  dispositivo text,

  -- Preenchido só quando origem = 'manual' e/ou quando um funcionário decide
  -- liberar mesmo com o sistema tendo negado (ver coluna forcado).
  registrado_por uuid references funcionarios(id),
  forcado boolean not null default false,

  created_at timestamptz not null default now()
);

comment on table acessos is 'Log de cada tentativa de entrada/saída na academia (catraca ou manual), liberada ou negada';
create index if not exists idx_acessos_academia_created on acessos (academia_id, created_at desc);
create index if not exists idx_acessos_aluno on acessos (aluno_id, created_at desc);
create index if not exists idx_acessos_academia_tipo on acessos (academia_id, tipo, created_at desc);

alter table acessos enable row level security;

-- ----------------------------------------------------------------------------
-- VIEW: acesso_presencas_hoje
-- Para cada aluno, olha a leitura LIBERADA mais recente de hoje. Se foi uma
-- "entrada", o aluno está dentro da academia agora. Isso dá o contador de
-- "quantas pessoas estão na academia neste momento".
-- ----------------------------------------------------------------------------
create or replace view acesso_presencas_hoje as
select distinct on (a.academia_id, a.aluno_id)
  a.academia_id,
  a.aluno_id,
  a.tipo as ultimo_tipo,
  a.created_at as ultimo_evento_em
from acessos a
where a.liberado = true
  and a.aluno_id is not null
  and a.created_at >= date_trunc('day', now())
order by a.academia_id, a.aluno_id, a.created_at desc;

comment on view acesso_presencas_hoje is 'Última passagem liberada de hoje por aluno - usada pra saber quem está dentro da academia agora';

-- RLS: mesma política do resto do banco (só o backend, via service_role, lê/escreve).
-- Views herdam RLS das tabelas base automaticamente no Postgres/Supabase.

-- ============================================================================
-- FIM DA MIGRAÇÃO 4
-- ============================================================================

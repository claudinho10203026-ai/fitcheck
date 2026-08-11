-- ============================================================================
-- MIGRAÇÃO 5: CADASTRO DE CATRACAS (tela "Configurar catraca")
-- ============================================================================
-- Rode no SQL Editor do Supabase depois da migration_004_controle_acesso.sql.
--
-- Isso NÃO é o hardware em si - é só um cadastro dentro do sistema pra você
-- dar um nome a cada catraca física (ex: "Catraca Entrada", "Catraca
-- Estacionamento"), dizer a marca, e o sistema te mostrar a URL certa e o
-- passo a passo específico daquela marca na tela de Controle de Acesso.
-- ============================================================================

create table if not exists catracas (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,
  nome text not null,
  marca text not null default 'outra' check (marca in ('control_id', 'intelbras', 'topdata', 'henry', 'zkteco', 'outra')),
  modelo text,
  local text, -- ex: "Entrada principal", "Catraca do estacionamento"
  sentido_padrao text not null default 'ambos' check (sentido_padrao in ('entrada', 'saida', 'ambos')),
  ativa boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now()
);

comment on table catracas is 'Cadastro das catracas físicas da academia (nome/marca/modelo) - usado só pra gerar a URL/instruções certas na tela de Controle de Acesso';
create index if not exists idx_catracas_academia on catracas (academia_id);

alter table catracas enable row level security;

-- ============================================================================
-- FIM DA MIGRAÇÃO 5
-- ============================================================================

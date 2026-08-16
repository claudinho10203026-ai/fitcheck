-- ============================================================================
-- MIGRAÇÃO 7: DISPOSITIVOS POR IP (leitores faciais tipo EVO) + código por aluno
-- ============================================================================
-- Rode no SQL Editor do Supabase depois da migration_006.
--
-- Alguns leitores faciais (ex: EVO) não são configurados apontando uma URL
-- pra fora - você entra no IP do próprio equipamento com a senha de admin
-- pra configurar/gerenciar. Esses campos guardam essa informação (só pra
-- referência sua e pra tela mostrar as instruções certas).
-- ============================================================================

alter table catracas add column if not exists tipo_conexao text not null default 'validacao_externa'
  check (tipo_conexao in ('validacao_externa', 'push_adms', 'ip_manual'));
alter table catracas add column if not exists ip text;
alter table catracas add column if not exists porta integer;
alter table catracas add column if not exists usuario_admin text;
alter table catracas add column if not exists senha_admin_cripto text;

comment on column catracas.tipo_conexao is
  'validacao_externa = equipamento chama nossa URL antes de liberar (Control iD, etc). push_adms = equipamento avisa DEPOIS que já liberou, formato ADMS/ZKTeco (tentativa - não confirmado pra todo modelo). ip_manual = sem protocolo conhecido ainda, guardado só como referência/anotação.';
comment on column catracas.senha_admin_cripto is 'Senha de admin do próprio equipamento, criptografada - é só uma anotação sua, o sistema não usa isso para se conectar automaticamente.';

-- Código/matrícula cadastrado NO EQUIPAMENTO pra identificar o aluno (usado
-- por dispositivos que avisam eventos por um código numérico/PIN em vez do
-- CPF). Se ficar em branco, tentamos casar pelo CPF mesmo.
alter table alunos add column if not exists codigo_dispositivo text;
create index if not exists idx_alunos_codigo_dispositivo on alunos (academia_id, codigo_dispositivo);

-- ============================================================================
-- FIM DA MIGRAÇÃO 7
-- ============================================================================

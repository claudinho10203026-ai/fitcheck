-- ============================================================================
-- MIGRAÇÃO: ficha médica completa, ficha financeira e fotos de alunos
-- ============================================================================
-- Rode este script se você JÁ tinha rodado o database/schema.sql antes desta
-- atualização (ele só adiciona o que é novo, não apaga nada). Se você está
-- criando o banco do zero, ignore este arquivo: já rode o schema.sql
-- atualizado, que já inclui tudo isso.
--
-- Como usar: SQL Editor do Supabase -> New query -> cole e rode.
-- ============================================================================

alter table alunos add column if not exists ficha_medica jsonb not null default '{}'::jsonb;

alter table alunos add column if not exists desconto_percentual numeric(5,2) not null default 0;
alter table alunos add column if not exists observacoes_financeiras text;
alter table alunos add column if not exists responsavel_financeiro_nome text;
alter table alunos add column if not exists responsavel_financeiro_cpf text;
alter table alunos add column if not exists responsavel_financeiro_telefone text;

-- (a coluna alunos.foto_url e a checagem de desconto_percentual já existiam/
-- são criadas junto no schema novo; se o "check" abaixo já existir, ignore o erro)
do $$
begin
  alter table alunos add constraint alunos_desconto_percentual_check check (desconto_percentual between 0 and 100);
exception
  when duplicate_object then null;
end $$;

-- bucket de storage para fotos de alunos
insert into storage.buckets (id, name, public)
values ('fotos-alunos', 'fotos-alunos', true)
on conflict (id) do nothing;

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================

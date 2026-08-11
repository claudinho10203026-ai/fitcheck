-- ============================================================================
-- MIGRAÇÃO 3: integração real com Asaas (boleto, PIX, cartão)
-- ============================================================================
-- Rode se você já tinha rodado o schema.sql (ou as migrações anteriores)
-- antes desta atualização. Se está criando o banco do zero, ignore este
-- arquivo - o schema.sql já inclui tudo isso.
--
-- Como usar: SQL Editor do Supabase -> New query -> cole e rode.
-- ============================================================================

alter table alunos add column if not exists asaas_customer_id text;

-- ============================================================================
-- FIM DA MIGRAÇÃO 3
-- ============================================================================

-- ============================================================================
-- MIGRAÇÃO 6: GATEWAY DE PAGAMENTO POR ACADEMIA
-- ============================================================================
-- Antes desta migração, a chave do Asaas/Mercado Pago era UMA SÓ pra todo o
-- sistema (definida no .env do backend) - ou seja, se você hospedasse mais de
-- uma academia neste sistema, o dinheiro de todas cairia na mesma conta.
--
-- Com isso aqui, cada academia cadastra a própria conta (Asaas e/ou Mercado
-- Pago) na tela Configurações > Pagamento. As chaves ficam criptografadas no
-- banco (nunca em texto puro) - ver backend/services/criptografia.js.
--
-- Se você já usava o Asaas/Mercado Pago só pelo .env, ele continua funcionando
-- como "padrão" pra quem ainda não configurou nada na tela nova - nada quebra.
-- Rode no SQL Editor do Supabase.
-- ============================================================================

alter table academias add column if not exists gateway_provider_preferido text check (gateway_provider_preferido in ('asaas', 'mercadopago'));
alter table academias add column if not exists asaas_api_key_cripto text;
alter table academias add column if not exists asaas_ambiente text not null default 'sandbox' check (asaas_ambiente in ('sandbox', 'production'));
alter table academias add column if not exists mercadopago_access_token_cripto text;

comment on column academias.asaas_api_key_cripto is 'Chave de API do Asaas desta academia, criptografada (AES-256-GCM) - nunca fica em texto puro no banco';
comment on column academias.mercadopago_access_token_cripto is 'Access token do Mercado Pago desta academia, criptografado (AES-256-GCM) - nunca fica em texto puro no banco';

-- ============================================================================
-- FIM DA MIGRAÇÃO 6
-- ============================================================================

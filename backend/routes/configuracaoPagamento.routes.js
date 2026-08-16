const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireAdmin } = require('../middleware/authorize');
const { criptografar, mascarar } = require('../services/criptografia');
const gatewayPagamento = require('../services/gatewayPagamento');

const router = express.Router();

// Tudo aqui é admin-only: são as credenciais de pagamento da academia.
router.use(requireAdmin);

// GET /api/configuracao-pagamento - estado atual (nunca retorna a chave em texto puro)
router.get('/', async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    const { data: academia, error } = await supabaseAdmin
      .from('academias')
      .select('gateway_provider_preferido, asaas_api_key_cripto, asaas_ambiente, mercadopago_access_token_cripto')
      .eq('id', academiaId)
      .single();
    if (error) throw error;

    const { descriptografar } = require('../services/criptografia');
    const asaasChave = descriptografar(academia.asaas_api_key_cripto);
    const mpToken = descriptografar(academia.mercadopago_access_token_cripto);

    res.json({
      provedor_preferido: academia.gateway_provider_preferido,
      provedor_ativo: await gatewayPagamento.provedorAtivo(academiaId),
      asaas: {
        configurado: Boolean(asaasChave || process.env.ASAAS_API_KEY),
        proprio_da_academia: Boolean(asaasChave),
        ambiente: academia.asaas_ambiente || 'sandbox',
        chave_mascarada: mascarar(asaasChave),
      },
      mercadopago: {
        configurado: Boolean(mpToken || process.env.MERCADOPAGO_ACCESS_TOKEN),
        proprio_da_academia: Boolean(mpToken),
        token_mascarado: mascarar(mpToken),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar configuração de pagamento.' });
  }
});

// PUT /api/configuracao-pagamento - salva/atualiza credenciais
// Body: { provedor_preferido?, asaas_api_key?, asaas_ambiente?, mercadopago_access_token?, remover_asaas?, remover_mercadopago? }
// Só manda a chave quando for TROCAR - deixar de fora mantém a atual.
router.put('/', async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    const { provedor_preferido, asaas_api_key, asaas_ambiente, mercadopago_access_token, remover_asaas, remover_mercadopago } =
      req.body;

    if (provedor_preferido && !['asaas', 'mercadopago'].includes(provedor_preferido)) {
      return res.status(400).json({ erro: 'Provedor preferido inválido.' });
    }
    if (asaas_ambiente && !['sandbox', 'production'].includes(asaas_ambiente)) {
      return res.status(400).json({ erro: 'Ambiente do Asaas inválido.' });
    }

    const atualizacao = {};
    if (provedor_preferido !== undefined) atualizacao.gateway_provider_preferido = provedor_preferido;
    if (asaas_ambiente) atualizacao.asaas_ambiente = asaas_ambiente;

    if (remover_asaas) atualizacao.asaas_api_key_cripto = null;
    else if (asaas_api_key) atualizacao.asaas_api_key_cripto = criptografar(asaas_api_key.trim());

    if (remover_mercadopago) atualizacao.mercadopago_access_token_cripto = null;
    else if (mercadopago_access_token) atualizacao.mercadopago_access_token_cripto = criptografar(mercadopago_access_token.trim());

    const { error } = await supabaseAdmin.from('academias').update(atualizacao).eq('id', academiaId);
    if (error) throw error;

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message || 'Erro ao salvar configuração de pagamento.' });
  }
});

module.exports = router;

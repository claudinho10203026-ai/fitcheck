const { supabaseAdmin } = require('../config/supabaseClient');

/**
 * Gera o carnê (uma ou várias parcelas) de mensalidade para uma matrícula.
 * A rota que chama essa função já deve ter confirmado que aluno/matrícula
 * pertencem à academia informada.
 */
async function gerarCarne({
  academiaId,
  alunoId,
  matriculaId,
  valorParcela,
  numeroParcelas,
  primeiroVencimento,
  diaVencimentoFixo,
}) {
  const parcelas = [];
  const dataBase = new Date(`${primeiroVencimento}T00:00:00`);

  for (let i = 0; i < numeroParcelas; i++) {
    const vencimento = new Date(dataBase);
    vencimento.setMonth(vencimento.getMonth() + i);
    if (diaVencimentoFixo) {
      vencimento.setDate(diaVencimentoFixo);
    }

    parcelas.push({
      academia_id: academiaId,
      aluno_id: alunoId,
      matricula_id: matriculaId,
      numero_parcela: i + 1,
      total_parcelas: numeroParcelas,
      valor: valorParcela,
      data_vencimento: vencimento.toISOString().slice(0, 10),
      status: 'em_aberto',
    });
  }

  const { data, error } = await supabaseAdmin.from('mensalidades').insert(parcelas).select();
  if (error) throw error;
  return data;
}

/**
 * Marca mensalidades vencidas (data_vencimento < hoje, status em_aberto) como
 * "atrasado", restrito à academia informada. Chamado sob demanda (ex: ao
 * abrir o dashboard/mensalidades) para manter o status em dia sem depender
 * de um cron job externo.
 */
async function atualizarAtrasadas(academiaId) {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('mensalidades')
    .update({ status: 'atrasado' })
    .eq('academia_id', academiaId)
    .eq('status', 'em_aberto')
    .lt('data_vencimento', hoje)
    .select('id');

  if (error) throw error;
  return data;
}

/**
 * Dá baixa manual em uma mensalidade (marca como paga sem gateway).
 * A rota que chama essa função já deve ter confirmado que a mensalidade
 * pertence à academia do funcionário logado.
 */
async function darBaixaManual({ mensalidadeId, formaPagamentoId, registradoPor }) {
  const { data, error } = await supabaseAdmin
    .from('mensalidades')
    .update({
      status: 'pago',
      data_pagamento: new Date().toISOString(),
      forma_pagamento_id: formaPagamentoId,
      baixa_manual: true,
      baixa_por: registradoPor,
    })
    .eq('id', mensalidadeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

module.exports = { gerarCarne, atualizarAtrasadas, darBaixaManual };

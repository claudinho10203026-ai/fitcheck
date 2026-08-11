const { supabaseAdmin } = require('../config/supabaseClient');
const mensalidadeService = require('./mensalidadeService');

/**
 * Calcula se um aluno está liberado para passar na catraca:
 * - cadastro precisa estar "ativo"
 * - precisa ter ao menos uma matrícula "ativa"
 * - não pode ter nenhuma mensalidade vencida (em atraso)
 *
 * IMPORTANTE sobre a checagem de atraso: em vez de confiar apenas na coluna
 * `status = 'atrasado'` (que só é atualizada quando alguém abre o Dashboard
 * ou a tela de Mensalidades), primeiro chamamos `atualizarAtrasadas` pra
 * "aquecer" o status na hora. Isso evita o cenário perigoso de um aluno
 * inadimplente conseguir passar porque ninguém abriu essas telas hoje ainda -
 * o que seria exatamente o contrário do que essa tela promete.
 *
 * Retorna o motivo do bloqueio quando aplicável (útil pra mostrar na tela/hardware).
 */
async function calcularAcesso(academiaId, aluno) {
  if (aluno.status !== 'ativo') {
    return { liberado: false, motivo: 'Cadastro inativo ou suspenso' };
  }

  // Mantém o status das mensalidades em dia antes de decidir (ver comentário acima).
  await mensalidadeService.atualizarAtrasadas(academiaId);

  const { count: matriculaAtiva } = await supabaseAdmin
    .from('matriculas')
    .select('id', { count: 'exact', head: true })
    .eq('academia_id', academiaId)
    .eq('aluno_id', aluno.id)
    .eq('status', 'ativa');
  if (!matriculaAtiva) {
    return { liberado: false, motivo: 'Sem matrícula ativa' };
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const { count: atrasos } = await supabaseAdmin
    .from('mensalidades')
    .select('id', { count: 'exact', head: true })
    .eq('academia_id', academiaId)
    .eq('aluno_id', aluno.id)
    .in('status', ['atrasado', 'em_aberto'])
    .lt('data_vencimento', hoje);
  if (atrasos > 0) {
    return { liberado: false, motivo: 'Mensalidade em atraso' };
  }

  return { liberado: true, motivo: null };
}

/**
 * Grava uma linha no histórico de acessos (tabela `acessos`). Chamado tanto
 * pela catraca (origem 'catraca') quanto pela liberação manual da recepção
 * (origem 'manual'). Nunca lança erro pro chamador - se o log falhar, a
 * catraca ainda deve liberar/negar normalmente (não queremos travar a
 * catraca por causa de um problema de log).
 */
async function registrarAcesso({
  academiaId,
  alunoId = null,
  cpfInformado = null,
  tipo = 'entrada',
  liberado,
  motivo = null,
  origem = 'catraca',
  dispositivo = null,
  registradoPor = null,
  forcado = false,
}) {
  try {
    const { data, error } = await supabaseAdmin
      .from('acessos')
      .insert({
        academia_id: academiaId,
        aluno_id: alunoId,
        cpf_informado: cpfInformado,
        tipo,
        liberado,
        motivo,
        origem,
        dispositivo,
        registrado_por: registradoPor,
        forcado,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao registrar log de acesso (não bloqueante):', err);
    return null;
  }
}

module.exports = { calcularAcesso, registrarAcesso };

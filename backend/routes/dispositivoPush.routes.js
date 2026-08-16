const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { calcularAcesso, registrarAcesso } = require('../services/acessoService');

const router = express.Router();

// ============================================================================
// EXPERIMENTAL: recebedor do protocolo ADMS/iClock (usado por diversos
// terminais biométricos "de baixo custo" vendidos no Brasil sob marcas
// diferentes - é o protocolo mais comum nesse tipo de equipamento).
//
// Isso é uma TENTATIVA DE MELHOR ESFORÇO: eu não tenho confirmação oficial
// de que o seu leitor facial EVO especificamente fala esse protocolo. Vale
// tentar apontar o equipamento pra cá (veja instruções na tela Controle de
// Acesso), mas se não funcionar, o caminho seguro é pedir o manual de
// integração pro suporte da EVO/revenda.
//
// LIMITAÇÃO IMPORTANTE (isso é físico, não dá pra contornar só com código):
// neste protocolo o equipamento decide localmente e avisa o sistema DEPOIS
// que a pessoa já passou - diferente da Control iD, que pergunta ANTES.
// Ou seja: isso aqui registra no histórico e ALERTA (fica marcado como
// "negado" mesmo já tendo passado) se alguém bloqueado conseguiu entrar,
// pra a recepção agir - mas não impede a passagem em tempo real por si só.
// Bloqueio de verdade, em tempo real, só existe em equipamentos que
// PERGUNTAM ANTES (ver tipo_conexao = 'validacao_externa').
// ============================================================================

async function acharAluno(academiaId, pin) {
  if (!pin) return null;
  const { data: porCodigo } = await supabaseAdmin
    .from('alunos')
    .select('id, nome, status, foto_url')
    .eq('academia_id', academiaId)
    .eq('codigo_dispositivo', String(pin))
    .maybeSingle();
  if (porCodigo) return porCodigo;

  // Sem código cadastrado: tenta como se o PIN do equipamento fosse o próprio CPF.
  const { data: porCpf } = await supabaseAdmin
    .from('alunos')
    .select('id, nome, status, foto_url')
    .eq('academia_id', academiaId)
    .eq('cpf', String(pin).replace(/\D/g, ''))
    .maybeSingle();
  return porCpf || null;
}

// Descobre qual academia/catraca é essa, pelo "SN" (número de série) que o
// equipamento manda. Como ainda não temos um campo próprio de "SN" no
// cadastro, casamos pelo nome ou IP informado; se não achar nenhum, usa a
// primeira catraca do tipo "push_adms" cadastrada (funciona bem pra quem só
// tem UM equipamento desse tipo por enquanto).
async function acharCatracaPorSN(sn) {
  const { data } = await supabaseAdmin
    .from('catracas')
    .select('id, academia_id, nome, ip')
    .eq('tipo_conexao', 'push_adms')
    .eq('ativa', true)
    .order('created_at', { ascending: true });
  if (!data || data.length === 0) return null;
  return data.find((c) => c.nome === sn || c.ip === sn) || data[0];
}

// Handshake inicial (o equipamento pergunta opções ao ligar) - só confirma OK.
router.get('/cdata', (req, res) => {
  res.type('text/plain').send('OK');
});

// Envio de log de presença/acesso.
router.post('/cdata', express.text({ type: '*/*', limit: '2mb' }), async (req, res) => {
  try {
    const sn = req.query.SN;
    const table = req.query.table;
    if (table !== 'ATTLOG' || !req.body) return res.type('text/plain').send('OK');

    const catraca = await acharCatracaPorSN(sn);
    if (!catraca) return res.type('text/plain').send('OK'); // nenhuma catraca push_adms cadastrada ainda

    const linhas = req.body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const linha of linhas) {
      const pin = linha.split('\t')[0];
      const aluno = await acharAluno(catraca.academia_id, pin);

      if (!aluno) {
        await registrarAcesso({
          academiaId: catraca.academia_id,
          cpfInformado: pin,
          tipo: 'entrada',
          liberado: false,
          motivo: 'Código do equipamento não corresponde a nenhum aluno (cadastre em codigo_dispositivo ou use o CPF como código no equipamento)',
          origem: 'catraca',
          dispositivo: catraca.nome,
        });
        continue;
      }

      const resultado = await calcularAcesso(catraca.academia_id, aluno);
      await registrarAcesso({
        academiaId: catraca.academia_id,
        alunoId: aluno.id,
        tipo: 'entrada',
        liberado: resultado.liberado,
        motivo: resultado.liberado ? null : `${resultado.motivo} (o equipamento já liberou localmente antes de avisar o sistema - fale com o aluno)`,
        origem: 'catraca',
        dispositivo: catraca.nome,
      });
    }

    res.type('text/plain').send('OK');
  } catch (err) {
    console.error('Erro ao processar push ADMS:', err);
    // Sempre responde OK pro equipamento não ficar tentando de novo sem parar;
    // o erro já fica logado no servidor pra investigar.
    res.type('text/plain').send('OK');
  }
});

// Fila de comandos remotos - por enquanto não enviamos nenhum comando de volta.
router.get('/getrequest', (req, res) => {
  res.type('text/plain').send('OK');
});

router.post('/devicecmd', express.text({ type: '*/*' }), (req, res) => {
  res.type('text/plain').send('OK');
});

module.exports = router;

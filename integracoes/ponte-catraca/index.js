/**
 * PONTE GENÉRICA CATRACA <-> SISTEMA DA ACADEMIA
 * ------------------------------------------------
 * Veja o README.md desta pasta antes de usar.
 *
 * O que este arquivo já faz (pronto, não precisa tocar):
 *   - Perguntar ao sistema da academia se um CPF pode entrar/sair.
 *
 * O que falta completar (marcado com "TODO" abaixo), específico do
 * fabricante/modelo da sua catraca:
 *   1. Como capturar o evento "pessoa reconhecida" da catraca (SDK do fabricante).
 *   2. Como mandar o comando de abrir/negar pro equipamento.
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL; // ex: https://seusistema.com/api
const CHAVE_INTEGRACAO = process.env.CHAVE_INTEGRACAO; // gerada na tela Controle de Acesso
const NOME_DISPOSITIVO = process.env.NOME_DISPOSITIVO || 'Catraca';

if (!API_URL || !CHAVE_INTEGRACAO) {
  console.error('Defina API_URL e CHAVE_INTEGRACAO no arquivo .env antes de rodar.');
  process.exit(1);
}

/**
 * Pergunta ao sistema da academia se esse CPF pode passar.
 * @param {string} cpf - somente números
 * @param {'entrada'|'saida'} sentido
 * @returns {Promise<{liberado: boolean, motivo: string|null, aluno?: object}>}
 */
async function verificarAcesso(cpf, sentido = 'entrada') {
  try {
    const { data } = await axios.get(`${API_URL}/acesso/verificar`, {
      params: { cpf, sentido, dispositivo: NOME_DISPOSITIVO },
      headers: { 'X-Chave-Integracao': CHAVE_INTEGRACAO },
      timeout: 5000,
    });
    return data;
  } catch (err) {
    // Se o sistema da academia não responder, o mais seguro é NEGAR a
    // passagem (evita liberar alguém sem conseguir confirmar pagamento).
    console.error('Erro ao consultar o sistema da academia:', err.message);
    return { liberado: false, motivo: 'Sistema da academia indisponível' };
  }
}

/**
 * ------------------------------------------------------------------------
 * TODO (1): CAPTURAR O EVENTO DA CATRACA
 * ------------------------------------------------------------------------
 * Aqui você usa o SDK/protocolo do fabricante da sua catraca pra escutar o
 * evento "pessoa reconhecida" (facial ou biometria) e obter o identificador
 * dela (o CPF, ou o código/matrícula que você cadastrou no equipamento
 * associado àquele CPF).
 *
 * Exemplo ilustrativo (substitua pelo SDK real do seu fabricante):
 *
 *   sdkDoFabricante.aoReconhecerPessoa(async (evento) => {
 *     const cpf = evento.codigoExterno; // ou evento.pis, depende do SDK
 *     const resultado = await verificarAcesso(cpf, 'entrada');
 *
 *     if (resultado.liberado) {
 *       // TODO (2): comando pra ABRIR a catraca - ver abaixo
 *     } else {
 *       // TODO (2): comando pra NEGAR/exibir mensagem na catraca
 *       console.log(`Negado: ${evento.nome || cpf} - ${resultado.motivo}`);
 *     }
 *   });
 */

/**
 * ------------------------------------------------------------------------
 * TODO (2): LIBERAR OU NEGAR NO EQUIPAMENTO
 * ------------------------------------------------------------------------
 * Depois de saber liberado/negado, você chama a função do SDK do
 * fabricante que abre o giro ou mostra "acesso negado" no display.
 * Isso é sempre específico de cada marca/modelo - consulte o manual de
 * integração do fabricante ou o técnico que instalou o equipamento.
 */

// --- Exemplo de teste manual (rode `node index.js SEU_CPF_AQUI` pra testar
// a conexão com o sistema antes de integrar com o hardware de verdade) ---
if (require.main === module) {
  const cpfTeste = process.argv[2];
  if (cpfTeste) {
    verificarAcesso(cpfTeste).then((r) => console.log('Resultado:', r));
  } else {
    console.log('Ponte pronta. Rode "node index.js 00000000000" pra testar a conexão com o sistema.');
  }
}

module.exports = { verificarAcesso };

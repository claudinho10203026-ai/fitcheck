/**
 * Criptografia simétrica (AES-256-GCM) usada só para guardar credenciais
 * sensíveis de cada academia (chave do Asaas, token do Mercado Pago) no
 * banco de dados de forma que, mesmo se alguém tiver acesso direto ao
 * banco, não veja a chave em texto puro.
 *
 * Exige a variável de ambiente GATEWAY_ENCRYPTION_KEY no .env do backend
 * (qualquer string longa e aleatória - ex: `openssl rand -hex 32`).
 */
const crypto = require('crypto');

function chave() {
  const segredo = process.env.GATEWAY_ENCRYPTION_KEY;
  if (!segredo) {
    throw new Error(
      'GATEWAY_ENCRYPTION_KEY não configurada no .env do backend. Defina uma string aleatória longa (ex: openssl rand -hex 32) antes de salvar credenciais de gateway.'
    );
  }
  // Deriva sempre 32 bytes (256 bits) a partir do segredo, independente do tamanho dele.
  return crypto.createHash('sha256').update(segredo).digest();
}

/** Criptografa um texto. Retorna uma string única (iv + tag + dados, em base64) pra salvar numa coluna text. */
function criptografar(textoPuro) {
  if (!textoPuro) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const criptografado = Buffer.concat([cipher.update(String(textoPuro), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, criptografado]).toString('base64');
}

/** Reverte criptografar(). Retorna null se o valor for vazio ou não puder ser decifrado. */
function descriptografar(valorCriptografado) {
  if (!valorCriptografado) return null;
  try {
    const dados = Buffer.from(valorCriptografado, 'base64');
    const iv = dados.subarray(0, 12);
    const tag = dados.subarray(12, 28);
    const criptografado = dados.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', chave(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(criptografado), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('Erro ao descriptografar credencial de gateway:', err.message);
    return null;
  }
}

/** Máscara pra exibir na tela sem revelar a chave inteira, ex: "••••••3f9a" */
function mascarar(valor) {
  if (!valor) return null;
  const limpo = String(valor);
  if (limpo.length <= 4) return '••••';
  return `••••••${limpo.slice(-4)}`;
}

module.exports = { criptografar, descriptografar, mascarar };

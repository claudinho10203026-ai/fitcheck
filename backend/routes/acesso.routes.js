const express = require('express');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireModulo, requireAdmin } = require('../middleware/authorize');
const { calcularAcesso, registrarAcesso } = require('../services/acessoService');
const mensalidadeService = require('../services/mensalidadeService');
const { criptografar, mascarar } = require('../services/criptografia');

const router = express.Router();

function limparCpf(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function sentidoValido(valor) {
  return valor === 'entrada' || valor === 'saida' ? valor : 'entrada';
}

// Middleware específico para o controlador da catraca (hardware), que não
// faz login como funcionário - autentica com a chave de integração da academia.
async function requireChaveIntegracao(req, res, next) {
  const chave = req.headers['x-chave-integracao'];
  if (!chave) return res.status(401).json({ erro: 'Chave de integração não informada.' });

  const { data: academia } = await supabaseAdmin
    .from('academias')
    .select('id, nome')
    .eq('chave_integracao_catraca', chave)
    .maybeSingle();
  if (!academia) return res.status(401).json({ erro: 'Chave de integração inválida.' });

  req.academiaId = academia.id;
  next();
}

// ============================================================================
// Endpoint para o CONTROLADOR DA CATRACA (hardware/software do fabricante)
// consultar antes de liberar a passagem. Autenticado por chave, não por login.
//
// GET /api/acesso/verificar?cpf=00000000000&sentido=entrada&dispositivo=Catraca%20Principal
// Header: X-Chave-Integracao: <chave gerada na tela de Controle de Acesso>
//
// Toda chamada aqui é registrada no histórico (tabela `acessos`), tenha sido
// liberada ou negada - é assim que a tela de Controle de Acesso mostra quem
// entrou/saiu e quando.
// ============================================================================
router.get('/verificar', requireChaveIntegracao, async (req, res) => {
  const cpf = limparCpf(req.query.cpf);
  const tipo = sentidoValido(req.query.sentido);
  const dispositivo = req.query.dispositivo || null;
  const academiaId = req.academiaId;

  try {
    if (!cpf) return res.status(400).json({ erro: 'Informe o CPF (?cpf=).' });

    const { data: aluno } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, status, foto_url')
      .eq('academia_id', academiaId)
      .eq('cpf', cpf)
      .maybeSingle();

    if (!aluno) {
      await registrarAcesso({
        academiaId,
        cpfInformado: cpf,
        tipo,
        liberado: false,
        motivo: 'Aluno não encontrado',
        origem: 'catraca',
        dispositivo,
      });
      return res.status(404).json({ liberado: false, motivo: 'Aluno não encontrado' });
    }

    const resultado = await calcularAcesso(academiaId, aluno);
    await registrarAcesso({
      academiaId,
      alunoId: aluno.id,
      cpfInformado: cpf,
      tipo,
      liberado: resultado.liberado,
      motivo: resultado.motivo,
      origem: 'catraca',
      dispositivo,
    });

    res.json({ ...resultado, aluno: { nome: aluno.nome, foto_url: aluno.foto_url } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao verificar acesso.' });
  }
});

// ============================================================================
// A partir daqui, endpoints para a EQUIPE (autenticados por login, não por chave)
// ============================================================================

// GET /api/acesso/verificar-interno?cpf=... - mesma checagem, usada pela
// ferramenta de consulta manual dentro do sistema. Só CONSULTA, não registra
// no histórico (isso é feito por /registrar, quando a recepção de fato deixa
// a pessoa entrar/sair).
router.get('/verificar-interno', requireAuth, requireModulo('acesso', 'visualizar'), async (req, res) => {
  try {
    const cpf = limparCpf(req.query.cpf);
    if (!cpf) return res.status(400).json({ erro: 'Informe o CPF.' });

    const { data: aluno } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, status, foto_url, telefone')
      .eq('academia_id', req.funcionario.academia_id)
      .eq('cpf', cpf)
      .maybeSingle();
    if (!aluno) return res.status(404).json({ erro: 'Nenhum aluno com esse CPF nesta academia.' });

    const resultado = await calcularAcesso(req.funcionario.academia_id, aluno);
    res.json({ ...resultado, aluno });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao verificar acesso.' });
  }
});

// POST /api/acesso/registrar - a recepção libera manualmente uma entrada ou
// saída (útil sem catraca automatizada, ou como reforço/backup dela).
// Body: { cpf, tipo: 'entrada'|'saida', forcar?: boolean }
// Se o aluno estiver bloqueado e `forcar` não vier true, retorna liberado:false
// sem registrar nada (a tela pergunta "libera mesmo assim?" antes de mandar
// forcar:true). Forçar exige permissão de "gerenciar" no módulo de acesso.
router.post('/registrar', requireAuth, requireModulo('acesso', 'visualizar'), async (req, res) => {
  try {
    const cpf = limparCpf(req.body.cpf);
    const tipo = sentidoValido(req.body.tipo);
    const forcar = Boolean(req.body.forcar);
    const academiaId = req.funcionario.academia_id;

    if (!cpf) return res.status(400).json({ erro: 'Informe o CPF.' });
    if (forcar && !['admin'].includes(req.funcionario.tipo) && (req.funcionario.permissoes?.acesso !== 'gerenciar')) {
      return res.status(403).json({ erro: 'Você não tem permissão para liberar manualmente um aluno bloqueado.' });
    }

    const { data: aluno } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, status, foto_url')
      .eq('academia_id', academiaId)
      .eq('cpf', cpf)
      .maybeSingle();

    if (!aluno) {
      return res.status(404).json({ erro: 'Nenhum aluno com esse CPF nesta academia.' });
    }

    const resultado = await calcularAcesso(academiaId, aluno);
    const vaiRegistrar = resultado.liberado || forcar;

    if (vaiRegistrar) {
      await registrarAcesso({
        academiaId,
        alunoId: aluno.id,
        cpfInformado: cpf,
        tipo,
        liberado: true,
        motivo: resultado.liberado ? null : `Liberado manualmente apesar de: ${resultado.motivo}`,
        origem: 'manual',
        registradoPor: req.funcionario.id,
        forcado: !resultado.liberado && forcar,
      });
    }

    res.json({
      liberado: vaiRegistrar,
      motivo: resultado.liberado ? null : resultado.motivo,
      bloqueado_pelo_sistema: !resultado.liberado,
      aluno: { nome: aluno.nome, foto_url: aluno.foto_url },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar acesso.' });
  }
});

// GET /api/acesso/historico - lista paginada do log de acessos, com filtros.
// Query params: data (YYYY-MM-DD, padrão hoje), aluno_id, tipo, liberado, page, limit
router.get('/historico', requireAuth, requireModulo('acesso', 'visualizar'), async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    const { data: dataFiltro, aluno_id, tipo, liberado } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const de = (page - 1) * limit;
    const ate = de + limit - 1;

    let query = supabaseAdmin
      .from('acessos')
      .select('*, alunos(nome, foto_url)', { count: 'exact' })
      .eq('academia_id', academiaId)
      .order('created_at', { ascending: false })
      .range(de, ate);

    if (dataFiltro) {
      query = query.gte('created_at', `${dataFiltro}T00:00:00`).lte('created_at', `${dataFiltro}T23:59:59`);
    }
    if (aluno_id) query = query.eq('aluno_id', aluno_id);
    if (tipo) query = query.eq('tipo', tipo);
    if (liberado !== undefined) query = query.eq('liberado', liberado === 'true');

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ registros: data, total: count, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar histórico de acessos.' });
  }
});

// GET /api/acesso/presentes - quem está dentro da academia agora (última
// leitura liberada de hoje foi uma entrada, sem saída depois). Usa a view
// `acesso_presencas_hoje` criada na migração 004.
router.get('/presentes', requireAuth, requireModulo('acesso', 'visualizar'), async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    const { data, error } = await supabaseAdmin
      .from('acesso_presencas_hoje')
      .select('aluno_id, ultimo_tipo, ultimo_evento_em, alunos(nome, foto_url)')
      .eq('academia_id', academiaId)
      .eq('ultimo_tipo', 'entrada')
      .order('ultimo_evento_em', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    // Se a view ainda não existe (migração 004 não rodada), não derruba a tela.
    res.status(200).json([]);
  }
});

// GET /api/acesso/bloqueados - lista alunos ativos que seriam barrados agora
router.get('/bloqueados', requireAuth, requireModulo('acesso', 'visualizar'), async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    await mensalidadeService.atualizarAtrasadas(academiaId);

    const hoje = new Date().toISOString().slice(0, 10);
    const [{ data: alunos }, { data: comMatriculaAtiva }, { data: comAtraso }] = await Promise.all([
      supabaseAdmin.from('alunos').select('id, nome, cpf, telefone, foto_url').eq('academia_id', academiaId).eq('status', 'ativo'),
      supabaseAdmin.from('matriculas').select('aluno_id').eq('academia_id', academiaId).eq('status', 'ativa'),
      supabaseAdmin
        .from('mensalidades')
        .select('aluno_id')
        .eq('academia_id', academiaId)
        .in('status', ['atrasado', 'em_aberto'])
        .lt('data_vencimento', hoje),
    ]);

    const idsComMatricula = new Set((comMatriculaAtiva || []).map((m) => m.aluno_id));
    const idsComAtraso = new Set((comAtraso || []).map((m) => m.aluno_id));

    const bloqueados = (alunos || [])
      .filter((a) => !idsComMatricula.has(a.id) || idsComAtraso.has(a.id))
      .map((a) => ({
        ...a,
        motivo: idsComAtraso.has(a.id) ? 'Mensalidade em atraso' : 'Sem matrícula ativa',
      }));

    res.json(bloqueados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar bloqueados.' });
  }
});

// GET /api/acesso/chave - retorna a chave de integração atual (admin)
router.get('/chave', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('academias')
      .select('chave_integracao_catraca')
      .eq('id', req.funcionario.academia_id)
      .single();
    res.json({ chave: data?.chave_integracao_catraca || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar chave de integração.' });
  }
});

// POST /api/acesso/chave/gerar - gera (ou regenera) a chave de integração
router.post('/chave/gerar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const novaChave = crypto.randomBytes(24).toString('hex');
    const { data, error } = await supabaseAdmin
      .from('academias')
      .update({ chave_integracao_catraca: novaChave })
      .eq('id', req.funcionario.academia_id)
      .select('chave_integracao_catraca')
      .single();
    if (error) throw error;
    res.json({ chave: data.chave_integracao_catraca });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar chave de integração.' });
  }
});

// ============================================================================
// CADASTRO DE CATRACAS (tela "Configurar catraca") - CRUD simples, só pra dar
// nome/marca/local a cada equipamento físico e gerar a URL/instrução certa.
// ============================================================================

const MARCAS_VALIDAS = ['control_id', 'intelbras', 'topdata', 'henry', 'zkteco', 'evo', 'outra'];
const TIPOS_CONEXAO_VALIDOS = ['validacao_externa', 'push_adms', 'ip_manual'];

// Nunca devolve a senha de admin em texto puro pro navegador - só se tem uma salva ou não.
function sanitizarCatraca(catraca) {
  const { senha_admin_cripto, ...resto } = catraca;
  return { ...resto, tem_senha_admin: Boolean(senha_admin_cripto) };
}

// GET /api/acesso/catracas
router.get('/catracas', requireAuth, requireModulo('acesso', 'visualizar'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('catracas')
      .select('*')
      .eq('academia_id', req.funcionario.academia_id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json((data || []).map(sanitizarCatraca));
  } catch (err) {
    console.error(err);
    // Se a migração 005 ainda não foi rodada, não derruba a tela.
    res.status(200).json([]);
  }
});

// POST /api/acesso/catracas
router.post('/catracas', requireAuth, requireModulo('acesso', 'gerenciar'), async (req, res) => {
  try {
    const { nome, marca, modelo, local, sentido_padrao, observacoes, tipo_conexao, ip, porta, usuario_admin, senha_admin } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Dê um nome pra essa catraca (ex: "Catraca Entrada").' });
    if (marca && !MARCAS_VALIDAS.includes(marca)) return res.status(400).json({ erro: 'Marca inválida.' });
    if (tipo_conexao && !TIPOS_CONEXAO_VALIDOS.includes(tipo_conexao)) return res.status(400).json({ erro: 'Tipo de conexão inválido.' });

    const { data, error } = await supabaseAdmin
      .from('catracas')
      .insert({
        academia_id: req.funcionario.academia_id,
        nome,
        marca: marca || 'outra',
        modelo: modelo || null,
        local: local || null,
        sentido_padrao: sentido_padrao || 'ambos',
        observacoes: observacoes || null,
        tipo_conexao: tipo_conexao || 'validacao_externa',
        ip: ip || null,
        porta: porta ? Number(porta) : null,
        usuario_admin: usuario_admin || null,
        senha_admin_cripto: senha_admin ? criptografar(senha_admin) : null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(sanitizarCatraca(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao cadastrar catraca.' });
  }
});

// PUT /api/acesso/catracas/:id
router.put('/catracas/:id', requireAuth, requireModulo('acesso', 'gerenciar'), async (req, res) => {
  try {
    const { nome, marca, modelo, local, sentido_padrao, ativa, observacoes, tipo_conexao, ip, porta, usuario_admin, senha_admin } =
      req.body;
    if (marca && !MARCAS_VALIDAS.includes(marca)) return res.status(400).json({ erro: 'Marca inválida.' });
    if (tipo_conexao && !TIPOS_CONEXAO_VALIDOS.includes(tipo_conexao)) return res.status(400).json({ erro: 'Tipo de conexão inválido.' });

    const atualizacao = {
      nome,
      marca,
      modelo,
      local,
      sentido_padrao,
      ativa,
      observacoes,
      tipo_conexao,
      ip,
      porta: porta ? Number(porta) : null,
      usuario_admin,
    };
    if (senha_admin) atualizacao.senha_admin_cripto = criptografar(senha_admin);

    const { data, error } = await supabaseAdmin
      .from('catracas')
      .update(atualizacao)
      .eq('id', req.params.id)
      .eq('academia_id', req.funcionario.academia_id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ erro: 'Catraca não encontrada.' });
    res.json(sanitizarCatraca(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar catraca.' });
  }
});

// DELETE /api/acesso/catracas/:id
router.delete('/catracas/:id', requireAuth, requireModulo('acesso', 'gerenciar'), async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('catracas')
      .delete()
      .eq('id', req.params.id)
      .eq('academia_id', req.funcionario.academia_id);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao remover catraca.' });
  }
});

module.exports = router;

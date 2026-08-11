const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireModulo } = require('../middleware/authorize');
const mensalidadeService = require('../services/mensalidadeService');

const router = express.Router();

// GET /api/alunos?busca=joao&status=ativo
router.get('/', requireModulo('alunos', 'visualizar'), async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    const { busca, status } = req.query;

    // Aquece o status das mensalidades vencidas antes de calcular quem está
    // bloqueado (ver acessoService.js para a explicação completa desse padrão).
    await mensalidadeService.atualizarAtrasadas(academiaId);

    let query = supabaseAdmin
      .from('alunos')
      .select('*')
      .eq('academia_id', academiaId)
      .order('nome', { ascending: true });

    if (status) query = query.eq('status', status);
    if (busca) query = query.or(`nome.ilike.%${busca}%,cpf.ilike.%${busca}%,email.ilike.%${busca}%`);

    const { data, error } = await query;
    if (error) throw error;

    // Marca quem está bloqueado no acesso (sem matrícula ativa OU com mensalidade
    // atrasada), pra já aparecer na lista sem precisar abrir o relatório de acesso.
    const hoje = new Date().toISOString().slice(0, 10);
    const [{ data: comMatriculaAtiva }, { data: comAtraso }] = await Promise.all([
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

    const comBloqueio = data.map((a) => ({
      ...a,
      bloqueado: a.status === 'ativo' && (!idsComMatricula.has(a.id) || idsComAtraso.has(a.id)),
    }));

    res.json(comBloqueio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar alunos.' });
  }
});

// GET /api/alunos/:id - perfil detalhado: dados + matrículas + mensalidades
router.get('/:id', requireModulo('alunos', 'visualizar'), async (req, res) => {
  try {
    const { id } = req.params;
    const academiaId = req.funcionario.academia_id;

    await mensalidadeService.atualizarAtrasadas(academiaId);

    const { data: aluno, error: erroAluno } = await supabaseAdmin
      .from('alunos')
      .select('*')
      .eq('id', id)
      .eq('academia_id', academiaId)
      .maybeSingle();
    if (erroAluno) throw erroAluno;
    if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });

    const { data: matriculas, error: erroMatriculas } = await supabaseAdmin
      .from('matriculas')
      .select('*, planos(*)')
      .eq('aluno_id', id)
      .order('created_at', { ascending: false });
    if (erroMatriculas) throw erroMatriculas;

    const { data: mensalidades, error: erroMensalidades } = await supabaseAdmin
      .from('mensalidades')
      .select('*, formas_pagamento(nome)')
      .eq('aluno_id', id)
      .order('data_vencimento', { ascending: false });
    if (erroMensalidades) throw erroMensalidades;

    const hoje = new Date().toISOString().slice(0, 10);
    const temMatriculaAtiva = matriculas.some((m) => m.status === 'ativa');
    const temAtraso = mensalidades.some(
      (m) => (m.status === 'atrasado' || m.status === 'em_aberto') && m.data_vencimento < hoje
    );
    const bloqueado = aluno.status === 'ativo' && (!temMatriculaAtiva || temAtraso);
    const motivoBloqueio = bloqueado ? (temAtraso ? 'Mensalidade em atraso' : 'Sem matrícula ativa') : null;

    res.json({ aluno: { ...aluno, bloqueado, motivo_bloqueio: motivoBloqueio }, matriculas, mensalidades });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar perfil do aluno.' });
  }
});

// POST /api/alunos
router.post('/', requireModulo('alunos', 'gerenciar'), async (req, res) => {
  try {
    const payload = { ...req.body, academia_id: req.funcionario.academia_id };
    if (!payload.nome || !payload.cpf) {
      return res.status(400).json({ erro: 'Nome e CPF são obrigatórios.' });
    }

    const { data, error } = await supabaseAdmin.from('alunos').insert(payload).select().single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ erro: 'Já existe um aluno cadastrado com esse CPF.' });
      }
      throw error;
    }
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao cadastrar aluno.' });
  }
});

// PUT /api/alunos/:id
router.put('/:id', requireModulo('alunos', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { academia_id, ...atualizacoes } = req.body; // nunca deixa o client trocar a academia do registro

    const { data, error } = await supabaseAdmin
      .from('alunos')
      .update(atualizacoes)
      .eq('id', id)
      .eq('academia_id', req.funcionario.academia_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar aluno.' });
  }
});

// DELETE /api/alunos/:id
router.delete('/:id', requireModulo('alunos', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('alunos')
      .delete()
      .eq('id', id)
      .eq('academia_id', req.funcionario.academia_id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir aluno.' });
  }
});

// POST /api/alunos/:id/foto - recebe a imagem em base64, sobe pro Supabase
// Storage e salva a URL pública em alunos.foto_url
router.post('/:id/foto', requireModulo('alunos', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { foto_base64 } = req.body;
    const academiaId = req.funcionario.academia_id;

    const casamento = /^data:(image\/\w+);base64,(.+)$/.exec(foto_base64 || '');
    if (!casamento) {
      return res.status(400).json({ erro: 'Envie uma imagem válida (foto_base64 no formato data URL).' });
    }
    const [, contentType, base64] = casamento;
    const extensao = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1];
    const buffer = Buffer.from(base64, 'base64');

    const { data: aluno } = await supabaseAdmin
      .from('alunos')
      .select('id')
      .eq('id', id)
      .eq('academia_id', academiaId)
      .maybeSingle();
    if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });

    const caminho = `${academiaId}/${id}.${extensao}`;
    const { error: erroUpload } = await supabaseAdmin.storage
      .from('fotos-alunos')
      .upload(caminho, buffer, { contentType, upsert: true });
    if (erroUpload) throw erroUpload;

    const { data: urlData } = supabaseAdmin.storage.from('fotos-alunos').getPublicUrl(caminho);
    // "cache bust" pra imagem atualizar na hora mesmo com o mesmo nome de arquivo
    const fotoUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    const { data: atualizado, error: erroUpdate } = await supabaseAdmin
      .from('alunos')
      .update({ foto_url: fotoUrl })
      .eq('id', id)
      .eq('academia_id', academiaId)
      .select()
      .single();
    if (erroUpdate) throw erroUpdate;

    res.json(atualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao enviar foto do aluno.' });
  }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tobias-valadares-secret-2025';

// ── Middleware de autenticação ──
function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token necessário' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido' });
  }
}

// ════════════════════════════
// AUTH
// ════════════════════════════
router.post('/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const r = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email]);
    if (!r.rows.length) return res.status(401).json({ erro: 'Usuário não encontrado' });
    const user = r.rows[0];
    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) return res.status(401).json({ erro: 'Senha incorreta' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, nome: user.nome }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, usuario: { id: user.id, nome: user.nome, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ════════════════════════════
// CLIENTES
// ════════════════════════════
router.get('/clientes', auth, async (req, res) => {
  try {
    const { busca, status } = req.query;
    let q = 'SELECT * FROM clientes WHERE 1=1';
    const params = [];
    if (busca) { params.push(`%${busca}%`); q += ` AND (nome ILIKE $${params.length} OR cpf ILIKE $${params.length} OR area ILIKE $${params.length})`; }
    if (status) { params.push(status); q += ` AND status ILIKE $${params.length}`; }
    q += ' ORDER BY criado_em DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.get('/clientes/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM clientes WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/clientes', auth, async (req, res) => {
  try {
    const f = req.body;
    const r = await pool.query(`
      INSERT INTO clientes (nome,cpf,rg,data_nascimento,estado_civil,telefone,email,endereco,profissao,renda,
        nit,num_beneficio,cid,tempo_contribuicao,area,advogada,tipo_atendimento,status,motivo,observacoes,data_entrada,honorarios)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *`,
      [f.nome,f.cpf,f.rg,f.data_nascimento||null,f.estado_civil,f.telefone,f.email,f.endereco,
       f.profissao,f.renda,f.nit,f.num_beneficio,f.cid,f.tempo_contribuicao,
       f.area,f.advogada,f.tipo_atendimento,f.status||'Ativo',f.motivo,f.observacoes,
       f.data_entrada||null,f.honorarios]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.put('/clientes/:id', auth, async (req, res) => {
  try {
    const f = req.body;
    const r = await pool.query(`
      UPDATE clientes SET nome=$1,cpf=$2,rg=$3,data_nascimento=$4,estado_civil=$5,telefone=$6,email=$7,
        endereco=$8,profissao=$9,renda=$10,nit=$11,num_beneficio=$12,cid=$13,tempo_contribuicao=$14,
        area=$15,advogada=$16,tipo_atendimento=$17,status=$18,motivo=$19,observacoes=$20,honorarios=$21,
        atualizado_em=NOW()
      WHERE id=$22 RETURNING *`,
      [f.nome,f.cpf,f.rg,f.data_nascimento||null,f.estado_civil,f.telefone,f.email,f.endereco,
       f.profissao,f.renda,f.nit,f.num_beneficio,f.cid,f.tempo_contribuicao,
       f.area,f.advogada,f.tipo_atendimento,f.status,f.motivo,f.observacoes,f.honorarios,req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/clientes/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM clientes WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════
// PROCESSOS
// ════════════════════════════
router.get('/processos', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM processos ORDER BY criado_em DESC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.get('/processos/cliente/:clienteId', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM processos WHERE cliente_id=$1 ORDER BY criado_em DESC', [req.params.clienteId]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/processos', auth, async (req, res) => {
  try {
    const f = req.body;
    const r = await pool.query(`
      INSERT INTO processos (num_processo,cliente_id,cliente_nome,area,tipo_acao,descricao,status,advogada,data_abertura,data_prazo,andamentos)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [f.num_processo,f.cliente_id||null,f.cliente_nome,f.area,f.tipo_acao,f.descricao,
       f.status||'Em andamento',f.advogada,f.data_abertura||null,f.data_prazo||null,f.andamentos]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.put('/processos/:id', auth, async (req, res) => {
  try {
    const f = req.body;
    const r = await pool.query(`
      UPDATE processos SET num_processo=$1,cliente_nome=$2,area=$3,tipo_acao=$4,descricao=$5,
        status=$6,advogada=$7,data_prazo=$8,andamentos=$9,atualizado_em=NOW()
      WHERE id=$10 RETURNING *`,
      [f.num_processo,f.cliente_nome,f.area,f.tipo_acao,f.descricao,
       f.status,f.advogada,f.data_prazo||null,f.andamentos,req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/processos/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM processos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════
// AGENDAMENTOS
// ════════════════════════════
router.get('/agendamentos', auth, async (req, res) => {
  try {
    const { data } = req.query;
    let q = 'SELECT * FROM agendamentos WHERE 1=1';
    const params = [];
    if (data) { params.push(data); q += ` AND data_agendamento=$${params.length}`; }
    q += ' ORDER BY data_agendamento, horario';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/agendamentos', auth, async (req, res) => {
  try {
    const f = req.body;
    const r = await pool.query(`
      INSERT INTO agendamentos (cliente_id,cliente_nome,data_agendamento,horario,area,advogada,status,observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [f.cliente_id||null,f.cliente_nome,f.data_agendamento,f.horario,f.area,f.advogada,f.status||'Confirmado',f.observacoes]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.put('/agendamentos/:id', auth, async (req, res) => {
  try {
    const f = req.body;
    const r = await pool.query(`
      UPDATE agendamentos SET status=$1,observacoes=$2 WHERE id=$3 RETURNING *`,
      [f.status, f.observacoes, req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/agendamentos/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM agendamentos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════
// CÁLCULOS INSS
// ════════════════════════════
router.get('/calculos', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM calculos_inss ORDER BY criado_em DESC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/calculos', auth, async (req, res) => {
  try {
    const f = req.body;
    const r = await pool.query(`
      INSERT INTO calculos_inss (cliente_id,cliente_nome,sexo,data_nascimento,total_dias,total_formatado,periodos,elegibilidades,observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [f.cliente_id||null,f.cliente_nome,f.sexo,f.data_nascimento||null,
       f.total_dias,f.total_formatado,JSON.stringify(f.periodos),JSON.stringify(f.elegibilidades),f.observacoes]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/calculos/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM calculos_inss WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════
// HONORÁRIOS
// ════════════════════════════
router.get('/honorarios', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM honorarios ORDER BY criado_em DESC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/honorarios', auth, async (req, res) => {
  try {
    const f = req.body;
    const r = await pool.query(`
      INSERT INTO honorarios (cliente_id,cliente_nome,tipo,valor,status_pagamento,vencimento,observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [f.cliente_id||null,f.cliente_nome,f.tipo,f.valor,f.status_pagamento||'Pendente',f.vencimento||null,f.observacoes]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.put('/honorarios/:id', auth, async (req, res) => {
  try {
    const f = req.body;
    const r = await pool.query(`UPDATE honorarios SET status_pagamento=$1 WHERE id=$2 RETURNING *`, [f.status_pagamento, req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════
// DASHBOARD (métricas)
// ════════════════════════════
router.get('/dashboard', auth, async (req, res) => {
  try {
    const [totalClientes, processosAtivos, agendHoje, concluidos] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM clientes'),
      pool.query("SELECT COUNT(*) FROM processos WHERE status ILIKE '%andamento%'"),
      pool.query('SELECT COUNT(*) FROM agendamentos WHERE data_agendamento=CURRENT_DATE'),
      pool.query("SELECT COUNT(*) FROM processos WHERE status ILIKE '%conclu%'"),
    ]);
    res.json({
      totalClientes: parseInt(totalClientes.rows[0].count),
      processosAtivos: parseInt(processosAtivos.rows[0].count),
      agendHoje: parseInt(agendHoje.rows[0].count),
      concluidos: parseInt(concluidos.rows[0].count),
    });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════
// ADVOGADOS
// ════════════════════════════
router.get('/advogados', auth, async (req, res) => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS advogados (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(200) NOT NULL,
      nome_exibicao VARCHAR(200),
      cpf VARCHAR(20),
      data_nascimento DATE,
      telefone VARCHAR(30),
      email VARCHAR(200),
      endereco TEXT,
      oab VARCHAR(50),
      estado VARCHAR(10),
      tipo VARCHAR(50) DEFAULT 'titular',
      status VARCHAR(50) DEFAULT 'Ativo',
      areas TEXT,
      faculdade VARCHAR(200),
      ano_formatura VARCHAR(10),
      pos_graduacao TEXT,
      bio TEXT,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    )`);
    const r = await pool.query('SELECT * FROM advogados ORDER BY nome ASC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/advogados', auth, async (req, res) => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS advogados (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(200) NOT NULL,
      nome_exibicao VARCHAR(200),
      cpf VARCHAR(20),
      data_nascimento DATE,
      telefone VARCHAR(30),
      email VARCHAR(200),
      endereco TEXT,
      oab VARCHAR(50),
      estado VARCHAR(10),
      tipo VARCHAR(50) DEFAULT 'titular',
      status VARCHAR(50) DEFAULT 'Ativo',
      areas TEXT,
      faculdade VARCHAR(200),
      ano_formatura VARCHAR(10),
      pos_graduacao TEXT,
      bio TEXT,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    )`);
    const f = req.body;
    if (!f.nome || !f.oab) return res.status(400).json({ erro: 'Nome e OAB são obrigatórios' });
    const r = await pool.query(`
      INSERT INTO advogados (nome,nome_exibicao,cpf,data_nascimento,telefone,email,endereco,oab,estado,tipo,status,areas,faculdade,ano_formatura,pos_graduacao,bio,observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [f.nome,f.nome_exibicao||null,f.cpf||null,f.data_nascimento||null,f.telefone||null,
       f.email||null,f.endereco||null,f.oab,f.estado||'MG',f.tipo||'titular',
       f.status||'Ativo',f.areas||null,f.faculdade||null,f.ano_formatura||null,
       f.pos_graduacao||null,f.bio||null,f.observacoes||null]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.put('/advogados/:id', auth, async (req, res) => {
  try {
    const f = req.body;
    const r = await pool.query(`
      UPDATE advogados SET nome=$1,nome_exibicao=$2,telefone=$3,email=$4,oab=$5,estado=$6,tipo=$7,status=$8,areas=$9,bio=$10,observacoes=$11
      WHERE id=$12 RETURNING *`,
      [f.nome,f.nome_exibicao||null,f.telefone||null,f.email||null,f.oab,f.estado||'MG',
       f.tipo||'titular',f.status||'Ativo',f.areas||null,f.bio||null,f.observacoes||null,req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/advogados/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM advogados WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════
// FUNCIONÁRIOS
// ════════════════════════════
router.get('/funcionarios', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, nome, email, role, cargo, criado_em FROM usuarios ORDER BY criado_em DESC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/funcionarios', auth, async (req, res) => {
  try {
    const { nome, email, cargo, role, senha, observacoes } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(senha, 10);
    // Adiciona coluna cargo se não existir
    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo VARCHAR(100)`).catch(()=>{});
    const r = await pool.query(
      'INSERT INTO usuarios (nome, email, senha, role, cargo) VALUES ($1,$2,$3,$4,$5) RETURNING id, nome, email, role, cargo, criado_em',
      [nome, email, hash, role || 'funcionario', cargo || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ erro: 'Este e-mail já está cadastrado' });
    res.status(500).json({ erro: e.message });
  }
});

router.delete('/funcionarios/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;

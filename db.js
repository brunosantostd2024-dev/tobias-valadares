const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(200) NOT NULL,
        email VARCHAR(200) UNIQUE NOT NULL,
        senha VARCHAR(200) NOT NULL,
        role VARCHAR(50) DEFAULT 'funcionario',
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(200) NOT NULL,
        cpf VARCHAR(20),
        rg VARCHAR(30),
        data_nascimento DATE,
        estado_civil VARCHAR(50),
        telefone VARCHAR(30),
        email VARCHAR(200),
        endereco TEXT,
        profissao VARCHAR(100),
        renda VARCHAR(50),
        nit VARCHAR(30),
        num_beneficio VARCHAR(50),
        cid VARCHAR(100),
        tempo_contribuicao VARCHAR(50),
        area VARCHAR(100),
        advogada VARCHAR(100),
        tipo_atendimento VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Ativo',
        motivo TEXT,
        observacoes TEXT,
        data_entrada DATE DEFAULT CURRENT_DATE,
        honorarios VARCHAR(100),
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS processos (
        id SERIAL PRIMARY KEY,
        num_processo VARCHAR(100),
        cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        cliente_nome VARCHAR(200),
        area VARCHAR(100),
        tipo_acao VARCHAR(200),
        descricao TEXT,
        status VARCHAR(100) DEFAULT 'Em andamento',
        advogada VARCHAR(100),
        data_abertura DATE DEFAULT CURRENT_DATE,
        data_prazo DATE,
        andamentos TEXT,
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        cliente_nome VARCHAR(200),
        data_agendamento DATE NOT NULL,
        horario VARCHAR(10) NOT NULL,
        area VARCHAR(100),
        advogada VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Confirmado',
        observacoes TEXT,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS calculos_inss (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        cliente_nome VARCHAR(200),
        sexo VARCHAR(10),
        data_nascimento DATE,
        total_dias INTEGER,
        total_formatado VARCHAR(50),
        periodos JSONB,
        elegibilidades JSONB,
        observacoes TEXT,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS honorarios (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        cliente_nome VARCHAR(200),
        tipo VARCHAR(100),
        valor VARCHAR(100),
        status_pagamento VARCHAR(50) DEFAULT 'Pendente',
        vencimento DATE,
        observacoes TEXT,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);

    // Inserir usuário admin padrão se não existir
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('tobias2025', 10);
    await client.query(`
      INSERT INTO usuarios (nome, email, senha, role)
      VALUES ('Administrador', 'funcionario@escritorio.com', $1, 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [hash]);

    console.log('Banco de dados inicializado com sucesso!');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };

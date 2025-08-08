const { Pool } = require('pg');
require('dotenv').config();

let pool = null;

// Configuração do pool de conexões NeonDB
const createPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10, // máximo de conexões no pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Eventos do pool
    pool.on('connect', () => {
      console.log('Conectado ao NeonDB');
    });

    pool.on('error', (err) => {
      console.error('Erro no pool do NeonDB:', err);
    });
  }
  return pool;
};

// Função para executar queries
const query = async (text, params) => {
  const client = createPool();
  try {
    const start = Date.now();
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    console.log(`Query executada em ${duration}ms: ${text.substring(0, 100)}...`);
    return res;
  } catch (error) {
    console.error('Erro na query:', error);
    throw error;
  }
};

// Função para testar conexão
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('Teste de conexão NeonDB bem-sucedido:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('Erro no teste de conexão NeonDB:', error);
    return false;
  }
};

// Função para fechar conexões
const closePool = async () => {
  if (pool) {
    await pool.end();
    console.log('Pool de conexões NeonDB fechado');
  }
};

module.exports = {
  query,
  testConnection,
  closePool,
  createPool
};
const fs = require('fs');

console.log('🔧 Gerando arquivo .env para Discloud...');

// Criar arquivo .env com as variáveis de ambiente
const envContent = `# Configuração do Bot Discord
DISCORD_TOKEN=${process.env.ENV_DISCORD_TOKEN || process.env.DISCORD_TOKEN || 'seu_token_aqui'}
BOT_PREFIX=${process.env.ENV_BOT_PREFIX || process.env.BOT_PREFIX || 'q.'}
NODE_ENV=${process.env.ENV_NODE_ENV || process.env.NODE_ENV || 'production'}
LOG_LEVEL=${process.env.ENV_LOG_LEVEL || process.env.LOG_LEVEL || 'info'}

# Configuração do Banco de Dados (PostgreSQL)
DATABASE_URL=${process.env.DATABASE_URL || 'postgresql://usuario:senha@host:porta/banco'}
DB_HOST=${process.env.DB_HOST || 'seu_host_do_banco'}
DB_PORT=${process.env.DB_PORT || '5432'}
DB_NAME=${process.env.DB_NAME || 'nome_do_banco'}
DB_USER=${process.env.DB_USER || 'usuario_do_banco'}
DB_PASSWORD=${process.env.DB_PASSWORD || 'senha_do_banco'}
`;

fs.writeFileSync('.env', envContent);
console.log('✅ Arquivo .env criado com sucesso!');
console.log('📝 Variáveis configuradas:');
console.log('- DISCORD_TOKEN:', process.env.ENV_DISCORD_TOKEN ? '✅ Configurado' : '❌ Não configurado');
console.log('- BOT_PREFIX:', process.env.ENV_BOT_PREFIX || 'q.');
console.log('- NODE_ENV:', process.env.ENV_NODE_ENV || 'production');

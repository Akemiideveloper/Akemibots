const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 Configuração do Bot Discord');
console.log('==============================\n');

rl.question('Digite o token do seu bot Discord: ', (token) => {
  const envContent = `# Configuração do Bot Discord
DISCORD_TOKEN=${token}
BOT_PREFIX=q.

# Configuração do Banco de Dados (PostgreSQL)
DATABASE_URL=postgresql://usuario:senha@host:porta/banco
DB_HOST=seu_host_do_banco
DB_PORT=5432
DB_NAME=nome_do_banco
DB_USER=usuario_do_banco
DB_PASSWORD=senha_do_banco

# Opcional: Configuração de Logs
LOG_LEVEL=info
`;

  fs.writeFileSync('.env', envContent);
  console.log('\n✅ Arquivo .env criado com sucesso!');
  console.log('⚠️  IMPORTANTE: Nunca compartilhe seu token com ninguém!');
  console.log('🚀 Agora você pode executar: npm start');
  
  rl.close();
});

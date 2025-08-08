const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 Configuração do Bot Discord para Discloud');
console.log('============================================\n');

rl.question('Digite o token do seu bot Discord: ', (token) => {
  if (!token || token.trim() === '') {
    console.log('\n❌ Token não pode estar vazio!');
    rl.close();
    return;
  }

  // Criar o conteúdo completo do discloud.config
  const discloudConfig = `NAME=qwp
AVATAR=https://i.imgur.com/bWhx7OT.png
TYPE=bot
MAIN=index.js
RAM=100
AUTORESTART=false
VERSION=latest
APT=tools
START=
BUILD=

# Variáveis de Ambiente
ENV_DISCORD_TOKEN=${token.trim()}
ENV_BOT_PREFIX=q.
ENV_LOG_LEVEL=info`;

  // Escrever o arquivo atualizado
  fs.writeFileSync('discloud.config', discloudConfig);
  
  console.log('\n✅ Arquivo discloud.config atualizado com sucesso!');
  console.log('⚠️  IMPORTANTE: Nunca compartilhe seu token com ninguém!');
  console.log('🚀 Agora você pode fazer deploy no Discloud:');
  console.log('   discloud push');
  
  rl.close();
});

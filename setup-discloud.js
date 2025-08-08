const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 Configuração do Bot Discord para Discloud');
console.log('============================================\n');

rl.question('Digite o token do seu bot Discord: ', (token) => {
  // Ler o arquivo discloud.config atual
  let discloudConfig = fs.readFileSync('discloud.config', 'utf8');
  
  // Substituir o token placeholder pelo token real
  discloudConfig = discloudConfig.replace(
    'ENV_DISCORD_TOKEN=seu_token_do_bot_discord_aqui',
    `ENV_DISCORD_TOKEN=${token}`
  );
  
  // Escrever o arquivo atualizado
  fs.writeFileSync('discloud.config', discloudConfig);
  
  console.log('\n✅ Arquivo discloud.config atualizado com sucesso!');
  console.log('⚠️  IMPORTANTE: Nunca compartilhe seu token com ninguém!');
  console.log('🚀 Agora você pode fazer deploy no Discloud:');
  console.log('   discloud push');
  
  rl.close();
});

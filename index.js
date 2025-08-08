const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Debug: Verificar variáveis de ambiente
console.log('🔍 Debug - Variáveis de ambiente:');
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? '✅ Configurado' : '❌ Não configurado');
console.log('BOT_PREFIX:', process.env.BOT_PREFIX || 'q. (padrão)');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

// Importações do banco de dados
const { testConnection } = require('./database/connection');
const ServerConfig = require('./database/models/ServerConfig');
const ModerationLog = require('./database/models/ModerationLog');
const MuteManager = require('./database/models/MuteManager');
const BlacklistProtection = require('./database/models/BlacklistProtection');

// Sistema de prefixo por servidor
const defaultPrefix = process.env.BOT_PREFIX || 'q.';

// Função para obter prefixo do servidor
async function getServerPrefix(guildId) {
  try {
    const config = await ServerConfig.getServerConfig(guildId);
    return config.prefix;
  } catch (error) {
    console.error('Erro ao obter prefixo do servidor:', error);
    return defaultPrefix;
  }
}

// Função para obter configuração do servidor (wrapper para compatibilidade)
async function getServerConfig(guildId) {
  try {
    return await ServerConfig.getServerConfig(guildId);
  } catch (error) {
    console.error('Erro ao obter configuração do servidor:', error);
    return {
      guildId: guildId,
      prefix: defaultPrefix,
      logChannels: {
        ban: null,
        unban: null,
        moderation: null
      }
    };
  }
}

// Função para definir canal de log
async function setLogChannel(guildId, logType, channelId) {
  try {
    await ServerConfig.updateLogChannel(guildId, logType, channelId);
    console.log(`Canal de log ${logType} definido para servidor ${guildId}: ${channelId}`);
    return true;
  } catch (error) {
    console.error('Erro ao definir canal de log:', error);
    return false;
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ]
});

// Coleção de comandos
client.commands = new Collection();

// Carregar comandos dinamicamente
const commandsPath = path.join(__dirname, 'comandos');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('name' in command && 'execute' in command) {
    client.commands.set(command.name, command);
    console.log(`Comando carregado: ${command.name}`);
  } else {
    console.log(`[AVISO] O comando ${filePath} está sem propriedade "name" ou "execute".`);
  }
}

// Função para alterar o prefixo de um servidor específico
async function setServerPrefix(guildId, newPrefix) {
  try {
    await ServerConfig.updateServerPrefix(guildId, newPrefix);
    console.log(`Prefixo do servidor ${guildId} alterado para: ${newPrefix}`);
    return true;
  } catch (error) {
    console.error('Erro ao alterar prefixo do servidor:', error);
    return false;
  }
}

client.once('ready', async () => {
  console.log(`Bot de Segurança online como ${client.user.tag}`);
  console.log(`Prefixo padrão: ${defaultPrefix}`);
  console.log(`Comandos carregados: ${client.commands.size}`);
  console.log(`Conectado em ${client.guilds.cache.size} servidor(es)`);
  
  // Testar conexão com o banco de dados
  console.log('🔗 Testando conexão com NeonDB...');
  const dbConnected = await testConnection();
  
  if (dbConnected) {
    console.log('✅ Conectado ao NeonDB com sucesso');
    
    // Pré-carregar configurações de todos os servidores
    const guildIds = client.guilds.cache.map(guild => guild.id);
    await ServerConfig.preloadConfigs(guildIds);
    
    // Carregar mutes ativos e reativar timers
    console.log('🔄 Carregando sistema de mutes...');
    await MuteManager.loadActiveMutes(client);

    // Inicializar proteção de blacklist
    BlacklistProtection.initializeProtection(client);
    
    console.log('📋 Servidores conectados:');
    for (const guild of client.guilds.cache.values()) {
      const config = await ServerConfig.getServerConfig(guild.id);
      console.log(`  - ${guild.name} (ID: ${guild.id}) - ${guild.memberCount} membros - Prefixo: ${config.prefix}`);
    }
  } else {
    console.log('❌ Erro na conexão com NeonDB - Usando sistema em memória como fallback');
  }
  
  // Status do bot
  client.user.setActivity(`${defaultPrefix}help | Protegendo servidores`, { type: 'WATCHING' });
});

// Sistema de comandos
client.on('messageCreate', async message => {
  if (!message.author.bot && message.guild) {
    console.log(`📥 [${message.guild.name}] Mensagem de ${message.author.tag}: "${message.content.substring(0, 50)}..."`);
  }

  if (message.author.bot) return;
  if (!message.guild) {
    console.log('🚫 Mensagem ignorada: DM recebida');
    return; // Ignorar DMs
  }
  
  // Usar ServerConfig para obter prefixo do banco de dados
  let serverPrefix;
  try {
    const config = await ServerConfig.getServerConfig(message.guild.id);
    serverPrefix = config.prefix;
  } catch (error) {
    console.error('Erro ao buscar prefixo do servidor:', error);
    serverPrefix = getServerPrefix(message.guild.id); // Fallback para sistema em memória
  }
  
  console.log(`🔍 [${message.guild.name}] Prefixo do servidor: "${serverPrefix}"`);
  
  if (!message.content.startsWith(serverPrefix)) {
    console.log(`⏭️ [${message.guild.name}] Mensagem não inicia com prefixo "${serverPrefix}"`);
    return;
  }

  const args = message.content.slice(serverPrefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  console.log(`🔍 [${message.guild.name}] Tentando executar comando: "${commandName}"`);

  const command = client.commands.get(commandName);

  if (!command) {
    console.log(`❌ [${message.guild.name}] Comando "${commandName}" não encontrado`);
    return;
  }

  console.log(`✅ [${message.guild.name}] Comando executado: ${commandName} por ${message.author.tag}`);

  try {
    await command.execute(message, args, client, serverPrefix, setServerPrefix, getServerConfig, setLogChannel, ModerationLog);
  } catch (error) {
    console.error(`💥 [${message.guild.name}] Erro ao executar comando ${commandName}:`, error);
    try {
      await message.reply('Ocorreu um erro ao executar este comando.');
    } catch (replyError) {
      await message.channel.send('Ocorreu um erro ao executar este comando.');
    }
  }
});



// Tratamento graceful de desligamento
process.on('SIGINT', async () => {
  console.log('Desligando bot...');
  
  // Limpar timers de mute
  MuteManager.clearAllTimers();
  
  // Fechar conexões do banco
  const { closePool } = require('./database/connection');
  await closePool();
  
  // Destruir cliente do Discord
  client.destroy();
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Desligando bot...');
  
  // Limpar timers de mute
  MuteManager.clearAllTimers();
  
  // Fechar conexões do banco
  const { closePool } = require('./database/connection');
  await closePool();
  
  // Destruir cliente do Discord
  client.destroy();
  
  process.exit(0);
});

// Exportar client para outros módulos (necessário para MuteManager)
module.exports = { client };

// Debug: Verificar token antes do login
console.log('🔍 Debug - Antes do login:');
console.log('Token length:', process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.length : 0);
console.log('Token starts with:', process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.substring(0, 10) + '...' : 'N/A');

// Login do bot
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ ERRO: DISCORD_TOKEN não está configurado!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);

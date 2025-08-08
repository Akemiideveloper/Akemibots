const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'ver-config',
  description: 'Mostra as configurações atuais do servidor',
  async execute(message, args, client, serverPrefix, setServerPrefix, getServerConfig) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Você precisa ter permissão de Administrador para usar este comando.');
    }

    // Tentar obter configuração do banco de dados primeiro, depois fallback para sistema em memória
    let config;
    try {
      const ServerConfig = require('../database/models/ServerConfig');
      config = await ServerConfig.getServerConfig(message.guild.id);
    } catch (error) {
      console.error('Erro ao buscar config do banco:', error);
      config = getServerConfig(message.guild.id) || { logChannels: {} };
    }
    
    // Garantir que logChannels existe
    if (!config.logChannels) {
      config.logChannels = {};
    }
    const guild = message.guild;

    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle('Configurações do Servidor')
      .setDescription(`Configurações atuais para **${guild.name}**`)
      .setThumbnail(guild.iconURL({ dynamic: true }));

    // Configuração de prefixo
    embed.addFields({
      name: 'Prefixo do Bot',
      value: `\`${serverPrefix}\``,
      inline: true
    });

    // Configurações de log
    const logChannels = config?.logChannels || {};
    let logStatus = '';

    const logTypes = [
      { key: 'ban', name: 'Banimentos' },
      { key: 'unban', name: 'Desbanimentos' },
      { key: 'moderation', name: 'Moderação Geral' },
      { key: 'mute', name: 'Mutes' },
      { key: 'unmute', name: 'Unmutes' },
      { key: 'blacklist', name: 'Blacklist' },
      { key: 'primeira_dama', name: 'Primeira Dama' },
      { key: 'panela', name: 'Panela' }
    ];

    for (const logType of logTypes) {
      const channelId = logChannels[logType.key];
      if (channelId) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          logStatus += `• **${logType.name}**: ${channel}\n`;
        } else {
          logStatus += `• **${logType.name}**: Canal removido (ID: ${channelId})\n`;
        }
      } else {
        logStatus += `• **${logType.name}**: Não configurado\n`;
      }
    }

    embed.addFields({
      name: 'Canais de Log',
      value: logStatus || 'Nenhum canal configurado',
      inline: false
    });

    // Informações do servidor
    embed.addFields(
      { name: 'ID do Servidor', value: guild.id, inline: true },
      { name: 'Membros', value: guild.memberCount.toString(), inline: true },
      { name: 'Comandos Carregados', value: client.commands.size.toString(), inline: true }
    );

    embed.addFields({
      name: 'Como Configurar',
      value: `Use \`${serverPrefix}config-logs\` para configurar canais de log\nUse \`${serverPrefix}setprefix\` para alterar o prefixo`,
      inline: false
    });

    embed.setFooter({ text: 'Sistema de Configuração' })
         .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
};
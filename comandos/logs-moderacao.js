const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'logs-moderacao',
  description: 'Visualiza logs de moderação do servidor',
  async execute(message, args, client, serverPrefix, setServerPrefix, getServerConfig, setLogChannel, ModerationLog) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('Você precisa ter permissão para moderar membros para usar este comando.');
    }

    const action = args[0]?.toLowerCase();
    const guildId = message.guild.id;

    try {
      if (!action || action === 'recentes') {
        // Mostrar logs recentes
        const logs = await ModerationLog.getLogsByGuild(guildId, 10);
        
        if (logs.length === 0) {
          const embed = new EmbedBuilder()
            .setColor('#bbffc3')
            .setTitle('Logs de Moderação')
            .setDescription('Nenhum log de moderação encontrado neste servidor.')
            .setTimestamp();
          
          return message.reply({ embeds: [embed] });
        }

        let logText = '';
        logs.forEach((log, index) => {
          const date = new Date(log.created_at).toLocaleString('pt-BR');
          const username = log.username ? `${log.username}#${log.discriminator}` : log.user_id;
          logText += `**${index + 1}.** ${log.action_type.toUpperCase()} | ${username}\n`;
          logText += `   Moderador: <@${log.moderator_id}> | ${date}\n`;
          logText += `   Motivo: ${log.reason || 'Não informado'}\n\n`;
        });

        const embed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle('Logs de Moderação Recentes')
          .setDescription(logText)
          .setFooter({ text: `Use ${serverPrefix}logs-moderacao stats para ver estatísticas` })
          .setTimestamp();

        return message.reply({ embeds: [embed] });

      } else if (action === 'stats') {
        // Mostrar estatísticas
        const stats = await ModerationLog.getModerationStats(guildId);
        const total = await ModerationLog.countLogsByGuild(guildId);

        if (stats.length === 0) {
          const embed = new EmbedBuilder()
            .setColor('#bbffc3')
            .setTitle('Estatísticas de Moderação')
            .setDescription('Nenhuma ação de moderação registrada nos últimos 30 dias.')
            .setTimestamp();
          
          return message.reply({ embeds: [embed] });
        }

        let statsText = '';
        stats.forEach(stat => {
          const actionName = this.getActionName(stat.action_type);
          statsText += `${actionName}: ${stat.count}\n`;
        });

        const embed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle('Estatísticas de Moderação')
          .setDescription('Ações de moderação nos últimos 30 dias')
          .addFields(
            { name: 'Total de Logs', value: total.toString(), inline: true },
            { name: 'Ações por Tipo', value: statsText, inline: false }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });

      } else if (action === 'usuario') {
        // Logs de usuário específico
        const userId = args[1];
        if (!userId) {
          return message.reply(`Use: \`${serverPrefix}logs-moderacao usuario <user_id>\``);
        }

        const userLogs = await ModerationLog.getLogsByUser(guildId, userId);
        
        if (userLogs.length === 0) {
          const embed = new EmbedBuilder()
            .setColor('#bbffc3')
            .setTitle('Logs de Usuário')
            .setDescription(`Nenhum log encontrado para o usuário ${userId}.`)
            .setTimestamp();
          
          return message.reply({ embeds: [embed] });
        }

        let userLogText = '';
        userLogs.forEach((log, index) => {
          const date = new Date(log.created_at).toLocaleString('pt-BR');
          userLogText += `**${index + 1}.** ${log.action_type.toUpperCase()}\n`;
          userLogText += `   Moderador: <@${log.moderator_id}> | ${date}\n`;
          userLogText += `   Motivo: ${log.reason || 'Não informado'}\n\n`;
        });

        const embed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle(`Logs de Moderação - <@${userId}>`)
          .setDescription(userLogText)
          .setTimestamp();

        return message.reply({ embeds: [embed] });

      } else {
        // Ajuda
        const embed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle('Logs de Moderação - Ajuda')
          .setDescription('Como usar o sistema de logs de moderação')
          .addFields(
            {
              name: 'Comandos Disponíveis',
              value: `\`${serverPrefix}logs-moderacao\` ou \`${serverPrefix}logs-moderacao recentes\` - Logs recentes\n\`${serverPrefix}logs-moderacao stats\` - Estatísticas do servidor\n\`${serverPrefix}logs-moderacao usuario <id>\` - Logs de usuário específico`,
              inline: false
            }
          )
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Erro ao buscar logs de moderação:', error);
      return message.reply('Erro ao buscar logs de moderação.');
    }
  },

  getActionName(actionType) {
    const names = {
      'ban': 'Banimentos',
      'unban': 'Desbanimentos',
      'kick': 'Expulsões',
      'mute': 'Silenciamentos',
      'warn': 'Advertências'
    };
    return names[actionType] || actionType;
  }
};
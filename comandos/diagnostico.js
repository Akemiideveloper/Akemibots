const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'diagnostico',
  description: 'Verifica o status do bot e configurações do servidor',
  async execute(message, args, client, serverPrefix) {
    const guild = message.guild;
    
    // Coleta informações do servidor atual
    const serverInfo = {
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      prefix: serverPrefix,
      botPermissions: guild.members.me.permissions.toArray(),
      channelPermissions: message.channel.permissionsFor(guild.members.me).toArray()
    };
    
    // Informações gerais do bot
    const botInfo = {
      guilds: client.guilds.cache.size,
      commands: client.commands.size,
      uptime: client.uptime,
      ping: client.ws.ping
    };
    
    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle('🔧 Diagnóstico do Bot')
      .setDescription('Informações detalhadas sobre o status do bot neste servidor')
      .addFields(
        {
          name: '🏠 Servidor Atual',
          value: `**Nome:** ${serverInfo.name}\n**ID:** ${serverInfo.id}\n**Membros:** ${serverInfo.memberCount}\n**Prefixo:** \`${serverInfo.prefix}\``,
          inline: true
        },
        {
          name: '🤖 Status do Bot',
          value: `**Servidores:** ${botInfo.guilds}\n**Comandos:** ${botInfo.commands}\n**Ping:** ${botInfo.ping}ms\n**Uptime:** ${formatUptime(botInfo.uptime)}`,
          inline: true
        },
        {
          name: '🔑 Permissões Principais',
          value: serverInfo.botPermissions.includes('Administrator') ? 
            '✅ Administrador (todas as permissões)' :
            `${serverInfo.botPermissions.includes('BanMembers') ? '✅' : '❌'} Banir Membros\n${serverInfo.botPermissions.includes('KickMembers') ? '✅' : '❌'} Expulsar Membros\n${serverInfo.botPermissions.includes('ManageMessages') ? '✅' : '❌'} Gerenciar Mensagens\n${serverInfo.botPermissions.includes('ModerateMembers') ? '✅' : '❌'} Moderar Membros`,
          inline: false
        }
      )
      .setTimestamp();
    
    // Adicionar informação sobre outros servidores
    if (client.guilds.cache.size > 1) {
      const otherServers = client.guilds.cache
        .filter(g => g.id !== guild.id)
        .map(g => `• ${g.name} (${g.memberCount} membros)`)
        .join('\n');
      
      if (otherServers) {
        embed.addFields({
          name: '🌐 Outros Servidores Conectados',
          value: otherServers.length > 1000 ? otherServers.substring(0, 1000) + '...' : otherServers,
          inline: false
        });
      }
    }
    
    await message.reply({ embeds: [embed] });
  }
};

function formatUptime(uptime) {
  const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
  const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((uptime % (60 * 1000)) / 1000);
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
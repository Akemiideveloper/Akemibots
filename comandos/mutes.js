const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const MuteManager = require('../database/models/MuteManager');

module.exports = {
  name: 'mutes',
  description: 'Lista todos os mutes ativos do servidor',
  async execute(message, args, client, botPrefix) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('❌ Você não tem permissão para ver os mutes.');
    }
    
    try {
      const activeMutes = await MuteManager.getActiveMutes(message.guild.id);
      
      if (activeMutes.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle('Mutes Ativos')
          .setDescription('Nenhum mute ativo neste servidor.')
          .setTimestamp();
        
        return message.reply({ embeds: [embed] });
      }
      
      let description = '';
      const currentTime = new Date();
      
      for (let i = 0; i < activeMutes.length && i < 10; i++) {
        const mute = activeMutes[i];
        const expiresAt = new Date(mute.expires_at);
        const timeLeft = expiresAt - currentTime;
        
        const user = mute.username ? `${mute.username}#${mute.discriminator}` : `<@${mute.user_id}>`;
        const timeLeftText = timeLeft > 0 ? formatTimeLeft(timeLeft) : 'Expirando...';
        
        description += `**${i + 1}.** ${user}\n`;
        description += `Expira em: ${timeLeftText}\n`;
        description += `Motivo: ${mute.reason || 'Não informado'}\n`;
        description += `ID: ${mute.id}\n\n`;
      }
      
      if (activeMutes.length > 10) {
        description += `*... e mais ${activeMutes.length - 10} mute(s)*`;
      }
      
      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle(`Mutes Ativos (${activeMutes.length})`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: `Use ${botPrefix}unmute @usuario para desmutar manualmente` });
      
      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Erro ao listar mutes:', error);
      message.reply('❌ Erro ao buscar mutes ativos.');
    }
  }
};

function formatTimeLeft(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
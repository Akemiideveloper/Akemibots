const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'kick',
  description: 'Remove um usuário do servidor',
  async execute(message, args, client, botPrefix) {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply('Você não tem permissão para expulsar membros.');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
      return message.reply(`Use: \`${botPrefix}kick <@usuário> [motivo]\``);
    }
    
    const member = message.guild.members.cache.get(user.id);
    if (!member) {
      return message.reply('Usuário não encontrado no servidor.');
    }
    
    if (!member.kickable) {
      return message.reply('Não posso expulsar este usuário.');
    }
    
    const reason = args.slice(1).join(' ') || 'Não informado';
    
    try {
      await member.kick(reason);
      
      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Usuário Expulso')
        .addFields(
          { name: 'Usuário', value: `${user.tag}`, inline: true },
          { name: 'Moderador', value: `${message.author.tag}`, inline: true },
          { name: 'Motivo', value: reason, inline: false }
        )
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply('Erro ao expulsar o usuário.');
    }
  }
};
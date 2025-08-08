const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'warn',
  description: 'Envia uma advertência para um usuário',
  async execute(message, args, client, botPrefix) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('Você não tem permissão para advertir membros.');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
      return message.reply(`Use: \`${botPrefix}warn <@usuário> <motivo>\``);
    }
    
    const reason = args.slice(1).join(' ');
    if (!reason) {
      return message.reply('Você deve fornecer um motivo para a advertência.');
    }
    
    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle('Usuário Advertido')
      .addFields(
        { name: 'Usuário', value: `${user.tag}`, inline: true },
        { name: 'Moderador', value: `${message.author.tag}`, inline: true },
        { name: 'Motivo', value: reason, inline: false }
      )
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
    
    // Enviar DM para o usuário advertido
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Você foi advertido')
        .setDescription(`Servidor: ${message.guild.name}`)
        .addFields(
          { name: 'Moderador', value: message.author.tag, inline: true },
          { name: 'Motivo', value: reason, inline: false }
        )
        .setTimestamp();
      
      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.log('Não foi possível enviar DM para o usuário advertido.');
    }
  }
};
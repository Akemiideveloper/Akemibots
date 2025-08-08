const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'userinfo',
  description: 'Mostra informações detalhadas de um usuário',
  async execute(message, args, client, botPrefix) {
    const user = message.mentions.users.first() || message.author;
    const member = message.guild.members.cache.get(user.id);
    
    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle(`Informações de ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Conta Criada', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Entrou no Servidor', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'N/A', inline: true },
        { name: 'Status', value: member ? member.presence?.status || 'offline' : 'N/A', inline: true },
        { name: 'Cargos', value: member ? (member.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.toString()).join(', ') || 'Nenhum') : 'N/A', inline: false }
      )
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  }
};
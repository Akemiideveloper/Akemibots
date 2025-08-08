const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'serverinfo',
  description: 'Exibe informações do servidor atual',
  async execute(message, args, client, botPrefix) {
    const guild = message.guild;
    
    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle(`Informações do ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: 'ID', value: guild.id, inline: true },
        { name: 'Dono', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Criado em', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Membros', value: `${guild.memberCount}`, inline: true },
        { name: 'Canais', value: `${guild.channels.cache.size}`, inline: true },
        { name: 'Cargos', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Nível de Verificação', value: guild.verificationLevel.toString(), inline: true },
        { name: 'Emojis', value: `${guild.emojis.cache.size}`, inline: true }
      )
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  }
};
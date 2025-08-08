const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'banlist',
  description: 'Lista todos os usuários banidos do servidor',
  async execute(message, args, client, serverPrefix) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('Você não tem permissão para ver a lista de banidos.');
    }

    try {
      const banList = await message.guild.bans.fetch();

      if (banList.size === 0) {
        const embed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle('Lista de Banidos')
          .setDescription('Não há usuários banidos neste servidor.')
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

      const bansPerPage = 10;
      const totalPages = Math.ceil(banList.size / bansPerPage);
      const page = parseInt(args[0]) || 1;

      if (page < 1 || page > totalPages) {
        return message.reply(`Página inválida. Use um número entre 1 e ${totalPages}.`);
      }

      const startIndex = (page - 1) * bansPerPage;
      const endIndex = startIndex + bansPerPage;

      const bansArray = Array.from(banList.values()).slice(startIndex, endIndex);

      let banListText = '';
      bansArray.forEach((ban, index) => {
        const user = ban.user;
        const reason = ban.reason || 'Não informado';
        const number = startIndex + index + 1;
        
        banListText += `**${number}.** ${user.tag} (${user.id})\n`;
        banListText += `   Motivo: ${reason}\n\n`;
      });

      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Lista de Usuários Banidos')
        .setDescription(banListText)
        .addFields(
          { name: 'Página', value: `${page} de ${totalPages}`, inline: true },
          { name: 'Total de Banidos', value: banList.size.toString(), inline: true }
        )
        .setFooter({ text: `Use ${serverPrefix}banlist <página> para navegar` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Erro ao buscar lista de banidos:', error);
      return message.reply('Erro ao buscar a lista de usuários banidos.');
    }
  }
};
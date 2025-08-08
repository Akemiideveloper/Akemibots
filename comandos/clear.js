const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'clear',
  description: 'Remove mensagens do canal atual',
  async execute(message, args, client, botPrefix) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply('Você não tem permissão para gerenciar mensagens.');
    }
    
    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100) {
      return message.reply(`Use: \`${botPrefix}clear <quantidade>\` (1-100)`);
    }
    
    try {
      const deleted = await message.channel.bulkDelete(amount + 1, true);
      
      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Mensagens Limpas')
        .setDescription(`${deleted.size - 1} mensagens foram deletadas.`)
        .setTimestamp();
      
      const reply = await message.channel.send({ embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    } catch (error) {
      console.error(error);
      message.reply('Erro ao deletar mensagens.');
    }
  }
};
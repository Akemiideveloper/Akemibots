const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ping',
  description: 'Exibe a latência do bot e tempo de atividade',
  async execute(message, args, client) {
    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle('Pong!')
      .addFields(
        { name: 'Latência da API', value: `${Math.round(client.ws.ping)}ms`, inline: true },
        { name: 'Uptime', value: formatUptime(client.uptime), inline: true }
      )
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  }
};

// Função para formatar uptime
function formatUptime(uptime) {
  const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
  const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((uptime % (60 * 1000)) / 1000);
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
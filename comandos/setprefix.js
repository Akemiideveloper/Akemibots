const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'setprefix',
  description: 'Altera o prefixo dos comandos para este servidor',
  async execute(message, args, client, serverPrefix, setServerPrefix) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Você precisa ter permissão de Administrador para usar este comando.');
    }
    
    if (!args[0]) {
      return message.reply(`Use: \`${serverPrefix}setprefix <novo_prefixo>\``);
    }
    
    if (args[0].length > 5) {
      return message.reply('O prefixo não pode ter mais que 5 caracteres.');
    }
    
    const oldPrefix = serverPrefix;
    const newPrefix = args[0];
    
    setServerPrefix(message.guild.id, newPrefix);
    
    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle('Prefixo Alterado')
      .setDescription(`Prefixo alterado apenas para este servidor: **${message.guild.name}**`)
      .addFields(
        { name: 'Prefixo Anterior', value: `\`${oldPrefix}\``, inline: true },
        { name: 'Novo Prefixo', value: `\`${newPrefix}\``, inline: true }
      )
      .setFooter({ text: 'Cada servidor pode ter seu próprio prefixo!' })
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  }
};
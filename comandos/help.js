const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'help',
  description: 'Lista todos os comandos disponíveis',
  async execute(message, args, client, serverPrefix) {
    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle('Comandos de Segurança')
      .setDescription(`Prefixo neste servidor: \`${serverPrefix}\``)
      .addFields(
        { 
          name: 'Utilidades', 
          value: `\`${serverPrefix}ping\` - Exibe a latência do bot e tempo de atividade\n\`${serverPrefix}setprefix <novo>\` - Altera o prefixo dos comandos (só para este servidor)\n\`${serverPrefix}userinfo <@usuario>\` - Mostra informações detalhadas de um usuário\n\`${serverPrefix}serverinfo\` - Exibe informações do servidor atual`, 
          inline: false 
        },
        { 
          name: 'Moderação', 
          value: `\`${serverPrefix}kick <@usuario> [motivo]\` - Remove um usuário do servidor\n\`${serverPrefix}ban <@usuario> [motivo]\` - Bane permanentemente um usuário\n\`${serverPrefix}unban <@usuario> [motivo]\` - Remove banimento de usuário\n\`${serverPrefix}mute <@usuario> <tempo> [motivo]\` - Silencia com unmute automático\n\`${serverPrefix}unmute <@usuario> [motivo]\` - Remove mute manualmente\n\`${serverPrefix}mutes\` - Lista mutes ativos\n\`${serverPrefix}blacklist\` - Gerencia blacklist anti-desban\n\`${serverPrefix}warn <@usuario> <motivo>\` - Envia uma advertência\n\`${serverPrefix}clear <quantidade>\` - Remove mensagens do canal`, 
          inline: false 
        },
        { 
          name: 'Sistemas Sociais', 
          value: `\`${serverPrefix}pd\` - Sistema de primeira dama\n\`${serverPrefix}panela\` - Sistema de panela`, 
          inline: false 
        },
        { 
          name: 'Configuração (Admin)', 
          value: `\`${serverPrefix}config-logs\` - Configurar canais de logs\n\`${serverPrefix}config-pd\` - Configurar sistema de primeira dama\n\`${serverPrefix}config-panela\` - Configurar sistema de panela\n\`${serverPrefix}ver-config\` - Ver todas as configurações`, 
          inline: false 
        }
      )
      .setFooter({ text: 'Bot de Segurança Discord | Cada servidor tem seu próprio prefixo', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  }
};
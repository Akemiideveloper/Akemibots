const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, UserSelectMenuBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const MuteManager = require('../database/models/MuteManager');
const ModerationLog = require('../database/models/ModerationLog');

module.exports = {
  name: 'mute',
  description: 'Silencia um usuário temporariamente com unmute automático',
  async execute(message, args, client, botPrefix, setServerPrefix, getServerConfig, setLogChannel, ModerationLog) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('Você não tem permissão para mutar membros.');
    }
    
    const user = message.mentions.users.first();
    
    // Se um usuário foi mencionado, usar o método tradicional
    if (user) {
      const timeInput = args[1];
      if (!timeInput) {
        return message.reply(`❌ **Especifique o tempo:** \`${botPrefix}mute @usuário 30m motivo\``);
      }
      
      const duration = parseTime(timeInput);
      if (!duration || duration < 1000) {
        return message.reply('❌ Tempo inválido. Use: `30s`, `15m`, `2h`, `1d` ou apenas números para minutos.');
      }
      
      const reason = args.slice(2).join(' ') || 'Não informado';
      return await this.muteUser(message, user, duration, reason);
    }
    
    // Se não há menção, mostrar menu de seleção
    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle('Sistema de Mute')
      .setDescription('Selecione um usuário para mutar e escolha a duração e motivo')
      .addFields({ 
        name: 'Instruções', 
        value: '1. Selecione o usuário no menu abaixo\n2. Escolha a duração do mute\n3. Selecione o motivo', 
        inline: false 
      })
      .setFooter({ text: 'Moderação | Sistema de Menus Interativos' })
      .setTimestamp();

    // Menu de seleção de usuário
    const userSelectMenu = new UserSelectMenuBuilder()
      .setCustomId(`mute_user_${message.author.id}`)
      .setPlaceholder('Selecione um usuário para mutar')
      .setMinValues(1)
      .setMaxValues(1);

    // Menu de seleção de duração
    const durationSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`mute_duration_${message.author.id}`)
      .setPlaceholder('Selecione a duração do mute')
      .addOptions([
        {
          label: '5 minutos',
          value: '5m',
          description: 'Mute por 5 minutos'
        },
        {
          label: '15 minutos',
          value: '15m',
          description: 'Mute por 15 minutos'
        },
        {
          label: '30 minutos',
          value: '30m',
          description: 'Mute por 30 minutos'
        },
        {
          label: '1 hora',
          value: '1h',
          description: 'Mute por 1 hora'
        },
        {
          label: '2 horas',
          value: '2h',
          description: 'Mute por 2 horas'
        },
        {
          label: '6 horas',
          value: '6h',
          description: 'Mute por 6 horas'
        },
        {
          label: '12 horas',
          value: '12h',
          description: 'Mute por 12 horas'
        },
        {
          label: '1 dia',
          value: '1d',
          description: 'Mute por 1 dia'
        },
        {
          label: 'Duração Personalizada',
          value: 'custom',
          description: 'Especificar duração manualmente'
        }
      ]);

    // Menu de seleção de motivo
    const reasonSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`mute_reason_${message.author.id}`)
      .setPlaceholder('Selecione o motivo do mute')
      .addOptions([
        {
          label: 'Spam/Flood',
          value: 'spam',
          description: 'Envio excessivo de mensagens'
        },
        {
          label: 'Comportamento Tóxico',
          value: 'toxic',
          description: 'Comportamento inadequado ou ofensivo'
        },
        {
          label: 'Linguagem Inapropriada',
          value: 'language',
          description: 'Uso de linguagem inadequada'
        },
        {
          label: 'Quebra de Regras',
          value: 'rules',
          description: 'Violação das regras do servidor'
        },
        {
          label: 'Discussão/Provocação',
          value: 'argument',
          description: 'Iniciando discussões desnecessárias'
        },
        {
          label: 'Off-topic',
          value: 'offtopic',
          description: 'Mensagens fora do tópico do canal'
        },
        {
          label: 'Motivo Personalizado',
          value: 'custom',
          description: 'Especificar motivo manualmente'
        }
      ]);

    const userRow = new ActionRowBuilder().addComponents(userSelectMenu);
    const durationRow = new ActionRowBuilder().addComponents(durationSelectMenu);
    const reasonRow = new ActionRowBuilder().addComponents(reasonSelectMenu);

    const response = await message.reply({ 
      embeds: [embed], 
      components: [userRow, durationRow, reasonRow]
    });

    // Configurar coletores para os menus
    this.setupCollectors(response, message, client, getServerConfig);
  },

  async muteUser(message, user, duration, reason) {
    const member = message.guild.members.cache.get(user.id);
    if (!member) {
      return message.reply('❌ Usuário não encontrado no servidor.');
    }

    // Verificar se o usuário já está mutado
    if (member.communicationDisabledUntil && member.communicationDisabledUntil > new Date()) {
      return message.reply('⚠️ Este usuário já está mutado.');
    }

    // Verificar hierarquia
    if (member.roles.highest.position >= message.member.roles.highest.position) {
      return message.reply('❌ Você não pode mutar este usuário (hierarquia de cargos).');
    }

    if (!member.moderatable) {
      return message.reply('❌ Não posso mutar este usuário (verifique minhas permissões).');
    }

    // Máximo de 28 dias (limite do Discord)
    const maxDuration = 28 * 24 * 60 * 60 * 1000; // 28 dias em ms
    if (duration > maxDuration) {
      return message.reply('❌ Duração máxima é de 28 dias.');
    }
    
    try {
      // Aplicar timeout no Discord
      await member.timeout(duration, `[${message.author.tag}] ${reason}`);
      
      // Registrar no sistema de containers
      const muteRecord = await MuteManager.createMute(
        message.guild.id,
        user.id,
        message.author.id,
        duration,
        reason
      );

      // Criar log de moderação
      await ModerationLog.createLog(
        message.guild.id,
        user.id,
        message.author.id,
        'mute',
        reason,
        { 
          duration: duration,
          expiresAt: new Date(Date.now() + duration).toISOString(),
          muteId: muteRecord?.id
        }
      );

      const durationText = formatDuration(duration);
      const expiresAt = new Date(Date.now() + duration);
      
      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Usuário Mutado')
        .setDescription('O usuário foi silenciado temporariamente. O unmute será automático quando o tempo expirar.')
        .addFields(
          { name: 'Usuário', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Duração', value: durationText, inline: true },
          { name: 'Moderador', value: `${message.author.tag}`, inline: true },
          { name: 'Motivo', value: reason, inline: false },
          { name: 'Expira em', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`, inline: false },
          { name: 'Sistema', value: 'Container com unmute automático ativo', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `ID do Mute: ${muteRecord?.id || 'N/A'}` });
      
      await message.reply({ embeds: [embed] });
      
      // Enviar log para canal configurado
      await this.sendMuteLog(message.guild, user, message.author, reason, durationText, expiresAt, getServerConfig);
      
      console.log(`Mute aplicado: ${user.tag} no servidor ${message.guild.name} por ${durationText}`);
      
    } catch (error) {
      console.error('Erro ao mutar usuário:', error);
      
      let errorMessage = 'Erro ao mutar o usuário.';
      if (error.code === 50013) {
        errorMessage = 'Erro: Não tenho permissão para mutar este usuário.';
      } else if (error.code === 50035) {
        errorMessage = 'Erro: Duração de mute inválida.';
      }
      
      message.reply(`❌ ${errorMessage}`);
    }
  },

  setupCollectors(response, originalMessage, client, getServerConfig) {
    let selectedUser = null;
    let selectedDuration = null;
    let selectedReason = null;

    // Coletor para seleção de usuário
    const userCollector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.customId.startsWith('mute_user_') && interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    // Coletor para seleção de duração
    const durationCollector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.customId.startsWith('mute_duration_') && interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    // Coletor para seleção de motivo
    const reasonCollector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.customId.startsWith('mute_reason_') && interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    userCollector.on('collect', async (interaction) => {
      selectedUser = interaction.values[0];
      const user = await client.users.fetch(selectedUser);
      
      const embed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('Usuario Selecionado')
        .setDescription(`**${user.tag}** foi selecionado para mute.`)
        .addFields({ 
          name: 'Próximo Passo', 
          value: 'Agora selecione a duração e o motivo do mute nos menus abaixo.', 
          inline: false 
        })
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await interaction.update({ embeds: [embed] });
      this.checkAndExecuteMute(originalMessage, selectedUser, selectedDuration, selectedReason, response, client, getServerConfig);
    });

    durationCollector.on('collect', async (interaction) => {
      selectedDuration = interaction.values[0];
      
      // Se for duração personalizada, abrir modal
      if (selectedDuration === 'custom') {
        const modal = new ModalBuilder()
          .setCustomId(`mute_custom_duration_${originalMessage.author.id}`)
          .setTitle('Duração Personalizada do Mute');

        const durationInput = new TextInputBuilder()
          .setCustomId('custom_duration_input')
          .setLabel('Digite a duração do mute:')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 30m, 2h, 1d, 3h30m')
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(10);

        const actionRow = new ActionRowBuilder().addComponents(durationInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
        
        client.on('interactionCreate', async (modalInteraction) => {
          if (!modalInteraction.isModalSubmit()) return;
          if (!modalInteraction.customId.startsWith('mute_custom_duration_')) return;
          if (modalInteraction.user.id !== originalMessage.author.id) return;

          const customDuration = modalInteraction.fields.getTextInputValue('custom_duration_input');
          selectedDuration = `custom:${customDuration}`;

          const embed = new EmbedBuilder()
            .setColor('#ffa500')
            .setTitle('Duração Personalizada Definida')
            .setDescription(`**Duração personalizada** foi definida.`)
            .addFields(
              { name: 'Duração', value: `"${customDuration}"`, inline: false },
              { 
                name: 'Status', 
                value: (selectedUser && selectedReason) ? 'Usuário, duração e motivo definidos!\nExecutando mute...' : 'Aguardando seleção completa...', 
                inline: false 
              }
            )
            .setTimestamp();

          await modalInteraction.update({ embeds: [embed] });
          this.checkAndExecuteMute(originalMessage, selectedUser, selectedDuration, selectedReason, response, client, getServerConfig);
        });

        return;
      }

      const durationText = this.getDurationText(selectedDuration);

      const embed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('Duração Selecionada')
        .setDescription(`**${durationText}** foi selecionada como duração.`)
        .addFields({ 
          name: 'Status', 
          value: (selectedUser && selectedReason) ? 'Usuário, duração e motivo selecionados!\nExecutando mute...' : 'Aguardando seleção completa...', 
          inline: false 
        })
        .setTimestamp();

      await interaction.update({ embeds: [embed] });
      this.checkAndExecuteMute(originalMessage, selectedUser, selectedDuration, selectedReason, response, client, getServerConfig);
    });

    reasonCollector.on('collect', async (interaction) => {
      selectedReason = interaction.values[0];
      
      // Se for motivo personalizado, abrir modal
      if (selectedReason === 'custom') {
        const modal = new ModalBuilder()
          .setCustomId(`mute_custom_reason_${originalMessage.author.id}`)
          .setTitle('Motivo Personalizado do Mute');

        const reasonInput = new TextInputBuilder()
          .setCustomId('custom_reason_input')
          .setLabel('Digite o motivo do mute:')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: Comportamento inadequado repetitivo...')
          .setRequired(true)
          .setMinLength(5)
          .setMaxLength(500);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
        
        client.on('interactionCreate', async (modalInteraction) => {
          if (!modalInteraction.isModalSubmit()) return;
          if (!modalInteraction.customId.startsWith('mute_custom_reason_')) return;
          if (modalInteraction.user.id !== originalMessage.author.id) return;

          const customReason = modalInteraction.fields.getTextInputValue('custom_reason_input');
          selectedReason = `custom:${customReason}`;

          const embed = new EmbedBuilder()
            .setColor('#ffa500')
            .setTitle('Motivo Personalizado Definido')
            .setDescription(`**Motivo personalizado** foi definido.`)
        .addFields(
              { name: 'Motivo', value: `"${customReason}"`, inline: false },
              { 
                name: 'Status', 
                value: (selectedUser && selectedDuration) ? 'Usuário, duração e motivo definidos!\nExecutando mute...' : 'Aguardando seleção completa...', 
                inline: false 
              }
        )
        .setTimestamp();
      
          await modalInteraction.update({ embeds: [embed] });
          this.checkAndExecuteMute(originalMessage, selectedUser, selectedDuration, selectedReason, response, client, getServerConfig);
        });

        return;
      }

      const reasonMap = {
        'spam': 'Spam/Flood - Envio excessivo de mensagens',
        'toxic': 'Comportamento Tóxico - Comportamento inadequado ou ofensivo',
        'language': 'Linguagem Inapropriada - Uso de linguagem inadequada',
        'rules': 'Quebra de Regras - Violação das regras do servidor',
        'argument': 'Discussão/Provocação - Iniciando discussões desnecessárias',
        'offtopic': 'Off-topic - Mensagens fora do tópico do canal'
      };
      
      const reasonText = reasonMap[selectedReason];

      const embed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('Motivo Selecionado')
        .setDescription(`**${reasonText}** foi selecionado como motivo.`)
        .addFields({ 
          name: 'Status', 
          value: (selectedUser && selectedDuration) ? 'Usuário, duração e motivo selecionados!\nExecutando mute...' : 'Aguardando seleção completa...', 
          inline: false 
        })
        .setTimestamp();

      await interaction.update({ embeds: [embed] });
      this.checkAndExecuteMute(originalMessage, selectedUser, selectedDuration, selectedReason, response, client, getServerConfig);
    });

    // Timeout dos coletores
    userCollector.on('end', () => console.log('Coletor de usuário finalizado'));
    durationCollector.on('end', () => console.log('Coletor de duração finalizado'));
    reasonCollector.on('end', () => console.log('Coletor de motivo finalizado'));
  },

  getDurationText(durationValue) {
    const durationMap = {
      '5m': '5 minutos',
      '15m': '15 minutos',
      '30m': '30 minutos',
      '1h': '1 hora',
      '2h': '2 horas',
      '6h': '6 horas',
      '12h': '12 horas',
      '1d': '1 dia'
    };
    return durationMap[durationValue] || durationValue;
  },

  async checkAndExecuteMute(originalMessage, userId, durationValue, reasonValue, response, client, getServerConfig) {
    if (userId && durationValue && reasonValue) {
      try {
        const user = await client.users.fetch(userId);
        const member = originalMessage.guild.members.cache.get(userId);
        
        if (!member) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Erro no Mute')
            .setDescription(`**${user.tag}** não está no servidor`)
            .setTimestamp();
          
          return response.edit({ embeds: [errorEmbed], components: [] });
        }

        if (member.communicationDisabledUntil && member.communicationDisabledUntil > new Date()) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Erro no Mute')
            .setDescription(`**${user.tag}** já está mutado`)
            .setTimestamp();
          
          return response.edit({ embeds: [errorEmbed], components: [] });
        }

        if (member.roles.highest.position >= originalMessage.member.roles.highest.position) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Erro no Mute')
            .setDescription(`Não posso mutar **${user.tag}** (hierarquia de cargos)`)
            .setTimestamp();
          
          return response.edit({ embeds: [errorEmbed], components: [] });
        }

        if (!member.moderatable) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Erro no Mute')
            .setDescription(`Não posso mutar **${user.tag}** (verifique minhas permissões)`)
            .setTimestamp();
          
          return response.edit({ embeds: [errorEmbed], components: [] });
        }

        let duration;
        let reasonText;
        
        // Processar duração
        if (durationValue.startsWith('custom:')) {
          const customDuration = durationValue.substring(7);
          duration = parseTime(customDuration);
          if (!duration || duration < 1000) {
            const errorEmbed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('Erro no Mute')
              .setDescription(`Duração inválida: "${customDuration}"`)
              .setTimestamp();
            
            return response.edit({ embeds: [errorEmbed], components: [] });
          }
        } else {
          duration = parseTime(durationValue);
        }

        // Verificar duração máxima
        const maxDuration = 28 * 24 * 60 * 60 * 1000;
        if (duration > maxDuration) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Erro no Mute')
            .setDescription('Duração máxima é de 28 dias')
            .setTimestamp();
          
          return response.edit({ embeds: [errorEmbed], components: [] });
        }
        
        // Processar motivo
        if (reasonValue.startsWith('custom:')) {
          reasonText = reasonValue.substring(7);
        } else {
          const reasonMap = {
            'spam': 'Spam/Flood - Envio excessivo de mensagens',
            'toxic': 'Comportamento Tóxico - Comportamento inadequado ou ofensivo',
            'language': 'Linguagem Inapropriada - Uso de linguagem inadequada',
            'rules': 'Quebra de Regras - Violação das regras do servidor',
            'argument': 'Discussão/Provocação - Iniciando discussões desnecessárias',
            'offtopic': 'Off-topic - Mensagens fora do tópico do canal'
          };
          reasonText = reasonMap[reasonValue];
        }
        
        // Aplicar timeout no Discord
        await member.timeout(duration, `[${originalMessage.author.tag}] ${reasonText}`);
        
        // Registrar no sistema de containers
        const muteRecord = await MuteManager.createMute(
          originalMessage.guild.id,
          user.id,
          originalMessage.author.id,
          duration,
          reasonText
        );

        // Criar log de moderação
        await ModerationLog.createLog(
          originalMessage.guild.id,
          user.id,
          originalMessage.author.id,
          'mute',
          reasonText,
          { 
            duration: duration,
            expiresAt: new Date(Date.now() + duration).toISOString(),
            muteId: muteRecord?.id,
            method: 'interactive'
          }
        );

        const durationText = formatDuration(duration);
        const expiresAt = new Date(Date.now() + duration);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle('Mute Executado')
          .setDescription('O usuário foi mutado com sucesso. O unmute será automático quando o tempo expirar.')
          .addFields(
            { name: 'Usuário Mutado', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Duração', value: durationText, inline: true },
            { name: 'Moderador', value: `${originalMessage.author.tag}`, inline: true },
            { name: 'Motivo', value: reasonText, inline: false },
            { name: 'Expira em', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`, inline: false },
            { name: 'Sistema', value: 'Container com unmute automático ativo', inline: false }
          )
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: `Sistema de Mute | ID: ${muteRecord?.id || 'N/A'}` })
          .setTimestamp();
        
        await response.edit({ embeds: [successEmbed], components: [] });
        
        // Enviar log para canal configurado
        await this.sendMuteLog(originalMessage.guild, user, originalMessage.author, reasonText, durationText, expiresAt, getServerConfig);
        
        console.log(`Mute interativo aplicado: ${user.tag} no servidor ${originalMessage.guild.name} por ${durationText}`);
        
    } catch (error) {
        console.error('Erro no mute interativo:', error);
        
        const errorEmbed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Erro no Mute')
          .setDescription('Ocorreu um erro ao tentar mutar o usuário.')
          .setTimestamp();
        
        await response.edit({ embeds: [errorEmbed], components: [] });
      }
    }
  },

  async sendMuteLog(guild, mutedUser, moderator, reason, duration, expiresAt, getServerConfig) {
    try {
      const config = await getServerConfig(guild.id);
      // Usar canal específico de mute primeiro, depois moderation como fallback
      const muteLogChannelId = config.logChannels.mute || config.logChannels.moderation;

      if (!muteLogChannelId) {
        return; // Nenhum canal configurado
      }

      const logChannel = guild.channels.cache.get(muteLogChannelId);
      if (!logChannel) {
        console.log(`Canal de log não encontrado: ${muteLogChannelId}`);
        return;
      }

      const logEmbed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Log de Mute')
        .setDescription('Um usuário foi mutado no servidor')
        .addFields(
          { name: 'Usuário Mutado', value: `${mutedUser.tag}\n${mutedUser.id}`, inline: true },
          { name: 'Moderador', value: `${moderator.tag}\n${moderator.id}`, inline: true },
          { name: 'Duração', value: duration, inline: true },
          { name: 'Motivo', value: reason, inline: false },
          { name: 'Expira em', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`, inline: false },
          { name: 'Data/Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(mutedUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Logs de Moderação' })
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
      console.log(`Log de mute enviado para ${logChannel.name}`);
    } catch (error) {
      console.error('Erro ao enviar log de mute:', error);
    }
  }
};

// Função para converter tempo em texto para milissegundos
function parseTime(timeStr) {
  const timeRegex = /^(\d+)([smhd]?)$/i;
  const match = timeStr.match(timeRegex);
  
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = (match[2] || 'm').toLowerCase();
  
  const multipliers = {
    's': 1000,          // segundos
    'm': 60 * 1000,     // minutos
    'h': 60 * 60 * 1000, // horas
    'd': 24 * 60 * 60 * 1000 // dias
  };
  
  return value * (multipliers[unit] || multipliers.m);
}

// Função para formatar duração para exibição
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} dia${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
  return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
}
const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, UserSelectMenuBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const MuteManager = require('../database/models/MuteManager');
const ModerationLog = require('../database/models/ModerationLog');

module.exports = {
  name: 'unmute',
  description: 'Remove o mute de um usuário manualmente',
  async execute(message, args, client, botPrefix, setServerPrefix, getServerConfig, setLogChannel, ModerationLog) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('❌ Você não tem permissão para desmutar membros.');
    }
    
    const user = message.mentions.users.first();
    
    // Se um usuário foi mencionado, usar o método tradicional
    if (user) {
      const reason = args.slice(1).join(' ') || 'Unmute manual';
      return await this.unmuteUser(message, user, reason);
    }
    
    // Se não há menção, mostrar menu de seleção
    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle('Sistema de Unmute')
      .setDescription('Selecione um usuário para desmutar e escolha o motivo')
      .addFields({ 
        name: 'Instruções', 
        value: '1. Selecione o usuário no menu abaixo\n2. Escolha o motivo do unmute', 
        inline: false 
      })
      .setFooter({ text: 'Moderação | Sistema de Menus Interativos' })
      .setTimestamp();

    // Menu de seleção de usuário
    const userSelectMenu = new UserSelectMenuBuilder()
      .setCustomId(`unmute_user_${message.author.id}`)
      .setPlaceholder('Selecione um usuário para desmutar')
      .setMinValues(1)
      .setMaxValues(1);

    // Menu de seleção de motivo
    const reasonSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`unmute_reason_${message.author.id}`)
      .setPlaceholder('Selecione o motivo do unmute')
      .addOptions([
        {
          label: 'Comportamento Melhorado',
          value: 'improved',
          description: 'Usuário demonstrou melhora no comportamento'
        },
        {
          label: 'Tempo Suficiente',
          value: 'time',
          description: 'Tempo de punição considerado suficiente'
        },
        {
          label: 'Arrependimento',
          value: 'regret',
          description: 'Usuário demonstrou arrependimento'
        },
        {
          label: 'Mal-entendido',
          value: 'misunderstanding',
          description: 'Situação foi um mal-entendido'
        },
        {
          label: 'Revisão de Caso',
          value: 'review',
          description: 'Caso foi revisado e aprovado'
        },
        {
          label: 'Pedido de Desculpas',
          value: 'apology',
          description: 'Usuário pediu desculpas adequadamente'
        },
        {
          label: 'Motivo Personalizado',
          value: 'custom',
          description: 'Especificar motivo manualmente'
        }
      ]);

    const userRow = new ActionRowBuilder().addComponents(userSelectMenu);
    const reasonRow = new ActionRowBuilder().addComponents(reasonSelectMenu);

    const response = await message.reply({ 
      embeds: [embed], 
      components: [userRow, reasonRow]
    });

    // Configurar coletores para os menus
    this.setupCollectors(response, message, client, getServerConfig);
  },

  async unmuteUser(message, user, reason) {
    const member = message.guild.members.cache.get(user.id);
    if (!member) {
      return message.reply('❌ Usuário não encontrado no servidor.');
    }

    // Verificar se o usuário está mutado
    if (!member.communicationDisabledUntil || member.communicationDisabledUntil <= new Date()) {
      return message.reply('⚠️ Este usuário não está mutado.');
    }
    
    try {
      // Remover timeout do Discord
      await member.timeout(null, `[${message.author.tag}] ${reason}`);
      
      // Remover do sistema de containers
      const result = await MuteManager.removeMute(
        message.guild.id,
        user.id,
        message.author.id,
        reason
      );

      if (!result.success) {
        console.warn(`Unmute manual sem container ativo: ${user.tag}`);
      }

      // Criar log de moderação
      await ModerationLog.createLog(
        message.guild.id,
        user.id,
        message.author.id,
        'unmute',
        reason,
        { 
          type: 'manual',
          muteId: result.muteId || null
        }
      );

      // Enviar notificação em canais de log
      await MuteManager.sendUnmuteNotification(message.guild, member, 'manual');
      
      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Usuário Desmutado')
        .setDescription('O usuário foi desmutado manualmente. O timer automático foi cancelado.')
        .addFields(
          { name: 'Usuário', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderador', value: `${message.author.tag}`, inline: true },
          { name: 'Motivo', value: reason, inline: false },
          { name: 'Sistema', value: result.success ? 'Container cancelado' : 'Unmute direto (sem container)', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: result.muteId ? `ID do Mute: ${result.muteId}` : 'Unmute manual' });
      
      await message.reply({ embeds: [embed] });
      
      // Enviar log para canal configurado
      await this.sendUnmuteLog(message.guild, user, message.author, reason, getServerConfig);
      
      console.log(`Unmute manual: ${user.tag} no servidor ${message.guild.name} por ${message.author.tag}`);
      
    } catch (error) {
      console.error('Erro ao desmutar usuário:', error);
      
      let errorMessage = 'Erro ao desmutar o usuário.';
      if (error.code === 50013) {
        errorMessage = 'Erro: Não tenho permissão para desmutar este usuário.';
      }
      
      message.reply(`❌ ${errorMessage}`);
    }
  },

  setupCollectors(response, originalMessage, client, getServerConfig) {
    let selectedUser = null;
    let selectedReason = null;

    // Coletor para seleção de usuário
    const userCollector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.customId.startsWith('unmute_user_') && interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    // Coletor para seleção de motivo
    const reasonCollector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.customId.startsWith('unmute_reason_') && interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    userCollector.on('collect', async (interaction) => {
      selectedUser = interaction.values[0];
      const user = await client.users.fetch(selectedUser);
      
      const embed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('Usuario Selecionado')
        .setDescription(`**${user.tag}** foi selecionado para unmute.`)
        .addFields({ 
          name: 'Próximo Passo', 
          value: 'Agora selecione o motivo do unmute no menu abaixo.', 
          inline: false 
        })
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await interaction.update({ embeds: [embed] });
      this.checkAndExecuteUnmute(originalMessage, selectedUser, selectedReason, response, client, getServerConfig);
    });

    reasonCollector.on('collect', async (interaction) => {
      selectedReason = interaction.values[0];
      
      // Se for motivo personalizado, abrir modal
      if (selectedReason === 'custom') {
        const modal = new ModalBuilder()
          .setCustomId(`unmute_custom_reason_${originalMessage.author.id}`)
          .setTitle('Motivo Personalizado do Unmute');

        const reasonInput = new TextInputBuilder()
          .setCustomId('custom_reason_input')
          .setLabel('Digite o motivo do unmute:')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: Usuário demonstrou arrependimento e melhora...')
          .setRequired(true)
          .setMinLength(5)
          .setMaxLength(500);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
        
        client.on('interactionCreate', async (modalInteraction) => {
          if (!modalInteraction.isModalSubmit()) return;
          if (!modalInteraction.customId.startsWith('unmute_custom_reason_')) return;
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
                value: selectedUser ? 'Usuário e motivo definidos!\nExecutando unmute...' : 'Aguardando seleção do usuário...', 
                inline: false 
              }
            )
            .setTimestamp();

          await modalInteraction.update({ embeds: [embed] });
          this.checkAndExecuteUnmute(originalMessage, selectedUser, selectedReason, response, client, getServerConfig);
        });

        return;
      }

      const reasonMap = {
        'improved': 'Comportamento Melhorado - Usuário demonstrou melhora',
        'time': 'Tempo Suficiente - Tempo de punição considerado adequado',
        'regret': 'Arrependimento - Usuário demonstrou arrependimento',
        'misunderstanding': 'Mal-entendido - Situação foi esclarecida',
        'review': 'Revisão de Caso - Caso foi revisado e aprovado',
        'apology': 'Pedido de Desculpas - Usuário pediu desculpas adequadamente'
      };
      
      const reasonText = reasonMap[selectedReason];

      const embed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('Motivo Selecionado')
        .setDescription(`**${reasonText}** foi selecionado como motivo.`)
        .addFields({ 
          name: 'Status', 
          value: selectedUser ? 'Usuário e motivo selecionados!\nExecutando unmute...' : 'Aguardando seleção do usuário...', 
          inline: false 
        })
        .setTimestamp();

      await interaction.update({ embeds: [embed] });
      this.checkAndExecuteUnmute(originalMessage, selectedUser, selectedReason, response, client, getServerConfig);
    });

    // Timeout dos coletores
    userCollector.on('end', () => console.log('Coletor de usuário finalizado'));
    reasonCollector.on('end', () => console.log('Coletor de motivo finalizado'));
  },

  async checkAndExecuteUnmute(originalMessage, userId, reasonValue, response, client, getServerConfig) {
    if (userId && reasonValue) {
      try {
        const user = await client.users.fetch(userId);
        const member = originalMessage.guild.members.cache.get(userId);
        
        if (!member) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Erro no Unmute')
            .setDescription(`**${user.tag}** não está no servidor`)
            .setTimestamp();
          
          return response.edit({ embeds: [errorEmbed], components: [] });
        }

        if (!member.communicationDisabledUntil || member.communicationDisabledUntil <= new Date()) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Erro no Unmute')
            .setDescription(`**${user.tag}** não está mutado`)
            .setTimestamp();
          
          return response.edit({ embeds: [errorEmbed], components: [] });
        }

        let reasonText;
        
        // Processar motivo
        if (reasonValue.startsWith('custom:')) {
          reasonText = reasonValue.substring(7);
        } else {
          const reasonMap = {
            'improved': 'Comportamento Melhorado - Usuário demonstrou melhora',
            'time': 'Tempo Suficiente - Tempo de punição considerado adequado',
            'regret': 'Arrependimento - Usuário demonstrou arrependimento',
            'misunderstanding': 'Mal-entendido - Situação foi esclarecida',
            'review': 'Revisão de Caso - Caso foi revisado e aprovado',
            'apology': 'Pedido de Desculpas - Usuário pediu desculpas adequadamente'
          };
          reasonText = reasonMap[reasonValue];
        }
        
        // Remover timeout do Discord
        await member.timeout(null, `[${originalMessage.author.tag}] ${reasonText}`);
        
        // Remover do sistema de containers
        const result = await MuteManager.removeMute(
          originalMessage.guild.id,
          user.id,
          originalMessage.author.id,
          reasonText
        );

        // Criar log de moderação
        await ModerationLog.createLog(
          originalMessage.guild.id,
          user.id,
          originalMessage.author.id,
          'unmute',
          reasonText,
          { 
            type: 'manual',
            method: 'interactive',
            muteId: result.muteId || null
          }
        );

        // Enviar notificação em canais de log
        await MuteManager.sendUnmuteNotification(originalMessage.guild, member, 'manual');
        
        const successEmbed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle('Unmute Executado')
          .setDescription('O usuário foi desmutado com sucesso. O timer automático foi cancelado.')
          .addFields(
            { name: 'Usuário Desmutado', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderador', value: `${originalMessage.author.tag}`, inline: true },
            { name: 'Motivo', value: reasonText, inline: false },
            { name: 'Sistema', value: result.success ? 'Container cancelado com sucesso' : 'Unmute direto (sem container ativo)', inline: false }
          )
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: `Sistema de Unmute | ID: ${result.muteId || 'N/A'}` })
          .setTimestamp();
        
        await response.edit({ embeds: [successEmbed], components: [] });
        
        // Enviar log para canal configurado
        await this.sendUnmuteLog(originalMessage.guild, user, originalMessage.author, reasonText, getServerConfig);
        
        console.log(`Unmute interativo aplicado: ${user.tag} no servidor ${originalMessage.guild.name}`);
        
      } catch (error) {
        console.error('Erro no unmute interativo:', error);
        
        const errorEmbed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Erro no Unmute')
          .setDescription('Ocorreu um erro ao tentar desmutar o usuário.')
          .setTimestamp();
        
        await response.edit({ embeds: [errorEmbed], components: [] });
      }
    }
  },

  async sendUnmuteLog(guild, unmutedUser, moderator, reason, getServerConfig) {
    try {
      const config = await getServerConfig(guild.id);
      // Usar canal específico de unmute primeiro, depois moderation como fallback
      const unmuteLogChannelId = config.logChannels.unmute || config.logChannels.moderation;

      if (!unmuteLogChannelId) {
        return; // Nenhum canal configurado
      }

      const logChannel = guild.channels.cache.get(unmuteLogChannelId);
      if (!logChannel) {
        console.log(`Canal de log não encontrado: ${unmuteLogChannelId}`);
        return;
      }

      const logEmbed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Log de Unmute')
        .setDescription('Um usuário foi desmutado no servidor')
        .addFields(
          { name: 'Usuário Desmutado', value: `${unmutedUser.tag}\n${unmutedUser.id}`, inline: true },
          { name: 'Moderador', value: `${moderator.tag}\n${moderator.id}`, inline: true },
          { name: 'Motivo', value: reason, inline: false },
          { name: 'Data/Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(unmutedUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Logs de Moderação' })
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
      console.log(`Log de unmute enviado para ${logChannel.name}`);
    } catch (error) {
      console.error('Erro ao enviar log de unmute:', error);
    }
  }
};
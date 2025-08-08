const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, UserSelectMenuBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
  name: 'ban',
  description: 'Bane permanentemente um usuário',
  async execute(message, args, client, serverPrefix, setServerPrefix, getServerConfig, setLogChannel, ModerationLog) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('Você não tem permissão para banir membros.');
    }

    const user = message.mentions.users.first();

    // Se um usuário foi mencionado, usar o método tradicional
    if (user) {
      return await this.banUser(message, user, args.slice(1).join(' ') || 'Não informado');
    }

    // Se não há menção, mostrar menu de seleção
    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle('Sistema de Banimento')
      .setDescription('Selecione um usuário para banir e escolha o motivo')
      .addFields({
        name: 'Instruções',
        value: '1. Selecione o usuário no menu abaixo\n2. Escolha o motivo do banimento',
        inline: false
      })
      .setFooter({ text: 'Moderação | Sistema de Menus Interativos' })
      .setTimestamp();

    // Menu de seleção de usuário
    const userSelectMenu = new UserSelectMenuBuilder()
      .setCustomId(`ban_user_${message.author.id}`)
      .setPlaceholder('Selecione um usuário para banir')
      .setMinValues(1)
      .setMaxValues(1);

    // Menu de seleção de motivo
    const reasonSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`ban_reason_${message.author.id}`)
      .setPlaceholder('Selecione o motivo do banimento')
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
          label: 'Quebra de Regras',
          value: 'rules',
          description: 'Violação das regras do servidor'
        },
        {
          label: 'Conteúdo Inapropriado',
          value: 'content',
          description: 'Compartilhamento de conteúdo inadequado'
        },
        {
          label: 'Raid/Ataque',
          value: 'raid',
          description: 'Tentativa de raid ou ataque ao servidor'
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
    this.setupCollectors(response, message, client);
  },

  async banUser(message, user, reason) {
    const member = message.guild.members.cache.get(user.id);

    if (member && !member.bannable) {
      return message.reply('Não posso banir este usuário.');
    }

    try {
      // Enviar DM antes do banimento usando container moderno
      try {
        const dmContainer = this.createBanNotificationContainer(message, user, reason);
        await user.send(dmContainer);
        console.log(`DM de banimento enviada para ${user.tag}`);
      } catch (dmError) {
        console.log(`Não foi possível enviar DM para ${user.tag}: ${dmError.message}`);
      }

      await message.guild.members.ban(user, { reason });

      const embed = this.createBanSuccessContainer(message, user, reason);

      // Enviar log para canal configurado
      await this.sendBanLog(message.guild, user, message.author, reason, getServerConfig);

      // Salvar no banco de dados
      await ModerationLog.createLog(
        message.guild.id,
        user.id,
        message.author.id,
        'ban',
        reason,
        { method: 'traditional' }
      );

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return message.reply('Erro ao banir o usuário.');
    }
  },

  // Método para criar container de notificação de banimento
  createBanNotificationContainer(message, user, reason) {
    const currentTime = Math.floor(Date.now() / 1000);

    const containerEmbed = new EmbedBuilder()
      .setColor('#ff4444')
      .setTitle('🚫 Notificação de Banimento')
      .setDescription('Você foi banido permanentemente do servidor')
      .addFields(
        {
          name: '📋 Informações do Servidor',
          value: `**Nome:** ${message.guild.name}\n**ID:** ${message.guild.id}`,
          inline: false
        },
        {
          name: '👤 Moderador Responsável',
          value: `**Nome:** ${message.author.tag}\n**ID:** ${message.author.id}`,
          inline: true
        },
        {
          name: '📅 Data e Hora',
          value: `<t:${currentTime}:F>\n<t:${currentTime}:R>`,
          inline: true
        },
        {
          name: '🔍 Motivo do Banimento',
          value: `\`\`\`${reason}\`\`\``,
          inline: false
        },
        {
          name: '⚠️ Aviso Importante',
          value: 'Este banimento é **permanente**. Para solicitar um desbanimento, entre em contato com akemi.gg.',
          inline: false
        }
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({
        text: 'Sistema de Moderação | Banimento Permanente',
        iconURL: message.guild.iconURL({ dynamic: true })
      })
      .setTimestamp();

    return { embeds: [containerEmbed] };
  },

  // Método para criar container de sucesso do banimento
  createBanSuccessContainer(message, user, reason) {
    const currentTime = Math.floor(Date.now() / 1000);

    const successEmbed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle('✅ Banimento Executado com Sucesso')
      .setDescription('O usuário foi banido permanentemente do servidor')
      .addFields(
        {
          name: '👤 Usuário Banido',
          value: `**Nome:** ${user.tag}\n**ID:** ${user.id}`,
          inline: true
        },
        {
          name: '🛡️ Moderador',
          value: `**Nome:** ${message.author.tag}\n**ID:** ${message.author.id}`,
          inline: true
        },
        {
          name: '📅 Data e Hora',
          value: `<t:${currentTime}:F>\n<t:${currentTime}:R>`,
          inline: false
        },
        {
          name: '🔍 Motivo do Banimento',
          value: `\`\`\`${reason}\`\`\``,
          inline: false
        },
        {
          name: '📋 Status da Ação',
          value: '✅ **Banimento aplicado**\n✅ **DM enviada**\n✅ **Log registrado**\n✅ **Banco atualizado**',
          inline: false
        }
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({
        text: 'Sistema de Moderação | Ação Concluída',
        iconURL: message.guild.iconURL({ dynamic: true })
      })
      .setTimestamp();

    return { embeds: [successEmbed] };
  },

  // Método para criar container de log de banimento
  createBanLogContainer(guild, bannedUser, moderator, reason) {
    const currentTime = Math.floor(Date.now() / 1000);

    const logEmbed = new EmbedBuilder()
      .setColor('#ff4444')
      .setTitle('📋 Log de Banimento')
      .setDescription('Um usuário foi banido permanentemente do servidor')
      .addFields(
        {
          name: '📋 Informações do Servidor',
          value: `**Nome:** ${guild.name}\n**ID:** ${guild.id}`,
          inline: false
        },
        {
          name: '👤 Usuário Banido',
          value: `**Nome:** ${bannedUser.tag}\n**ID:** ${bannedUser.id}`,
          inline: true
        },
        {
          name: '🛡️ Moderador Responsável',
          value: `**Nome:** ${moderator.tag}\n**ID:** ${moderator.id}`,
          inline: true
        },
        {
          name: '📅 Data e Hora',
          value: `<t:${currentTime}:F>\n<t:${currentTime}:R>`,
          inline: false
        },
        {
          name: '🔍 Motivo do Banimento',
          value: `\`\`\`${reason}\`\`\``,
          inline: false
        },
        {
          name: '📊 Tipo de Ação',
          value: '🚫 **Banimento Permanente**\n⏰ **Aplicado Imediatamente**\n📝 **Registrado no Sistema**',
          inline: false
        }
      )
      .setThumbnail(bannedUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({
        text: 'Sistema de Logs de Moderação | Registro Automático',
        iconURL: guild.iconURL({ dynamic: true })
      })
      .setTimestamp();

    return { embeds: [logEmbed] };
  },

  setupCollectors(response, originalMessage, client) {
    let selectedUser = null;
    let selectedReason = null;

    // Coletor para seleção de usuário
    const userCollector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.customId.startsWith('ban_user_') && interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    // Coletor para seleção de motivo
    const reasonCollector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.customId.startsWith('ban_reason_') && interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    userCollector.on('collect', async (interaction) => {
      selectedUser = interaction.values[0];
      const user = await client.users.fetch(selectedUser);

      const embed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('Usuario Selecionado')
        .setDescription(`**${user.tag}** foi selecionado para banimento.`)
        .addFields({
          name: 'Próximo Passo',
          value: 'Agora selecione o motivo do banimento no menu abaixo.',
          inline: false
        })
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await interaction.update({ embeds: [embed] });
      this.checkAndExecuteBan(originalMessage, selectedUser, selectedReason, response, client);
    });

    reasonCollector.on('collect', async (interaction) => {
      selectedReason = interaction.values[0];

      // Se for motivo personalizado, abrir modal
      if (selectedReason === 'custom') {
        const modal = new ModalBuilder()
          .setCustomId(`ban_custom_reason_${originalMessage.author.id}`)
          .setTitle('Motivo Personalizado do Banimento');

        const reasonInput = new TextInputBuilder()
          .setCustomId('custom_reason_input')
          .setLabel('Digite o motivo do banimento:')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: Violação grave das regras da comunidade...')
          .setRequired(true)
          .setMinLength(5)
          .setMaxLength(500);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);

        // Configurar coletor para o modal
        const modalCollector = response.createMessageComponentCollector({
          filter: (modalInteraction) => modalInteraction.customId.startsWith('ban_custom_reason_') && modalInteraction.user.id === originalMessage.author.id,
          time: 300000 // 5 minutos
        });

        client.on('interactionCreate', async (modalInteraction) => {
          if (!modalInteraction.isModalSubmit()) return;
          if (!modalInteraction.customId.startsWith('ban_custom_reason_')) return;
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
                value: selectedUser ? 'Usuario e motivo definidos!\nExecutando banimento...' : 'Aguardando seleção do usuário...',
                inline: false
              }
            )
            .setTimestamp();

          await modalInteraction.update({ embeds: [embed] });
          this.checkAndExecuteBan(originalMessage, selectedUser, selectedReason, response, client);
        });

        return;
      }

      // Motivos pré-definidos
      const reasonMap = {
        'spam': 'Spam/Flood - Envio excessivo de mensagens',
        'toxic': 'Comportamento Tóxico - Comportamento inadequado ou ofensivo',
        'rules': 'Quebra de Regras - Violação das regras do servidor',
        'content': 'Conteúdo Inapropriado - Compartilhamento de conteúdo inadequado',
        'raid': 'Raid/Ataque - Tentativa de raid ou ataque ao servidor'
      };

      const reasonText = reasonMap[selectedReason];

      const embed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('Motivo Selecionado')
        .setDescription(`**${reasonText}** foi selecionado como motivo.`)
        .addFields({
          name: 'Status',
          value: selectedUser ? 'Usuario e motivo selecionados!\nExecutando banimento...' : 'Aguardando seleção do usuário...',
          inline: false
        })
        .setTimestamp();

      await interaction.update({ embeds: [embed] });
      this.checkAndExecuteBan(originalMessage, selectedUser, selectedReason, response, client);
    });

    // Timeout dos coletores
    userCollector.on('end', () => console.log('Coletor de usuário finalizado'));
    reasonCollector.on('end', () => console.log('Coletor de motivo finalizado'));
  },

  async checkAndExecuteBan(originalMessage, userId, reason, response, client) {
    if (userId && reason) {
      try {
        const user = await client.users.fetch(userId);
        const member = originalMessage.guild.members.cache.get(userId);

        if (member && !member.bannable) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Erro no Banimento')
            .setDescription(`Não posso banir **${user.tag}** (permissões insuficientes ou cargo superior)`)
            .setTimestamp();

          return response.edit({ embeds: [errorEmbed], components: [] });
        }

        let reasonText;

        // Verificar se é motivo personalizado
        if (reason.startsWith('custom:')) {
          reasonText = reason.substring(7); // Remove 'custom:' do início
        } else {
          const reasonMap = {
            'spam': 'Spam/Flood - Envio excessivo de mensagens',
            'toxic': 'Comportamento Tóxico - Comportamento inadequado ou ofensivo',
            'rules': 'Quebra de Regras - Violação das regras do servidor',
            'content': 'Conteúdo Inapropriado - Compartilhamento de conteúdo inadequado',
            'raid': 'Raid/Ataque - Tentativa de raid ou ataque ao servidor'
          };
          reasonText = reasonMap[reason];
        }

        // Enviar DM antes do banimento usando container moderno
        try {
          const dmContainer = this.createBanNotificationContainer(originalMessage, user, reasonText);
          await user.send(dmContainer);
          console.log(`DM de banimento enviada para ${user.tag}`);
        } catch (dmError) {
          console.log(`Não foi possível enviar DM para ${user.tag}: ${dmError.message}`);
        }

        // Executar banimento
        await originalMessage.guild.members.ban(user, { reason: reasonText });

        const successEmbed = this.createBanSuccessContainer(originalMessage, user, reasonText);

        // Enviar log para canal configurado
        await this.sendBanLog(originalMessage.guild, user, originalMessage.author, reasonText, getServerConfig);

        // Salvar no banco de dados
        await ModerationLog.createLog(
          originalMessage.guild.id,
          user.id,
          originalMessage.author.id,
          'ban',
          reasonText,
          { method: 'interactive' }
        );

        await response.edit({ embeds: [successEmbed], components: [] });

      } catch (error) {
        console.error(error);

        const errorEmbed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Erro no Banimento')
          .setDescription('Ocorreu um erro ao tentar banir o usuário.')
          .setTimestamp();

        await response.edit({ embeds: [errorEmbed], components: [] });
      }
    }
  },

  async sendBanLog(guild, bannedUser, moderator, reason, getServerConfig) {
    try {
      const config = getServerConfig(guild.id);
      const banLogChannelId = config.logChannels.ban || config.logChannels.moderation;

      if (!banLogChannelId) {
        return; // Nenhum canal configurado
      }

      const logChannel = guild.channels.cache.get(banLogChannelId);
      if (!logChannel) {
        console.log(`Canal de log não encontrado: ${banLogChannelId}`);
        return;
      }

      const logEmbed = this.createBanLogContainer(guild, bannedUser, moderator, reason);

      await logChannel.send({ embeds: [logEmbed] });
      console.log(`Log de banimento enviado para ${logChannel.name}`);
    } catch (error) {
      console.error('Erro ao enviar log de banimento:', error);
    }
  }
};
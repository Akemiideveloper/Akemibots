const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Blacklist = require('../database/models/Blacklist');
const ModerationLog = require('../database/models/ModerationLog');

module.exports = {
  name: 'blacklist',
  description: 'Gerencia a blacklist de usuários que não podem ser desbanidos',
  async execute(message, args, client, serverPrefix, setServerPrefix, getServerConfig) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('Você precisa ter permissão de Banir Membros para usar este comando.');
    }

    // Se nenhum argumento, mostrar interface interativa
    if (args.length === 0) {
      return await this.showInteractiveMenu(message, getServerConfig);
    }

    // Comandos diretos (para compatibilidade)
    const action = args[0].toLowerCase();
    
    switch (action) {
      case 'add':
      case 'adicionar':
        return await this.handleDirectAdd(message, args.slice(1), getServerConfig);
      case 'remove':
      case 'remover':
        return await this.handleDirectRemove(message, args.slice(1), getServerConfig);
      case 'list':
      case 'lista':
        return await this.handleDirectList(message, getServerConfig);
      default:
        return await this.showInteractiveMenu(message, getServerConfig);
    }
  },

  async showInteractiveMenu(message, getServerConfig) {
    const embed = new EmbedBuilder()
      .setColor('#ff4444')
      .setTitle('Sistema de Blacklist')
      .setDescription('Gerencie usuários que não podem ser desbanidos automaticamente')
      .addFields(
        {
          name: 'Como funciona',
          value: '• Usuários na blacklist não podem ser desbanidos\n• Tentativas de desban serão automaticamente revertidas\n• Apenas comandos podem remover da blacklist',
          inline: false
        },
        {
          name: 'Ações Disponíveis',
          value: 'Selecione uma ação no menu abaixo para continuar',
          inline: false
        }
      )
      .setFooter({ text: 'Sistema de Blacklist | Timeout: 5 minutos' })
      .setTimestamp();

    const actionMenu = new StringSelectMenuBuilder()
      .setCustomId(`blacklist_action_${message.author.id}`)
      .setPlaceholder('Selecione uma ação')
      .addOptions([
        {
          label: 'Adicionar à Blacklist',
          value: 'add',
          description: 'Adicionar usuário à blacklist'
        },
        {
          label: 'Remover da Blacklist',
          value: 'remove',
          description: 'Remover usuário da blacklist'
        },
        {
          label: 'Listar Blacklist',
          value: 'list',
          description: 'Ver todos os usuários na blacklist'
        },
        {
          label: 'Verificar Usuário',
          value: 'check',
          description: 'Verificar se usuário está na blacklist'
        }
      ]);

    const actionRow = new ActionRowBuilder().addComponents(actionMenu);

    const response = await message.reply({
      embeds: [embed],
      components: [actionRow]
    });

    await this.setupCollectors(response, message, getServerConfig);
  },

  async setupCollectors(response, originalMessage, getServerConfig) {
    const collector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId.startsWith('blacklist_action_')) {
        const action = interaction.values[0];
        
        switch (action) {
          case 'add':
            await this.showAddUserMenu(interaction, originalMessage, getServerConfig);
            break;
          case 'remove':
            await this.showRemoveUserMenu(interaction, originalMessage, getServerConfig);
            break;
          case 'list':
            await this.showBlacklistList(interaction, originalMessage);
            break;
          case 'check':
            await this.showCheckUserMenu(interaction, originalMessage);
            break;
        }
      } else if (interaction.customId.startsWith('blacklist_add_user_')) {
        await this.handleAddUser(interaction, originalMessage, getServerConfig);
      } else if (interaction.customId.startsWith('blacklist_remove_user_')) {
        await this.handleRemoveUser(interaction, originalMessage, getServerConfig);
      } else if (interaction.customId.startsWith('blacklist_check_user_')) {
        await this.handleCheckUser(interaction, originalMessage);
      } else if (interaction.customId.startsWith('blacklist_reason_modal_')) {
        await this.handleReasonModal(interaction, originalMessage, getServerConfig);
      }
    });

    collector.on('end', () => {
      console.log('Coletor de blacklist finalizado');
    });
  },

  async showAddUserMenu(interaction, originalMessage, getServerConfig) {
    const embed = new EmbedBuilder()
      .setColor('#ffa500')
      .setTitle('Adicionar à Blacklist')
      .setDescription('Selecione o usuário que será adicionado à blacklist')
      .addFields({
        name: 'Aviso',
        value: 'Este usuário não poderá ser desbanido até ser removido da blacklist',
        inline: false
      })
      .setTimestamp();

    const userMenu = new UserSelectMenuBuilder()
      .setCustomId(`blacklist_add_user_${originalMessage.author.id}`)
      .setPlaceholder('Selecione o usuário para adicionar à blacklist');

    const userRow = new ActionRowBuilder().addComponents(userMenu);

    await interaction.update({
      embeds: [embed],
      components: [userRow]
    });
  },

  async showRemoveUserMenu(interaction, originalMessage, getServerConfig) {
    const blacklistedUsers = await Blacklist.getBlacklistedUsers(originalMessage.guild.id, 25);

    if (blacklistedUsers.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Blacklist Vazia')
        .setDescription('Não há usuários na blacklist deste servidor')
        .setTimestamp();

      return await interaction.update({
        embeds: [embed],
        components: []
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#ffa500')
      .setTitle('Remover da Blacklist')
      .setDescription('Selecione o usuário que será removido da blacklist')
      .setTimestamp();

    const userMenu = new UserSelectMenuBuilder()
      .setCustomId(`blacklist_remove_user_${originalMessage.author.id}`)
      .setPlaceholder('Selecione o usuário para remover da blacklist');

    const userRow = new ActionRowBuilder().addComponents(userMenu);

    await interaction.update({
      embeds: [embed],
      components: [userRow]
    });
  },

  async showCheckUserMenu(interaction, originalMessage) {
    const embed = new EmbedBuilder()
      .setColor('#ffa500')
      .setTitle('Verificar Usuário')
      .setDescription('Selecione o usuário para verificar se está na blacklist')
      .setTimestamp();

    const userMenu = new UserSelectMenuBuilder()
      .setCustomId(`blacklist_check_user_${originalMessage.author.id}`)
      .setPlaceholder('Selecione o usuário para verificar');

    const userRow = new ActionRowBuilder().addComponents(userMenu);

    await interaction.update({
      embeds: [embed],
      components: [userRow]
    });
  },

  async handleAddUser(interaction, originalMessage, getServerConfig) {
    const userId = interaction.values[0];
    const user = await interaction.guild.members.fetch(userId).catch(() => null);
    
    if (!user) {
      // Tentar buscar usuário do Discord
      try {
        const discordUser = await interaction.client.users.fetch(userId);
        
        // Mostrar modal para motivo
        const modal = new ModalBuilder()
          .setCustomId(`blacklist_reason_modal_${userId}_${originalMessage.author.id}`)
          .setTitle('Motivo da Blacklist');

        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Motivo para adicionar à blacklist')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: Usuário problemático, violação grave de regras...')
          .setRequired(true)
          .setMaxLength(500);

        const reasonRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(reasonRow);

        await interaction.showModal(modal);
        return;
      } catch (error) {
        const embed = new EmbedBuilder()
          .setColor('#ff4444')
          .setTitle('Erro')
          .setDescription('Usuário não encontrado')
          .setTimestamp();

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }
    }

    // Se usuário foi encontrado no servidor, mostrar modal
    const modal = new ModalBuilder()
      .setCustomId(`blacklist_reason_modal_${userId}_${originalMessage.author.id}`)
      .setTitle('Motivo da Blacklist');

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Motivo para adicionar à blacklist')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ex: Usuário problemático, violação grave de regras...')
      .setRequired(true)
      .setMaxLength(500);

    const reasonRow = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(reasonRow);

    await interaction.showModal(modal);
  },

  async handleReasonModal(interaction, originalMessage, getServerConfig) {
    const userId = interaction.customId.split('_')[3];
    const reason = interaction.fields.getTextInputValue('reason');

    try {
      // Verificar se já está na blacklist
      const existing = await Blacklist.isBlacklisted(originalMessage.guild.id, userId);
      if (existing) {
        const embed = new EmbedBuilder()
          .setColor('#ffa500')
          .setTitle('Usuário já na Blacklist')
          .setDescription('Este usuário já está na blacklist')
          .addFields(
            { name: 'Motivo Atual', value: existing.reason || 'Sem motivo especificado', inline: false },
            { name: 'Adicionado em', value: `<t:${Math.floor(new Date(existing.added_at).getTime() / 1000)}:F>`, inline: false }
          )
          .setTimestamp();

        return await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      // Buscar informações do usuário
      let user;
      try {
        user = await interaction.client.users.fetch(userId);
      } catch (error) {
        user = { tag: 'Usuário Desconhecido', id: userId };
      }

      // Adicionar à blacklist
      await Blacklist.addUser(
        originalMessage.guild.id,
        userId,
        user.tag,
        reason,
        originalMessage.author.id,
        originalMessage.author.tag
      );

      // Log da ação
      await ModerationLog.log(
        originalMessage.guild.id,
        userId,
        originalMessage.author.id,
        'BLACKLIST_ADD',
        reason
      );

      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Usuário Adicionado à Blacklist')
        .setDescription('Usuário foi adicionado à blacklist com sucesso')
        .addFields(
          { name: 'Usuário', value: `${user.tag}\n${userId}`, inline: true },
          { name: 'Moderador', value: `${originalMessage.author.tag}\n${originalMessage.author.id}`, inline: true },
          { name: 'Motivo', value: reason, inline: false }
        )
        .setFooter({ text: 'Este usuário não poderá ser desbanido até ser removido da blacklist' })
        .setTimestamp();

      // Enviar log para canal de moderação
      await this.sendBlacklistLog(originalMessage.guild, user, originalMessage.author, 'ADD', reason, getServerConfig);

      await interaction.reply({
        embeds: [embed],
        ephemeral: false
      });

    } catch (error) {
      console.error('Erro ao adicionar à blacklist:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao adicionar o usuário à blacklist')
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
  },

  async handleRemoveUser(interaction, originalMessage, getServerConfig) {
    const userId = interaction.values[0];

    try {
      // Verificar se está na blacklist
      const blacklistEntry = await Blacklist.getBlacklistEntry(originalMessage.guild.id, userId);
      if (!blacklistEntry) {
        const embed = new EmbedBuilder()
          .setColor('#ffa500')
          .setTitle('Usuário não está na Blacklist')
          .setDescription('Este usuário não está na blacklist')
          .setTimestamp();

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }

      // Remover da blacklist
      await Blacklist.removeUser(originalMessage.guild.id, userId);

      // Buscar informações do usuário
      let user;
      try {
        user = await interaction.client.users.fetch(userId);
      } catch (error) {
        user = { tag: blacklistEntry.user_tag || 'Usuário Desconhecido', id: userId };
      }

      // Log da ação
      await ModerationLog.log(
        originalMessage.guild.id,
        userId,
        originalMessage.author.id,
        'BLACKLIST_REMOVE',
        'Removido da blacklist'
      );

      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Usuário Removido da Blacklist')
        .setDescription('Usuário foi removido da blacklist com sucesso')
        .addFields(
          { name: 'Usuário', value: `${user.tag}\n${userId}`, inline: true },
          { name: 'Moderador', value: `${originalMessage.author.tag}\n${originalMessage.author.id}`, inline: true },
          { name: 'Motivo Original', value: blacklistEntry.reason || 'Sem motivo especificado', inline: false }
        )
        .setFooter({ text: 'Este usuário agora pode ser desbanido normalmente' })
        .setTimestamp();

      // Enviar log para canal de moderação
      await this.sendBlacklistLog(originalMessage.guild, user, originalMessage.author, 'REMOVE', 'Removido da blacklist', getServerConfig);

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao remover da blacklist:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao remover o usuário da blacklist')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async handleCheckUser(interaction, originalMessage) {
    const userId = interaction.values[0];

    try {
      const blacklistEntry = await Blacklist.getBlacklistEntry(originalMessage.guild.id, userId);
      
      // Buscar informações do usuário
      let user;
      try {
        user = await interaction.client.users.fetch(userId);
      } catch (error) {
        user = { tag: 'Usuário Desconhecido', id: userId };
      }

      if (blacklistEntry) {
        const embed = new EmbedBuilder()
          .setColor('#ff4444')
          .setTitle('Usuário na Blacklist')
          .setDescription('Este usuário está na blacklist')
          .addFields(
            { name: 'Usuário', value: `${user.tag}\n${userId}`, inline: true },
            { name: 'Adicionado por', value: blacklistEntry.added_by_tag || 'Desconhecido', inline: true },
            { name: 'Motivo', value: blacklistEntry.reason || 'Sem motivo especificado', inline: false },
            { name: 'Data', value: `<t:${Math.floor(new Date(blacklistEntry.added_at).getTime() / 1000)}:F>`, inline: false }
          )
          .setTimestamp();

        await interaction.update({
          embeds: [embed],
          components: []
        });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle('Usuário não está na Blacklist')
          .setDescription('Este usuário não está na blacklist e pode ser desbanido normalmente')
          .addFields(
            { name: 'Usuário', value: `${user.tag}\n${userId}`, inline: true }
          )
          .setTimestamp();

        await interaction.update({
          embeds: [embed],
          components: []
        });
      }

    } catch (error) {
      console.error('Erro ao verificar blacklist:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao verificar o usuário')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async showBlacklistList(interaction, originalMessage) {
    try {
      const blacklistedUsers = await Blacklist.getBlacklistedUsers(originalMessage.guild.id, 10);
      const totalCount = await Blacklist.getBlacklistCount(originalMessage.guild.id);

      if (blacklistedUsers.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle('Blacklist Vazia')
          .setDescription('Não há usuários na blacklist deste servidor')
          .setTimestamp();

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }

      let userList = '';
      for (const entry of blacklistedUsers) {
        const addedDate = new Date(entry.added_at);
        userList += `**${entry.user_tag || 'Usuário Desconhecido'}**\n`;
        userList += `ID: \`${entry.user_id}\`\n`;
        userList += `Motivo: ${entry.reason || 'Sem motivo'}\n`;
        userList += `Adicionado: <t:${Math.floor(addedDate.getTime() / 1000)}:R>\n\n`;
      }

      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Lista de Blacklist')
        .setDescription(userList)
        .setFooter({ text: `Mostrando ${blacklistedUsers.length} de ${totalCount} usuários na blacklist` })
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao listar blacklist:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao buscar a lista de blacklist')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async sendBlacklistLog(guild, user, moderator, action, reason, getServerConfig) {
    try {
      const config = await getServerConfig(guild.id);
      const logChannelId = config.logChannels.blacklist || config.logChannels.moderation;

      if (!logChannelId) {
        return; // Nenhum canal configurado
      }

      const logChannel = guild.channels.cache.get(logChannelId);
      if (!logChannel) {
        console.log(`Canal de log não encontrado: ${logChannelId}`);
        return;
      }

      const actionText = action === 'ADD' ? 'Adicionado à Blacklist' : 'Removido da Blacklist';
      const color = action === 'ADD' ? '#ff4444' : '#bbffc3';

      const logEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Log de Blacklist - ${actionText}`)
        .setDescription(`Um usuário foi ${action === 'ADD' ? 'adicionado à' : 'removido da'} blacklist`)
        .addFields(
          { name: 'Usuário', value: `${user.tag}\n${user.id}`, inline: true },
          { name: 'Moderador', value: `${moderator.tag}\n${moderator.id}`, inline: true },
          { name: 'Motivo', value: reason, inline: false },
          { name: 'Data/Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(user.displayAvatarURL ? user.displayAvatarURL({ dynamic: true }) : null)
        .setFooter({ text: 'Sistema de Logs de Blacklist' })
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
      console.log(`Log de blacklist enviado para ${logChannel.name}`);
    } catch (error) {
      console.error('Erro ao enviar log de blacklist:', error);
    }
  },

  // Métodos para comandos diretos
  async handleDirectAdd(message, args, getServerConfig) {
    if (args.length < 2) {
      return message.reply('Uso: `q.blacklist add @usuário motivo`');
    }

    const userMention = args[0];
    const reason = args.slice(1).join(' ');
    
    // Extrair ID do usuário
    const userIdMatch = userMention.match(/(\d+)/);
    if (!userIdMatch) {
      return message.reply('Por favor, mencione um usuário válido.');
    }

    const userId = userIdMatch[1];
    
    try {
      const user = await message.client.users.fetch(userId);
      
      await Blacklist.addUser(
        message.guild.id,
        userId,
        user.tag,
        reason,
        message.author.id,
        message.author.tag
      );

      await ModerationLog.log(
        message.guild.id,
        userId,
        message.author.id,
        'BLACKLIST_ADD',
        reason
      );

      await this.sendBlacklistLog(message.guild, user, message.author, 'ADD', reason, getServerConfig);

      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Usuário Adicionado à Blacklist')
        .addFields(
          { name: 'Usuário', value: `${user.tag}\n${userId}`, inline: true },
          { name: 'Motivo', value: reason, inline: false }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Erro ao adicionar à blacklist:', error);
      await message.reply('Ocorreu um erro ao adicionar o usuário à blacklist.');
    }
  },

  async handleDirectRemove(message, args, getServerConfig) {
    if (args.length < 1) {
      return message.reply('Uso: `q.blacklist remove @usuário`');
    }

    const userMention = args[0];
    
    // Extrair ID do usuário
    const userIdMatch = userMention.match(/(\d+)/);
    if (!userIdMatch) {
      return message.reply('Por favor, mencione um usuário válido.');
    }

    const userId = userIdMatch[1];
    
    try {
      const blacklistEntry = await Blacklist.getBlacklistEntry(message.guild.id, userId);
      if (!blacklistEntry) {
        return message.reply('Este usuário não está na blacklist.');
      }

      await Blacklist.removeUser(message.guild.id, userId);
      
      const user = await message.client.users.fetch(userId).catch(() => ({ tag: 'Usuário Desconhecido', id: userId }));

      await ModerationLog.log(
        message.guild.id,
        userId,
        message.author.id,
        'BLACKLIST_REMOVE',
        'Removido da blacklist'
      );

      await this.sendBlacklistLog(message.guild, user, message.author, 'REMOVE', 'Removido da blacklist', getServerConfig);

      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Usuário Removido da Blacklist')
        .addFields(
          { name: 'Usuário', value: `${user.tag}\n${userId}`, inline: true }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Erro ao remover da blacklist:', error);
      await message.reply('Ocorreu um erro ao remover o usuário da blacklist.');
    }
  },

  async handleDirectList(message, getServerConfig) {
    try {
      const blacklistedUsers = await Blacklist.getBlacklistedUsers(message.guild.id, 10);
      const totalCount = await Blacklist.getBlacklistCount(message.guild.id);

      if (blacklistedUsers.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle('Blacklist Vazia')
          .setDescription('Não há usuários na blacklist deste servidor')
          .setTimestamp();

        return await message.reply({ embeds: [embed] });
      }

      let userList = '';
      for (const entry of blacklistedUsers) {
        const addedDate = new Date(entry.added_at);
        userList += `**${entry.user_tag || 'Usuário Desconhecido'}**\n`;
        userList += `ID: \`${entry.user_id}\`\n`;
        userList += `Motivo: ${entry.reason || 'Sem motivo'}\n`;
        userList += `Adicionado: <t:${Math.floor(addedDate.getTime() / 1000)}:R>\n\n`;
      }

      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Lista de Blacklist')
        .setDescription(userList)
        .setFooter({ text: `Mostrando ${blacklistedUsers.length} de ${totalCount} usuários na blacklist` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Erro ao listar blacklist:', error);
      await message.reply('Ocorreu um erro ao buscar a lista de blacklist.');
    }
  }
};
const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const BlacklistProtection = require('../database/models/BlacklistProtection');

module.exports = {
  name: 'unban',
  description: 'Remove o banimento de um usuário',
  async execute(message, args, client, serverPrefix, setServerPrefix, getServerConfig, setLogChannel, ModerationLog) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      try {
        await message.reply('Você não tem permissão para desbanir membros.');
      } catch (replyError) {
        await message.channel.send('Você não tem permissão para desbanir membros.');
      }
      return;
    }

    // Se um ID foi fornecido, usar método tradicional
    if (args[0]) {
      return await this.unbanUserById(message, args, getServerConfig);
    }

    // Se não há argumentos, mostrar interface de menus
    try {
      const banList = await message.guild.bans.fetch();

      if (banList.size === 0) {
        const embed = new EmbedBuilder()
          .setColor('#bbffc3')
          .setTitle('Lista de Banidos')
          .setDescription('Não há usuários banidos neste servidor.')
          .setTimestamp();

        return await message.reply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Sistema de Desbanimento')
        .setDescription('Selecione um usuário para desbanir da lista abaixo')
        .addFields({
          name: 'Como usar',
          value: '1. Selecione o usuário no menu abaixo\n2. Defina o motivo do desbanimento\n3. Confirmação será processada automaticamente',
          inline: false
        })
        .setFooter({ text: 'Sistema de Desbanimento | Timeout: 5 minutos' })
        .setTimestamp();

      // Criar menu de seleção com usuários banidos (máximo 25 opções)
      const bannedUsers = Array.from(banList.values()).slice(0, 25);
      const userMenu = new StringSelectMenuBuilder()
        .setCustomId(`unban_user_${message.author.id}`)
        .setPlaceholder('Selecione um usuário para desbanir')
        .addOptions(
          bannedUsers.map(ban => ({
            label: ban.user.tag,
            value: ban.user.id,
            description: `ID: ${ban.user.id} | Motivo original: ${(ban.reason || 'Não informado').substring(0, 50)}`
          }))
        );

      const userRow = new ActionRowBuilder().addComponents(userMenu);

      const response = await message.reply({ 
        embeds: [embed], 
        components: [userRow]
      });

      // Configurar coletores para os menus
      this.setupCollectors(response, message, getServerConfig);

    } catch (error) {
      console.error('Erro ao buscar lista de banidos:', error);
      try {
        await message.reply('Erro ao buscar a lista de usuários banidos.');
      } catch (replyError) {
        await message.channel.send('Erro ao buscar a lista de usuários banidos.');
      }
    }
  },

  async unbanUserById(message, args, getServerConfig) {
    const userId = args[0];
    const reason = args.slice(1).join(' ') || 'Não informado';

    try {
      // Verificar se o usuário está banido
      const banList = await message.guild.bans.fetch();
      const bannedUser = banList.find(ban => ban.user.id === userId);

      if (!bannedUser) {
        try {
          return await message.reply('Este usuário não está banido neste servidor ou o ID é inválido.');
        } catch (replyError) {
          return await message.channel.send('Este usuário não está banido neste servidor ou o ID é inválido.');
        }
      }

      const user = bannedUser.user;

      // Verificar se usuário está na blacklist
      const blacklistStatus = await BlacklistProtection.checkBlacklistStatus(message.guild.id, userId);
      
      if (blacklistStatus.isBlacklisted) {
        const blacklistEmbed = new EmbedBuilder()
          .setColor('#ff4444')
          .setTitle('🚫 Desban Bloqueado - Usuário na Blacklist')
          .setDescription('Este usuário não pode ser desbanido pois está na blacklist do servidor')
          .addFields(
            { name: 'Usuário', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Status', value: 'Na Blacklist', inline: true },
            { name: 'Motivo da Blacklist', value: blacklistStatus.reason || 'Sem motivo especificado', inline: false },
            { name: 'Como Resolver', value: 'Use o comando `q.blacklist remove @usuário` para remover da blacklist primeiro', inline: false }
          )
          .setFooter({ text: 'Sistema de Proteção de Blacklist' })
          .setTimestamp();

        try {
          return await message.reply({ embeds: [blacklistEmbed] });
        } catch (replyError) {
          return await message.channel.send({ embeds: [blacklistEmbed] });
        }
      }

      // Executar desbanimento
      await message.guild.members.unban(userId, reason);

      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Usuario Desbanido')
        .addFields(
          { name: 'Usuario', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderador', value: `${message.author.tag}`, inline: true },
          { name: 'Motivo', value: reason, inline: false }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Desbanimento' })
        .setTimestamp();

      // Enviar log para canal configurado
      await this.sendUnbanLog(message.guild, user, message.author, reason, getServerConfig);
      
      // Salvar no banco de dados
      await ModerationLog.createLog(
        message.guild.id,
        user.id,
        message.author.id,
        'unban',
        reason,
        { method: 'traditional' }
      );

      try {
        await message.reply({ embeds: [embed] });
      } catch (replyError) {
        await message.channel.send({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Erro ao desbanir usuário:', error);
      
      let errorMessage = 'Erro ao desbanir o usuário. Verifique se o ID está correto.';
      if (error.code === 10026) {
        errorMessage = 'Usuário não encontrado ou não está banido.';
      }
      
      try {
        await message.reply(errorMessage);
      } catch (replyError) {
        await message.channel.send(errorMessage);
      }
    }
  },

  setupCollectors(response, originalMessage, getServerConfig) {
    let selectedUserId = null;

    // Coletor para seleção de usuário
    const userCollector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.customId.startsWith('unban_user_') && interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    // Coletor para modal de motivo
    const modalCollector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.customId.startsWith('unban_reason_modal_') && interaction.user.id === originalMessage.author.id,
      time: 300000
    });

    userCollector.on('collect', async (interaction) => {
      selectedUserId = interaction.values[0];
      
      try {
        const user = await originalMessage.guild.members.fetch(selectedUserId).catch(() => null) || 
                     await interaction.client.users.fetch(selectedUserId);

        // Abrir modal para motivo
        const modal = new ModalBuilder()
          .setCustomId(`unban_reason_modal_${originalMessage.author.id}`)
          .setTitle('Motivo do Desbanimento');

        const reasonInput = new TextInputBuilder()
          .setCustomId('unban_reason_input')
          .setLabel('Digite o motivo do desbanimento:')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: Apelação aceita, comportamento melhorado...')
          .setRequired(true)
          .setMinLength(5)
          .setMaxLength(500);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);

        // Configurar listener para o modal
        const client = interaction.client;
        const modalHandler = async (modalInteraction) => {
          if (!modalInteraction.isModalSubmit()) return;
          if (!modalInteraction.customId.startsWith('unban_reason_modal_')) return;
          if (modalInteraction.user.id !== originalMessage.author.id) return;

          const customReason = modalInteraction.fields.getTextInputValue('unban_reason_input');
          
          try {
            // Verificar se usuário está na blacklist
            const blacklistStatus = await BlacklistProtection.checkBlacklistStatus(originalMessage.guild.id, selectedUserId);
            
            if (blacklistStatus.isBlacklisted) {
              const blacklistEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('🚫 Desban Bloqueado - Usuário na Blacklist')
                .setDescription('Este usuário não pode ser desbanido pois está na blacklist do servidor')
                .addFields(
                  { name: 'Usuário', value: `${user.tag} (${user.id})`, inline: true },
                  { name: 'Status', value: 'Na Blacklist', inline: true },
                  { name: 'Motivo da Blacklist', value: blacklistStatus.reason || 'Sem motivo especificado', inline: false },
                  { name: 'Como Resolver', value: 'Use o comando `q.blacklist remove @usuário` para remover da blacklist primeiro', inline: false }
                )
                .setFooter({ text: 'Sistema de Proteção de Blacklist' })
                .setTimestamp();

              await modalInteraction.update({ 
                embeds: [blacklistEmbed], 
                components: []
              });
              
              // Remover o listener após uso
              client.removeListener('interactionCreate', modalHandler);
              return;
            }

            // Executar desbanimento
            await originalMessage.guild.members.unban(selectedUserId, customReason);

            const successEmbed = new EmbedBuilder()
              .setColor('#bbffc3')
              .setTitle('Usuario Desbanido')
              .addFields(
                { name: 'Usuario', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Moderador', value: `${originalMessage.author.tag}`, inline: true },
                { name: 'Motivo', value: customReason, inline: false }
              )
              .setThumbnail(user.displayAvatarURL({ dynamic: true }))
              .setFooter({ text: 'Sistema de Desbanimento | Ação concluída' })
              .setTimestamp();

            // Enviar log para canal configurado
            await this.sendUnbanLog(originalMessage.guild, user, originalMessage.author, customReason, getServerConfig);
            
            // Salvar no banco de dados
            await ModerationLog.createLog(
              originalMessage.guild.id,
              user.id,
              originalMessage.author.id,
              'unban',
              customReason,
              { method: 'interactive' }
            );

            await modalInteraction.update({ 
              embeds: [successEmbed], 
              components: []
            });

          } catch (error) {
            console.error('Erro ao desbanir usuário:', error);
            
            const errorEmbed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('Erro no Desbanimento')
              .setDescription('Ocorreu um erro ao tentar desbanir o usuário.')
              .setTimestamp();

            await modalInteraction.update({ 
              embeds: [errorEmbed], 
              components: []
            });
          }

          // Remover o listener após uso
          client.removeListener('interactionCreate', modalHandler);
        };

        client.on('interactionCreate', modalHandler);

      } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        await interaction.reply({
          content: 'Erro ao buscar informações do usuário.',
          ephemeral: true
        });
      }
    });

    // Timeout dos coletores
    userCollector.on('end', () => console.log('Coletor de desbanimento finalizado'));
  },

  async sendUnbanLog(guild, unbannedUser, moderator, reason, getServerConfig) {
    try {
      const config = getServerConfig(guild.id);
      const unbanLogChannelId = config.logChannels.unban || config.logChannels.moderation;

      if (!unbanLogChannelId) {
        return; // Nenhum canal configurado
      }

      const logChannel = guild.channels.cache.get(unbanLogChannelId);
      if (!logChannel) {
        console.log(`Canal de log não encontrado: ${unbanLogChannelId}`);
        return;
      }

      const logEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('Log de Desbanimento')
        .setDescription('Um usuário foi desbanido do servidor')
        .addFields(
          { name: '\\▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\\', value: '\u200b', inline: false },
          { name: 'Usuario Desbanido', value: `${unbannedUser.tag}\n${unbannedUser.id}`, inline: true },
          { name: 'Moderador', value: `${moderator.tag}\n${moderator.id}`, inline: true },
          { name: 'Data/Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
          { name: '\\▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\\', value: '\u200b', inline: false },
          { name: 'Motivo do Desbanimento', value: reason, inline: false },
          { name: '\\▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\\', value: '\u200b', inline: false }
        )
        .setThumbnail(unbannedUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Logs de Moderação' })
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
      console.log(`Log de desbanimento enviado para ${logChannel.name}`);
    } catch (error) {
      console.error('Erro ao enviar log de desbanimento:', error);
    }
  }
};
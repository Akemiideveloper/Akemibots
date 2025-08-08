const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const Panela = require('../database/models/Panela');
const PanelaConfig = require('../database/models/PanelaConfig');
const ModerationLog = require('../database/models/ModerationLog');

module.exports = {
  name: 'panela',
  description: 'Sistema de Panela - escolha sua panela',
  async execute(message, args, client, serverPrefix, setServerPrefix, getServerConfig) {
    try {
      // Verificar se usuário pode usar o comando
      const userRoles = message.member.roles.cache.map(role => role.id);
      const canUse = await PanelaConfig.userHasPermission(message.guild.id, userRoles);
      
      if (!canUse) {
        const embed = new EmbedBuilder()
          .setColor('#ff4444')
          .setTitle('Acesso Negado')
          .setDescription('Você não tem permissão para usar este comando')
          .addFields({
            name: 'Como obter acesso',
            value: 'Entre em contato com um administrador para configurar os cargos permitidos',
            inline: false
          })
          .setTimestamp();

        return await message.reply({ embeds: [embed] });
      }

      // Buscar panela atual do usuário
      const panelaAtual = await Panela.getPanela(message.guild.id, message.author.id);

      // Mostrar interface principal
      await this.showMainInterface(message, panelaAtual, getServerConfig);

    } catch (error) {
      console.error('Erro no comando panela:', error);
      await message.reply('Ocorreu um erro ao executar o comando. Tente novamente.');
    }
  },

  async showMainInterface(message, panelaAtual, getServerConfig) {
    // Buscar configuração para pegar os cargos configurados
    const config = await PanelaConfig.getConfig(message.guild.id);
    
    // Contar quantas pessoas estão usando o sistema de panela
    const stats = await Panela.getEstatisticas(message.guild.id);
    const totalPanelas = stats.total_usuarios_com_panela || 0;

    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle(`Olá, ${message.author.displayName}!`)
      .setDescription('Seu cargo possui direito à Panela.\n\nUtilize os botões abaixo para gerenciar sua Panela.')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));



    // Sempre usar os nomes fixos como na print, independente da configuração
    // Contar membros para cada sistema
    let antibanCount = 0;
    let primeiraDamaCount = 0;
    
    // Se há cargos configurados, usar os contadores deles
    if (config.allowedRoles && config.allowedRoles.length > 0) {
      // Primeiro cargo = Antiban
      if (config.allowedRoles[0]) {
        try {
          antibanCount = message.guild.members.cache.filter(member => 
            member.roles.cache.has(config.allowedRoles[0])
          ).size;
        } catch (error) {
          console.error('Erro ao contar Antiban:', error);
        }
      }
      
      // Segundo cargo = Primeira Dama  
      if (config.allowedRoles[1]) {
        try {
          primeiraDamaCount = message.guild.members.cache.filter(member => 
            member.roles.cache.has(config.allowedRoles[1])
          ).size;
        } catch (error) {
          console.error('Erro ao contar Primeira Dama:', error);
        }
      }
    }
    
    // Sempre criar os 3 botões com nomes fixos da print
    buttons = [
      new ButtonBuilder()
        .setCustomId('antiban_button')
        .setLabel(`🔒 Antiban (${antibanCount})`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('primeira_dama_button')
        .setLabel(`💎 Primeira Dama (${primeiraDamaCount})`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('panela_main_button')
        .setLabel(`👤 Panela (${totalPanelas})`)
        .setStyle(ButtonStyle.Secondary)
    ];

    const row = new ActionRowBuilder().addComponents(buttons);

    const sentMessage = await message.reply({
      embeds: [embed],
      components: [row]
    });

    // Collector para os botões
    const collector = sentMessage.createMessageComponentCollector({
      time: 300000 // 5 minutos
    });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return await interaction.reply({
          content: 'Apenas quem executou o comando pode usar este botão.',
          ephemeral: true
        });
      }

      try {
        if (interaction.customId === 'panela_main_button') {
          await this.showPanelaMenu(interaction, sentMessage, getServerConfig);
        } else if (interaction.customId === 'antiban_button') {
          // Botão Antiban - mostrar opções de definir antiban
          await this.showAntibanMenu(interaction, sentMessage, getServerConfig);
        } else if (interaction.customId === 'primeira_dama_button') {
          // Botão Primeira Dama - mostrar opções de definir primeira dama
          await this.showPrimeiraDamaMenu(interaction, sentMessage, getServerConfig);
        }
      } catch (error) {
        console.error('Erro no collector do botão principal:', error);
        await interaction.reply({
          content: 'Ocorreu um erro ao processar sua solicitação.',
          ephemeral: true
        });
      }
    });

    collector.on('end', () => {
      sentMessage.edit({ components: [] }).catch(() => {});
    });
  },

  async showAntibanMenu(interaction, originalMessage, getServerConfig) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Sistema Antiban')
      .setDescription('Gerencie o sistema antiban')
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('antiban_sub_menu')
      .setPlaceholder('Escolha uma opção...')
      .addOptions([
        {
          label: 'Definir Antiban',
          description: 'Dar cargo antiban para um usuário',
          value: 'definir_antiban',
        },
        {
          label: 'Remover Antiban',
          description: 'Remover cargo antiban de um usuário',
          value: 'remover_antiban',
        },
        {
          label: 'Listar Antibans',
          description: 'Ver todos os usuários com antiban',
          value: 'listar_antiban',
        }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para o submenu antiban
    const antibanCollector = originalMessage.createMessageComponentCollector({
      time: 300000 // 5 minutos
    });

    antibanCollector.on('collect', async (antibanInteraction) => {
      if (antibanInteraction.user.id !== interaction.user.id) {
        return await antibanInteraction.reply({
          content: 'Apenas quem executou o comando pode usar este menu.',
          ephemeral: true
        });
      }

      if (antibanInteraction.customId === 'antiban_sub_menu') {
        try {
          const option = antibanInteraction.values[0];

          switch (option) {
            case 'definir_antiban':
              await this.showUserSelectForAntiban(antibanInteraction, originalMessage, getServerConfig);
              break;
            case 'remover_antiban':
              await this.showUserSelectForRemoveAntiban(antibanInteraction, originalMessage, getServerConfig);
              break;
            case 'listar_antiban':
              await this.listAntibanUsers(antibanInteraction, originalMessage, getServerConfig);
              break;
          }
        } catch (error) {
          console.error('Erro no collector do submenu antiban:', error);
          await antibanInteraction.reply({
            content: 'Ocorreu um erro ao processar sua solicitação.',
            ephemeral: true
          });
        }
      }
    });

    antibanCollector.on('end', () => {
      originalMessage.edit({ components: [] }).catch(() => {});
    });
  },

  async showPrimeiraDamaMenu(interaction, originalMessage, getServerConfig) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Sistema Primeira Dama')
      .setDescription('Gerencie o sistema primeira dama')
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('primeira_dama_sub_menu')
      .setPlaceholder('Escolha uma opção...')
      .addOptions([
        {
          label: 'Definir Primeira Dama',
          description: 'Dar cargo primeira dama para um usuário',
          value: 'definir_primeira_dama',
        },
        {
          label: 'Remover Primeira Dama',
          description: 'Remover cargo primeira dama de um usuário',
          value: 'remover_primeira_dama',
        },
        {
          label: 'Listar Primeiras Damas',
          description: 'Ver todos os usuários com primeira dama',
          value: 'listar_primeira_dama',
        }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para o submenu primeira dama
    const pdCollector = originalMessage.createMessageComponentCollector({
      time: 300000 // 5 minutos
    });

    pdCollector.on('collect', async (pdInteraction) => {
      if (pdInteraction.user.id !== interaction.user.id) {
        return await pdInteraction.reply({
          content: 'Apenas quem executou o comando pode usar este menu.',
          ephemeral: true
        });
      }

      if (pdInteraction.customId === 'primeira_dama_sub_menu') {
        try {
          const option = pdInteraction.values[0];

          switch (option) {
            case 'definir_primeira_dama':
              await this.showUserSelectForPrimeiraDama(pdInteraction, originalMessage, getServerConfig);
              break;
            case 'remover_primeira_dama':
              await this.showUserSelectForRemovePrimeiraDama(pdInteraction, originalMessage, getServerConfig);
              break;
            case 'listar_primeira_dama':
              await this.listPrimeiraDamaUsers(pdInteraction, originalMessage, getServerConfig);
              break;
          }
        } catch (error) {
          console.error('Erro no collector do submenu primeira dama:', error);
          await pdInteraction.reply({
            content: 'Ocorreu um erro ao processar sua solicitação.',
            ephemeral: true
          });
        }
      }
    });

    pdCollector.on('end', () => {
      originalMessage.edit({ components: [] }).catch(() => {});
    });
  },

  async showPanelaMenu(interaction, originalMessage, getServerConfig) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Sistema de Panela')
      .setDescription('Escolha uma das opções abaixo para gerenciar sua panela')
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('panela_sub_menu')
      .setPlaceholder('Escolha uma opção...')
      .addOptions([
        {
          label: 'Escolher Panela',
          description: 'Definir ou alterar sua panela',
          value: 'escolher',
        },
        {
          label: 'Remover Panela',
          description: 'Remover sua panela atual',
          value: 'remover',
        },
        {
          label: 'Ver Minha Panela',
          description: 'Ver informações da sua panela atual',
          value: 'ver',
        },
        {
          label: 'Quem Me Tem Como Panela',
          description: 'Ver quem te escolheu como panela',
          value: 'quem_me_tem',
        },
        {
          label: 'Ver Ranking',
          description: 'Ver ranking das panelas mais escolhidas',
          value: 'ranking',
        }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para o submenu
    const subCollector = originalMessage.createMessageComponentCollector({
      time: 300000 // 5 minutos
    });

    subCollector.on('collect', async (subInteraction) => {
      if (subInteraction.user.id !== interaction.user.id) {
        return await subInteraction.reply({
          content: 'Apenas quem executou o comando pode usar este menu.',
          ephemeral: true
        });
      }

      if (subInteraction.customId === 'panela_sub_menu') {
        try {
          const option = subInteraction.values[0];

          switch (option) {
            case 'escolher':
              await this.showUserSelectMenu(subInteraction, originalMessage, getServerConfig);
              break;
            case 'remover':
              await this.removePanela(subInteraction, originalMessage, getServerConfig);
              break;
            case 'ver':
              await this.verPanela(subInteraction, originalMessage);
              break;
            case 'quem_me_tem':
              await this.quemMeTemComoPanela(subInteraction, originalMessage);
              break;
            case 'ranking':
              await this.showRanking(subInteraction, originalMessage);
              break;
          }
        } catch (error) {
          console.error('Erro no collector do submenu:', error);
          await subInteraction.reply({
            content: 'Ocorreu um erro ao processar sua solicitação.',
            ephemeral: true
          });
        }
      }
    });

    subCollector.on('end', () => {
      originalMessage.edit({ components: [] }).catch(() => {});
    });
  },

  async showUserSelectMenu(interaction, originalMessage, getServerConfig) {
    const userSelectMenu = new UserSelectMenuBuilder()
      .setCustomId('panela_user_select')
      .setPlaceholder('Selecione quem será sua panela...')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(userSelectMenu);

    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Escolher Panela')
      .setDescription('Selecione o usuário que será sua panela')
      .setFooter({ text: 'Esta ação pode ser desfeita' })
      .setTimestamp();

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para seleção de usuário
    const userCollector = originalMessage.createMessageComponentCollector({
      time: 300000 // 5 minutos
    });

    userCollector.on('collect', async (userInteraction) => {
      if (userInteraction.user.id !== interaction.user.id) {
        return await userInteraction.reply({
          content: 'Apenas quem executou o comando pode usar este menu.',
          ephemeral: true
        });
      }

      if (userInteraction.customId === 'panela_user_select') {
        const selectedUserId = userInteraction.values[0];
        
        // Verificar se o usuário não está tentando selecionar a si mesmo
        if (selectedUserId === userInteraction.user.id) {
          return await userInteraction.reply({
            content: 'Você não pode selecionar a si mesmo como panela!',
            ephemeral: true
          });
        }

        const selectedUser = await originalMessage.guild.members.fetch(selectedUserId);
        await this.showConfirmationMenu(userInteraction, originalMessage, selectedUser, getServerConfig);
      }
    });

    userCollector.on('end', () => {
      originalMessage.edit({ components: [] }).catch(() => {});
    });
  },

  async showConfirmationMenu(interaction, originalMessage, selectedUser, getServerConfig) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Confirmar Escolha')
      .setDescription(`Tem certeza que deseja escolher **${selectedUser.displayName}** como sua panela?`)
      .setThumbnail(selectedUser.user.displayAvatarURL({ dynamic: true }))
      .addFields({
        name: 'Usuário Selecionado',
        value: `<@${selectedUser.id}> (${selectedUser.user.tag})`,
        inline: false
      })
      .setFooter({ text: 'Esta ação substituirá sua panela atual' })
      .setTimestamp();

    const confirmButton = new StringSelectMenuBuilder()
      .setCustomId(`panela_confirm_${selectedUser.id}`)
      .setPlaceholder('Confirmar escolha...')
      .addOptions([
        {
          label: 'Sim, confirmar',
          description: 'Definir esta pessoa como minha panela',
          value: 'confirm',
        },
        {
          label: 'Cancelar',
          description: 'Voltar ao menu anterior',
          value: 'cancel',
        }
      ]);

    const row = new ActionRowBuilder().addComponents(confirmButton);

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para confirmação
    const confirmCollector = originalMessage.createMessageComponentCollector({
      time: 300000 // 5 minutos
    });

    confirmCollector.on('collect', async (confirmInteraction) => {
      if (confirmInteraction.user.id !== interaction.user.id) {
        return await confirmInteraction.reply({
          content: 'Apenas quem executou o comando pode usar este menu.',
          ephemeral: true
        });
      }

      if (confirmInteraction.customId.startsWith('panela_confirm_')) {
        const action = confirmInteraction.values[0];
        
        if (action === 'confirm') {
          // Extrair o ID do usuário do customId
          const selectedUserId = confirmInteraction.customId.split('_')[2];
          
          // Verificar novamente se não é auto-seleção
          if (selectedUserId === confirmInteraction.user.id) {
            return await confirmInteraction.reply({
              content: 'Erro: Não é possível selecionar a si mesmo como panela.',
              ephemeral: true
            });
          }

          await this.setPanela(confirmInteraction, originalMessage, selectedUserId, getServerConfig);
        } else if (action === 'cancel') {
          await this.showUserSelectMenu(confirmInteraction, originalMessage, getServerConfig);
        }
      }
    });

    confirmCollector.on('end', () => {
      originalMessage.edit({ components: [] }).catch(() => {});
    });
  },

  async setPanela(interaction, originalMessage, panelaId, getServerConfig) {
    try {
      const guildId = originalMessage.guild.id;
      const userId = interaction.user.id;
      
      // Buscar informações dos usuários
      const user = await originalMessage.guild.members.fetch(userId);
      const panela = await originalMessage.guild.members.fetch(panelaId);
      
      const userTag = user.user.tag;
      const panelaTag = panela.user.tag;
      
      // Salvar no banco de dados
      await Panela.setPanela(guildId, userId, panelaId, userTag, panelaTag);
      
      // Buscar configuração e aplicar cargo se configurado
      const config = await PanelaConfig.getConfig(guildId);
      if (config.panelaRoleId) {
        try {
          await panela.roles.add(config.panelaRoleId);
          console.log(`Cargo de panela aplicado a ${panelaTag}`);
        } catch (roleError) {
          console.error('Erro ao aplicar cargo de panela:', roleError);
        }
      }
      
      // Criar log de moderação
      await ModerationLog.createLog({
        guildId: guildId,
        userId: panelaId,
        moderatorId: userId,
        actionType: 'panela_set',
        reason: `Escolhido como panela por ${userTag}`,
        metadata: {
          panela_tag: panelaTag,
          user_tag: userTag
        }
      });
      
      // Enviar log para canal configurado
      await this.sendPanelaLog(originalMessage.guild, user, panela, 'set', getServerConfig);
      
      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Panela Definida com Sucesso')
        .setDescription(`**${panela.displayName}** agora é sua panela!`)
        .setThumbnail(panela.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          {
            name: 'Sua Nova Panela',
            value: `<@${panelaId}> (${panelaTag})`,
            inline: false
          },
          {
            name: 'Data',
            value: new Date().toLocaleString('pt-BR'),
            inline: true
          }
        )
        .setFooter({ text: `Sistema de Panela • ${originalMessage.guild.name}` })
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao definir panela:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao definir sua panela. Tente novamente.')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async removePanela(interaction, originalMessage, getServerConfig) {
    try {
      const guildId = originalMessage.guild.id;
      const userId = interaction.user.id;
      
      // Verificar se o usuário tem uma panela
      const panelaAtual = await Panela.getPanela(guildId, userId);
      
      if (!panelaAtual) {
        const embed = new EmbedBuilder()
          .setColor('#ff4444')
          .setTitle('Nenhuma Panela')
          .setDescription('Você não possui uma panela para remover.')
          .setTimestamp();

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }
      
      // Remover do banco de dados
      await Panela.removePanela(guildId, userId);
      
      // Buscar membro da panela para remover cargo
      try {
        const panelaMember = await originalMessage.guild.members.fetch(panelaAtual.panela_id);
        const config = await PanelaConfig.getConfig(guildId);
        
        if (config.panelaRoleId && panelaMember.roles.cache.has(config.panelaRoleId)) {
          // Verificar se a pessoa ainda é panela de alguém mais
          const outrasRelacoes = await Panela.getQuemTemComoPanela(guildId, panelaAtual.panela_id);
          
          if (outrasRelacoes.length === 0) {
            await panelaMember.roles.remove(config.panelaRoleId);
            console.log(`Cargo de panela removido de ${panelaAtual.panela_tag}`);
          }
        }
      } catch (memberError) {
        console.error('Erro ao remover cargo de panela:', memberError);
      }
      
      // Criar log de moderação
      await ModerationLog.createLog({
        guildId: guildId,
        userId: panelaAtual.panela_id,
        moderatorId: userId,
        actionType: 'panela_remove',
        reason: `Panela removida por ${interaction.user.tag}`,
        metadata: {
          panela_tag: panelaAtual.panela_tag,
          user_tag: interaction.user.tag
        }
      });
      
      // Enviar log para canal configurado
      const user = await originalMessage.guild.members.fetch(userId);
      const panelaMember = await originalMessage.guild.members.fetch(panelaAtual.panela_id).catch(() => null);
      
      if (panelaMember) {
        await this.sendPanelaLog(originalMessage.guild, user, panelaMember, 'remove', getServerConfig);
      }
      
      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Panela Removida')
        .setDescription(`**${panelaAtual.panela_tag}** não é mais sua panela.`)
        .addFields({
          name: 'Status',
          value: 'Você não possui uma panela no momento',
          inline: false
        })
        .setFooter({ text: `Sistema de Panela • ${originalMessage.guild.name}` })
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao remover panela:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao remover sua panela.')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async verPanela(interaction, originalMessage) {
    try {
      const guildId = originalMessage.guild.id;
      const userId = interaction.user.id;
      
      const panela = await Panela.getPanela(guildId, userId);
      
      if (!panela) {
        const embed = new EmbedBuilder()
          .setColor('#ffb6c1')
          .setTitle('Nenhuma Panela')
          .setDescription('Você ainda não escolheu uma panela.')
          .addFields({
            name: 'Como escolher',
            value: 'Use a opção "Escolher Panela" no menu principal',
            inline: false
          })
          .setTimestamp();

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }
      
      // Buscar membro da panela
      const panelaMember = await originalMessage.guild.members.fetch(panela.panela_id).catch(() => null);
      
      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Sua Panela')
        .setDescription(`Informações sobre sua panela atual`)
        .addFields(
          {
            name: 'Panela',
            value: panelaMember ? `<@${panela.panela_id}> (${panela.panela_tag})` : `${panela.panela_tag} (usuário não encontrado)`,
            inline: false
          },
          {
            name: 'Desde',
            value: new Date(panela.created_at).toLocaleString('pt-BR'),
            inline: true
          },
          {
            name: 'Última Atualização',
            value: new Date(panela.updated_at).toLocaleString('pt-BR'),
            inline: true
          }
        )
        .setFooter({ text: `Sistema de Panela • ${originalMessage.guild.name}` })
        .setTimestamp();
      
      if (panelaMember) {
        embed.setThumbnail(panelaMember.user.displayAvatarURL({ dynamic: true }));
      }

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao ver panela:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao buscar informações da sua panela.')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async quemMeTemComoPanela(interaction, originalMessage) {
    try {
      const guildId = originalMessage.guild.id;
      const userId = interaction.user.id;
      
      const pessoasQueMe = await Panela.getQuemTemComoPanela(guildId, userId);
      
      if (pessoasQueMe.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#ffb6c1')
          .setTitle('Ninguém Te Tem Como Panela')
          .setDescription('Você ainda não foi escolhido como panela por ninguém.')
          .setTimestamp();

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }
      
      let listaText = '';
      for (let i = 0; i < pessoasQueMe.length; i++) {
        const pessoa = pessoasQueMe[i];
        listaText += `${i + 1}. **${pessoa.user_tag}**\n`;
        listaText += `   <@${pessoa.user_id}>\n`;
        listaText += `   Desde: ${new Date(pessoa.created_at).toLocaleDateString('pt-BR')}\n\n`;
      }
      
      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Quem Te Tem Como Panela')
        .setDescription(`${pessoasQueMe.length} ${pessoasQueMe.length === 1 ? 'pessoa te tem' : 'pessoas te têm'} como panela`)
        .addFields({
          name: `Lista (${pessoasQueMe.length})`,
          value: listaText.length > 1024 ? listaText.substring(0, 1020) + '...' : listaText,
          inline: false
        })
        .setFooter({ text: `Sistema de Panela • ${originalMessage.guild.name}` })
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao buscar quem me tem como panela:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao buscar quem te tem como panela.')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async showRanking(interaction, originalMessage) {
    try {
      // Buscar configuração para pegar o ID do cargo
      console.log(`🔍 Buscando configuração Panela para servidor: ${originalMessage.guild.id}`);
      const config = await PanelaConfig.getConfig(originalMessage.guild.id);
      console.log(`📋 Configuração encontrada:`, config);
      console.log(`🎭 Cargo Panela configurado: ${config.panelaRoleId || config.panela_role_id}`);
      
      const panelaRoleId = config.panelaRoleId || config.panela_role_id;
      
      if (!panelaRoleId) {
        console.log(`❌ Cargo Panela não configurado!`);
        const embed = new EmbedBuilder()
          .setColor('#ffb6c1')
          .setTitle('Configuração Necessária')
          .setDescription('O cargo de panela não foi configurado neste servidor.\n\nUse `q.config-panela` para configurar.')
          .setTimestamp();

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }
      
      console.log(`✅ Cargo Panela válido encontrado: ${panelaRoleId}`);

      // Buscar ranking do banco de dados
      const ranking = await Panela.getRankingPanelas(originalMessage.guild.id, 10);

      if (ranking.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#ffb6c1')
          .setTitle('Ranking Vazio')
          .setDescription('Ainda não há panelas definidas neste servidor')
          .setTimestamp();

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }

      // Verificar quais usuários realmente possuem o cargo
      const rankingComCargo = [];
      const rankingSemCargo = [];

      for (const entry of ranking) {
        try {
          const member = await originalMessage.guild.members.fetch(entry.panela_id).catch(() => null);
          
          if (member && member.roles.cache.has(panelaRoleId)) {
            console.log(`✅ ${entry.panela_tag} possui o cargo Panela`);
            rankingComCargo.push(entry);
          } else {
            console.log(`❌ ${entry.panela_tag} NÃO possui o cargo Panela ou não está no servidor`);
            rankingSemCargo.push(entry);
          }
        } catch (error) {
          console.error(`❌ Erro ao verificar membro ${entry.panela_tag}:`, error);
          rankingSemCargo.push(entry);
        }
      }

      // Construir texto do ranking
      let rankingText = '';
      
      if (rankingComCargo.length > 0) {
        rankingText += '**💎 Com Cargo de Panela:**\n\n';
        rankingComCargo.forEach((entry, index) => {
          const posicao = index + 1;
          const emoji = posicao === 1 ? '🥇' : posicao === 2 ? '🥈' : posicao === 3 ? '🥉' : `${posicao}.`;
          
          rankingText += `${emoji} **${entry.panela_tag}** ✅\n`;
          rankingText += `   <@${entry.panela_id}>\n`;
          rankingText += `   ${entry.count} ${entry.count === 1 ? 'pessoa' : 'pessoas'}\n\n`;
        });
      }

      if (rankingSemCargo.length > 0) {
        if (rankingComCargo.length > 0) {
          rankingText += '\n**⚠️ Sem Cargo (Banco apenas):**\n\n';
        }
        
        rankingSemCargo.forEach((entry, index) => {
          const posicao = (rankingComCargo.length + index + 1);
          rankingText += `${posicao}. **${entry.panela_tag}** ❌\n`;
          rankingText += `   <@${entry.panela_id}> (sem cargo)\n`;
          rankingText += `   ${entry.count} ${entry.count === 1 ? 'pessoa' : 'pessoas'}\n\n`;
        });
      }

      if (rankingText === '') {
        rankingText = 'Nenhuma panela encontrada.';
      }

      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Ranking de Panelas')
        .setDescription('Lista baseada no banco de dados e verificação de cargos')
        .addFields({
          name: `Ranking (${rankingComCargo.length} com cargo, ${rankingSemCargo.length} sem cargo)`,
          value: rankingText.length > 1024 ? rankingText.substring(0, 1020) + '...' : rankingText,
          inline: false
        })
        .setFooter({ text: `Sistema de Panela • ${originalMessage.guild.name} • ✅ = Com cargo • ❌ = Sem cargo` })
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('❌ Erro ao mostrar ranking:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao buscar o ranking de panelas.')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async sendPanelaLog(guild, user, panela, action, getServerConfig) {
    try {
      const config = await getServerConfig(guild.id);
      
      // Usar canal específico de panela ou canal geral de moderação
      const logChannelId = config?.logChannels?.panela || config?.logChannels?.moderation;
      
      if (!logChannelId) {
        return; // Sem canal configurado
      }
      
      const logChannel = guild.channels.cache.get(logChannelId);
      if (!logChannel) {
        return; // Canal não encontrado
      }
      
      const actionText = action === 'set' ? 'Definida' : 'Removida';
      const color = action === 'set' ? '#00ff00' : '#ff9900';
      
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Sistema de Panela - ${actionText}`)
        .addFields(
          {
            name: 'Usuário',
            value: `<@${user.id}> (${user.user.tag})`,
            inline: true
          },
          {
            name: 'Panela',
            value: `<@${panela.id}> (${panela.user.tag})`,
            inline: true
          },
          {
            name: 'Ação',
            value: actionText,
            inline: true
          },
          {
            name: 'Data',
            value: new Date().toLocaleString('pt-BR'),
            inline: false
          }
        )
        .setFooter({ text: 'Sistema de Logs de Panela' })
        .setTimestamp();
      
      await logChannel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Erro ao enviar log de panela:', error);
    }
  },

  // Funções para Antiban
  async showUserSelectForAntiban(interaction, originalMessage, getServerConfig) {
    const userSelectMenu = new UserSelectMenuBuilder()
      .setCustomId('antiban_user_select')
      .setPlaceholder('Selecione quem receberá o cargo antiban...')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(userSelectMenu);

    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Definir Antiban')
      .setDescription('Selecione o usuário que receberá o cargo antiban')
      .setTimestamp();

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para seleção de usuário
    const userCollector = originalMessage.createMessageComponentCollector({
      time: 300000 // 5 minutos
    });

    userCollector.on('collect', async (userInteraction) => {
      if (userInteraction.user.id !== interaction.user.id) {
        return await userInteraction.reply({
          content: 'Apenas quem executou o comando pode usar este menu.',
          ephemeral: true
        });
      }

      if (userInteraction.customId === 'antiban_user_select') {
        const selectedUserId = userInteraction.values[0];
        await this.giveAntibanRole(userInteraction, originalMessage, selectedUserId, getServerConfig);
      }
    });

    userCollector.on('end', () => {
      originalMessage.edit({ components: [] }).catch(() => {});
    });
  },

  async giveAntibanRole(interaction, originalMessage, userId, getServerConfig) {
    try {
      const config = await PanelaConfig.getConfig(interaction.guild.id);
      
      // Usar cargo antiban específico
      const antibanRoleId = config.antibanRoleId;
      
      if (!antibanRoleId) {
        return await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor('#ff4444')
            .setTitle('Configuração Necessária')
            .setDescription('Cargo antiban não foi configurado.\n\nUse `q.config-panela → Definir Cargo Antiban` para configurar.')
            .setTimestamp()],
          components: []
        });
      }

      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(antibanRoleId);

      if (!role) {
        return await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor('#ff4444')
            .setTitle('Erro')
            .setDescription('Cargo antiban não encontrado.')
            .setTimestamp()],
          components: []
        });
      }

      // Aplicar o cargo
      await member.roles.add(antibanRoleId);

      // Criar log
      await ModerationLog.createLog({
        guildId: interaction.guild.id,
        userId: userId,
        moderatorId: interaction.user.id,
        actionType: 'antiban_add',
        reason: `Cargo antiban dado por ${interaction.user.tag}`,
        metadata: {
          role_name: role.name,
          role_id: antibanRoleId
        }
      });

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('Antiban Definido')
        .setDescription(`**${member.displayName}** recebeu o cargo antiban!`)
        .addFields(
          {
            name: 'Usuário',
            value: `<@${userId}> (${member.user.tag})`,
            inline: false
          },
          {
            name: 'Cargo Aplicado',
            value: `<@&${antibanRoleId}> (${role.name})`,
            inline: false
          },
          {
            name: 'Aplicado por',
            value: `<@${interaction.user.id}>`,
            inline: true
          }
        )
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao dar cargo antiban:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao aplicar o cargo antiban.')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  // Funções para Primeira Dama
  async showUserSelectForPrimeiraDama(interaction, originalMessage, getServerConfig) {
    const userSelectMenu = new UserSelectMenuBuilder()
      .setCustomId('primeira_dama_user_select')
      .setPlaceholder('Selecione quem receberá o cargo primeira dama...')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(userSelectMenu);

    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Definir Primeira Dama')
      .setDescription('Selecione o usuário que receberá o cargo primeira dama')
      .setTimestamp();

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para seleção de usuário
    const userCollector = originalMessage.createMessageComponentCollector({
      time: 300000 // 5 minutos
    });

    userCollector.on('collect', async (userInteraction) => {
      if (userInteraction.user.id !== interaction.user.id) {
        return await userInteraction.reply({
          content: 'Apenas quem executou o comando pode usar este menu.',
          ephemeral: true
        });
      }

      if (userInteraction.customId === 'primeira_dama_user_select') {
        const selectedUserId = userInteraction.values[0];
        await this.givePrimeiraDamaRole(userInteraction, originalMessage, selectedUserId, getServerConfig);
      }
    });

    userCollector.on('end', () => {
      originalMessage.edit({ components: [] }).catch(() => {});
    });
  },

  async givePrimeiraDamaRole(interaction, originalMessage, userId, getServerConfig) {
    try {
      const config = await PanelaConfig.getConfig(interaction.guild.id);
      
      // Usar cargo primeira dama específico
      const primeiraDamaRoleId = config.primeiraDamaRoleId;
      
      if (!primeiraDamaRoleId) {
        return await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor('#ff4444')
            .setTitle('Configuração Necessária')
            .setDescription('Cargo primeira dama não foi configurado.\n\nUse `q.config-panela → Definir Cargo Primeira Dama` para configurar.')
            .setTimestamp()],
          components: []
        });
      }

      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(primeiraDamaRoleId);

      if (!role) {
        return await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor('#ff4444')
            .setTitle('Erro')
            .setDescription('Cargo primeira dama não encontrado.')
            .setTimestamp()],
          components: []
        });
      }

      // Aplicar o cargo
      await member.roles.add(primeiraDamaRoleId);

      // Criar log
      await ModerationLog.createLog({
        guildId: interaction.guild.id,
        userId: userId,
        moderatorId: interaction.user.id,
        actionType: 'primeira_dama_add',
        reason: `Cargo primeira dama dado por ${interaction.user.tag}`,
        metadata: {
          role_name: role.name,
          role_id: primeiraDamaRoleId
        }
      });

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('Primeira Dama Definida')
        .setDescription(`**${member.displayName}** recebeu o cargo primeira dama!`)
        .addFields(
          {
            name: 'Usuário',
            value: `<@${userId}> (${member.user.tag})`,
            inline: false
          },
          {
            name: 'Cargo Aplicado',
            value: `<@&${primeiraDamaRoleId}> (${role.name})`,
            inline: false
          },
          {
            name: 'Aplicado por',
            value: `<@${interaction.user.id}>`,
            inline: true
          }
        )
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao dar cargo primeira dama:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao aplicar o cargo primeira dama.')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  }
};
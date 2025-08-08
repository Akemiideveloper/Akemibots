const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const PrimeiraDama = require('../database/models/PrimeiraDama');
const PrimeiraDamaConfig = require('../database/models/PrimeiraDamaConfig');
const ModerationLog = require('../database/models/ModerationLog');

module.exports = {
  name: 'pd',
  description: 'Sistema de Primeira Dama - escolha sua primeira dama',
  async execute(message, args, client, serverPrefix, setServerPrefix, getServerConfig) {
    try {
      // Verificar se usuário pode usar o comando
      const userRoles = message.member.roles.cache.map(role => role.id);
      const canUse = await PrimeiraDamaConfig.canUseCommand(message.guild.id, userRoles);
      
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

      // Buscar primeira dama atual do usuário
      const primeiraDamaAtual = await PrimeiraDama.getPrimeiraDama(message.guild.id, message.author.id);

      // Mostrar interface principal
      await this.showMainInterface(message, primeiraDamaAtual, getServerConfig);

    } catch (error) {
      console.error('Erro no comando pd:', error);
      await message.reply('Ocorreu um erro ao executar o comando. Tente novamente.');
    }
  },

  async showMainInterface(message, primeiraDamaAtual, getServerConfig) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Sistema de Primeira Dama')
      .setDescription('Gerencie sua primeira dama usando os menus abaixo')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

    if (primeiraDamaAtual) {
      embed.addFields({
        name: 'Sua Primeira Dama Atual',
        value: `${primeiraDamaAtual.primeira_dama_tag}\n<@${primeiraDamaAtual.primeira_dama_id}>`,
        inline: false
      });
    } else {
      embed.addFields({
        name: 'Status',
        value: 'Você ainda não tem uma primeira dama',
        inline: false
      });
    }

    embed.addFields(
      {
        name: 'Como funciona',
        value: '• Escolha alguém para ser sua primeira dama\n• A pessoa receberá o cargo automaticamente\n• Você pode trocar quando quiser\n• Cada pessoa tem sua própria primeira dama',
        inline: false
      },
      {
        name: 'Ações Disponíveis',
        value: 'Use os menus abaixo para gerenciar sua primeira dama',
        inline: false
      }
    );

    const actionMenu = new StringSelectMenuBuilder()
      .setCustomId(`pd_action_${message.author.id}`)
      .setPlaceholder('Selecione uma ação')
      .addOptions([
        {
          label: 'Escolher/Trocar Primeira Dama',
          value: 'set',
          description: 'Definir quem será sua primeira dama'
        },
        {
          label: 'Ver Minha Primeira Dama',
          value: 'view',
          description: 'Ver informações da sua primeira dama atual'
        },
        {
          label: 'Remover Primeira Dama',
          value: 'remove',
          description: 'Remover sua primeira dama atual'
        },
        {
          label: 'Ver Quem Me Tem Como PD',
          value: 'who_has_me',
          description: 'Ver quem te escolheu como primeira dama'
        },
        {
          label: 'Ranking de Primeiras Damas',
          value: 'ranking',
          description: 'Ver o ranking das primeiras damas mais populares'
        }
      ]);

    const actionRow = new ActionRowBuilder().addComponents(actionMenu);

    embed.setFooter({ text: 'Sistema de Primeira Dama | Timeout: 5 minutos' })
         .setTimestamp();

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
      if (interaction.customId.startsWith('pd_action_')) {
        const action = interaction.values[0];
        
        switch (action) {
          case 'set':
            await this.showSetPdMenu(interaction, originalMessage, getServerConfig);
            break;
          case 'view':
            await this.showCurrentPd(interaction, originalMessage);
            break;
          case 'remove':
            await this.removePd(interaction, originalMessage, getServerConfig);
            break;
          case 'who_has_me':
            await this.showWhoHasMe(interaction, originalMessage);
            break;
          case 'ranking':
            await this.showRanking(interaction, originalMessage);
            break;
        }
      } else if (interaction.customId.startsWith('pd_select_user_')) {
        await this.handleUserSelection(interaction, originalMessage, getServerConfig);
      } else if (interaction.customId.startsWith('pd_confirm_')) {
        await this.handleConfirmation(interaction, originalMessage, getServerConfig);
      }
    });

    collector.on('end', () => {
      console.log('Coletor de primeira dama finalizado');
    });
  },

  async showSetPdMenu(interaction, originalMessage, getServerConfig) {
    const embed = new EmbedBuilder()
      .setColor('#ffa500')
      .setTitle('Escolher Primeira Dama')
      .setDescription('Selecione quem será sua primeira dama')
      .addFields({
        name: 'Importante',
        value: 'A pessoa escolhida receberá automaticamente o cargo de "Primeira Dama"',
        inline: false
      })
      .setTimestamp();

    const userMenu = new UserSelectMenuBuilder()
      .setCustomId(`pd_select_user_${originalMessage.author.id}`)
      .setPlaceholder('Selecione sua primeira dama');

    const userRow = new ActionRowBuilder().addComponents(userMenu);

    await interaction.update({
      embeds: [embed],
      components: [userRow]
    });
  },

  async handleUserSelection(interaction, originalMessage, getServerConfig) {
    const selectedUserId = interaction.values[0];
    const selectedUser = await interaction.guild.members.fetch(selectedUserId).catch(() => null);

    if (!selectedUser) {
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Usuário não encontrado no servidor')
        .setTimestamp();

      return await interaction.update({
        embeds: [embed],
        components: []
      });
    }

    // Verificar se não está tentando escolher a si mesmo
    if (selectedUserId === originalMessage.author.id) {
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Você não pode escolher a si mesmo como primeira dama!')
        .setTimestamp();

      return await interaction.update({
        embeds: [embed],
        components: []
      });
    }

    // Verificar se não é um bot
    if (selectedUser.user.bot) {
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Você não pode escolher um bot como primeira dama!')
        .setTimestamp();

      return await interaction.update({
        embeds: [embed],
        components: []
      });
    }

    // Mostrar confirmação
    await this.showConfirmation(interaction, originalMessage, selectedUser, getServerConfig);
  },

  async showConfirmation(interaction, originalMessage, selectedUser, getServerConfig) {
    const primeiraDamaAtual = await PrimeiraDama.getPrimeiraDama(originalMessage.guild.id, originalMessage.author.id);

    const embed = new EmbedBuilder()
      .setColor('#ffa500')
      .setTitle('Confirmar Escolha')
      .setDescription(`Você tem certeza que quer escolher **${selectedUser.user.tag}** como sua primeira dama?`)
      .addFields(
        { name: 'Nova Primeira Dama', value: `${selectedUser.user.tag}\n<@${selectedUser.id}>`, inline: true }
      )
      .setThumbnail(selectedUser.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    if (primeiraDamaAtual) {
      embed.addFields(
        { name: 'Primeira Dama Atual', value: `${primeiraDamaAtual.primeira_dama_tag}\n<@${primeiraDamaAtual.primeira_dama_id}>`, inline: true }
      );
    }

    const confirmMenu = new StringSelectMenuBuilder()
      .setCustomId(`pd_confirm_${selectedUser.id}_${originalMessage.author.id}`)
      .setPlaceholder('Confirmar escolha')
      .addOptions([
        {
          label: 'Sim, confirmar',
          value: 'confirm',
          description: 'Definir como primeira dama'
        },
        {
          label: 'Não, cancelar',
          value: 'cancel',
          description: 'Cancelar operação'
        }
      ]);

    const confirmRow = new ActionRowBuilder().addComponents(confirmMenu);

    await interaction.update({
      embeds: [embed],
      components: [confirmRow]
    });
  },

  async handleConfirmation(interaction, originalMessage, getServerConfig) {
    const customIdParts = interaction.customId.split('_');
    const selectedUserId = customIdParts[2]; // pd_confirm_[USER_ID]_[AUTHOR_ID]
    const choice = interaction.values[0];

    if (choice === 'cancel') {
      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Operação Cancelada')
        .setDescription('A escolha da primeira dama foi cancelada')
        .setTimestamp();

      return await interaction.update({
        embeds: [embed],
        components: []
      });
    }

    if (choice === 'confirm') {
      await this.setPrimeiraDama(interaction, originalMessage, selectedUserId, getServerConfig);
    }
  },

  async setPrimeiraDama(interaction, originalMessage, primeiraDamaId, getServerConfig) {
    try {
      // Verificar se não está tentando escolher a si mesmo (dupla validação)
      if (primeiraDamaId === originalMessage.author.id) {
        const embed = new EmbedBuilder()
          .setColor('#ffb6c1')
          .setTitle('Erro')
          .setDescription('Você não pode escolher a si mesmo como primeira dama!')
          .setTimestamp();

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }

      const selectedUser = await interaction.guild.members.fetch(primeiraDamaId).catch(() => null);
      
      if (!selectedUser) {
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

      // Buscar configuração do cargo
      const config = await PrimeiraDamaConfig.getConfig(originalMessage.guild.id);
      
      // Buscar primeira dama anterior (se houver)
      const primeiraDamaAnterior = await PrimeiraDama.getPrimeiraDama(originalMessage.guild.id, originalMessage.author.id);

      // Remover cargo da primeira dama anterior
      if (primeiraDamaAnterior && config.pdRoleId) {
        const anteriorUser = await interaction.guild.members.fetch(primeiraDamaAnterior.primeira_dama_id).catch(() => null);
        if (anteriorUser && anteriorUser.roles.cache.has(config.pdRoleId)) {
          // Verificar se essa pessoa ainda é primeira dama de alguém mais
          const outrasRelacoes = await PrimeiraDama.getQuemTemComoPrimeiraDama(originalMessage.guild.id, primeiraDamaAnterior.primeira_dama_id);
          
          // Se só era primeira dama desta pessoa, remover cargo
          if (outrasRelacoes.length <= 1) {
            await anteriorUser.roles.remove(config.pdRoleId, 'Primeira dama removida').catch(console.error);
          }
        }
      }

      // Salvar nova primeira dama no banco
      await PrimeiraDama.setPrimeiraDama(
        originalMessage.guild.id,
        originalMessage.author.id,
        primeiraDamaId,
        originalMessage.author.tag,
        selectedUser.user.tag
      );

      // Adicionar cargo à nova primeira dama
      if (config.pdRoleId) {
        console.log(`🎀 Tentando adicionar cargo PD: ${config.pdRoleId}`);
        const role = interaction.guild.roles.cache.get(config.pdRoleId);
        console.log(`🎀 Cargo encontrado:`, role ? role.name : 'NÃO ENCONTRADO');
        
        if (role && !selectedUser.roles.cache.has(config.pdRoleId)) {
          console.log(`🎀 Adicionando cargo ${role.name} para ${selectedUser.user.tag}`);
          await selectedUser.roles.add(config.pdRoleId, `Primeira dama de ${originalMessage.author.tag}`)
            .then(() => console.log(`✅ Cargo ${role.name} adicionado com sucesso`))
            .catch(error => console.error(`❌ Erro ao adicionar cargo:`, error));
        } else if (selectedUser.roles.cache.has(config.pdRoleId)) {
          console.log(`ℹ️ ${selectedUser.user.tag} já possui o cargo ${role ? role.name : config.pdRoleId}`);
        }
      } else {
        console.log(`⚠️ Cargo de primeira dama não configurado!`);
      }

      // Log da ação
      await ModerationLog.createLog(
        originalMessage.guild.id,
        primeiraDamaId,
        originalMessage.author.id,
        'PRIMEIRA_DAMA_SET',
        `Definido como primeira dama de ${originalMessage.author.tag}`
      );

      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Primeira Dama Definida!')
        .setDescription(`**${selectedUser.user.tag}** agora é sua primeira dama!`)
        .addFields(
          { name: 'Você', value: `${originalMessage.author.tag}\n<@${originalMessage.author.id}>`, inline: true },
          { name: 'Sua Primeira Dama', value: `${selectedUser.user.tag}\n<@${selectedUser.id}>`, inline: true }
        )
        .setThumbnail(selectedUser.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Primeira Dama' })
        .setTimestamp();

      // Enviar log para canal configurado
      await this.sendPdLog(originalMessage.guild, originalMessage.author, selectedUser.user, 'SET', getServerConfig);

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao definir primeira dama:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao definir a primeira dama')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async showCurrentPd(interaction, originalMessage) {
    const primeiraDama = await PrimeiraDama.getPrimeiraDama(originalMessage.guild.id, originalMessage.author.id);

    if (!primeiraDama) {
      const embed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('Nenhuma Primeira Dama')
        .setDescription('Você ainda não tem uma primeira dama definida')
        .addFields({
          name: 'Como definir',
          value: 'Use o menu "Escolher/Trocar Primeira Dama" para definir sua primeira dama',
          inline: false
        })
        .setTimestamp();

      return await interaction.update({
        embeds: [embed],
        components: []
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Sua Primeira Dama')
      .setDescription(`Informações sobre sua primeira dama atual`)
      .addFields(
        { name: 'Primeira Dama', value: `${primeiraDama.primeira_dama_tag}\n<@${primeiraDama.primeira_dama_id}>`, inline: true },
        { name: 'Definida em', value: `<t:${Math.floor(new Date(primeiraDama.created_at).getTime() / 1000)}:F>`, inline: true },
        { name: 'Atualizada em', value: `<t:${Math.floor(new Date(primeiraDama.updated_at).getTime() / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    // Tentar buscar avatar da primeira dama
    try {
      const pdUser = await interaction.client.users.fetch(primeiraDama.primeira_dama_id);
      embed.setThumbnail(pdUser.displayAvatarURL({ dynamic: true }));
    } catch (error) {
      // Se não conseguir buscar, usar avatar padrão
    }

    await interaction.update({
      embeds: [embed],
      components: []
    });
  },

  async removePd(interaction, originalMessage, getServerConfig) {
    const primeiraDama = await PrimeiraDama.getPrimeiraDama(originalMessage.guild.id, originalMessage.author.id);

    if (!primeiraDama) {
      const embed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('Nenhuma Primeira Dama')
        .setDescription('Você não tem uma primeira dama para remover')
        .setTimestamp();

      return await interaction.update({
        embeds: [embed],
        components: []
      });
    }

    try {
      // Buscar configuração do cargo
      const config = await PrimeiraDamaConfig.getConfig(originalMessage.guild.id);

      // Remover do banco
      await PrimeiraDama.removePrimeiraDama(originalMessage.guild.id, originalMessage.author.id);

      // Verificar se deve remover o cargo
      if (config.pdRoleId) {
        const pdUser = await interaction.guild.members.fetch(primeiraDama.primeira_dama_id).catch(() => null);
        if (pdUser) {
          // Verificar se ainda é primeira dama de alguém mais
          const outrasRelacoes = await PrimeiraDama.getQuemTemComoPrimeiraDama(originalMessage.guild.id, primeiraDama.primeira_dama_id);
          
          // Se não é mais primeira dama de ninguém, remover cargo
          if (outrasRelacoes.length === 0) {
            await pdUser.roles.remove(config.pdRoleId, 'Não é mais primeira dama de ninguém').catch(console.error);
          }
        }
      }

      // Log da ação
      await ModerationLog.createLog(
        originalMessage.guild.id,
        primeiraDama.primeira_dama_id,
        originalMessage.author.id,
        'PRIMEIRA_DAMA_REMOVE',
        `Removido como primeira dama de ${originalMessage.author.tag}`
      );

      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Primeira Dama Removida')
        .setDescription(`**${primeiraDama.primeira_dama_tag}** não é mais sua primeira dama`)
        .setTimestamp();

      // Enviar log para canal configurado
      await this.sendPdLog(originalMessage.guild, originalMessage.author, { tag: primeiraDama.primeira_dama_tag, id: primeiraDama.primeira_dama_id }, 'REMOVE', getServerConfig);

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao remover primeira dama:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao remover a primeira dama')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async showWhoHasMe(interaction, originalMessage) {
    const quemTemMim = await PrimeiraDama.getQuemTemComoPrimeiraDama(originalMessage.guild.id, originalMessage.author.id);

    if (quemTemMim.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('Ninguém Te Escolheu')
        .setDescription('Nenhum usuário te escolheu como primeira dama ainda')
        .setTimestamp();

      return await interaction.update({
        embeds: [embed],
        components: []
      });
    }

    let listaUsuarios = '';
    quemTemMim.forEach((relacao, index) => {
      listaUsuarios += `${index + 1}. **${relacao.user_tag}**\n`;
      listaUsuarios += `   <@${relacao.user_id}>\n`;
      listaUsuarios += `   Desde: <t:${Math.floor(new Date(relacao.created_at).getTime() / 1000)}:R>\n\n`;
    });

    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Quem Te Tem Como Primeira Dama')
      .setDescription(listaUsuarios)
      .setFooter({ text: `Total: ${quemTemMim.length} ${quemTemMim.length === 1 ? 'pessoa' : 'pessoas'}` })
      .setTimestamp();

    await interaction.update({
      embeds: [embed],
      components: []
    });
  },

  async showRanking(interaction, originalMessage) {
    try {
      // Buscar configuração para pegar o ID do cargo
      console.log(`🔍 Buscando configuração PD para servidor: ${originalMessage.guild.id}`);
      const config = await PrimeiraDamaConfig.getConfig(originalMessage.guild.id);
      console.log(`📋 Configuração encontrada:`, config);
      console.log(`🎭 Cargo PD configurado: ${config.pdRoleId || config.pd_role_id}`);
      
      const pdRoleId = config.pdRoleId || config.pd_role_id;
      
      if (!pdRoleId) {
        console.log(`❌ Cargo PD não configurado!`);
        const embed = new EmbedBuilder()
          .setColor('#ffb6c1')
          .setTitle('Configuração Necessária')
          .setDescription('O cargo de primeira dama não foi configurado neste servidor.\n\nUse `q.config-pd` para configurar.')
          .setTimestamp();

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }
      
      console.log(`✅ Cargo PD válido encontrado: ${pdRoleId}`);

      // Buscar ranking do banco de dados
      const ranking = await PrimeiraDama.getRankingPrimeirasDamas(originalMessage.guild.id, 10);

      if (ranking.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#ffb6c1')
          .setTitle('Ranking Vazio')
          .setDescription('Ainda não há primeiras damas definidas neste servidor')
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
          const member = await originalMessage.guild.members.fetch(entry.primeira_dama_id).catch(() => null);
          
          if (member && member.roles.cache.has(pdRoleId)) {
            console.log(`✅ ${entry.primeira_dama_tag} possui o cargo PD`);
            rankingComCargo.push(entry);
          } else {
            console.log(`❌ ${entry.primeira_dama_tag} NÃO possui o cargo PD ou não está no servidor`);
            rankingSemCargo.push(entry);
          }
        } catch (error) {
          console.error(`❌ Erro ao verificar membro ${entry.primeira_dama_tag}:`, error);
          rankingSemCargo.push(entry);
        }
      }

      // Construir texto do ranking
      let rankingText = '';
      
      if (rankingComCargo.length > 0) {
        rankingText += '**💎 Com Cargo de Primeira Dama:**\n\n';
        rankingComCargo.forEach((entry, index) => {
          const posicao = index + 1;
          const emoji = posicao === 1 ? '🥇' : posicao === 2 ? '🥈' : posicao === 3 ? '🥉' : `${posicao}.`;
          
          rankingText += `${emoji} **${entry.primeira_dama_tag}** ✅\n`;
          rankingText += `   <@${entry.primeira_dama_id}>\n`;
          rankingText += `   ${entry.count} ${entry.count === 1 ? 'pessoa' : 'pessoas'}\n\n`;
        });
      }

      if (rankingSemCargo.length > 0) {
        if (rankingComCargo.length > 0) {
          rankingText += '\n**⚠️ Sem Cargo (Banco apenas):**\n\n';
        }
        
        rankingSemCargo.forEach((entry, index) => {
          const posicao = (rankingComCargo.length + index + 1);
          rankingText += `${posicao}. **${entry.primeira_dama_tag}** ❌\n`;
          rankingText += `   <@${entry.primeira_dama_id}> (sem cargo)\n`;
          rankingText += `   ${entry.count} ${entry.count === 1 ? 'pessoa' : 'pessoas'}\n\n`;
        });
      }

      if (rankingText === '') {
        rankingText = 'Nenhuma primeira dama encontrada.';
      }

      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Ranking de Primeiras Damas')
        .setDescription('Lista baseada no banco de dados e verificação de cargos')
        .addFields({
          name: `Ranking (${rankingComCargo.length} com cargo, ${rankingSemCargo.length} sem cargo)`,
          value: rankingText.length > 1024 ? rankingText.substring(0, 1020) + '...' : rankingText,
          inline: false
        })
        .setFooter({ text: 'Sistema de Primeira Dama • ✅ = Com cargo • ❌ = Sem cargo' })
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
        .setDescription('Ocorreu um erro ao buscar o ranking de primeiras damas.')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async sendPdLog(guild, user, primeiraDama, action, getServerConfig) {
    try {
      const config = await getServerConfig(guild.id);
      const logChannelId = config.logChannels.primeira_dama || config.logChannels.moderation;

      if (!logChannelId) {
        return; // Nenhum canal configurado
      }

      const logChannel = guild.channels.cache.get(logChannelId);
      if (!logChannel) {
        console.log(`Canal de log não encontrado: ${logChannelId}`);
        return;
      }

      const actionText = action === 'SET' ? 'Primeira Dama Definida' : 'Primeira Dama Removida';
      const color = action === 'SET' ? '#ffb6c1' : '#ffb6c1';

      const logEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Log de Primeira Dama - ${actionText}`)
        .setDescription(`${action === 'SET' ? 'Nova primeira dama definida' : 'Primeira dama removida'}`)
        .addFields(
          { name: 'Usuário', value: `${user.tag}\n${user.id}`, inline: true },
          { name: 'Primeira Dama', value: `${primeiraDama.tag}\n${primeiraDama.id}`, inline: true },
          { name: 'Ação', value: actionText, inline: true },
          { name: 'Data/Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(primeiraDama.displayAvatarURL ? primeiraDama.displayAvatarURL({ dynamic: true }) : null)
        .setFooter({ text: 'Sistema de Logs de Primeira Dama' })
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
      console.log(`Log de primeira dama enviado para ${logChannel.name}`);
    } catch (error) {
      console.error('Erro ao enviar log de primeira dama:', error);
    }
  }
};
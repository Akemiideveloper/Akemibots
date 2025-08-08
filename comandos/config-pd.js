const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const PrimeiraDamaConfig = require('../database/models/PrimeiraDamaConfig');

module.exports = {
  name: 'config-pd',
  description: 'Configurar sistema de Primeira Dama',
  async execute(message, args, client, serverPrefix, setServerPrefix, getServerConfig) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Você precisa ter permissão de Administrador para usar este comando.');
    }

    // Buscar configuração atual
    const config = await PrimeiraDamaConfig.getConfig(message.guild.id);

    await this.showConfigInterface(message, config);
  },

  async showConfigInterface(message, config) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Configuração do Sistema de Primeira Dama')
      .setDescription('Configure quem pode usar o comando e o cargo que será dado')
      .addFields(
        {
          name: 'Configurações Atuais',
          value: await this.getCurrentConfigText(message.guild, config),
          inline: false
        },
        {
          name: 'Como usar',
          value: '1. Configure os cargos que podem usar o comando\n2. Defina o cargo "Primeira Dama"\n3. Sistema estará pronto para uso',
          inline: false
        }
      )
      .setFooter({ text: 'Sistema de Configuração de Primeira Dama | Timeout: 5 minutos' })
      .setTimestamp();

    const actionMenu = new StringSelectMenuBuilder()
      .setCustomId(`config_pd_action_${message.author.id}`)
      .setPlaceholder('Selecione uma ação')
      .addOptions([
        {
          label: 'Configurar Cargos Permitidos',
          value: 'allowed_roles',
          description: 'Definir quais cargos podem usar q.pd'
        },
        {
          label: 'Definir Cargo Primeira Dama',
          value: 'pd_role',
          description: 'Cargo que será dado às primeiras damas'
        },
        {
          label: 'Ver Configuração Atual',
          value: 'view',
          description: 'Visualizar todas as configurações'
        },
        {
          label: 'Resetar Configurações',
          value: 'reset',
          description: 'Limpar todas as configurações'
        }
      ]);

    const actionRow = new ActionRowBuilder().addComponents(actionMenu);

    const response = await message.reply({
      embeds: [embed],
      components: [actionRow]
    });

    await this.setupCollectors(response, message);
  },

  async getCurrentConfigText(guild, config) {
    let configText = '';

    // Cargos permitidos
    if (config.allowedRoles.length > 0) {
      const roleMentions = config.allowedRoles.map(roleId => {
        const role = guild.roles.cache.get(roleId);
        return role ? `<@&${roleId}>` : `Cargo removido (${roleId})`;
      });
      configText += `**Cargos que podem usar q.pd:** ${roleMentions.join(', ')}\n`;
    } else {
      configText += `**Cargos que podem usar q.pd:** Todos (nenhum cargo específico)\n`;
    }

    // Cargo de primeira dama
    if (config.pdRoleId) {
      const pdRole = guild.roles.cache.get(config.pdRoleId);
      configText += `**Cargo "Primeira Dama":** ${pdRole ? `<@&${config.pdRoleId}>` : `Cargo removido (${config.pdRoleId})`}\n`;
    } else {
      configText += `**Cargo "Primeira Dama":** Não configurado\n`;
    }

    return configText || 'Nenhuma configuração definida';
  },

  async setupCollectors(response, originalMessage) {
    const collector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId.startsWith('config_pd_action_')) {
        const action = interaction.values[0];
        
        switch (action) {
          case 'allowed_roles':
            await this.showAllowedRolesMenu(interaction, originalMessage);
            break;
          case 'pd_role':
            await this.showPdRoleMenu(interaction, originalMessage);
            break;
          case 'view':
            await this.showCurrentConfig(interaction, originalMessage);
            break;
          case 'reset':
            await this.showResetConfirmation(interaction, originalMessage);
            break;
        }
      } else if (interaction.customId.startsWith('config_pd_allowed_roles_')) {
        await this.handleAllowedRolesSelection(interaction, originalMessage);
      } else if (interaction.customId.startsWith('config_pd_role_')) {
        await this.handlePdRoleSelection(interaction, originalMessage);
      } else if (interaction.customId.startsWith('config_pd_reset_')) {
        await this.handleResetConfirmation(interaction, originalMessage);
      }
    });

    collector.on('end', () => {
      console.log('Coletor de configuração de primeira dama finalizado');
    });
  },

  async showAllowedRolesMenu(interaction, originalMessage) {
    const embed = new EmbedBuilder()
      .setColor('#ffa500')
      .setTitle('Configurar Cargos Permitidos')
      .setDescription('Selecione os cargos que podem usar o comando q.pd')
      .addFields({
        name: 'Importante',
        value: 'Se nenhum cargo for selecionado, qualquer usuário poderá usar o comando',
        inline: false
      })
      .setTimestamp();

    const roleMenu = new RoleSelectMenuBuilder()
      .setCustomId(`config_pd_allowed_roles_${originalMessage.author.id}`)
      .setPlaceholder('Selecione os cargos permitidos')
      .setMinValues(0)
      .setMaxValues(10);

    const roleRow = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.update({
      embeds: [embed],
      components: [roleRow]
    });
  },

  async handleAllowedRolesSelection(interaction, originalMessage) {
    const selectedRoles = interaction.values;

    try {
      await PrimeiraDamaConfig.updateAllowedRoles(originalMessage.guild.id, selectedRoles);

      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Cargos Permitidos Configurados')
        .setDescription('Configuração salva com sucesso')
        .setTimestamp();

      if (selectedRoles.length > 0) {
        const roleMentions = selectedRoles.map(roleId => {
          const role = interaction.guild.roles.cache.get(roleId);
          return role ? `<@&${roleId}>` : `Cargo não encontrado (${roleId})`;
        });
        embed.addFields({
          name: 'Cargos Permitidos',
          value: roleMentions.join('\n'),
          inline: false
        });
      } else {
        embed.addFields({
          name: 'Acesso',
          value: 'Todos os usuários podem usar o comando q.pd',
          inline: false
        });
      }

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao configurar cargos permitidos:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao salvar a configuração')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async showPdRoleMenu(interaction, originalMessage) {
    const embed = new EmbedBuilder()
      .setColor('#ffa500')
      .setTitle('Configurar Cargo "Primeira Dama"')
      .setDescription('Selecione o cargo que será dado às primeiras damas')
      .addFields({
        name: 'Funcionamento',
        value: 'Este cargo será automaticamente adicionado/removido quando alguém for escolhido/removido como primeira dama',
        inline: false
      })
      .setTimestamp();

    const roleMenu = new RoleSelectMenuBuilder()
      .setCustomId(`config_pd_role_${originalMessage.author.id}`)
      .setPlaceholder('Selecione o cargo de primeira dama')
      .setMinValues(1)
      .setMaxValues(1);

    const roleRow = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.update({
      embeds: [embed],
      components: [roleRow]
    });
  },

  async handlePdRoleSelection(interaction, originalMessage) {
    const selectedRoleId = interaction.values[0];
    const selectedRole = interaction.guild.roles.cache.get(selectedRoleId);

    if (!selectedRole) {
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Cargo não encontrado')
        .setTimestamp();

      return await interaction.update({
        embeds: [embed],
        components: []
      });
    }

    try {
      await PrimeiraDamaConfig.setPdRole(originalMessage.guild.id, selectedRoleId);

      const embed = new EmbedBuilder()
        .setColor('#ffb6c1')
        .setTitle('Cargo "Primeira Dama" Configurado')
        .setDescription('Configuração salva com sucesso')
        .addFields({
          name: 'Cargo Configurado',
          value: `<@&${selectedRoleId}>`,
          inline: false
        })
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      console.error('Erro ao configurar cargo de primeira dama:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Erro')
        .setDescription('Ocorreu um erro ao salvar a configuração')
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  },

  async showCurrentConfig(interaction, originalMessage) {
    const config = await PrimeiraDamaConfig.getConfig(originalMessage.guild.id);

    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Configuração Atual')
      .setDescription('Configurações do sistema de primeira dama')
      .addFields({
        name: 'Configurações',
        value: await this.getCurrentConfigText(originalMessage.guild, config),
        inline: false
      })
      .setTimestamp();

    await interaction.update({
      embeds: [embed],
      components: []
    });
  },

  async showResetConfirmation(interaction, originalMessage) {
    const embed = new EmbedBuilder()
      .setColor('#ff4444')
      .setTitle('Resetar Configurações')
      .setDescription('Tem certeza que quer resetar todas as configurações?')
      .addFields({
        name: 'Atenção',
        value: 'Esta ação irá:\n• Limpar lista de cargos permitidos\n• Remover cargo de primeira dama\n• Não afetará as primeiras damas já definidas',
        inline: false
      })
      .setTimestamp();

    const confirmMenu = new StringSelectMenuBuilder()
      .setCustomId(`config_pd_reset_${originalMessage.author.id}`)
      .setPlaceholder('Confirmar reset')
      .addOptions([
        {
          label: 'Sim, resetar tudo',
          value: 'confirm',
          description: 'Limpar todas as configurações'
        },
        {
          label: 'Não, cancelar',
          value: 'cancel',
          description: 'Manter configurações atuais'
        }
      ]);

    const confirmRow = new ActionRowBuilder().addComponents(confirmMenu);

    await interaction.update({
      embeds: [embed],
      components: [confirmRow]
    });
  },

  async handleResetConfirmation(interaction, originalMessage) {
    const choice = interaction.values[0];

          if (choice === 'cancel') {
        const embed = new EmbedBuilder()
          .setColor('#ffb6c1')
          .setTitle('Reset Cancelado')
        .setDescription('As configurações foram mantidas')
        .setTimestamp();

      return await interaction.update({
        embeds: [embed],
        components: []
      });
    }

    if (choice === 'confirm') {
      try {
        // Resetar configurações
        const defaultConfig = {
          guildId: originalMessage.guild.id,
          allowedRoles: [],
          pdRoleId: null
        };

        await PrimeiraDamaConfig.saveConfig(defaultConfig);

        const embed = new EmbedBuilder()
          .setColor('#ffb6c1')
          .setTitle('Configurações Resetadas')
          .setDescription('Todas as configurações foram limpas')
          .addFields({
            name: 'Status',
            value: '• Cargos permitidos: Todos\n• Cargo primeira dama: Não configurado',
            inline: false
          })
          .setTimestamp();

        await interaction.update({
          embeds: [embed],
          components: []
        });

      } catch (error) {
        console.error('Erro ao resetar configurações:', error);
        
        const embed = new EmbedBuilder()
          .setColor('#ff4444')
          .setTitle('Erro')
          .setDescription('Ocorreu um erro ao resetar as configurações')
          .setTimestamp();

        await interaction.update({
          embeds: [embed],
          components: []
        });
      }
    }
  }
};
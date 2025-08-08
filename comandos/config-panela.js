const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const PanelaConfig = require('../database/models/PanelaConfig');

module.exports = {
  name: 'config-panela',
  description: 'Configurar sistema de Panela',
  async execute(message, args, client, serverPrefix, setServerPrefix, getServerConfig) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Você precisa ter permissão de Administrador para usar este comando.');
    }

    // Buscar configuração atual
    const config = await PanelaConfig.getConfig(message.guild.id);

    await this.showConfigInterface(message, config);
  },

  async showConfigInterface(message, config) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Configuração do Sistema de Panela')
      .setDescription('Configure quem pode usar o comando e o cargo que será dado')
      .addFields(
        {
          name: 'Configurações Atuais',
          value: await this.getCurrentConfigText(message.guild, config),
          inline: false
        },
        {
          name: 'Como usar',
          value: '1. Configure os cargos que podem usar o comando\n2. Defina o cargo "Panela"\n3. Sistema estará pronto para uso',
          inline: false
        }
      )
      .setFooter({ text: 'Sistema de Configuração de Panela | Timeout: 5 minutos' })
      .setTimestamp();

    const actionMenu = new StringSelectMenuBuilder()
      .setCustomId(`config_panela_action_${message.author.id}`)
      .setPlaceholder('Selecione uma ação')
      .addOptions([
        {
          label: 'Configurar Cargos Permitidos',
          value: 'allowed_roles',
          description: 'Definir quais cargos podem usar q.panela'
        },
        {
          label: 'Definir Cargo Panela',
          value: 'panela_role',
          description: 'Cargo que será dado às panelas'
        },
        {
          label: 'Definir Cargo Antiban',
          value: 'antiban_role',
          description: 'Cargo que será dado pelo botão Antiban'
        },
        {
          label: 'Definir Cargo Primeira Dama',
          value: 'primeira_dama_role',
          description: 'Cargo que será dado pelo botão Primeira Dama'
        },
        {
          label: 'Ver Configuração Atual',
          value: 'view_config',
          description: 'Visualizar todas as configurações'
        },
        {
          label: 'Resetar Configurações',
          value: 'reset_config',
          description: 'Limpar todas as configurações'
        }
      ]);

    const actionRow = new ActionRowBuilder().addComponents(actionMenu);

    const response = await message.reply({
      embeds: [embed],
      components: [actionRow]
    });

    // Collector para capturar interações
    const collector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.user.id === message.author.id,
      time: 300000 // 5 minutos
    });

    collector.on('collect', async (interaction) => {
      try {
        const action = interaction.values[0];

        switch (action) {
          case 'allowed_roles':
            await this.showAllowedRolesConfig(interaction, response, config);
            break;
          case 'panela_role':
            await this.showPanelaRoleConfig(interaction, response, config);
            break;
          case 'antiban_role':
            await this.showAntibanRoleConfig(interaction, response, config);
            break;
          case 'primeira_dama_role':
            await this.showPrimeiraDamaRoleConfig(interaction, response, config);
            break;
          case 'view_config':
            await this.showFullConfig(interaction, response, config);
            break;
          case 'reset_config':
            await this.showResetConfirmation(interaction, response, config);
            break;
        }
      } catch (error) {
        console.error('Erro no collector de config-panela:', error);
        
        // Verificar se a interação ainda pode ser respondida
        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({
              content: 'Ocorreu um erro ao processar sua solicitação.',
              ephemeral: true
            });
          } catch (replyError) {
            console.error('Erro ao responder interação:', replyError);
          }
        }
      }
    });

    collector.on('end', () => {
      response.edit({ components: [] }).catch(() => {});
    });
  },

  async getCurrentConfigText(guild, config) {
    let text = '';
    
    // Cargos permitidos
    if (config.allowedRoles && config.allowedRoles.length > 0) {
      text += '**Cargos que podem usar q.panela:**\n';
      for (const roleId of config.allowedRoles) {
        text += `• <@&${roleId}>\n`;
      }
    } else {
      text += '**Cargos permitidos:** Nenhum configurado\n';
    }
    
    text += '\n';
    
    // Cargo de panela
    if (config.panelaRoleId) {
      text += `**Cargo "Panela":** <@&${config.panelaRoleId}>\n`;
    } else {
      text += '**Cargo "Panela":** Não configurado\n';
    }
    
    // Status geral
    const isConfigured = config.allowedRoles.length > 0 && config.panelaRoleId;
    text += `\n**Status:** ${isConfigured ? '✅ Configurado' : '❌ Configuração incompleta'}`;
    
    return text;
  },

  async showAllowedRolesConfig(interaction, originalMessage, config) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Configurar Cargos Permitidos')
      .setDescription('Selecione os cargos que poderão usar o comando `q.panela`')
      .addFields({
        name: 'Cargos Atuais',
        value: config.allowedRoles.length > 0 
          ? config.allowedRoles.map(id => `<@&${id}>`).join('\n')
          : 'Nenhum cargo configurado',
        inline: false
      })
      .setFooter({ text: 'Selecione os cargos abaixo' });

    const roleMenu = new RoleSelectMenuBuilder()
      .setCustomId(`config_panela_roles_${interaction.user.id}`)
      .setPlaceholder('Selecione os cargos permitidos...')
      .setMinValues(0)
      .setMaxValues(25);

    const row = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para roles
    const roleCollector = originalMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('config_panela_roles_'),
      time: 300000
    });

    roleCollector.on('collect', async (roleInteraction) => {
      try {
        const selectedRoles = roleInteraction.values;
        
        // Atualizar configuração
        await PanelaConfig.updateAllowedRoles(interaction.guild.id, selectedRoles);
        
        // Buscar configuração atualizada
        const updatedConfig = await PanelaConfig.getConfig(interaction.guild.id);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Cargos Permitidos Atualizados')
          .setDescription('Os cargos permitidos foram configurados com sucesso!')
          .addFields({
            name: 'Cargos Configurados',
            value: selectedRoles.length > 0 
              ? selectedRoles.map(id => `<@&${id}>`).join('\n')
              : 'Nenhum cargo selecionado',
            inline: false
          })
          .setTimestamp();

        await roleInteraction.update({
          embeds: [successEmbed],
          components: []
        });

        // Voltar ao menu principal após 3 segundos
        setTimeout(async () => {
          const mockMessage = { 
            reply: (options) => originalMessage.edit(options),
            author: roleInteraction.user,
            guild: roleInteraction.guild
          };
          await this.showConfigInterface(mockMessage, updatedConfig);
        }, 3000);

      } catch (error) {
        console.error('Erro ao configurar cargos permitidos:', error);
        await roleInteraction.reply({
          content: 'Erro ao salvar configurações. Tente novamente.',
          ephemeral: true
        });
      }
    });
  },

  async showPanelaRoleConfig(interaction, originalMessage, config) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Configurar Cargo de Panela')
      .setDescription('Selecione o cargo que será dado automaticamente às panelas')
      .addFields({
        name: 'Cargo Atual',
        value: config.panelaRoleId ? `<@&${config.panelaRoleId}>` : 'Nenhum cargo configurado',
        inline: false
      })
      .setFooter({ text: 'Selecione o cargo abaixo' });

    const roleMenu = new RoleSelectMenuBuilder()
      .setCustomId(`config_panela_role_${interaction.user.id}`)
      .setPlaceholder('Selecione o cargo de panela...')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para role
    const roleCollector = originalMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('config_panela_role_'),
      time: 300000
    });

    roleCollector.on('collect', async (roleInteraction) => {
      try {
        const selectedRole = roleInteraction.values[0];
        
        // Atualizar configuração
        await PanelaConfig.setPanelaRole(interaction.guild.id, selectedRole);
        
        // Buscar configuração atualizada
        const updatedConfig = await PanelaConfig.getConfig(interaction.guild.id);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Cargo de Panela Configurado')
          .setDescription('O cargo de panela foi configurado com sucesso!')
          .addFields({
            name: 'Cargo Configurado',
            value: `<@&${selectedRole}>`,
            inline: false
          })
          .setTimestamp();

        await roleInteraction.update({
          embeds: [successEmbed],
          components: []
        });

        // Voltar ao menu principal após 3 segundos
        setTimeout(async () => {
          const mockMessage = { 
            reply: (options) => originalMessage.edit(options),
            author: roleInteraction.user,
            guild: roleInteraction.guild
          };
          await this.showConfigInterface(mockMessage, updatedConfig);
        }, 3000);

      } catch (error) {
        console.error('Erro ao configurar cargo de panela:', error);
        await roleInteraction.reply({
          content: 'Erro ao salvar configurações. Tente novamente.',
          ephemeral: true
        });
      }
    });
  },

  async showFullConfig(interaction, originalMessage, config) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Configuração Completa do Sistema de Panela')
      .setDescription('Todas as configurações atuais do sistema')
      .addFields(
        {
          name: 'Cargos Permitidos',
          value: config.allowedRoles.length > 0 
            ? config.allowedRoles.map(id => `<@&${id}>`).join('\n')
            : 'Nenhum cargo configurado',
          inline: false
        },
        {
          name: 'Cargo de Panela',
          value: config.panelaRoleId ? `<@&${config.panelaRoleId}>` : 'Não configurado',
          inline: true
        },
        {
          name: 'Cargo Antiban',
          value: config.antibanRoleId ? `<@&${config.antibanRoleId}>` : 'Não configurado',
          inline: true
        },
        {
          name: 'Cargo Primeira Dama',
          value: config.primeiraDamaRoleId ? `<@&${config.primeiraDamaRoleId}>` : 'Não configurado',
          inline: true
        },
        {
          name: 'Status do Sistema',
          value: config.allowedRoles.length > 0 && config.panelaRoleId && config.antibanRoleId && config.primeiraDamaRoleId
            ? '✅ Sistema totalmente configurado'
            : '⚠️ Configuração incompleta',
          inline: false
        },
        {
          name: 'Criado em',
          value: new Date(config.createdAt).toLocaleString('pt-BR'),
          inline: true
        },
        {
          name: 'Última atualização',
          value: new Date(config.updatedAt).toLocaleString('pt-BR'),
          inline: true
        }
      )
      .setFooter({ text: 'Sistema de Panela' })
      .setTimestamp();

    const backButton = new StringSelectMenuBuilder()
      .setCustomId(`config_panela_back_${interaction.user.id}`)
      .setPlaceholder('Voltar ao menu principal')
      .addOptions([
        {
          label: 'Voltar',
          value: 'back',
          description: 'Retornar ao menu de configuração'
        }
      ]);

    const row = new ActionRowBuilder().addComponents(backButton);

    try {
      await interaction.update({
        embeds: [embed],
        components: [row]
      });
    } catch (error) {
      console.error('Erro ao atualizar interação na visualização:', error);
      
      // Se a interação expirou, editar a mensagem original
      if (error.code === 10062 || error.code === 40060) {
        try {
          await originalMessage.edit({
            embeds: [embed],
            components: [row]
          });
        } catch (editError) {
          console.error('Erro ao editar mensagem original:', editError);
        }
      }
      return;
    }

    // Collector para voltar
    const backCollector = originalMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('config_panela_back_'),
      time: 300000
    });

    backCollector.on('collect', async (backInteraction) => {
      const mockMessage = { 
        reply: (options) => originalMessage.edit(options),
        author: backInteraction.user,
        guild: backInteraction.guild
      };
      await this.showConfigInterface(mockMessage, config);
    });
  },

  async showResetConfirmation(interaction, originalMessage, config) {
    const embed = new EmbedBuilder()
      .setColor('#ff4444')
      .setTitle('Confirmar Reset')
      .setDescription('⚠️ **ATENÇÃO:** Esta ação irá apagar TODAS as configurações do sistema de panela!')
      .addFields(
        {
          name: 'O que será removido:',
          value: '• Todos os cargos permitidos\n• Cargo de panela\n• Todas as configurações',
          inline: false
        },
        {
          name: 'Importante:',
          value: 'As relações de panela já criadas NÃO serão afetadas.',
          inline: false
        }
      )
      .setFooter({ text: 'Esta ação não pode ser desfeita!' });

    const confirmMenu = new StringSelectMenuBuilder()
      .setCustomId(`config_panela_reset_${interaction.user.id}`)
      .setPlaceholder('Selecione uma opção...')
      .addOptions([
        {
          label: 'Confirmar Reset',
          value: 'confirm',
          description: 'Apagar todas as configurações'
        },
        {
          label: 'Cancelar',
          value: 'cancel',
          description: 'Voltar sem fazer alterações'
        }
      ]);

    const row = new ActionRowBuilder().addComponents(confirmMenu);

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para confirmação
    const resetCollector = originalMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('config_panela_reset_'),
      time: 300000
    });

    resetCollector.on('collect', async (resetInteraction) => {
      const action = resetInteraction.values[0];

      if (action === 'confirm') {
        try {
          await PanelaConfig.clearConfig(interaction.guild.id);
          
          const successEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Configurações Resetadas')
            .setDescription('Todas as configurações do sistema de panela foram removidas com sucesso!')
            .setTimestamp();

          await resetInteraction.update({
            embeds: [successEmbed],
            components: []
          });

        } catch (error) {
          console.error('Erro ao resetar configurações:', error);
          await resetInteraction.reply({
            content: 'Erro ao resetar configurações. Tente novamente.',
            ephemeral: true
          });
        }
      } else {
        // Cancelar - voltar ao menu principal
        const mockMessage = { 
          reply: (options) => originalMessage.edit(options),
          author: resetInteraction.user,
          guild: resetInteraction.guild
        };
        await this.showConfigInterface(mockMessage, config);
      }
    });
  },

  async showAntibanRoleConfig(interaction, originalMessage, config) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Configurar Cargo Antiban')
      .setDescription('Selecione o cargo que será dado automaticamente pelo botão Antiban')
      .addFields({
        name: 'Cargo Atual',
        value: config.antibanRoleId ? `<@&${config.antibanRoleId}>` : 'Nenhum cargo configurado',
        inline: false
      })
      .setFooter({ text: 'Selecione o cargo abaixo' });

    const roleMenu = new RoleSelectMenuBuilder()
      .setCustomId(`config_antiban_role_${interaction.user.id}`)
      .setPlaceholder('Selecione o cargo antiban...')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para role
    const roleCollector = originalMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('config_antiban_role_'),
      time: 300000
    });

    roleCollector.on('collect', async (roleInteraction) => {
      try {
        const selectedRole = roleInteraction.values[0];
        
        // Atualizar configuração
        await PanelaConfig.setAntibanRole(interaction.guild.id, selectedRole);
        
        // Buscar configuração atualizada
        const updatedConfig = await PanelaConfig.getConfig(interaction.guild.id);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Cargo Antiban Configurado')
          .setDescription('O cargo antiban foi configurado com sucesso!')
          .addFields({
            name: 'Cargo Configurado',
            value: `<@&${selectedRole}>`,
            inline: false
          })
          .setTimestamp();

        try {
          await roleInteraction.update({
            embeds: [successEmbed],
            components: []
          });
        } catch (updateError) {
          console.error('Erro ao atualizar interação de cargo antiban:', updateError);
          
          // Se não conseguir atualizar, tentar responder
          if (!roleInteraction.replied) {
            try {
              await roleInteraction.followUp({
                embeds: [successEmbed],
                ephemeral: true
              });
            } catch (followUpError) {
              console.error('Erro ao fazer follow-up antiban:', followUpError);
            }
          }
        }

        // Voltar ao menu principal após 3 segundos
        setTimeout(async () => {
          const mockMessage = { 
            reply: (options) => originalMessage.edit(options),
            author: roleInteraction.user,
            guild: roleInteraction.guild
          };
          await this.showConfigInterface(mockMessage, updatedConfig);
        }, 3000);

      } catch (error) {
        console.error('Erro ao configurar cargo antiban:', error);
        await roleInteraction.reply({
          content: 'Erro ao salvar configurações. Tente novamente.',
          ephemeral: true
        });
      }
    });
  },

  async showPrimeiraDamaRoleConfig(interaction, originalMessage, config) {
    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setTitle('Configurar Cargo Primeira Dama')
      .setDescription('Selecione o cargo que será dado automaticamente pelo botão Primeira Dama')
      .addFields({
        name: 'Cargo Atual',
        value: config.primeiraDamaRoleId ? `<@&${config.primeiraDamaRoleId}>` : 'Nenhum cargo configurado',
        inline: false
      })
      .setFooter({ text: 'Selecione o cargo abaixo' });

    const roleMenu = new RoleSelectMenuBuilder()
      .setCustomId(`config_primeira_dama_role_${interaction.user.id}`)
      .setPlaceholder('Selecione o cargo primeira dama...')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    // Collector para role
    const roleCollector = originalMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('config_primeira_dama_role_'),
      time: 300000
    });

    roleCollector.on('collect', async (roleInteraction) => {
      try {
        const selectedRole = roleInteraction.values[0];
        
        // Atualizar configuração
        await PanelaConfig.setPrimeiraDamaRole(interaction.guild.id, selectedRole);
        
        // Buscar configuração atualizada
        const updatedConfig = await PanelaConfig.getConfig(interaction.guild.id);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Cargo Primeira Dama Configurado')
          .setDescription('O cargo primeira dama foi configurado com sucesso!')
          .addFields({
            name: 'Cargo Configurado',
            value: `<@&${selectedRole}>`,
            inline: false
          })
          .setTimestamp();

        try {
          await roleInteraction.update({
            embeds: [successEmbed],
            components: []
          });
        } catch (updateError) {
          console.error('Erro ao atualizar interação de cargo primeira dama:', updateError);
          
          // Se não conseguir atualizar, tentar responder
          if (!roleInteraction.replied) {
            try {
              await roleInteraction.followUp({
                embeds: [successEmbed],
                ephemeral: true
              });
            } catch (followUpError) {
              console.error('Erro ao fazer follow-up primeira dama:', followUpError);
            }
          }
        }

        // Voltar ao menu principal após 3 segundos
        setTimeout(async () => {
          const mockMessage = { 
            reply: (options) => originalMessage.edit(options),
            author: roleInteraction.user,
            guild: roleInteraction.guild
          };
          await this.showConfigInterface(mockMessage, updatedConfig);
        }, 3000);

      } catch (error) {
        console.error('Erro ao configurar cargo primeira dama:', error);
        await roleInteraction.reply({
          content: 'Erro ao salvar configurações. Tente novamente.',
          ephemeral: true
        });
      }
    });
  }
};
const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder } = require('discord.js');

module.exports = {
  name: 'config-logs',
  description: 'Configura canais de log para banimentos e desbanimentos',
  async execute(message, args, client, serverPrefix, setServerPrefix, getServerConfig, setLogChannel) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Você precisa ter permissão de Administrador para usar este comando.');
    }

    // Mostrar interface de configuração com menus
    let config;
    try {
      const ServerConfig = require('../database/models/ServerConfig');
      config = await ServerConfig.getServerConfig(message.guild.id);
    } catch (error) {
      console.error('Erro ao buscar config do banco:', error);
      config = getServerConfig(message.guild.id) || { logChannels: {} };
    }
    
    // Garantir que logChannels existe
    if (!config.logChannels) {
      config.logChannels = {};
    }
    
    const embed = new EmbedBuilder()
      .setColor('#bbffc3')
      .setTitle('Sistema de Configuração de Logs')
      .setDescription('Configure canais para logs de moderação usando os menus abaixo')
      .addFields(
        {
          name: 'Configurações Atuais',
          value: getCurrentConfig(message.guild, config),
          inline: false
        },
        {
          name: 'Como usar',
          value: '1. Selecione o tipo de log no primeiro menu\n2. Escolha o canal no segundo menu\n3. Configuração será aplicada automaticamente',
          inline: false
        }
      )
      .setFooter({ text: 'Sistema de Configuração de Logs | Timeout: 5 minutos' })
      .setTimestamp();

    // Menu de seleção de tipo de log
    const logTypeMenu = new StringSelectMenuBuilder()
      .setCustomId(`config_log_type_${message.author.id}`)
      .setPlaceholder('Selecione o tipo de log para configurar')
      .addOptions([
        {
          label: 'Logs de Banimentos',
          value: 'ban',
          description: 'Canal para registrar banimentos de usuários'
        },
        {
          label: 'Logs de Desbanimentos', 
          value: 'unban',
          description: 'Canal para registrar desbanimentos de usuários'
        },
        {
          label: 'Logs de Moderação Geral',
          value: 'moderation',
          description: 'Canal geral para logs de moderação (fallback)'
        },
        {
          label: 'Logs de Mute',
          value: 'mute',
          description: 'Canal para registrar ações de mute de usuários'
        },
        {
          label: 'Logs de Unmute',
          value: 'unmute',
          description: 'Canal para registrar ações de unmute de usuários'
        },
        {
          label: 'Logs de Blacklist',
          value: 'blacklist',
          description: 'Canal para logs de blacklist e proteções automáticas'
        },
        {
          label: 'Logs de Primeira Dama',
          value: 'primeira_dama',
          description: 'Canal para logs do sistema de primeira dama'
        },
        {
          label: 'Logs de Panela',
          value: 'panela',
          description: 'Canal para logs do sistema de panela'
        },
        {
          label: 'Desativar Logs',
          value: 'disable',
          description: 'Remover configuração de logs'
        }
      ]);

    // Menu de seleção de canal (desabilitado inicialmente)
    const channelMenu = new ChannelSelectMenuBuilder()
      .setCustomId(`config_log_channel_${message.author.id}`)
      .setPlaceholder('Primeiro selecione o tipo de log acima')
      .addChannelTypes(ChannelType.GuildText)
      .setDisabled(true);

    const logTypeRow = new ActionRowBuilder().addComponents(logTypeMenu);
    const channelRow = new ActionRowBuilder().addComponents(channelMenu);

    const response = await message.reply({ 
      embeds: [embed], 
      components: [logTypeRow, channelRow]
    });

    // Configurar coletores para os menus
    setupCollectors(response, message, getServerConfig, setLogChannel);
  },

};

function getCurrentConfig(guild, config) {
    const logChannels = config?.logChannels || {};
    let configText = '';

    const logTypes = [
      { key: 'ban', name: 'Banimentos' },
      { key: 'unban', name: 'Desbanimentos' },
      { key: 'moderation', name: 'Moderação Geral' },
      { key: 'mute', name: 'Mutes' },
      { key: 'unmute', name: 'Unmutes' },
      { key: 'blacklist', name: 'Blacklist' },
      { key: 'primeira_dama', name: 'Primeira Dama' }
    ];

    for (const logType of logTypes) {
      const channelId = logChannels[logType.key];
      if (channelId) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          configText += `${logType.name}: ${channel}\n`;
        } else {
          configText += `${logType.name}: Canal removido (ID: ${channelId})\n`;
        }
      } else {
        configText += `${logType.name}: Não configurado\n`;
      }
    }

    return configText || 'Nenhuma configuração definida';
}

function setupCollectors(response, originalMessage, getServerConfig, setLogChannel) {
    let selectedLogType = null;

    // Coletor para seleção de tipo de log
    const logTypeCollector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.customId.startsWith('config_log_type_') && interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    // Coletor para seleção de canal
    const channelCollector = response.createMessageComponentCollector({
      filter: (interaction) => interaction.customId.startsWith('config_log_channel_') && interaction.user.id === originalMessage.author.id,
      time: 300000 // 5 minutos
    });

    logTypeCollector.on('collect', async (interaction) => {
      selectedLogType = interaction.values[0];

      if (selectedLogType === 'disable') {
        // Mostrar menu para desativar logs
        await showDisableMenu(interaction, originalMessage, getServerConfig, setLogChannel);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('Tipo de Log Selecionado')
        .setDescription(`Tipo selecionado: **${getLogTypeName(selectedLogType)}**`)
        .addFields({
          name: 'Próximo Passo',
          value: 'Agora selecione o canal no menu abaixo onde os logs serão enviados.',
          inline: false
        })
        .setTimestamp();

      // Habilitar menu de canal
      const newChannelMenu = new ChannelSelectMenuBuilder()
        .setCustomId(`config_log_channel_${originalMessage.author.id}`)
        .setPlaceholder('Selecione o canal para os logs')
        .addChannelTypes(ChannelType.GuildText)
        .setDisabled(false);

      const logTypeRow = interaction.message.components[0];
      const channelRow = new ActionRowBuilder().addComponents(newChannelMenu);

      await interaction.update({ 
        embeds: [embed], 
        components: [logTypeRow, channelRow]
      });
    });

    channelCollector.on('collect', async (interaction) => {
      if (!selectedLogType) {
        await interaction.reply({ 
          content: 'Por favor, primeiro selecione o tipo de log.',
          ephemeral: true 
        });
        return;
      }

      const channelId = interaction.values[0];
      const channel = originalMessage.guild.channels.cache.get(channelId);

      // Verificar permissões do bot no canal
      const botPermissions = channel.permissionsFor(originalMessage.guild.members.me);
      if (!botPermissions.has('SendMessages') || !botPermissions.has('EmbedLinks')) {
        await interaction.reply({
          content: 'O bot precisa ter permissões para enviar mensagens e embeds no canal escolhido.',
          ephemeral: true
        });
        return;
      }

      // Configurar o canal
      setLogChannel(originalMessage.guild.id, selectedLogType, channelId);

      const successEmbed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Configuração Concluída')
        .addFields(
          { name: 'Tipo de Log', value: getLogTypeName(selectedLogType), inline: true },
          { name: 'Canal Configurado', value: `${channel}`, inline: true },
          { name: 'Status', value: 'Ativo', inline: true }
        )
        .setFooter({ text: 'Sistema de Configuração de Logs | Configuração salva' })
        .setTimestamp();

      // Enviar teste no canal configurado
      try {
        const testEmbed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Teste de Configuração de Log')
          .setDescription(`Este canal foi configurado para receber logs de **${getLogTypeName(selectedLogType)}**.`)
          .addFields(
            { name: 'Servidor', value: originalMessage.guild.name, inline: true },
            { name: 'Configurado por', value: originalMessage.author.tag, inline: true }
          )
          .setTimestamp();

        await channel.send({ embeds: [testEmbed] });
      } catch (error) {
        console.log(`Erro ao enviar teste no canal de log: ${error.message}`);
      }

      await interaction.update({ 
        embeds: [successEmbed], 
        components: []
      });
    });

    // Timeout dos coletores
    logTypeCollector.on('end', () => console.log('Coletor de configuração de logs finalizado'));
    channelCollector.on('end', () => console.log('Coletor de canal de logs finalizado'));
}

async function showDisableMenu(interaction, originalMessage, getServerConfig, setLogChannel) {
    const embed = new EmbedBuilder()
      .setColor('#ffa500')
      .setTitle('Desativar Logs')
      .setDescription('Selecione qual tipo de log deseja desativar')
      .setTimestamp();

    const disableMenu = new StringSelectMenuBuilder()
      .setCustomId(`disable_log_type_${originalMessage.author.id}`)
      .setPlaceholder('Selecione o tipo de log para desativar')
      .addOptions([
        {
          label: 'Desativar Logs de Banimentos',
          value: 'ban',
          description: 'Remove configuração de logs de banimentos'
        },
        {
          label: 'Desativar Logs de Desbanimentos',
          value: 'unban', 
          description: 'Remove configuração de logs de desbanimentos'
        },
        {
          label: 'Desativar Logs de Moderação',
          value: 'moderation',
          description: 'Remove configuração de logs gerais'
        },
        {
          label: 'Desativar Logs de Mute',
          value: 'mute',
          description: 'Remove configuração de logs de mute'
        },
        {
          label: 'Desativar Logs de Unmute',
          value: 'unmute',
          description: 'Remove configuração de logs de unmute'
        },
        {
          label: 'Desativar Logs de Blacklist',
          value: 'blacklist',
          description: 'Remove configuração de logs de blacklist'
        },
        {
          label: 'Desativar Logs de Primeira Dama',
          value: 'primeira_dama',
          description: 'Remove configuração de logs de primeira dama'
        },
        {
          label: 'Desativar Logs de Panela',
          value: 'panela',
          description: 'Remove configuração de logs de panela'
        },
        {
          label: 'Desativar Todos os Logs',
          value: 'all',
          description: 'Remove todas as configurações de logs'
        }
      ]);

    const disableRow = new ActionRowBuilder().addComponents(disableMenu);

    await interaction.update({ 
      embeds: [embed], 
      components: [disableRow]
    });

    // Coletor para desativação
    const disableCollector = interaction.message.createMessageComponentCollector({
      filter: (disableInteraction) => disableInteraction.customId.startsWith('disable_log_type_') && disableInteraction.user.id === originalMessage.author.id,
      time: 300000
    });

    disableCollector.on('collect', async (disableInteraction) => {
      const typeToDisable = disableInteraction.values[0];

      if (typeToDisable === 'all') {
        setLogChannel(originalMessage.guild.id, 'ban', null);
        setLogChannel(originalMessage.guild.id, 'unban', null);
        setLogChannel(originalMessage.guild.id, 'moderation', null);
        setLogChannel(originalMessage.guild.id, 'mute', null);
        setLogChannel(originalMessage.guild.id, 'unmute', null);
        setLogChannel(originalMessage.guild.id, 'blacklist', null);
        setLogChannel(originalMessage.guild.id, 'primeira_dama', null);
      } else {
        setLogChannel(originalMessage.guild.id, typeToDisable, null);
      }

      const disabledEmbed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Logs Desativados')
        .setDescription(typeToDisable === 'all' ? 
          'Todos os logs foram desativados neste servidor.' :
          `Logs de **${getLogTypeName(typeToDisable)}** foram desativados.`)
        .setTimestamp();

      await disableInteraction.update({ 
        embeds: [disabledEmbed], 
        components: []
      });
    });
}

function getLogTypeName(logType) {
    const names = {
      'ban': 'Banimentos',
      'unban': 'Desbanimentos',
      'moderation': 'Moderação Geral',
      'mute': 'Mutes',
      'unmute': 'Unmutes',
      'blacklist': 'Blacklist',
      'primeira_dama': 'Primeira Dama',
      'panela': 'Panela'
    };
    return names[logType] || logType;
}
const Blacklist = require('./Blacklist');
const ModerationLog = require('./ModerationLog');

class BlacklistProtection {
  // Inicializar proteção contra desbans
  static initializeProtection(client) {
    console.log('🛡️ Inicializando proteção de blacklist...');
    
    // Listener para eventos de desban
    client.on('guildBanRemove', async (ban) => {
      try {
        await this.handleUnbanAttempt(ban);
      } catch (error) {
        console.error('Erro na proteção de blacklist:', error);
      }
    });

    console.log('✅ Proteção de blacklist ativada');
  }

  // Verificar e reverter tentativas de desban de usuários na blacklist
  static async handleUnbanAttempt(ban) {
    const { guild, user } = ban;
    
    console.log(`🔍 Verificando desban: ${user.tag} (${user.id}) no servidor ${guild.name}`);
    
    try {
      // Verificar se usuário está na blacklist
      const blacklistEntry = await Blacklist.isBlacklisted(guild.id, user.id);
      
      if (!blacklistEntry) {
        console.log(`✅ Desban permitido: ${user.tag} não está na blacklist`);
        return;
      }

      console.log(`🚫 Desban bloqueado: ${user.tag} está na blacklist`);

      // Re-banir o usuário imediatamente
      await this.rebanUser(guild, user, blacklistEntry);
      
      // Log da proteção ativada
      await this.logProtectionActivated(guild, user, blacklistEntry);
      
    } catch (error) {
      console.error(`Erro ao processar desban de ${user.tag}:`, error);
    }
  }

  // Re-banir usuário que está na blacklist
  static async rebanUser(guild, user, blacklistEntry) {
    try {
      const reason = `[BLACKLIST] Proteção automática ativada - Motivo original: ${blacklistEntry.reason || 'Sem motivo especificado'}`;
      
      await guild.members.ban(user.id, {
        reason: reason,
        deleteMessageDays: 0 // Não deletar mensagens na proteção automática
      });

      console.log(`🔒 Usuário re-banido automaticamente: ${user.tag}`);
      
      // Enviar notificação para canal de logs
      await this.sendProtectionNotification(guild, user, blacklistEntry, 'AUTO_REBAN');
      
    } catch (error) {
      console.error(`Erro ao re-banir ${user.tag}:`, error);
      
      // Se falhar o re-ban, enviar alerta crítico
      await this.sendCriticalAlert(guild, user, blacklistEntry, error);
    }
  }

  // Log da ativação da proteção
  static async logProtectionActivated(guild, user, blacklistEntry) {
    try {
      await ModerationLog.log(
        guild.id,
        user.id,
        'SYSTEM', // ID do sistema
        'BLACKLIST_PROTECTION',
        `Proteção ativada - usuário re-banido automaticamente. Motivo original: ${blacklistEntry.reason || 'Sem motivo'}`
      );
    } catch (error) {
      console.error('Erro ao registrar log de proteção:', error);
    }
  }

  // Enviar notificação de proteção ativada
  static async sendProtectionNotification(guild, user, blacklistEntry, action) {
    try {
      const { EmbedBuilder } = require('discord.js');
      const ServerConfig = require('./ServerConfig');
      
      const config = await ServerConfig.getServerConfig(guild.id);
      const logChannelId = config.logChannels.blacklist || config.logChannels.moderation;

      if (!logChannelId) {
        console.log('Nenhum canal de log configurado para blacklist');
        return;
      }

      const logChannel = guild.channels.cache.get(logChannelId);
      if (!logChannel) {
        console.log(`Canal de log não encontrado: ${logChannelId}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🛡️ Proteção de Blacklist Ativada')
        .setDescription('Um usuário na blacklist foi automaticamente re-banido após tentativa de desban')
        .addFields(
          { name: 'Usuário Protegido', value: `${user.tag}\n${user.id}`, inline: true },
          { name: 'Ação', value: action === 'AUTO_REBAN' ? 'Re-banimento Automático' : 'Proteção Ativada', inline: true },
          { name: 'Status', value: 'Blacklist mantida', inline: true },
          { name: 'Motivo Original da Blacklist', value: blacklistEntry.reason || 'Sem motivo especificado', inline: false },
          { name: 'Adicionado à Blacklist por', value: blacklistEntry.added_by_tag || 'Desconhecido', inline: true },
          { name: 'Data da Blacklist', value: `<t:${Math.floor(new Date(blacklistEntry.added_at).getTime() / 1000)}:F>`, inline: true }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Proteção de Blacklist' })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
      console.log(`Notificação de proteção enviada para ${logChannel.name}`);

    } catch (error) {
      console.error('Erro ao enviar notificação de proteção:', error);
    }
  }

  // Enviar alerta crítico se não conseguir re-banir
  static async sendCriticalAlert(guild, user, blacklistEntry, error) {
    try {
      const { EmbedBuilder } = require('discord.js');
      const ServerConfig = require('./ServerConfig');
      
      const config = await ServerConfig.getServerConfig(guild.id);
      const logChannelId = config.logChannels.blacklist || config.logChannels.moderation;

      if (!logChannelId) {
        console.log('Nenhum canal de log configurado para alerta crítico');
        return;
      }

      const logChannel = guild.channels.cache.get(logChannelId);
      if (!logChannel) {
        console.log(`Canal de log não encontrado para alerta crítico: ${logChannelId}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🚨 ALERTA CRÍTICO - Falha na Proteção de Blacklist')
        .setDescription('Não foi possível re-banir um usuário da blacklist automaticamente!')
        .addFields(
          { name: 'Usuário', value: `${user.tag}\n${user.id}`, inline: true },
          { name: 'Status', value: '⚠️ DESBANIDO (BLACKLIST ATIVA)', inline: true },
          { name: 'Ação Necessária', value: 'Banir manualmente o usuário', inline: true },
          { name: 'Motivo da Blacklist', value: blacklistEntry.reason || 'Sem motivo especificado', inline: false },
          { name: 'Erro', value: error.message || 'Erro desconhecido', inline: false }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Proteção de Blacklist - AÇÃO MANUAL NECESSÁRIA' })
        .setTimestamp();

      await logChannel.send({ 
        content: '@here **ATENÇÃO MODERADORES**', 
        embeds: [embed] 
      });
      
      console.log(`🚨 Alerta crítico enviado para ${logChannel.name}`);

    } catch (error) {
      console.error('Erro ao enviar alerta crítico:', error);
    }
  }

  // Verificar se desban é permitido (para uso em comandos)
  static async isUnbanAllowed(guildId, userId) {
    try {
      const blacklistEntry = await Blacklist.isBlacklisted(guildId, userId);
      return !blacklistEntry; // Permitido se NÃO estiver na blacklist
    } catch (error) {
      console.error('Erro ao verificar permissão de desban:', error);
      return false; // Em caso de erro, negar por segurança
    }
  }

  // Verificar blacklist com informações detalhadas
  static async checkBlacklistStatus(guildId, userId) {
    try {
      const blacklistEntry = await Blacklist.isBlacklisted(guildId, userId);
      
      if (blacklistEntry) {
        return {
          isBlacklisted: true,
          entry: blacklistEntry,
          canUnban: false,
          reason: blacklistEntry.reason || 'Sem motivo especificado'
        };
      }
      
      return {
        isBlacklisted: false,
        entry: null,
        canUnban: true,
        reason: null
      };
    } catch (error) {
      console.error('Erro ao verificar status da blacklist:', error);
      return {
        isBlacklisted: true, // Por segurança, assumir que está na blacklist em caso de erro
        entry: null,
        canUnban: false,
        reason: 'Erro ao verificar blacklist'
      };
    }
  }
}

module.exports = BlacklistProtection;
const { query } = require('../connection');

class MuteManager {
  constructor() {
    this.activeTimers = new Map(); // Armazena timers ativos em memória
  }

  // Criar um mute temporário
  async createMute(guildId, userId, moderatorId, durationMs, reason) {
    try {
      const expiresAt = new Date(Date.now() + durationMs);
      
      const result = await query(`
        INSERT INTO temporary_mutes (guild_id, user_id, moderator_id, expires_at, reason, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id, expires_at
      `, [guildId, userId, moderatorId, expiresAt, reason]);

      const muteId = result.rows[0].id;
      
      // Programar unmute automático
      this.scheduleUnmute(muteId, guildId, userId, durationMs);
      
      console.log(`✅ Mute criado: ${userId} no servidor ${guildId} por ${durationMs}ms`);
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao criar mute:', error);
      return null;
    }
  }

  // Programar unmute automático
  scheduleUnmute(muteId, guildId, userId, durationMs) {
    // Limpar timer existente se houver
    if (this.activeTimers.has(muteId)) {
      clearTimeout(this.activeTimers.get(muteId));
    }

    // Criar novo timer
    const timer = setTimeout(async () => {
      await this.executeAutoUnmute(muteId, guildId, userId);
      this.activeTimers.delete(muteId);
    }, durationMs);

    this.activeTimers.set(muteId, timer);
    console.log(`⏰ Timer de unmute agendado para ${new Date(Date.now() + durationMs).toLocaleString()}`);
  }

  // Executar unmute automático
  async executeAutoUnmute(muteId, guildId, userId) {
    try {
      console.log(`Executando unmute automático: ${userId} no servidor ${guildId}`);
      
      // Obter cliente do Discord (será passado pelo index.js)
      const client = require('../../index').client;
      if (!client) {
        console.error('Cliente Discord não disponível para unmute automático');
        return;
      }

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        console.error(`Servidor ${guildId} não encontrado para unmute automático`);
        return;
      }

      const member = guild.members.cache.get(userId);
      if (!member) {
        console.error(`Membro ${userId} não encontrado no servidor ${guildId}`);
        await this.markMuteAsInactive(muteId);
        return;
      }

      // Remover timeout do Discord
      await member.timeout(null, 'Tempo de mute expirado - unmute automático');
      
      // Marcar mute como inativo no banco
      await this.markMuteAsInactive(muteId);

      // Enviar notificação em canal de logs se configurado
      await this.sendUnmuteNotification(guild, member, 'automático');

      console.log(`✅ Unmute automático executado com sucesso: ${member.user.tag}`);
    } catch (error) {
      console.error('Erro no unmute automático:', error);
      // Tentar marcar como inativo mesmo com erro
      await this.markMuteAsInactive(muteId);
    }
  }

  // Marcar mute como inativo
  async markMuteAsInactive(muteId) {
    try {
      await query(`
        UPDATE temporary_mutes 
        SET is_active = false, unmuted_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [muteId]);
    } catch (error) {
      console.error('Erro ao marcar mute como inativo:', error);
    }
  }

  // Remover mute manualmente
  async removeMute(guildId, userId, moderatorId, reason = 'Unmute manual') {
    try {
      // Encontrar mute ativo
      const result = await query(`
        SELECT id FROM temporary_mutes 
        WHERE guild_id = $1 AND user_id = $2 AND is_active = true
        ORDER BY created_at DESC LIMIT 1
      `, [guildId, userId]);

      if (result.rows.length === 0) {
        return { success: false, message: 'Nenhum mute ativo encontrado para este usuário' };
      }

      const muteId = result.rows[0].id;

      // Cancelar timer se existir
      if (this.activeTimers.has(muteId)) {
        clearTimeout(this.activeTimers.get(muteId));
        this.activeTimers.delete(muteId);
      }

      // Marcar como inativo
      await this.markMuteAsInactive(muteId);

      console.log(`✅ Mute removido manualmente: ${userId} no servidor ${guildId}`);
      return { success: true, muteId };
    } catch (error) {
      console.error('Erro ao remover mute:', error);
      return { success: false, message: 'Erro interno ao remover mute' };
    }
  }

  // Enviar notificação de unmute
  async sendUnmuteNotification(guild, member, type) {
    try {
      const ServerConfig = require('./ServerConfig');
      const config = await ServerConfig.getServerConfig(guild.id);
      
      if (!config.logChannels.moderation) return;

      const channel = guild.channels.cache.get(config.logChannels.moderation);
      if (!channel) return;

      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setColor('#bbffc3')
        .setTitle('Log de Unmute Automático')
        .setDescription('Um usuário foi automaticamente desmutado pelo sistema')
        .addFields(
          { name: 'Usuário Desmutado', value: `${member.user.tag}\n${member.user.id}`, inline: true },
          { name: 'Tipo', value: type === 'automático' ? 'Unmute Automático' : 'Unmute Manual', inline: true },
          { name: 'Sistema', value: 'Container expirado', inline: true },
          { name: 'Data/Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Logs de Moderação' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log(`Log de unmute automático enviado para ${channel.name}`);
    } catch (error) {
      console.error('Erro ao enviar notificação de unmute:', error);
    }
  }

  // Carregar mutes ativos na inicialização
  async loadActiveMutes(client) {
    try {
      console.log('🔄 Carregando mutes ativos...');
      
      const result = await query(`
        SELECT id, guild_id, user_id, expires_at 
        FROM temporary_mutes 
        WHERE is_active = true AND expires_at > CURRENT_TIMESTAMP
      `);

      let loaded = 0;
      for (const mute of result.rows) {
        const timeLeft = new Date(mute.expires_at) - new Date();
        
        if (timeLeft > 0) {
          this.scheduleUnmute(mute.id, mute.guild_id, mute.user_id, timeLeft);
          loaded++;
        } else {
          // Mute já deveria ter expirado, marcar como inativo
          await this.markMuteAsInactive(mute.id);
        }
      }

      console.log(`✅ ${loaded} mutes ativos carregados e timers reativados`);
    } catch (error) {
      console.error('Erro ao carregar mutes ativos:', error);
    }
  }

  // Listar mutes ativos de um servidor
  async getActiveMutes(guildId) {
    try {
      const result = await query(`
        SELECT tm.*, u.username, u.discriminator
        FROM temporary_mutes tm
        LEFT JOIN users u ON tm.user_id = u.user_id
        WHERE tm.guild_id = $1 AND tm.is_active = true
        ORDER BY tm.expires_at ASC
      `, [guildId]);

      return result.rows;
    } catch (error) {
      console.error('Erro ao listar mutes ativos:', error);
      return [];
    }
  }

  // Limpar timers ao desligar
  clearAllTimers() {
    console.log(`🧹 Limpando ${this.activeTimers.size} timers de mute...`);
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }
}

module.exports = new MuteManager();
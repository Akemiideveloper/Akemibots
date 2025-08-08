const { query } = require('../connection');

class ModerationLog {
  // Criar log de moderação
  async createLog(guildId, userId, moderatorId, actionType, reason, metadata = {}) {
    try {
      const result = await query(`
        INSERT INTO moderation_logs (guild_id, user_id, moderator_id, action_type, reason, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
      `, [guildId, userId, moderatorId, actionType, reason, JSON.stringify(metadata)]);

      console.log(`Log de moderação criado: ${actionType} - ${userId} por ${moderatorId}`);
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao criar log de moderação:', error);
      return null;
    }
  }

  // Buscar logs por servidor
  async getLogsByGuild(guildId, limit = 50, offset = 0) {
    try {
      const result = await query(`
        SELECT ml.*, u.username, u.discriminator
        FROM moderation_logs ml
        LEFT JOIN users u ON ml.user_id = u.user_id
        WHERE ml.guild_id = $1
        ORDER BY ml.created_at DESC
        LIMIT $2 OFFSET $3
      `, [guildId, limit, offset]);

      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar logs por servidor:', error);
      return [];
    }
  }

  // Buscar logs por usuário
  async getLogsByUser(guildId, userId, limit = 20) {
    try {
      const result = await query(`
        SELECT * FROM moderation_logs
        WHERE guild_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      `, [guildId, userId, limit]);

      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar logs por usuário:', error);
      return [];
    }
  }

  // Buscar logs por tipo de ação
  async getLogsByAction(guildId, actionType, limit = 30) {
    try {
      const result = await query(`
        SELECT ml.*, u.username, u.discriminator
        FROM moderation_logs ml
        LEFT JOIN users u ON ml.user_id = u.user_id
        WHERE ml.guild_id = $1 AND ml.action_type = $2
        ORDER BY ml.created_at DESC
        LIMIT $3
      `, [guildId, actionType, limit]);

      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar logs por ação:', error);
      return [];
    }
  }

  // Contar logs por servidor
  async countLogsByGuild(guildId) {
    try {
      const result = await query(`
        SELECT COUNT(*) as total FROM moderation_logs
        WHERE guild_id = $1
      `, [guildId]);

      return parseInt(result.rows[0].total);
    } catch (error) {
      console.error('Erro ao contar logs:', error);
      return 0;
    }
  }

  // Estatísticas de moderação
  async getModerationStats(guildId, days = 30) {
    try {
      const result = await query(`
        SELECT 
          action_type,
          COUNT(*) as count
        FROM moderation_logs
        WHERE guild_id = $1 
        AND created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY action_type
        ORDER BY count DESC
      `, [guildId]);

      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return [];
    }
  }

  // Limpar logs antigos (opcional)
  async cleanOldLogs(daysOld = 365) {
    try {
      const result = await query(`
        DELETE FROM moderation_logs
        WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      `);

      console.log(`${result.rowCount} logs antigos removidos`);
      return result.rowCount;
    } catch (error) {
      console.error('Erro ao limpar logs antigos:', error);
      return 0;
    }
  }
}

module.exports = new ModerationLog();
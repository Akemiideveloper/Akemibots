const { query } = require('../connection');

class Blacklist {
  // Adicionar usuário à blacklist
  static async addUser(guildId, userId, userTag, reason, addedById, addedByTag) {
    try {
      const result = await query(`
        INSERT INTO blacklist (guild_id, user_id, user_tag, reason, added_by_id, added_by_tag)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (guild_id, user_id) 
        DO UPDATE SET 
          reason = EXCLUDED.reason,
          added_by_id = EXCLUDED.added_by_id,
          added_by_tag = EXCLUDED.added_by_tag,
          added_at = CURRENT_TIMESTAMP,
          is_active = TRUE
        RETURNING *
      `, [guildId, userId, userTag, reason, addedById, addedByTag]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao adicionar usuário à blacklist:', error);
      throw error;
    }
  }

  // Remover usuário da blacklist
  static async removeUser(guildId, userId) {
    try {
      const result = await query(`
        UPDATE blacklist 
        SET is_active = FALSE 
        WHERE guild_id = $1 AND user_id = $2 AND is_active = TRUE
        RETURNING *
      `, [guildId, userId]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao remover usuário da blacklist:', error);
      throw error;
    }
  }

  // Verificar se usuário está na blacklist
  static async isBlacklisted(guildId, userId) {
    try {
      const result = await query(`
        SELECT * FROM blacklist 
        WHERE guild_id = $1 AND user_id = $2 AND is_active = TRUE
      `, [guildId, userId]);
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Erro ao verificar blacklist:', error);
      return null;
    }
  }

  // Listar usuários na blacklist
  static async getBlacklistedUsers(guildId, limit = 50, offset = 0) {
    try {
      const result = await query(`
        SELECT * FROM blacklist 
        WHERE guild_id = $1 AND is_active = TRUE
        ORDER BY added_at DESC
        LIMIT $2 OFFSET $3
      `, [guildId, limit, offset]);
      
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar usuários da blacklist:', error);
      return [];
    }
  }

  // Contar usuários na blacklist
  static async getBlacklistCount(guildId) {
    try {
      const result = await query(`
        SELECT COUNT(*) as count 
        FROM blacklist 
        WHERE guild_id = $1 AND is_active = TRUE
      `, [guildId]);
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Erro ao contar blacklist:', error);
      return 0;
    }
  }

  // Buscar usuário específico na blacklist
  static async getBlacklistEntry(guildId, userId) {
    try {
      const result = await query(`
        SELECT * FROM blacklist 
        WHERE guild_id = $1 AND user_id = $2 AND is_active = TRUE
      `, [guildId, userId]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erro ao buscar entrada da blacklist:', error);
      return null;
    }
  }

  // Limpar blacklist inteira (apenas para emergências)
  static async clearBlacklist(guildId) {
    try {
      const result = await query(`
        UPDATE blacklist 
        SET is_active = FALSE 
        WHERE guild_id = $1 AND is_active = TRUE
        RETURNING COUNT(*) as cleared
      `, [guildId]);
      
      return result.rows[0].cleared;
    } catch (error) {
      console.error('Erro ao limpar blacklist:', error);
      throw error;
    }
  }
}

module.exports = Blacklist;
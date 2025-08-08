const { query } = require('../connection');

class PrimeiraDama {
  // Definir primeira dama de um usuário
  static async setPrimeiraDama(guildId, userId, primeiraDamaId, userTag, primeiraDamaTag) {
    try {
      const result = await query(`
        INSERT INTO primeira_dama (guild_id, user_id, primeira_dama_id, user_tag, primeira_dama_tag)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (guild_id, user_id) 
        DO UPDATE SET 
          primeira_dama_id = EXCLUDED.primeira_dama_id,
          primeira_dama_tag = EXCLUDED.primeira_dama_tag,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [guildId, userId, primeiraDamaId, userTag, primeiraDamaTag]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao definir primeira dama:', error);
      throw error;
    }
  }

  // Buscar primeira dama de um usuário
  static async getPrimeiraDama(guildId, userId) {
    try {
      const result = await query(`
        SELECT * FROM primeira_dama 
        WHERE guild_id = $1 AND user_id = $2
      `, [guildId, userId]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erro ao buscar primeira dama:', error);
      return null;
    }
  }

  // Buscar todos os usuários que têm uma pessoa como primeira dama
  static async getQuemTemComoPrimeiraDama(guildId, primeiraDamaId) {
    try {
      const result = await query(`
        SELECT * FROM primeira_dama 
        WHERE guild_id = $1 AND primeira_dama_id = $2
        ORDER BY created_at DESC
      `, [guildId, primeiraDamaId]);
      
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar quem tem como primeira dama:', error);
      return [];
    }
  }

  // Remover primeira dama de um usuário
  static async removePrimeiraDama(guildId, userId) {
    try {
      const result = await query(`
        DELETE FROM primeira_dama 
        WHERE guild_id = $1 AND user_id = $2
        RETURNING *
      `, [guildId, userId]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erro ao remover primeira dama:', error);
      throw error;
    }
  }

  // Listar todas as primeiras damas de um servidor
  static async getAllPrimeirasDamas(guildId, limit = 50, offset = 0) {
    try {
      const result = await query(`
        SELECT * FROM primeira_dama 
        WHERE guild_id = $1
        ORDER BY updated_at DESC
        LIMIT $2 OFFSET $3
      `, [guildId, limit, offset]);
      
      return result.rows;
    } catch (error) {
      console.error('Erro ao listar primeiras damas:', error);
      return [];
    }
  }

  // Contar primeiras damas de um servidor
  static async countPrimeirasDamas(guildId) {
    try {
      const result = await query(`
        SELECT COUNT(*) as count 
        FROM primeira_dama 
        WHERE guild_id = $1
      `, [guildId]);
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Erro ao contar primeiras damas:', error);
      return 0;
    }
  }

  // Buscar rankings - quem é primeira dama de mais pessoas
  static async getRankingPrimeirasDamas(guildId, limit = 10) {
    try {
      const result = await query(`
        SELECT 
          primeira_dama_id,
          primeira_dama_tag,
          COUNT(*) as count,
          array_agg(user_tag) as usuarios
        FROM primeira_dama 
        WHERE guild_id = $1
        GROUP BY primeira_dama_id, primeira_dama_tag
        ORDER BY count DESC, primeira_dama_tag ASC
        LIMIT $2
      `, [guildId, limit]);
      
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar ranking de primeiras damas:', error);
      return [];
    }
  }
}

module.exports = PrimeiraDama;
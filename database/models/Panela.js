const { query } = require('../connection');

class Panela {
  // Definir panela de um usuário
  static async setPanela(guildId, userId, panelaId, userTag, panelaTag) {
    try {
      const result = await query(`
        INSERT INTO panela (guild_id, user_id, panela_id, user_tag, panela_tag)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (guild_id, user_id) 
        DO UPDATE SET 
          panela_id = EXCLUDED.panela_id,
          panela_tag = EXCLUDED.panela_tag,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [guildId, userId, panelaId, userTag, panelaTag]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao definir panela:', error);
      throw error;
    }
  }

  // Buscar panela de um usuário
  static async getPanela(guildId, userId) {
    try {
      const result = await query(`
        SELECT * FROM panela 
        WHERE guild_id = $1 AND user_id = $2
      `, [guildId, userId]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erro ao buscar panela:', error);
      return null;
    }
  }

  // Buscar todos os usuários que têm uma pessoa como panela
  static async getQuemTemComoPanela(guildId, panelaId) {
    try {
      const result = await query(`
        SELECT * FROM panela 
        WHERE guild_id = $1 AND panela_id = $2
        ORDER BY created_at DESC
      `, [guildId, panelaId]);
      
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar quem tem como panela:', error);
      return [];
    }
  }

  // Remover panela de um usuário
  static async removePanela(guildId, userId) {
    try {
      const result = await query(`
        DELETE FROM panela 
        WHERE guild_id = $1 AND user_id = $2
        RETURNING *
      `, [guildId, userId]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erro ao remover panela:', error);
      throw error;
    }
  }

  // Buscar ranking das panelas mais escolhidas
  static async getRankingPanelas(guildId, limit = 10) {
    try {
      const result = await query(`
        SELECT 
          panela_id,
          panela_tag,
          COUNT(*) as count
        FROM panela 
        WHERE guild_id = $1
        GROUP BY panela_id, panela_tag
        ORDER BY count DESC, panela_tag ASC
        LIMIT $2
      `, [guildId, limit]);
      
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar ranking de panelas:', error);
      return [];
    }
  }

  // Buscar estatísticas gerais
  static async getEstatisticas(guildId) {
    try {
      const result = await query(`
        SELECT 
          COUNT(DISTINCT user_id) as total_usuarios_com_panela,
          COUNT(DISTINCT panela_id) as total_panelas_unicas,
          COUNT(*) as total_relacoes
        FROM panela 
        WHERE guild_id = $1
      `, [guildId]);
      
      return result.rows[0] || {
        total_usuarios_com_panela: 0,
        total_panelas_unicas: 0,
        total_relacoes: 0
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas de panela:', error);
      return {
        total_usuarios_com_panela: 0,
        total_panelas_unicas: 0,
        total_relacoes: 0
      };
    }
  }

  // Limpar todas as relações de um servidor (útil para reset)
  static async limparTodasPanelas(guildId) {
    try {
      const result = await query(`
        DELETE FROM panela WHERE guild_id = $1
      `, [guildId]);
      
      return result.rowCount;
    } catch (error) {
      console.error('Erro ao limpar panelas:', error);
      throw error;
    }
  }

  // Verificar se usuário já tem panela definida
  static async temPanela(guildId, userId) {
    try {
      const result = await query(`
        SELECT COUNT(*) as count FROM panela 
        WHERE guild_id = $1 AND user_id = $2
      `, [guildId, userId]);
      
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('Erro ao verificar se tem panela:', error);
      return false;
    }
  }
}

module.exports = Panela;
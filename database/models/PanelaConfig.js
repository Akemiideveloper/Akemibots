const { query } = require('../connection');

class PanelaConfig {
  // Cache para configurações
  static cache = new Map();

  // Buscar configuração de panela de um servidor
  static async getConfig(guildId) {
    try {
      // Verificar cache primeiro
      if (this.cache.has(guildId)) {
        return this.cache.get(guildId);
      }

      const result = await query(`
        SELECT * FROM panela_config WHERE guild_id = $1
      `, [guildId]);

      let config;
      if (result.rows.length > 0) {
        const row = result.rows[0];
        config = {
          guildId: row.guild_id,
          allowedRoles: row.allowed_roles || [],
          panelaRoleId: row.panela_role_id,
          antibanRoleId: row.antiban_role_id,
          primeiraDamaRoleId: row.primeira_dama_role_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      } else {
        // Criar configuração padrão se não existir
        config = {
          guildId: guildId,
          allowedRoles: [],
          panelaRoleId: null,
          antibanRoleId: null,
          primeiraDamaRoleId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Salvar configuração padrão no banco
        await this.saveConfig(config);
      }

      // Atualizar cache
      this.cache.set(guildId, config);
      return config;
    } catch (error) {
      console.error('Erro ao carregar configuração de panela:', error);
      
      // Retornar configuração padrão em caso de erro
      const defaultConfig = {
        guildId: guildId,
        allowedRoles: [],
        panelaRoleId: null,
        antibanRoleId: null,
        primeiraDamaRoleId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.cache.set(guildId, defaultConfig);
      return defaultConfig;
    }
  }

  // Salvar configuração no banco
  static async saveConfig(config) {
    try {
      const result = await query(`
        INSERT INTO panela_config (guild_id, allowed_roles, panela_role_id, antiban_role_id, primeira_dama_role_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (guild_id) 
        DO UPDATE SET 
          allowed_roles = EXCLUDED.allowed_roles,
          panela_role_id = EXCLUDED.panela_role_id,
          antiban_role_id = EXCLUDED.antiban_role_id,
          primeira_dama_role_id = EXCLUDED.primeira_dama_role_id,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        config.guildId,
        config.allowedRoles || [],
        config.panelaRoleId,
        config.antibanRoleId,
        config.primeiraDamaRoleId
      ]);

      console.log(`Configuração de panela do servidor ${config.guildId} salva no banco`);
      
      // Atualizar cache
      const savedConfig = {
        guildId: result.rows[0].guild_id,
        allowedRoles: result.rows[0].allowed_roles || [],
        panelaRoleId: result.rows[0].panela_role_id,
        antibanRoleId: result.rows[0].antiban_role_id,
        primeiraDamaRoleId: result.rows[0].primeira_dama_role_id,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at
      };
      
      this.cache.set(config.guildId, savedConfig);
      return savedConfig;
    } catch (error) {
      console.error('Erro ao salvar configuração de panela:', error);
      throw error;
    }
  }

  // Adicionar cargo permitido
  static async addAllowedRole(guildId, roleId) {
    try {
      const config = await this.getConfig(guildId);
      
      if (!config.allowedRoles.includes(roleId)) {
        config.allowedRoles.push(roleId);
        await this.saveConfig(config);
      }
      
      return config;
    } catch (error) {
      console.error('Erro ao adicionar cargo permitido:', error);
      throw error;
    }
  }

  // Remover cargo permitido
  static async removeAllowedRole(guildId, roleId) {
    try {
      const config = await this.getConfig(guildId);
      
      config.allowedRoles = config.allowedRoles.filter(id => id !== roleId);
      await this.saveConfig(config);
      
      return config;
    } catch (error) {
      console.error('Erro ao remover cargo permitido:', error);
      throw error;
    }
  }

  // Definir cargo de panela
  static async setPanelaRole(guildId, roleId) {
    try {
      const config = await this.getConfig(guildId);
      config.panelaRoleId = roleId;
      
      await this.saveConfig(config);
      return config;
    } catch (error) {
      console.error('Erro ao definir cargo de panela:', error);
      throw error;
    }
  }

  // Definir cargo de antiban
  static async setAntibanRole(guildId, roleId) {
    try {
      const config = await this.getConfig(guildId);
      config.antibanRoleId = roleId;
      
      await this.saveConfig(config);
      return config;
    } catch (error) {
      console.error('Erro ao definir cargo de antiban:', error);
      throw error;
    }
  }

  // Definir cargo de primeira dama
  static async setPrimeiraDamaRole(guildId, roleId) {
    try {
      const config = await this.getConfig(guildId);
      config.primeiraDamaRoleId = roleId;
      
      await this.saveConfig(config);
      return config;
    } catch (error) {
      console.error('Erro ao definir cargo de primeira dama:', error);
      throw error;
    }
  }

  // Verificar se usuário tem permissão
  static async userHasPermission(guildId, userRoles) {
    try {
      const config = await this.getConfig(guildId);
      
      // Se não há cargos configurados, ninguém tem permissão
      if (config.allowedRoles.length === 0) {
        return false;
      }
      
      // Verificar se o usuário tem algum dos cargos permitidos
      return userRoles.some(roleId => config.allowedRoles.includes(roleId));
    } catch (error) {
      console.error('Erro ao verificar permissão de usuário:', error);
      return false;
    }
  }

  // Limpar cache
  static clearCache(guildId = null) {
    if (guildId) {
      this.cache.delete(guildId);
    } else {
      this.cache.clear();
    }
  }

  // Limpar configuração de um servidor
  static async clearConfig(guildId) {
    try {
      await query(`
        DELETE FROM panela_config WHERE guild_id = $1
      `, [guildId]);
      
      this.clearCache(guildId);
      console.log(`Configuração de panela do servidor ${guildId} removida`);
      
      return true;
    } catch (error) {
      console.error('Erro ao limpar configuração de panela:', error);
      throw error;
    }
  }

  // Obter estatísticas de configuração
  static async getConfigStats(guildId) {
    try {
      const config = await this.getConfig(guildId);
      
      return {
        guildId: config.guildId,
        totalAllowedRoles: config.allowedRoles.length,
        hasPanelaRole: !!config.panelaRoleId,
        isConfigured: config.allowedRoles.length > 0 && config.panelaRoleId,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas de configuração:', error);
      return null;
    }
  }

  // Atualizar múltiplos cargos permitidos de uma vez
  static async updateAllowedRoles(guildId, roleIds) {
    try {
      const config = await this.getConfig(guildId);
      config.allowedRoles = [...new Set(roleIds)]; // Remove duplicatas
      
      await this.saveConfig(config);
      return config;
    } catch (error) {
      console.error('Erro ao atualizar cargos permitidos:', error);
      throw error;
    }
  }
}

module.exports = PanelaConfig;
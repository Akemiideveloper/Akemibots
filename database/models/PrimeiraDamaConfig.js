const { query } = require('../connection');

class PrimeiraDamaConfig {
  // Cache para configurações
  static cache = new Map();

  // Buscar configuração de primeira dama de um servidor
  static async getConfig(guildId) {
    try {
      // Verificar cache primeiro
      if (this.cache.has(guildId)) {
        return this.cache.get(guildId);
      }

      const result = await query(`
        SELECT * FROM primeira_dama_config WHERE guild_id = $1
      `, [guildId]);

      let config;
      if (result.rows.length > 0) {
        const row = result.rows[0];
        config = {
          guildId: row.guild_id,
          allowedRoles: row.allowed_roles || [],
          pdRoleId: row.pd_role_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      } else {
        // Criar configuração padrão se não existir
        config = {
          guildId: guildId,
          allowedRoles: [],
          pdRoleId: null,
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
      console.error('Erro ao carregar configuração de primeira dama:', error);
      
      // Retornar configuração padrão em caso de erro
      const defaultConfig = {
        guildId: guildId,
        allowedRoles: [],
        pdRoleId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.cache.set(guildId, defaultConfig);
      return defaultConfig;
    }
  }

  // Salvar configuração de primeira dama
  static async saveConfig(config) {
    try {
      await query(`
        INSERT INTO primeira_dama_config (guild_id, allowed_roles, pd_role_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id) 
        DO UPDATE SET 
          allowed_roles = EXCLUDED.allowed_roles,
          pd_role_id = EXCLUDED.pd_role_id,
          updated_at = CURRENT_TIMESTAMP
      `, [
        config.guildId,
        config.allowedRoles,
        config.pdRoleId
      ]);

      // Atualizar cache
      config.updatedAt = new Date();
      this.cache.set(config.guildId, config);
      console.log(`Configuração de primeira dama do servidor ${config.guildId} salva no banco`);
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar configuração de primeira dama:', error);
      return false;
    }
  }

  // Atualizar cargos permitidos
  static async updateAllowedRoles(guildId, roleIds) {
    try {
      const config = await this.getConfig(guildId);
      config.allowedRoles = roleIds;
      return await this.saveConfig(config);
    } catch (error) {
      console.error('Erro ao atualizar cargos permitidos:', error);
      return false;
    }
  }

  // Adicionar cargo permitido
  static async addAllowedRole(guildId, roleId) {
    try {
      const config = await this.getConfig(guildId);
      if (!config.allowedRoles.includes(roleId)) {
        config.allowedRoles.push(roleId);
        return await this.saveConfig(config);
      }
      return true; // Já existe
    } catch (error) {
      console.error('Erro ao adicionar cargo permitido:', error);
      return false;
    }
  }

  // Remover cargo permitido
  static async removeAllowedRole(guildId, roleId) {
    try {
      const config = await this.getConfig(guildId);
      const index = config.allowedRoles.indexOf(roleId);
      if (index > -1) {
        config.allowedRoles.splice(index, 1);
        return await this.saveConfig(config);
      }
      return true; // Não existe mesmo
    } catch (error) {
      console.error('Erro ao remover cargo permitido:', error);
      return false;
    }
  }

  // Definir cargo de primeira dama
  static async setPdRole(guildId, roleId) {
    try {
      const config = await this.getConfig(guildId);
      config.pdRoleId = roleId;
      return await this.saveConfig(config);
    } catch (error) {
      console.error('Erro ao definir cargo de primeira dama:', error);
      return false;
    }
  }

  // Verificar se usuário pode usar comando
  static async canUseCommand(guildId, userRoles) {
    try {
      const config = await this.getConfig(guildId);
      
      // Se não há cargos configurados, qualquer um pode usar
      if (config.allowedRoles.length === 0) {
        return true;
      }
      
      // Verificar se usuário tem algum dos cargos permitidos
      return config.allowedRoles.some(roleId => userRoles.includes(roleId));
    } catch (error) {
      console.error('Erro ao verificar permissão:', error);
      return false;
    }
  }

  // Limpar cache de um servidor
  static clearCache(guildId) {
    this.cache.delete(guildId);
    console.log(`Cache de configuração de primeira dama limpo para servidor ${guildId}`);
  }

  // Limpar todo o cache
  static clearAllCache() {
    this.cache.clear();
    console.log('Cache de configurações de primeira dama limpo');
  }

  // Listar todas as configurações (para debug)
  static async getAllConfigs() {
    try {
      const result = await query('SELECT * FROM primeira_dama_config ORDER BY guild_id');
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar todas as configurações:', error);
      return [];
    }
  }
}

module.exports = PrimeiraDamaConfig;
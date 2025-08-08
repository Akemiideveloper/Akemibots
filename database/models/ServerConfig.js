const { query } = require('../connection');

class ServerConfig {
  constructor() {
    this.cache = new Map(); // Cache local para performance
  }

  // Carregar configuração do servidor do banco de dados
  async getServerConfig(guildId) {
    // Verificar cache primeiro
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId);
    }

    try {
      const result = await query(
        'SELECT * FROM server_configs WHERE guild_id = $1',
        [guildId]
      );

      let config;
      if (result.rows.length > 0) {
        const row = result.rows[0];
        config = {
          guildId: row.guild_id,
          prefix: row.prefix,
          logChannels: {
            ban: row.log_channel_ban,
            unban: row.log_channel_unban,
            moderation: row.log_channel_moderation,
            mute: row.log_channel_mute,
            unmute: row.log_channel_unmute,
            blacklist: row.log_channel_blacklist,
            primeira_dama: row.log_channel_primeira_dama,
            panela: row.log_channel_panela
          }
        };
      } else {
        // Criar configuração padrão se não existir
        config = {
          guildId: guildId,
          prefix: 'q.',
          logChannels: {
            ban: null,
            unban: null,
            moderation: null,
            mute: null,
            unmute: null,
            blacklist: null,
            primeira_dama: null,
            panela: null
          }
        };
        
        // Salvar configuração padrão no banco
        await this.saveServerConfig(config);
      }

      // Atualizar cache
      this.cache.set(guildId, config);
      return config;
    } catch (error) {
      console.error('Erro ao carregar configuração do servidor:', error);
      
      // Retornar configuração padrão em caso de erro
      const defaultConfig = {
        guildId: guildId,
        prefix: 'q.',
        logChannels: {
          ban: null,
          unban: null,
          moderation: null,
          mute: null,
          unmute: null,
          blacklist: null,
          primeira_dama: null
        }
      };
      
      this.cache.set(guildId, defaultConfig);
      return defaultConfig;
    }
  }

  // Salvar configuração do servidor no banco de dados
  async saveServerConfig(config) {
    try {
      await query(`
        INSERT INTO server_configs (guild_id, prefix, log_channel_ban, log_channel_unban, log_channel_moderation, log_channel_mute, log_channel_unmute, log_channel_blacklist, log_channel_primeira_dama, log_channel_panela)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (guild_id) 
        DO UPDATE SET 
          prefix = EXCLUDED.prefix,
          log_channel_ban = EXCLUDED.log_channel_ban,
          log_channel_unban = EXCLUDED.log_channel_unban,
          log_channel_moderation = EXCLUDED.log_channel_moderation,
          log_channel_mute = EXCLUDED.log_channel_mute,
          log_channel_unmute = EXCLUDED.log_channel_unmute,
          log_channel_blacklist = EXCLUDED.log_channel_blacklist,
          log_channel_primeira_dama = EXCLUDED.log_channel_primeira_dama,
          log_channel_panela = EXCLUDED.log_channel_panela,
          updated_at = CURRENT_TIMESTAMP
      `, [
        config.guildId,
        config.prefix,
        config.logChannels.ban,
        config.logChannels.unban,
        config.logChannels.moderation,
        config.logChannels.mute,
        config.logChannels.unmute,
        config.logChannels.blacklist,
        config.logChannels.primeira_dama,
        config.logChannels.panela
      ]);

      // Atualizar cache
      this.cache.set(config.guildId, config);
      console.log(`Configuração do servidor ${config.guildId} salva no banco`);
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar configuração do servidor:', error);
      return false;
    }
  }

  // Atualizar apenas o prefixo
  async updateServerPrefix(guildId, newPrefix) {
    try {
      const config = await this.getServerConfig(guildId);
      config.prefix = newPrefix;
      return await this.saveServerConfig(config);
    } catch (error) {
      console.error('Erro ao atualizar prefixo do servidor:', error);
      return false;
    }
  }

  // Atualizar canal de log
  async updateLogChannel(guildId, logType, channelId) {
    try {
      const config = await this.getServerConfig(guildId);
      config.logChannels[logType] = channelId;
      return await this.saveServerConfig(config);
    } catch (error) {
      console.error('Erro ao atualizar canal de log:', error);
      return false;
    }
  }

  // Limpar cache de um servidor (força recarregamento do banco)
  clearCache(guildId) {
    this.cache.delete(guildId);
    console.log(`Cache limpo para servidor ${guildId}`);
  }

  // Limpar todo o cache
  clearAllCache() {
    this.cache.clear();
    console.log('Cache de configurações limpo');
  }

  // Listar todas as configurações (para debug)
  async getAllConfigs() {
    try {
      const result = await query('SELECT * FROM server_configs ORDER BY guild_id');
      return result.rows;
    } catch (error) {
      console.error('Erro ao buscar todas as configurações:', error);
      return [];
    }
  }

  // Limpar cache (para forçar reload do banco)
  clearCache(guildId = null) {
    if (guildId) {
      this.cache.delete(guildId);
    } else {
      this.cache.clear();
    }
  }

  // Carregar todas as configurações na inicialização
  async preloadConfigs(guildIds) {
    console.log('Pré-carregando configurações de servidores...');
    for (const guildId of guildIds) {
      await this.getServerConfig(guildId);
    }
    console.log(`${guildIds.length} configurações carregadas no cache`);
  }
}

module.exports = new ServerConfig();
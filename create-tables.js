const { query } = require('./database/connection');

async function createTables() {
  try {
    console.log('🚀 Criando tabelas no NeonDB...');
    
    // Criar tabela server_configs
    await query(`
      CREATE TABLE IF NOT EXISTS server_configs (
        guild_id VARCHAR(20) PRIMARY KEY,
        prefix VARCHAR(10) DEFAULT 'q.',
        log_channel_ban VARCHAR(20),
        log_channel_unban VARCHAR(20),
        log_channel_moderation VARCHAR(20),
        log_channel_mute VARCHAR(20),
        log_channel_unmute VARCHAR(20),
        log_channel_blacklist VARCHAR(20),
        log_channel_primeira_dama VARCHAR(20),
        log_channel_panela VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela server_configs criada');
    
    // Criar tabela moderation_logs
    await query(`
      CREATE TABLE IF NOT EXISTS moderation_logs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        moderator_id VARCHAR(20) NOT NULL,
        action_type VARCHAR(20) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      )
    `);
    console.log('✅ Tabela moderation_logs criada');
    
    // Criar tabela users
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(20) PRIMARY KEY,
        username VARCHAR(32) NOT NULL,
        discriminator VARCHAR(4),
        global_name VARCHAR(32),
        avatar_hash VARCHAR(100),
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela users criada');
    
    // Criar tabela guild_members
    await query(`
      CREATE TABLE IF NOT EXISTS guild_members (
        guild_id VARCHAR(20),
        user_id VARCHAR(20),
        nickname VARCHAR(32),
        joined_at TIMESTAMP,
        roles JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id)
      )
    `);
    console.log('✅ Tabela guild_members criada');
    
    // Criar tabela temporary_mutes (sistema de containers)
    await query(`
      CREATE TABLE IF NOT EXISTS temporary_mutes (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        moderator_id VARCHAR(20) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        reason TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unmuted_at TIMESTAMP
      )
    `);
    console.log('✅ Tabela temporary_mutes criada');

    // Criar tabela blacklist
    await query(`
      CREATE TABLE IF NOT EXISTS blacklist (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        user_tag VARCHAR(255),
        reason TEXT,
        added_by_id VARCHAR(20) NOT NULL,
        added_by_tag VARCHAR(255),
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE(guild_id, user_id)
      )
    `);
    console.log('✅ Tabela blacklist criada');

    // Criar tabela primeira_dama
    await query(`
      CREATE TABLE IF NOT EXISTS primeira_dama (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        primeira_dama_id VARCHAR(20) NOT NULL,
        user_tag VARCHAR(255),
        primeira_dama_tag VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, user_id)
      )
    `);
    console.log('✅ Tabela primeira_dama criada');

    // Criar tabela primeira_dama_config
    await query(`
      CREATE TABLE IF NOT EXISTS primeira_dama_config (
        guild_id VARCHAR(20) PRIMARY KEY,
        allowed_roles TEXT[],
        pd_role_id VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela primeira_dama_config criada');

    // Criar tabela panela
    await query(`
      CREATE TABLE IF NOT EXISTS panela (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        panela_id VARCHAR(20) NOT NULL,
        user_tag VARCHAR(100) NOT NULL,
        panela_tag VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, user_id)
      )
    `);
    console.log('✅ Tabela panela criada');

    // Criar tabela panela_config
    await query(`
      CREATE TABLE IF NOT EXISTS panela_config (
        guild_id VARCHAR(20) PRIMARY KEY,
        allowed_roles TEXT[],
        panela_role_id VARCHAR(20),
        antiban_role_id VARCHAR(20),
        primeira_dama_role_id VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela panela_config criada');

    // Criar índices
    const indices = [
      'CREATE INDEX IF NOT EXISTS idx_moderation_logs_guild_id ON moderation_logs(guild_id)',
      'CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON moderation_logs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_moderation_logs_action_type ON moderation_logs(action_type)',
      'CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON moderation_logs(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_guild_members_guild_id ON guild_members(guild_id)',
      'CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen)',
      'CREATE INDEX IF NOT EXISTS idx_temporary_mutes_guild_id ON temporary_mutes(guild_id)',
      'CREATE INDEX IF NOT EXISTS idx_temporary_mutes_expires_at ON temporary_mutes(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_temporary_mutes_active ON temporary_mutes(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_blacklist_guild_user ON blacklist(guild_id, user_id)',
      'CREATE INDEX IF NOT EXISTS idx_blacklist_guild_active ON blacklist(guild_id) WHERE is_active = TRUE',
      'CREATE INDEX IF NOT EXISTS idx_primeira_dama_guild_user ON primeira_dama(guild_id, user_id)',
      'CREATE INDEX IF NOT EXISTS idx_primeira_dama_guild_pd ON primeira_dama(guild_id, primeira_dama_id)',
      'CREATE INDEX IF NOT EXISTS idx_primeira_dama_config_guild ON primeira_dama_config(guild_id)',
      'CREATE INDEX IF NOT EXISTS idx_panela_guild_user ON panela(guild_id, user_id)',
      'CREATE INDEX IF NOT EXISTS idx_panela_guild_panela ON panela(guild_id, panela_id)'
    ];
    
    for (const index of indices) {
      await query(index);
    }
    console.log('✅ Índices criados');
    
    // Testar funcionalidades
    console.log('🧪 Testando funcionalidades do banco...');
    const ServerConfig = require('./database/models/ServerConfig');
    
    const testGuildId = '123456789012345678';
    const config = await ServerConfig.getServerConfig(testGuildId);
    console.log('✅ Configuração criada:', config);
    
    await ServerConfig.updateServerPrefix(testGuildId, 'test!');
    const updatedConfig = await ServerConfig.getServerConfig(testGuildId);
    console.log('✅ Prefixo atualizado para:', updatedConfig.prefix);
    
    // Limpar dados de teste
    await query('DELETE FROM server_configs WHERE guild_id = $1', [testGuildId]);
    console.log('🧹 Dados de teste removidos');
    
    console.log('🎊 Banco de dados configurado com sucesso!');
    console.log('');
    console.log('📋 Próximos passos:');
    console.log('1. Configure seu token do Discord no arquivo .env');
    console.log('2. Execute: node index.js');
    console.log('3. Convide o bot para seu servidor');
    console.log('');
    
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Erro ao criar tabelas:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  createTables();
}

module.exports = { createTables };
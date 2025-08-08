-- Schema do banco de dados para o bot Discord
-- Execute este script no seu NeonDB para criar as tabelas

-- Tabela de configurações de servidores
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
);

-- Tabela de logs de moderação (para histórico)
CREATE TABLE IF NOT EXISTS moderation_logs (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    moderator_id VARCHAR(20) NOT NULL,
    action_type VARCHAR(20) NOT NULL, -- 'ban', 'unban', 'kick', 'mute', etc
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB -- dados extras específicos por tipo de ação
);

-- Tabela de usuários (cache de informações)
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(20) PRIMARY KEY,
    username VARCHAR(32) NOT NULL,
    discriminator VARCHAR(4),
    global_name VARCHAR(32),
    avatar_hash VARCHAR(100),
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de membros por servidor
CREATE TABLE IF NOT EXISTS guild_members (
    guild_id VARCHAR(20),
    user_id VARCHAR(20),
    nickname VARCHAR(32),
    joined_at TIMESTAMP,
    roles JSONB, -- array de role IDs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_moderation_logs_guild_id ON moderation_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_action_type ON moderation_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON moderation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_guild_members_guild_id ON guild_members(guild_id);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger nas tabelas relevantes
DROP TRIGGER IF EXISTS update_server_configs_updated_at ON server_configs;
CREATE TRIGGER update_server_configs_updated_at
    BEFORE UPDATE ON server_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_guild_members_updated_at ON guild_members;
CREATE TRIGGER update_guild_members_updated_at
    BEFORE UPDATE ON guild_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Tabela de blacklist de usuários
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
);

-- Índices para blacklist
CREATE INDEX IF NOT EXISTS idx_blacklist_guild_user ON blacklist(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_guild_active ON blacklist(guild_id) WHERE is_active = TRUE;

-- Tabela de primeira dama
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
);

-- Tabela de configurações de primeira dama
CREATE TABLE IF NOT EXISTS primeira_dama_config (
    guild_id VARCHAR(20) PRIMARY KEY,
    allowed_roles TEXT[], -- Array de IDs de cargos permitidos
    pd_role_id VARCHAR(20), -- ID do cargo "Primeira Dama"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para primeira dama
CREATE INDEX IF NOT EXISTS idx_primeira_dama_guild_user ON primeira_dama(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_primeira_dama_guild_pd ON primeira_dama(guild_id, primeira_dama_id);

-- Tabela de relações de panela
CREATE TABLE IF NOT EXISTS panela (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL, -- Quem escolheu
    panela_id VARCHAR(20) NOT NULL, -- Quem foi escolhido como panela
    user_tag VARCHAR(100) NOT NULL, -- Tag de quem escolheu
    panela_tag VARCHAR(100) NOT NULL, -- Tag da panela para ranking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, user_id)
);

-- Tabela de configurações de panela
CREATE TABLE IF NOT EXISTS panela_config (
    guild_id VARCHAR(20) PRIMARY KEY,
    allowed_roles TEXT[], -- Array de IDs de cargos permitidos
    panela_role_id VARCHAR(20), -- ID do cargo "Panela"
    antiban_role_id VARCHAR(20), -- ID do cargo "Antiban"
    primeira_dama_role_id VARCHAR(20), -- ID do cargo "Primeira Dama"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para panela
CREATE INDEX IF NOT EXISTS idx_panela_guild_user ON panela(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_panela_guild_panela ON panela(guild_id, panela_id);
CREATE INDEX IF NOT EXISTS idx_primeira_dama_config_guild ON primeira_dama_config(guild_id);
#!/bin/bash

# Script de deploy automatizado para o Bot Discord
# Uso: ./scripts/deploy.sh [dev|prod]

set -e

# Cores para saída
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # Sem Cor

# Função para log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERRO: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] AVISO: $1${NC}"
}

# Verificar se Docker está instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker não está instalado. Instale o Docker primeiro."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose não está instalado. Instale o Docker Compose primeiro."
        exit 1
    fi
    
    log "Docker e Docker Compose encontrados"
}

# Verificar arquivo .env
check_env() {
    if [ ! -f .env ]; then
        error "Arquivo .env não encontrado. Copie env.example para .env e configure as variáveis."
        exit 1
    fi
    
    # Verificar variáveis obrigatórias
    source .env
    
    if [ -z "$DISCORD_TOKEN" ]; then
        error "DISCORD_TOKEN não configurado no arquivo .env"
        exit 1
    fi
    
    if [ -z "$DATABASE_URL" ] && [ -z "$DB_HOST" ]; then
        error "Configuração do banco de dados não encontrada no arquivo .env"
        exit 1
    fi
    
    log "Variáveis de ambiente verificadas"
}

# Parar containers existentes
stop_containers() {
    log "Parando containers existentes..."
    docker-compose down --remove-orphans 2>/dev/null || true
}

# Construir nova imagem
build_image() {
    log "Construindo imagem Docker..."
    docker-compose build --no-cache
}

# Iniciar containers
start_containers() {
    local env_file=$1
    log "Iniciando containers com $env_file..."
    docker-compose -f $env_file up -d
}

# Verificar status
check_status() {
    log "Verificando status dos containers..."
    sleep 10
    
    if docker-compose ps | grep -q "Up"; then
        log "Containers iniciados com sucesso"
        docker-compose ps
    else
        error "Falha ao iniciar containers"
        docker-compose logs
        exit 1
    fi
}

# Backup dos logs
backup_logs() {
    if [ -d "logs" ]; then
        log "Fazendo backup dos logs..."
        tar -czf "logs-backup-$(date +%Y%m%d-%H%M%S).tar.gz" logs/ 2>/dev/null || true
    fi
}

# Função principal
main() {
    local environment=${1:-dev}
    
    log "Iniciando deploy do Bot Discord (ambiente: $environment)"
    
    # Verificações
    check_docker
    check_env
    
    # Backup
    backup_logs
    
    # Parar containers existentes
    stop_containers
    
    # Construir imagem
    build_image
    
    # Escolher arquivo de compose baseado no ambiente
    local compose_file="docker-compose.yml"
    if [ "$environment" = "prod" ]; then
        compose_file="docker-compose.prod.yml"
    fi
    
    # Iniciar containers
    start_containers $compose_file
    
    # Verificar status
    check_status
    
    log "Deploy concluído com sucesso!"
    log "Para ver os logs: docker-compose logs -f"
    log "Para parar: docker-compose down"
}

# Executar script
main "$@"

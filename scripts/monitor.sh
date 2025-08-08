#!/bin/bash

# Script de monitoramento para o Bot Discord
# Uso: ./scripts/monitor.sh [status|logs|health|restart]

set -e

# Cores para saída
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Verificar status dos containers
check_status() {
    log "Verificando status dos containers..."
    
    if docker-compose ps | grep -q "Up"; then
        log "✅ Containers estão rodando"
        docker-compose ps
    else
        error "❌ Containers não estão rodando"
        docker-compose ps
        return 1
    fi
}

# Verificar verificação de saúde
check_health() {
    log "Verificando verificação de saúde dos containers..."
    
    local container_name=$(docker-compose ps -q discord-bot)
    if [ -n "$container_name" ]; then
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' $container_name 2>/dev/null || echo "sem-verificacao-saude")
        
        if [ "$health_status" = "healthy" ]; then
            log "✅ Verificação de saúde: SAUDÁVEL"
        elif [ "$health_status" = "unhealthy" ]; then
            error "❌ Verificação de saúde: NÃO SAUDÁVEL"
            return 1
        elif [ "$health_status" = "starting" ]; then
            warning "⏳ Verificação de saúde: INICIANDO"
        else
            info "ℹ️ Verificação de saúde: $health_status"
        fi
    else
        error "Container não encontrado"
        return 1
    fi
}

# Mostrar logs
show_logs() {
    local lines=${1:-50}
    log "Mostrando últimos $lines linhas dos logs..."
    docker-compose logs --tail=$lines
}

# Mostrar logs em tempo real
show_logs_follow() {
    log "Mostrando logs em tempo real (Ctrl+C para sair)..."
    docker-compose logs -f
}

# Reiniciar containers
restart_containers() {
    log "Reiniciando containers..."
    docker-compose restart
    
    sleep 5
    check_status
    check_health
}

# Verificar uso de recursos
check_resources() {
    log "Verificando uso de recursos..."
    
    local container_name=$(docker-compose ps -q discord-bot)
    if [ -n "$container_name" ]; then
        echo "=== Uso de Recursos ==="
        docker stats --no-stream $container_name
        
        echo -e "\n=== Informações do Container ==="
        docker inspect --format='{{.Config.Image}}' $container_name
        docker inspect --format='{{.State.StartedAt}}' $container_name
        docker inspect --format='{{.State.Status}}' $container_name
    else
        error "Container não encontrado"
    fi
}

# Verificar conectividade
check_connectivity() {
    log "Verificando conectividade..."
    
    # Verificar se o bot está online no Discord
    local logs=$(docker-compose logs --tail=20 2>/dev/null)
    
    if echo "$logs" | grep -q "Bot de Segurança online"; then
        log "✅ Bot está online no Discord"
    else
        warning "⚠️ Bot pode não estar online no Discord"
    fi
    
    if echo "$logs" | grep -q "Conectado ao NeonDB"; then
        log "✅ Conectado ao banco de dados"
    else
        warning "⚠️ Problemas com banco de dados"
    fi
}

# Função principal
main() {
    local action=${1:-status}
    
    case $action in
        "status")
            check_status
            check_health
            check_connectivity
            ;;
        "logs")
            show_logs
            ;;
        "logs-follow")
            show_logs_follow
            ;;
        "health")
            check_health
            ;;
        "restart")
            restart_containers
            ;;
        "resources")
            check_resources
            ;;
        "full")
            check_status
            check_health
            check_connectivity
            check_resources
            show_logs 20
            ;;
        *)
            echo "Uso: $0 [status|logs|logs-follow|health|restart|resources|full]"
            echo ""
            echo "Comandos disponíveis:"
            echo "  status      - Verificar status geral"
            echo "  logs        - Mostrar logs recentes"
            echo "  logs-follow - Mostrar logs em tempo real"
            echo "  health      - Verificar verificação de saúde"
            echo "  restart     - Reiniciar containers"
            echo "  resources   - Verificar uso de recursos"
            echo "  full        - Verificação completa"
            exit 1
            ;;
    esac
}

# Executar script
main "$@"

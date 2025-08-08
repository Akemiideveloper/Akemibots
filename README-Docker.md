# Bot Discord - Deploy com Container

Este projeto foi containerizado para facilitar o deploy e gerenciamento do bot Discord.

## Pré-requisitos

- Docker
- Docker Compose
- Token do bot Discord
- Configuração do banco de dados PostgreSQL

## Configuração

### 1. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e configure suas variáveis:

```bash
cp env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Configuração do Bot Discord
DISCORD_TOKEN=seu_token_do_bot_aqui
BOT_PREFIX=q.

# Configuração do Banco de Dados (PostgreSQL)
DATABASE_URL=postgresql://usuario:senha@host:porta/banco
DB_HOST=seu_host_do_banco
DB_PORT=5432
DB_NAME=nome_do_banco
DB_USER=usuario_do_banco
DB_PASSWORD=senha_do_banco
```

### 2. Deploy com Docker Compose

```bash
# Construir e iniciar o container
docker-compose up -d

# Ver logs em tempo real
docker-compose logs -f

# Parar o container
docker-compose down

# Reiniciar o container
docker-compose restart
```

### 3. Deploy Manual com Docker

```bash
# Construir a imagem
docker build -t discord-bot .

# Executar o container
docker run --env-file .env -d --name discord-bot discord-bot

# Ver logs
docker logs -f discord-bot

# Parar o container
docker stop discord-bot

# Remover o container
docker rm discord-bot
```

## Scripts NPM Disponíveis

```bash
# Construir imagem Docker
npm run docker:build

# Executar container
npm run docker:run

# Usar Docker Compose
npm run docker:compose

# Parar containers
npm run docker:compose:down

# Ver logs
npm run docker:logs

# Reiniciar
npm run docker:restart

# Deploy automatizado
npm run docker:deploy:dev
npm run docker:deploy:prod

# Monitoramento
npm run docker:monitor
npm run docker:monitor:logs
npm run docker:monitor:health
npm run docker:monitor:full

# Limpeza e backup
npm run docker:clean
npm run docker:backup
```

## Estrutura do Container

- **Imagem Base**: Node.js 18 Alpine
- **Porta**: 3000 (para verificações de saúde)
- **Usuário**: bot (não-root para segurança)
- **Volumes**: `./logs:/app/logs` para persistência de logs
- **Verificação de Saúde**: Verificação automática a cada 30s

## Monitoramento

### Verificação de Saúde
O container inclui uma verificação de saúde que verifica se o bot está funcionando:

```bash
# Verificar status da verificação de saúde
docker inspect discord-bot | grep Health -A 10
```

### Logs
```bash
# Logs em tempo real
docker-compose logs -f

# Logs dos últimos 100 eventos
docker-compose logs --tail=100
```

## Solução de Problemas

### Container não inicia
1. Verifique se as variáveis de ambiente estão configuradas
2. Confirme se o token do Discord é válido
3. Verifique a conectividade com o banco de dados

### Bot não responde
1. Verifique os logs: `docker-compose logs -f`
2. Confirme se o bot está online no Discord
3. Verifique as permissões do bot no servidor

### Problemas de banco de dados
1. Verifique a string de conexão no `.env`
2. Confirme se o banco está acessível
3. Verifique as credenciais do banco

## Backup e Restauração

### Backup dos dados
```bash
# Backup do volume de logs
docker run --rm -v discord-bot_logs:/data -v $(pwd):/backup alpine tar czf /backup/logs-backup.tar.gz -C /data .
```

### Restauração dos dados
```bash
# Restauração do volume de logs
docker run --rm -v discord-bot_logs:/data -v $(pwd):/backup alpine tar xzf /backup/logs-backup.tar.gz -C /data
```

## Segurança

- O container roda como usuário não-root
- Imagem baseada em Alpine Linux (menor superfície de ataque)
- Verificações de saúde para monitoramento
- Volumes isolados para dados persistentes

## Performance

- Imagem otimizada com Alpine Linux
- Dependências instaladas apenas em produção
- Cache de camadas Docker otimizado
- Reinicialização automática em caso de falha

## Scripts de Automação

### Deploy Automatizado
```bash
# Deploy em ambiente de desenvolvimento
./scripts/deploy.sh dev

# Deploy em ambiente de produção
./scripts/deploy.sh prod
```

### Monitoramento Avançado
```bash
# Verificação completa do sistema
./scripts/monitor.sh full

# Verificar apenas logs
./scripts/monitor.sh logs

# Verificar verificação de saúde
./scripts/monitor.sh health

# Reiniciar containers
./scripts/monitor.sh restart
```

## Comandos Úteis

```bash
# Verificar status geral
npm run docker:monitor

# Ver logs em tempo real
npm run docker:logs

# Deploy rápido
npm run docker:deploy:dev

# Limpeza completa
npm run docker:clean

# Backup automático
npm run docker:backup
```

## Ambiente de Produção

Para deploy em produção, use o arquivo `docker-compose.prod.yml`:

```bash
# Deploy em produção
docker-compose -f docker-compose.prod.yml up -d

# Ou usando o script
npm run docker:deploy:prod
```

O ambiente de produção inclui:
- Limites de recursos (memória e CPU)
- Logs rotativos
- Configurações de segurança aprimoradas
- Monitoramento avançado

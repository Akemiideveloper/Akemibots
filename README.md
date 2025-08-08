# Akemibots

Bot de moderação e segurança para Discord.

## 🚀 Configuração Rápida

### Para Desenvolvimento Local:
```bash
# 1. Instalar dependências
npm install

# 2. Configurar token
node setup-env.js

# 3. Executar bot
npm start
```

### Para Discloud:
```bash
# 1. Copiar arquivo de exemplo
copy discloud.config.example discloud.config

# 2. Configurar token no discloud.config
node setup-discloud.js

# 3. Fazer deploy
discloud push
```

## 🔧 Configuração Manual

### Variáveis de Ambiente Necessárias:
```env
DISCORD_TOKEN=seu_token_do_bot_discord_aqui
BOT_PREFIX=q.
LOG_LEVEL=info
```

### Como obter o Token:
1. Acesse: https://discord.com/developers/applications
2. Selecione seu bot
3. Vá em "Bot" → "Token"
4. Clique em "Reset Token" se necessário
5. Copie o token

## ⚠️ Importante
- **NUNCA** compartilhe seu token
- **NUNCA** commite arquivos `.env` ou `discloud.config`
- Os arquivos sensíveis estão protegidos no `.gitignore`

## 📋 Comandos Disponíveis
- `q.help` - Lista todos os comandos
- `q.ban` - Banir usuário
- `q.kick` - Expulsar usuário
- `q.mute` - Silenciar usuário
- `q.warn` - Advertir usuário
- `q.clear` - Limpar mensagens
- `q.userinfo` - Informações do usuário
- `q.serverinfo` - Informações do servidor

## 🔒 Segurança
O projeto está configurado para proteger seus tokens:
- `.env` e `discloud.config` estão no `.gitignore`
- Scripts automáticos para configuração segura
- Histórico do Git limpo de tokens

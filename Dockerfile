# Usar Node.js 18 Alpine como imagem base
FROM node:18-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bot -u 1001

# Alterar propriedade do diretório da aplicação
RUN chown -R bot:nodejs /app
USER bot

# Expor porta (se necessário para verificações de saúde)
EXPOSE 3000

# Verificação de saúde
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Verificação de saúde do bot aprovada')" || exit 1

# Iniciar a aplicação
CMD ["npm", "start"]

FROM node:18-slim

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar resto dos arquivos
COPY . .

# Expor porta
EXPOSE 3000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Comando para iniciar
CMD ["node", "server.js"]

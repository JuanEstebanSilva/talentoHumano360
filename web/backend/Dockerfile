# ═══════════════════════════════════════════════════════════════════════════════
# Dockerfile para Talento 360 Backend
# ═══════════════════════════════════════════════════════════════════════════════

FROM node:20-alpine

WORKDIR /app

# Copiar package.json e instalar dependencias a nivel raíz (/app)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copiar código de base de datos, servicios y backend
COPY database/ ./database/
COPY web/services/ ./web/services/
COPY web/backend/ ./web/backend/

WORKDIR /app

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules:/app/web/backend/node_modules

CMD ["node", "web/backend/server.js"]


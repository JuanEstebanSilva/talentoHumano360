# ═══════════════════════════════════════════════════════════════════════════════
# Dockerfile para despliegue de Talento 360 Backend en Render / Cloud
# ═══════════════════════════════════════════════════════════════════════════════

FROM node:20-alpine

WORKDIR /app

# Copiar package.json e instalar dependencias de producción
COPY web/backend/package.json ./web/backend/
WORKDIR /app/web/backend
RUN npm install --production

# Copiar código de base de datos, servicios y backend
WORKDIR /app
COPY database/ ./database/
COPY web/services/ ./web/services/
COPY web/backend/ ./web/backend/

WORKDIR /app/web/backend

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.js"]

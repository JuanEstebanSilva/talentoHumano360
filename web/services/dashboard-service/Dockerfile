FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src/ ./src/
# Las copias de seguridad se guardan en /app/backups (volumen backups_data en Docker Compose).
RUN mkdir -p /app/backups && chown -R node:node /app
USER node
EXPOSE 3006
CMD ["node", "src/server.js"]

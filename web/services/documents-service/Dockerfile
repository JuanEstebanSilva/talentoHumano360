FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src/ ./src/
# Los volúmenes montados en /data heredan este propietario la primera vez.
RUN mkdir -p /data/documentos /data/bandeja && chown -R node:node /app /data
USER node
EXPOSE 3009
CMD ["node", "src/server.js"]

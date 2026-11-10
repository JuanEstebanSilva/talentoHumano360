FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src/ ./src/
RUN chown -R node:node /app
USER node
EXPOSE 3004
CMD ["node", "src/server.js"]

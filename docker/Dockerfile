FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY proto/ ./proto/
COPY src/ ./src/
COPY lessons/ ./lessons/

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 50051 50052 50053

CMD ["node", "lessons/18-microservices/start-all.js"]

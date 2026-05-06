FROM node:18-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV JWT_SECRET=pos_system_secret_key_2026
ENV JWT_EXPIRES_IN=7d
ENV DATABASE_URL=file:./prisma/posdb.db
ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm install

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .

EXPOSE 5000

CMD ["node", "start.js"]

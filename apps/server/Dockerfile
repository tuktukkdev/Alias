FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ENV RESEND_API_KEY = "re_"
ENV EMAIL_FROM = "re_"
ENV POSTGRES_PASSWORD = admin
# prisma generate only reads the schema file, not the DB — dummy URL satisfies prisma.config.ts
ENV DATABASE_URL="postgresql://postgres:admin@localhost:5432/alias?schema=public"
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

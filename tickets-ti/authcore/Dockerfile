# ── Etapa 1: dependencias de producción ───────────────────────────────────────
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# ── Etapa 2: imagen final ──────────────────────────────────────────────────────
FROM node:18-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Se copia solo lo necesario: nunca .env, tests ni node_modules locales
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js .sequelizerc ./
COPY src ./src

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3002/api/health || exit 1

CMD ["sh", "-c", "npx sequelize-cli db:migrate && node server.js"]

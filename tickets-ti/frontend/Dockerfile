# ── Etapa 1: build de React ────────────────────────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json ./
# npm install y no npm ci: package-lock.json no se versiona (.gitignore), así
# que un clon limpio no lo tiene y npm ci fallaría.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ── Etapa 2: servidor nginx ────────────────────────────────────────────────────
FROM nginx:alpine AS production
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]

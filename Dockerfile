# syntax=docker/dockerfile:1

# ---- build: compile client (Vite) + server (esbuild) -----------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- deps: production node_modules only ------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---- runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=5000 \
    TZ=Asia/Manila
WORKDIR /app

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY package.json ./

# Run as the unprivileged `node` user. The app writes nothing to disk:
# all state lives in PostgreSQL.
USER node

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply pending database migrations, then start the server. If a migration
# fails the container exits instead of serving against a stale schema.
CMD ["sh", "-c", "node dist/migrate.cjs && exec node dist/index.cjs"]

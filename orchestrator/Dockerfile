# Orchestrator Dockerfile
# Multi-stage build — builder compiles TypeScript, production runs compiled JS

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Build tools required for native modules (mysql2 C++ bindings)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci && npm cache clean --force

COPY src/ ./src/

RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:18-alpine AS production

WORKDIR /app

# tini: proper signal handling (PID 1 in container)
RUN apk add --no-cache tini

COPY package*.json ./

# Production deps only (still needs build tools for mysql2 native bindings)
RUN apk add --no-cache python3 make g++ && \
    npm ci --only=production && \
    npm cache clean --force && \
    apk del python3 make g++

COPY --from=builder /app/dist ./dist

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S orchestrator -u 1001 -G nodejs && \
    chown -R orchestrator:nodejs /app

USER orchestrator

# No ports — the orchestrator has no HTTP interface
# Health check: verify the process is alive
HEALTHCHECK --interval=60s --timeout=5s --retries=3 \
  CMD node -e "process.exit(0)"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js", "scheduler"]

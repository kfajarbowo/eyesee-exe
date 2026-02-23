# ============================================================
# EyeSee License Server - Dockerfile
# Uses Debian-based image (no apk, no internet needed for build tools)
# ============================================================

# ---- Stage 1: Builder ----
# node:20 sudah include python3, make, g++ - tidak perlu install!
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./

# Install dependencies (better-sqlite3 akan compile native di sini)
RUN npm ci --omit=dev

# ---- Stage 2: Runner ----
FROM node:20-slim AS runner

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -s /bin/sh nodejs

WORKDIR /app

# Copy compiled node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs package.json ./
COPY --chown=nodejs:nodejs routes/ ./routes/
COPY --chown=nodejs:nodejs middleware/ ./middleware/
COPY --chown=nodejs:nodejs database/ ./database/
COPY --chown=nodejs:nodejs scripts/ ./scripts/
COPY --chown=nodejs:nodejs public/ ./public/

# Create data directory
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/license/status', r => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]

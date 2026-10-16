# ==============================================================================
# API Gateway — Dockerfile
# Multi-stage / minimal Node.js 20 Alpine container
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Ensure security with NODE_ENV=production
ENV NODE_ENV=production

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY server.js tracing.js ./

# Preload OpenTelemetry tracing module before any other modules execute
ENV NODE_OPTIONS="--require ./tracing.js"

# Run as non-root user
USER node

# Expose gateway port (default 3000)
EXPOSE 3000

# Docker native health check
HEALTHCHECK --interval=10s --timeout=3s --retries=3 --start-period=5s \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the server using node directly for proper SIGTERM signal handling
CMD ["node", "server.js"]

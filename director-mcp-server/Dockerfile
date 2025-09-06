# Director MCP Server Dockerfile
# Multi-stage build for efficient production image

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for building
RUN apk add --no-cache \
    curl \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for building)
RUN npm ci && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Install system dependencies for runtime
RUN apk add --no-cache \
    curl \
    tini

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S director -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R director:nodejs /app

# Switch to non-root user
USER director

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]

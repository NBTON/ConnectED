# Multi-stage build for optimal image size
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:20-alpine AS production

# Install dumb-init
RUN apk add --no-cache dumb-init curl

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Create app directory
WORKDIR /app

# Copy installed dependencies from base stage
COPY --from=base --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nextjs:nodejs . .

# Create non-root user for running the app
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
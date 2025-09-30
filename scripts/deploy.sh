#!/bin/bash

# ConnectED Deployment Script
# Usage: ./scripts/deploy.sh [environment] [version]

set -e

ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "🚀 Starting ConnectED deployment..."
echo "Environment: $ENVIRONMENT"
echo "Version: $VERSION"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]; then
    source "$PROJECT_ROOT/.env.$ENVIRONMENT"
    echo "✅ Loaded environment configuration: .env.$ENVIRONMENT"
else
    echo "❌ Environment file not found: .env.$ENVIRONMENT"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required tools
echo "🔧 Checking required tools..."
for tool in docker docker-compose curl; do
    if ! command_exists "$tool"; then
        echo "❌ $tool is required but not installed."
        exit 1
    fi
done

# Create backup before deployment
if [ "$ENVIRONMENT" = "production" ]; then
    echo "💾 Creating database backup..."
    ./scripts/backup.sh "$ENVIRONMENT"
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f "docker-compose.$ENVIRONMENT.yml" down

# Pull latest images
echo "📥 Pulling latest images..."
docker-compose -f "docker-compose.$ENVIRONMENT.yml" pull

# Build application image if needed
if [ -f "$PROJECT_ROOT/Dockerfile" ]; then
    echo "🔨 Building application image..."
    docker build -t "connected-app:$VERSION" "$PROJECT_ROOT"
fi

# Run database migrations
echo "🗄️ Running database migrations..."
docker-compose -f "docker-compose.$ENVIRONMENT.yml" run --rm app npm run db:migrate || echo "⚠️ No migration script found, skipping..."

# Start services
echo "▶️ Starting services..."
docker-compose -f "docker-compose.$ENVIRONMENT.yml" up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 30

# Health check
echo "🏥 Performing health checks..."
if curl -f "http://localhost:3000/health" >/dev/null 2>&1; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    echo "🔄 Rolling back..."
    ./scripts/rollback.sh "$ENVIRONMENT"
    exit 1
fi

# Update load balancer (if applicable)
if [ -n "$LOAD_BALANCER_URL" ]; then
    echo "⚖️ Updating load balancer..."
    curl -X POST "$LOAD_BALANCER_URL/update" \
         -H "Content-Type: application/json" \
         -d "{\"service\":\"connected-app\",\"version\":\"$VERSION\"}" || echo "⚠️ Load balancer update failed"
fi

# Clean up old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

# Send notification
if [ -n "$DEPLOYMENT_WEBHOOK" ]; then
    echo "📢 Sending deployment notification..."
    curl -X POST "$DEPLOYMENT_WEBHOOK" \
         -H "Content-Type: application/json" \
         -d "{\"environment\":\"$ENVIRONMENT\",\"version\":\"$VERSION\",\"status\":\"success\"}"
fi

echo "🎉 Deployment completed successfully!"
echo "🌐 Application is available at: http://localhost:3000"
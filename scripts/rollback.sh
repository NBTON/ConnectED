#!/bin/bash

# ConnectED Rollback Script
# Usage: ./scripts/rollback.sh [environment]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "🔄 Starting ConnectED rollback..."
echo "Environment: $ENVIRONMENT"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]; then
    source "$PROJECT_ROOT/.env.$ENVIRONMENT"
    echo "✅ Loaded environment configuration: .env.$ENVIRONMENT"
else
    echo "❌ Environment file not found: .env.$ENVIRONMENT"
    exit 1
fi

# Get the previous version from backup
BACKUP_DIR="$PROJECT_ROOT/backups/$ENVIRONMENT"
LATEST_BACKUP=$(ls -t "$BACKUP_DIR" 2>/dev/null | head -1 || echo "")

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ No backup found for rollback"
    exit 1
fi

echo "📦 Rolling back to: $LATEST_BACKUP"

# Stop current containers
echo "🛑 Stopping current containers..."
docker-compose -f "docker-compose.$ENVIRONMENT.yml" down

# Restore database from backup
if [ -f "$BACKUP_DIR/$LATEST_BACKUP/database.dump" ]; then
    echo "🗄️ Restoring database from backup..."
    # Add database restore commands here
    # mongorestore --uri="$MONGODB_URL" "$BACKUP_DIR/$LATEST_BACKUP/database.dump"
fi

# Start services with previous version
echo "▶️ Starting services with previous version..."
docker-compose -f "docker-compose.$ENVIRONMENT.yml" up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 30

# Health check
echo "🏥 Performing health checks..."
if curl -f "http://localhost:3000/health" >/dev/null 2>&1; then
    echo "✅ Rollback completed successfully"
else
    echo "❌ Rollback failed - manual intervention required"
    exit 1
fi

# Send notification
if [ -n "$DEPLOYMENT_WEBHOOK" ]; then
    echo "📢 Sending rollback notification..."
    curl -X POST "$DEPLOYMENT_WEBHOOK" \
         -H "Content-Type: application/json" \
         -d "{\"environment\":\"$ENVIRONMENT\",\"status\":\"rollback\",\"version\":\"$LATEST_BACKUP\"}"
fi

echo "🎉 Rollback completed successfully!"
#!/bin/bash

# ConnectED Backup Script
# Usage: ./scripts/backup.sh [environment]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PROJECT_ROOT/backups/$ENVIRONMENT"

echo "💾 Creating ConnectED backup..."
echo "Environment: $ENVIRONMENT"
echo "Timestamp: $TIMESTAMP"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]; then
    source "$PROJECT_ROOT/.env.$ENVIRONMENT"
    echo "✅ Loaded environment configuration: .env.$ENVIRONMENT"
else
    echo "❌ Environment file not found: .env.$ENVIRONMENT"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR/$TIMESTAMP"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Backup database
echo "🗄️ Backing up database..."
if [ -n "$MONGODB_URL" ]; then
    if command_exists mongodump; then
        mongodump --uri="$MONGODB_URL" --out="$BACKUP_DIR/$TIMESTAMP/database.dump"
        echo "✅ Database backup completed"
    else
        echo "⚠️ mongodump not found, skipping database backup"
    fi
else
    echo "⚠️ MONGODB_URL not set, skipping database backup"
fi

# Backup configuration files
echo "📁 Backing up configuration files..."
cp "$PROJECT_ROOT/.env.$ENVIRONMENT" "$BACKUP_DIR/$TIMESTAMP/.env.backup" 2>/dev/null || echo "⚠️ No environment file to backup"
cp "$PROJECT_ROOT/docker-compose.$ENVIRONMENT.yml" "$BACKUP_DIR/$TIMESTAMP/" 2>/dev/null || echo "⚠️ No docker-compose file to backup"

# Backup application version info
echo "🏷️ Recording application version..."
git rev-parse HEAD > "$BACKUP_DIR/$TIMESTAMP/git_commit.txt" 2>/dev/null || echo "unknown" > "$BACKUP_DIR/$TIMESTAMP/git_commit.txt"
git branch --show-current > "$BACKUP_DIR/$TIMESTAMP/git_branch.txt" 2>/dev/null || echo "unknown" > "$BACKUP_DIR/$TIMESTAMP/git_branch.txt"

# Create backup metadata
cat > "$BACKUP_DIR/$TIMESTAMP/backup_info.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "environment": "$ENVIRONMENT",
  "project": "ConnectED",
  "version": "$(cat package.json | grep '"version"' | cut -d'"' -f4)",
  "backup_type": "full"
}
EOF

# Compress backup
echo "🗜️ Compressing backup..."
cd "$BACKUP_DIR"
tar -czf "$TIMESTAMP.tar.gz" "$TIMESTAMP/"
rm -rf "$TIMESTAMP/"

# Clean old backups (keep last 10)
echo "🧹 Cleaning old backups..."
ls -t "$BACKUP_DIR"/*.tar.gz | tail -n +11 | xargs rm -f 2>/dev/null || echo "✅ No old backups to clean"

echo "✅ Backup completed successfully!"
echo "📦 Backup saved to: $BACKUP_DIR/$TIMESTAMP.tar.gz"

# Upload to remote storage (if configured)
if [ -n "$BACKUP_REMOTE" ]; then
    echo "☁️ Uploading backup to remote storage..."
    # Add your remote backup upload logic here
    # aws s3 cp "$BACKUP_DIR/$TIMESTAMP.tar.gz" "$BACKUP_REMOTE" || echo "⚠️ Remote upload failed"
fi
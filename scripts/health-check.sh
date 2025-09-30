#!/bin/bash

# ConnectED Health Check Script
# Usage: ./scripts/health-check.sh [url] [timeout]

set -e

URL=${1:-http://localhost:3000}
TIMEOUT=${2:-30}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🏥 Performing health check..."
echo "URL: $URL"
echo "Timeout: ${TIMEOUT}s"

# Function to check HTTP endpoint
check_http() {
    local url=$1
    local timeout=$2

    if curl -f -s --max-time "$timeout" "$url/health" >/dev/null 2>&1; then
        echo "✅ HTTP health check passed"
        return 0
    else
        echo "❌ HTTP health check failed"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    echo "🗄️ Checking database connectivity..."

    # Check MongoDB
    if [ -n "$MONGODB_URL" ]; then
        if command -v mongosh >/dev/null 2>&1; then
            if mongosh --eval "db.adminCommand('ping')" "$MONGODB_URL" >/dev/null 2>&1; then
                echo "✅ MongoDB connectivity check passed"
                return 0
            fi
        elif command -v mongo >/dev/null 2>&1; then
            if mongo --eval "db.adminCommand('ping')" "$MONGODB_URL" >/dev/null 2>&1; then
                echo "✅ MongoDB connectivity check passed"
                return 0
            fi
        fi
        echo "❌ MongoDB connectivity check failed"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis() {
    echo "🔴 Checking Redis connectivity..."

    if [ -n "$REDIS_URL" ]; then
        if command -v redis-cli >/dev/null 2>&1; then
            if redis-cli ping >/dev/null 2>&1; then
                echo "✅ Redis connectivity check passed"
                return 0
            fi
        fi
        echo "❌ Redis connectivity check failed"
        return 1
    fi
}

# Function to check Docker containers
check_containers() {
    echo "🐳 Checking Docker containers..."

    if command -v docker >/dev/null 2>&1; then
        # Check if containers are running
        RUNNING=$(docker ps --filter "name=connected" --filter "status=running" | wc -l)
        if [ "$RUNNING" -gt 1 ]; then
            echo "✅ Docker containers are running"
            return 0
        else
            echo "❌ No Docker containers are running"
            return 1
        fi
    fi
}

# Run all health checks
FAILED=0

check_http "$URL" "$TIMEOUT" || FAILED=$((FAILED + 1))
check_database || FAILED=$((FAILED + 1))
check_redis || FAILED=$((FAILED + 1))
check_containers || FAILED=$((FAILED + 1))

# Report results
if [ $FAILED -eq 0 ]; then
    echo "🎉 All health checks passed!"
    exit 0
else
    echo "❌ $FAILED health check(s) failed!"
    exit 1
fi
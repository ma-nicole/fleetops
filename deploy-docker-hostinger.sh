#!/bin/bash

# FleetOpt Docker Deployment Script for Hostinger
# Simplified docker-based deployment

set -e

echo "╔════════════════════════════════════════════╗"
echo "║ FleetOpt Docker Deploy (Hostinger)        ║"
echo "╚════════════════════════════════════════════╝"

# Check Docker
command -v docker >/dev/null 2>&1 || {
  echo "Docker not found. Please install Docker first."
  exit 1
}

# Configuration
IMAGE_PREFIX="fleetopt"
BACKEND_IMAGE="$IMAGE_PREFIX-backend:latest"
FRONTEND_IMAGE="$IMAGE_PREFIX-frontend:latest"
BACKEND_CONTAINER="fleetopt-backend"
FRONTEND_CONTAINER="fleetopt-frontend"
MYSQL_CONTAINER="fleetopt-db"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

# 1. Build images
log_info "Building Docker images..."
docker build -t "$BACKEND_IMAGE" ./backend
docker build -t "$FRONTEND_IMAGE" ./frontend

# 2. Stop existing containers
log_info "Stopping existing containers..."
docker stop $BACKEND_CONTAINER $FRONTEND_CONTAINER $MYSQL_CONTAINER 2>/dev/null || true

# 3. Remove old containers
log_info "Removing old containers..."
docker rm $BACKEND_CONTAINER $FRONTEND_CONTAINER $MYSQL_CONTAINER 2>/dev/null || true

# 4. Start MySQL
log_info "Starting MySQL container..."
docker run -d \
  --name $MYSQL_CONTAINER \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=fleetopt \
  -e MYSQL_USER=fleetopt \
  -e MYSQL_PASSWORD=fleetopt \
  -v fleetopt_data:/var/lib/mysql \
  -p 3306:3306 \
  mysql:8.0

sleep 10

# 5. Start Backend
log_info "Starting backend container..."
docker run -d \
  --name $BACKEND_CONTAINER \
  --link $MYSQL_CONTAINER:db \
  -e DATABASE_URL="mysql+pymysql://fleetopt:fleetopt@db:3306/fleetopt" \
  -e FRONTEND_URL="https://yourdomain.com" \
  -p 8000:8080 \
  "$BACKEND_IMAGE"

# 6. Initialize database
log_info "Initializing database..."
sleep 5
docker exec $BACKEND_CONTAINER python -c "
from app.db import engine
from app.models.base import Base
Base.metadata.create_all(bind=engine)
print('Database initialized')
" || log_warn "Database initialization (may already exist)"

# 7. Start Frontend
log_info "Starting frontend container..."
docker run -d \
  --name $FRONTEND_CONTAINER \
  -e NEXT_PUBLIC_API_URL="https://yourdomain.com/api" \
  -p 3000:8080 \
  "$FRONTEND_IMAGE"

# 8. Status
echo ""
log_info "Deployment complete!"
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║          Service Status                    ║"
echo "╚════════════════════════════════════════════╝"
echo ""
docker ps --filter "name=fleetopt" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Logs:"
echo "  Backend:   docker logs -f $BACKEND_CONTAINER"
echo "  Frontend:  docker logs -f $FRONTEND_CONTAINER"
echo "  Database:  docker logs -f $MYSQL_CONTAINER"
echo ""
echo "Stop services:"
echo "  docker stop $BACKEND_CONTAINER $FRONTEND_CONTAINER $MYSQL_CONTAINER"
echo ""
echo "Next: Configure Nginx reverse proxy and SSL"
echo ""

#!/bin/bash

# FleetOpt — Docker deployment para sa Hostinger KVM VPS (may Docker/root SSH).
# HINDI gagana ang script na ito sa Hostinger Shared Hosting (walang Docker).
#
# Bago tumakbo, i-export ang iyong tunay na domain/paths, hal.:
#   export DOMAIN=https://fleetops.mo-domain.com
#   export MYSQL_ROOT_PASSWORD=...
# o i-edit ang mga default sa ibaba.
#
set -e

echo "╔════════════════════════════════════════════╗"
echo "║ FleetOpt Docker Deploy (Hostinger VPS)      ║"
echo "╚════════════════════════════════════════════╝"

command -v docker >/dev/null 2>&1 || {
  echo "Docker not found. SA Hostinger: bumili ng KVM VPS, i-enable SSH, mag-install Docker."
  exit 1
}

# --- Domain & DB (PALITAN SA PRODUCTION) ---
DOMAIN="${DOMAIN:-https://yourdomain.com}"
DOMAIN="${DOMAIN%/}"
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-${DOMAIN}/api}"
FRONTEND_URL="${FRONTEND_URL:-${DOMAIN}}"
BACKEND_ORIGIN="${BACKEND_ORIGIN:-http://fleetopt-backend:8080}"
APP_ENV="${APP_ENV:-production}"
UPLOADS_ROOT="${UPLOADS_ROOT:-/app/uploads}"
CORS_ORIGINS="${CORS_ORIGINS:-${FRONTEND_URL}}"
if [ -z "${SECRET_KEY:-}" ]; then
  SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
fi

MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-rootpassword}"
MYSQL_DATABASE="${MYSQL_DATABASE:-fleetopt}"
MYSQL_USER="${MYSQL_USER:-fleetopt}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-fleetopt}"

IMAGE_PREFIX="fleetopt"
BACKEND_IMAGE="$IMAGE_PREFIX-backend:latest"
FRONTEND_IMAGE="$IMAGE_PREFIX-frontend:latest"
BACKEND_CONTAINER="fleetopt-backend"
FRONTEND_CONTAINER="fleetopt-frontend"
MYSQL_CONTAINER="fleetopt-db"
NETWORK="fleetopt_net"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

DB_HOST_INTERNAL="$MYSQL_CONTAINER"
DATABASE_URL="mysql+pymysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${DB_HOST_INTERNAL}:3306/${MYSQL_DATABASE}"

log_info "Configuration:"
echo "  FRONTEND_URL=$FRONTEND_URL"
echo "  NEXT_PUBLIC_API_URL (build)=$NEXT_PUBLIC_API_URL"
echo "  BACKEND_ORIGIN (build)=$BACKEND_ORIGIN"
echo "  DATABASE_URL host=$DB_HOST_INTERNAL"

# Docker network (hindi na --link; deprecated na iyon sa Docker API)
docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK"

log_info "Stopping/removing existing containers..."
docker stop "$BACKEND_CONTAINER" "$FRONTEND_CONTAINER" "$MYSQL_CONTAINER" 2>/dev/null || true
docker rm "$BACKEND_CONTAINER" "$FRONTEND_CONTAINER" "$MYSQL_CONTAINER" 2>/dev/null || true

log_info "Building images (frontend kailangan ang NEXT_PUBLIC_* sa build)..."
docker build -t "$BACKEND_IMAGE" ./backend
docker build \
  --build-arg "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}" \
  --build-arg "BACKEND_ORIGIN=${BACKEND_ORIGIN}" \
  -t "$FRONTEND_IMAGE" \
  ./frontend

log_info "Starting MySQL 8..."
docker run -d \
  --name "$MYSQL_CONTAINER" \
  --network "$NETWORK" \
  -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
  -e MYSQL_DATABASE="$MYSQL_DATABASE" \
  -e MYSQL_USER="$MYSQL_USER" \
  -e MYSQL_PASSWORD="$MYSQL_PASSWORD" \
  -v fleetopt_mysql_data:/var/lib/mysql \
  -p 3306:3306 \
  mysql:8.0

log_info "Waiting for MySQL to accept connections..."
for i in $(seq 1 45); do
  if docker exec "$MYSQL_CONTAINER" mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent 2>/dev/null; then
    break
  fi
  sleep 2
done

log_info "Starting backend..."
log_info "Running alembic migrations..."
docker run --rm \
  --network "$NETWORK" \
  -e APP_ENV="$APP_ENV" \
  -e SECRET_KEY="$SECRET_KEY" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e FRONTEND_URL="$FRONTEND_URL" \
  -e CORS_ORIGINS="$CORS_ORIGINS" \
  -e UPLOADS_ROOT="$UPLOADS_ROOT" \
  -v fleetopt_uploads:"$UPLOADS_ROOT" \
  "$BACKEND_IMAGE" \
  alembic upgrade head

log_info "Starting backend..."
docker run -d \
  --name "$BACKEND_CONTAINER" \
  --network "$NETWORK" \
  -e APP_ENV="$APP_ENV" \
  -e SECRET_KEY="$SECRET_KEY" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e FRONTEND_URL="$FRONTEND_URL" \
  -e CORS_ORIGINS="$CORS_ORIGINS" \
  -e UPLOADS_ROOT="$UPLOADS_ROOT" \
  -v fleetopt_uploads:"$UPLOADS_ROOT" \
  -p 8000:8080 \
  "$BACKEND_IMAGE"

log_info "Starting frontend..."
docker run -d \
  --name "$FRONTEND_CONTAINER" \
  --network "$NETWORK" \
  -p 3000:8080 \
  "$FRONTEND_IMAGE"

cat > /tmp/fleetopt-nginx.conf << 'EOF'
upstream backend {
    server 127.0.0.1:8000;
}

upstream frontend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    client_max_body_size 15M; # Backend max validated upload is 12MB

    location /api/ {
        proxy_pass http://backend/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://backend/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

echo ""
log_info "Tapos na ang container run."
docker ps --filter "name=fleetopt" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Sunod:"
echo "  1. Nginx reverse proxy: /api → 127.0.0.1:8000, /uploads → 127.0.0.1:8000/uploads, / → 127.0.0.1:3000"
echo "  2. Nginx template written to /tmp/fleetopt-nginx.conf"
echo "  3. SSL (Let's Encrypt sa VPS o Hostinger panel)"
echo "  4. Palitan ang lahat ng yourdomain placeholder at mga DB password via env exports"
echo "  5. Check probes: curl http://127.0.0.1:8000/health && curl http://127.0.0.1:8000/ready"
echo "  Logs: docker logs -f $BACKEND_CONTAINER | $FRONTEND_CONTAINER | $MYSQL_CONTAINER"

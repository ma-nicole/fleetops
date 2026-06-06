#!/bin/bash

# FleetOpt Database Migration Script
# Runs Alembic migrations against MySQL (production-safe path).

set -e

echo "╔════════════════════════════════════════════╗"
echo "║    FleetOpt Database Migration Script      ║"
echo "╚════════════════════════════════════════════╝"

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-fleetopt}"
DB_PASSWORD="${DB_PASSWORD:-fleetopt}"
DB_NAME="${DB_NAME:-fleetopt}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

# Check if MySQL is accessible
log_info "Checking database connectivity..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" "$DB_NAME" > /dev/null 2>&1 || \
  log_error "Cannot connect to database. Check credentials and ensure MySQL is running."

log_info "Connected to database: $DB_NAME on $DB_HOST"

# Run Alembic migrations
log_info "Running Alembic migrations..."
cd backend
source .venv/bin/activate
alembic upgrade head || log_error "Alembic migration failed"

# Insert seed data (optional)
log_info "Database migration completed successfully!"
echo ""
echo "✓ Alembic upgrade head applied"
echo "✓ Ready for production"
echo ""
echo "Next steps:"
echo "  1. Create initial users via API: POST /api/auth/register"
echo "  2. Configure roles via: POST /api/manager/drivers/profile"
echo "  3. Add trucks via: POST /api/admin/trucks"
echo ""

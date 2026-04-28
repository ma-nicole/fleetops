#!/bin/bash

# FleetOpt Database Migration Script
# This script initializes and migrates the PostgreSQL database

set -e

echo "╔════════════════════════════════════════════╗"
echo "║    FleetOpt Database Migration Script      ║"
echo "╚════════════════════════════════════════════╝"

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-fleetopt}"
DB_PASSWORD="${DB_PASSWORD:-fleetopt}"
DB_NAME="${DB_NAME:-fleetopt}"

export PGPASSWORD=$DB_PASSWORD

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

# Check if PostgreSQL is accessible
log_info "Checking database connectivity..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1 || \
  log_error "Cannot connect to database. Check credentials and ensure PostgreSQL is running."

log_info "Connected to database: $DB_NAME on $DB_HOST"

# Run Python migration script
log_info "Running database initialization..."
cd backend
source .venv/bin/activate

# Execute SQLAlchemy table creation via Python
python3 << 'EOF'
import sys
from app.db import engine
from app.models.base import Base

try:
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created successfully")
except Exception as e:
    print(f"✗ Error creating tables: {e}", file=sys.stderr)
    sys.exit(1)
EOF

if [ $? -ne 0 ]; then
  log_error "Database initialization failed"
fi

# Insert seed data (optional)
log_info "Database initialized successfully!"
echo ""
echo "✓ All tables created"
echo "✓ Ready for production"
echo ""
echo "Next steps:"
echo "  1. Create initial users via API: POST /api/auth/register"
echo "  2. Configure roles via: POST /api/manager/drivers/profile"
echo "  3. Add trucks via: POST /api/admin/trucks"
echo ""

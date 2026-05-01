#!/bin/bash

# FleetOpt Deployment Script for Hostinger
# This script sets up backend and frontend on Hostinger cloud hosting or VPS

set -e

echo "╔════════════════════════════════════════════╗"
echo "║  FleetOpt Deployment Script (Hostinger)   ║"
echo "╚════════════════════════════════════════════╝"

# Configuration
PROJECT_NAME="fleetopt"
BACKEND_PORT=8000
FRONTEND_PORT=3000
BACKEND_DIR="./backend"
FRONTEND_DIR="./frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
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

# 1. Check prerequisites
log_info "Checking prerequisites..."
command -v python3 >/dev/null 2>&1 || log_error "Python 3 is not installed"
command -v npm >/dev/null 2>&1 || log_error "Node.js/npm is not installed"
command -v git >/dev/null 2>&1 || log_warn "Git is not installed (optional)"

# 2. Setup Backend
log_info "Setting up backend..."
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
  log_info "Creating Python virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
log_info "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
  log_info "Creating .env file..."
  cat > .env << EOF
# Backend Environment Variables
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
DATABASE_URL=mysql+pymysql://fleetopt:fleetopt@localhost:3306/fleetopt
FRONTEND_URL=https://yourdomain.com
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Google Cloud SQL Configuration
USE_CLOUD_SQL=false
GCP_PROJECT_ID=
CLOUD_SQL_INSTANCE=
CLOUD_SQL_DB_USER=fleetopt
CLOUD_SQL_DB_PASSWORD=
CLOUD_SQL_DB_NAME=fleetopt

# Clerk Configuration
CLERK_API_KEY=
CLERK_FRONTEND_API=
USE_CLERK_AUTH=false
EOF
  log_warn "Created .env with placeholder values. Update these with your actual values."
fi

cd ..

# 3. Setup Frontend
log_info "Setting up frontend..."
cd "$FRONTEND_DIR"

log_info "Installing Node.js dependencies..."
npm install

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
  log_info "Creating .env.local file..."
  cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
EOF
  log_warn "Created .env.local with placeholder values. Update these with your actual values."
fi

log_info "Building frontend..."
npm run build

cd ..

# 4. Database initialization message
log_info "Database setup instructions (MySQL):"
echo "  1. Ensure MySQL 8.0+ is running on your server"
echo "  2. Create database: mysql -u root -p -e \"CREATE DATABASE fleetopt;\""
echo "  3. Create user: mysql -u root -p -e \"CREATE USER 'fleetopt'@'localhost' IDENTIFIED BY 'fleetopt';\""
echo "  4. Grant privileges: mysql -u root -p -e \"GRANT ALL PRIVILEGES ON fleetopt.* TO 'fleetopt'@'localhost'; FLUSH PRIVILEGES;\""

# 5. Systemd service setup (optional)
log_info "Setting up systemd services..."

# Backend service
cat > /tmp/fleetopt-backend.service << EOF
[Unit]
Description=FleetOpt Backend API
After=network.target

[Service]
Type=notify
User=$USER
WorkingDirectory=$(pwd)/backend
Environment="PATH=$(pwd)/backend/.venv/bin"
ExecStart=$(pwd)/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

log_warn "Backend systemd service template created at /tmp/fleetopt-backend.service"
log_warn "To install: sudo cp /tmp/fleetopt-backend.service /etc/systemd/system/"
log_warn "Then: sudo systemctl enable fleetopt-backend && sudo systemctl start fleetopt-backend"

# Frontend service
cat > /tmp/fleetopt-frontend.service << EOF
[Unit]
Description=FleetOpt Frontend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)/frontend
ExecStart=$(which npm) start -- -p $FRONTEND_PORT
Restart=always
RestartSec=10
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

log_warn "Frontend systemd service template created at /tmp/fleetopt-frontend.service"

# 6. Nginx configuration
log_info "Generating Nginx configuration..."
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
    client_max_body_size 10M;

    # Redirect HTTP to HTTPS (after SSL setup)
    # return 301 https://$server_name$request_uri;

    location /api/ {
        proxy_pass http://backend/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTPS configuration (uncomment after getting SSL certificate)
# server {
#     listen 443 ssl http2;
#     server_name yourdomain.com www.yourdomain.com;
#     client_max_body_size 10M;
#     
#     ssl_certificate /path/to/certificate.crt;
#     ssl_certificate_key /path/to/private.key;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     
#     location /api/ {
#         proxy_pass http://backend/api/;
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto https;
#         proxy_read_timeout 60s;
#         proxy_connect_timeout 60s;
#     }
#     
#     location / {
#         proxy_pass http://frontend;
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto https;
#     }
# }
EOF

log_warn "Nginx configuration template created at /tmp/fleetopt-nginx.conf"
log_warn "Copy to: sudo cp /tmp/fleetopt-nginx.conf /etc/nginx/sites-available/fleetopt"
log_warn "Enable: sudo ln -s /etc/nginx/sites-available/fleetopt /etc/nginx/sites-enabled/"
log_warn "Update yourdomain.com in the config, then: sudo nginx -t && sudo systemctl restart nginx"

# 7. Final instructions
echo ""
log_info "Deployment setup complete!"
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║         Next Steps for Hostinger           ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "1. Update environment variables:"
echo "   - Edit: $BACKEND_DIR/.env"
echo "   - Edit: $FRONTEND_DIR/.env.local"
echo ""
echo "2. Setup MySQL database:"
echo "   - Follow database initialization instructions above"
echo ""
echo "3. Start services:"
echo "   - Manual: cd backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo "   - Manual: cd frontend && npm start -- -p 3000"
echo ""
echo "4. Configure Nginx reverse proxy:"
echo "   - Follow the Nginx setup instructions above"
echo ""
echo "5. Enable HTTPS:"
echo "   - Use Hostinger's SSL certificate or Let's Encrypt"
echo "   - Update Nginx HTTPS configuration"
echo ""
echo "6. Verify deployment:"
echo "   - Backend health: curl http://localhost:8000/health"
echo "   - Frontend: http://yourdomain.com"
echo ""

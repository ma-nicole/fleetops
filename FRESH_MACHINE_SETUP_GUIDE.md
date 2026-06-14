# 🚀 FleetOps - Fresh Machine Setup Guide

**Last Updated:** June 12, 2026  
**Purpose:** Complete setup guide for running FleetOps on a fresh machine

---

## 📋 QUICK REFERENCE: System Requirements

| Component | Requirement | Status |
|-----------|-------------|--------|
| **Node.js** | 18+ (frontend: next@16, react@19) | ⚠️ Verify |
| **npm** | 10+ | ⚠️ Verify |
| **Python** | 3.12+ | ⚠️ Verify |
| **MySQL** | 5.7+ or MariaDB | ⚠️ Check XAMPP |
| **XAMPP** | MySQL module (must be running) | ⚠️ Required |

---

## ✅ STEP 1: FRONTEND SETUP REQUIREMENTS

### 1.1 Node.js & npm Verification

```bash
# Check Node.js version (need 18+)
node --version

# Check npm version (need 10+)
npm --version

# If needed, install from: https://nodejs.org/
```

**Frontend Dependencies:**
- **next**: 16.2.7 (Next.js framework)
- **react**: 19.0.0
- **react-dom**: 19.0.0
- **TypeScript**: 5.7.2
- **ESLint**: 9.17.0

**Additional Dependencies:**
- `countries-list`: 3.3.0
- `html5-qrcode`: 2.3.8
- `jspdf`: 4.2.1

### 1.2 Frontend Environment Configuration

**File:** `frontend/.env.development`

```env
NEXT_PUBLIC_API_URL=/api-proxy
BACKEND_ORIGIN=http://127.0.0.1:8000
NEXT_PUBLIC_DIESEL_PRICE_PHP_PER_LITER=74.75
NEXT_PUBLIC_TOLL_FEES_PHP_PER_TRIP=0
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=  # Optional if not using Clerk auth
```

**Current Status:**
```
✅ .env.development exists and is configured
✅ All required dependencies in package.json
✅ TypeScript configuration (tsconfig.json) exists
```

### 1.3 Common Frontend Issues on Fresh Machine

| Issue | Solution |
|-------|----------|
| `Cannot find module 'next'` | Run `npm install` in frontend directory |
| Port 3000 already in use | Change port in package.json dev script or kill process on :3000 |
| Build fails during compilation | Ensure TypeScript 5.7.2+ is installed |
| API connection errors | Verify BACKEND_ORIGIN=http://127.0.0.1:8000 in .env.development |

---

## ✅ STEP 2: BACKEND SETUP REQUIREMENTS

### 2.1 Python Version Verification

```bash
# Check Python version (need 3.12+)
python --version
# or
python -m pip --version
```

**Backend Dependencies:**
```
fastapi==0.115.6              # Web framework
uvicorn[standard]==0.34.0     # ASGI server
sqlalchemy==2.0.49            # ORM
alembic==1.14.1               # Database migrations
PyMySQL==1.1.1                # MySQL driver
python-jose==3.3.0            # JWT tokens
passlib[bcrypt]==1.7.4        # Password hashing
bcrypt==4.1.3                 # Bcrypt library
pydantic-settings==2.7.0      # Configuration management
email-validator==2.2.0        # Email validation
pyjwt[crypto]==2.10.1         # JWT cryptography
pandas>=2.3.0                 # Data analysis
numpy>=2.2.0                  # Numerical computing
scikit-learn>=1.6.0           # ML library
statsmodels>=0.14.5           # Statistical models
networkx==3.4.2               # Graph library
python-multipart==0.0.19      # Multipart form parsing
httpx==0.28.1                 # HTTP client
resend==2.3.0                 # Email API (optional)
clerk-sdk==1.1.1              # Clerk auth SDK (optional)
```

### 2.2 Backend Environment Configuration

**File:** `backend/.env`

```env
# Core Configuration
APP_ENV=development
SECRET_KEY=dev-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Database (XAMPP MySQL)
DATABASE_URL=mysql+pymysql://root:@localhost:3306/fleetopt

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000
UPLOADS_ROOT=uploads

# Optional Integrations (leave empty if not using)
USE_CLERK_AUTH=false
CLERK_API_KEY=
CLERK_FRONTEND_API=
CLERK_WEBHOOK_SECRET=

# Email Service (optional)
RESEND_API_KEY=
EMAIL_FROM=FleetOpt <notifications@fleetopt.com>
FEEDBACK_INBOX_EMAIL=
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30

# SMS Service (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Route Estimation
GOOGLE_MAPS_GEOCODING_API_KEY=
GOOGLE_MAPS_DIRECTIONS_API_KEY=
GOOGLE_DIRECTIONS_FALLBACK_TO_GEOCODING_KEY=true
USE_GOOGLE_DIRECTIONS_FOR_ROUTING=true
GEOCODING_USER_AGENT=FleetOpt/1.0 (+https://your-domain.example/contact)
OPENROUTESERVICE_API_KEY=
USE_TRUCK_ROUTE_PROFILE=true
OSRM_ROUTE_BASE_URL=https://router.project-osrm.org
OSRM_ROUTE_PROFILE=driving
USE_OSRM_DRIVING_DISTANCE=true
REQUIRE_ROUTED_DISTANCE=true

# Freight Computation
DIESEL_PRICE_PHP_PER_LITER=74.75
TOLL_FEES_PHP_PER_TRIP=0
```

**Current Status:**
```
✅ .env exists with MySQL configuration
✅ DATABASE_URL: mysql+pymysql://root:@localhost:3306/fleetopt (XAMPP default)
✅ Optional integrations left empty (safe for development)
```

### 2.3 Common Backend Issues on Fresh Machine

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: No module named 'fastapi'` | Run `python -m pip install -r requirements.txt` in backend |
| Port 8000 already in use | Kill process or specify different port in uvicorn |
| Database connection refused | Ensure MySQL is running in XAMPP |
| Alembic migration errors | Check DATABASE_URL is correct in backend/.env |
| Virtual environment not found | Create with `python -m venv .venv` then activate |

---

## ✅ STEP 3: DATABASE SETUP REQUIREMENTS

### 3.1 MySQL Database Verification

**Required:** MySQL 5.7+ or MariaDB (via XAMPP)

**Database Details:**
- **Database Name:** `fleetopt`
- **User:** `fleetopt` (or `root` for XAMPP default)
- **Host:** `localhost`
- **Port:** `3306`

### 3.2 XAMPP MySQL Setup

```bash
# 1. Ensure XAMPP Control Panel is running MySQL
# 2. Verify connection with command:
mysql -u root -p -h localhost

# If no password (XAMPP default):
mysql -u root -h localhost
```

**Connection String in .env:**
```
DATABASE_URL=mysql+pymysql://root:@localhost:3306/fleetopt
```

### 3.3 Database Creation & Configuration

```sql
-- Create database if not exists
CREATE DATABASE IF NOT EXISTS fleetopt;

-- Create user and grant privileges (optional, if not using root)
CREATE USER IF NOT EXISTS 'fleetopt'@'localhost' IDENTIFIED BY 'fleetopt';
GRANT ALL PRIVILEGES ON fleetopt.* TO 'fleetopt'@'localhost';
FLUSH PRIVILEGES;
```

### 3.4 Database Migrations

**Alembic Migration Files Located:**
- `backend/alembic/versions/20260606_0001_initial_schema.py` - Initial schema
- `backend/alembic/versions/20260607_0002_toll_matrix.py` - Toll matrix tables
- `backend/alembic/versions/20260607_0003_toll_plaza_aliases.py` - Toll plaza aliases

**Apply Migrations:**
```bash
cd backend
alembic upgrade head
```

### 3.5 Database Schema Overview

**Core Tables:**
- `users` - User accounts, roles, authentication
- `bookings` - Booking requests from customers
- `trips` - Trip assignments and tracking
- `trucks` - Fleet vehicles
- `driver_profiles` - Driver information
- `helper_profiles` - Helper personnel
- `routes` - Route history and optimization
- `ratings` - Customer feedback and ratings
- `payments` - Payment transactions
- `toll_logs` - Toll fee tracking
- `fuel_logs` - Fuel consumption data
- `maintenance_records` - Vehicle maintenance
- `attendance_records` - Staff attendance
- `completion_reports` - Trip completion details
- `feedback` - Customer feedback
- `toll_plaza_matrix` - Toll pricing
- `toll_plaza_aliases` - Toll location names

**User Roles:**
- `customer` - Booking customers
- `driver` - Vehicle operators
- `dispatcher` - Trip assignment
- `helper` - Support staff
- `manager` - Operations manager
- `admin` - System administrator

### 3.6 Database Verification

```bash
# Check database exists
mysql -u root -h localhost -e "SHOW DATABASES LIKE 'fleetopt';"

# Check tables exist (after migrations)
mysql -u root -h localhost -e "USE fleetopt; SHOW TABLES;"

# Verify key tables
mysql -u root -h localhost -e "USE fleetopt; DESCRIBE users;"
```

---

## ✅ STEP 4: ENVIRONMENT FILES CHECKLIST

### 4.1 Backend Environment File

**Location:** `backend/.env`

**Required Variables:**
```
✅ APP_ENV=development
✅ SECRET_KEY=dev-key-change-in-production (can use default for dev)
✅ ACCESS_TOKEN_EXPIRE_MINUTES=1440
✅ DATABASE_URL=mysql+pymysql://root:@localhost:3306/fleetopt
✅ FRONTEND_URL=http://localhost:3000
✅ UPLOADS_ROOT=uploads
✅ USE_CLERK_AUTH=false (optional, disabled by default)
```

**Optional/Development Variables:**
```
⚠️ CLERK_API_KEY= (only if using Clerk authentication)
⚠️ GOOGLE_MAPS_GEOCODING_API_KEY= (needed for route optimization)
⚠️ GOOGLE_MAPS_DIRECTIONS_API_KEY= (needed for route optimization)
⚠️ RESEND_API_KEY= (for email notifications)
```

**Current Status:** ✅ All required variables present

### 4.2 Frontend Environment File

**Location:** `frontend/.env.development`

**Required Variables:**
```
✅ NEXT_PUBLIC_API_URL=/api-proxy
✅ BACKEND_ORIGIN=http://127.0.0.1:8000
✅ NEXT_PUBLIC_DIESEL_PRICE_PHP_PER_LITER=74.75
✅ NEXT_PUBLIC_TOLL_FEES_PHP_PER_TRIP=0
```

**Optional Variables:**
```
⚠️ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= (only if using Clerk authentication)
```

**Current Status:** ✅ All required variables present

### 4.3 Root Environment

**Location:** `.env` (if needed in project root)

**Not typically required for development** - configuration inherited from backend/.env and frontend/.env.development

---

## 🚀 STEP 5: COMPLETE STARTUP PROCESS

### 5.1 PREREQUISITE CHECKLIST

Before starting, verify:

```bash
# ✅ Node.js 18+
node --version

# ✅ Python 3.12+
python --version

# ✅ MySQL Running
mysql -u root -h localhost -e "SELECT 1;"

# ✅ Database exists
mysql -u root -h localhost -e "SHOW DATABASES LIKE 'fleetopt';"
```

### 5.2 METHOD 1: AUTOMATED SETUP (All-in-One)

**From Project Root:**

```bash
# Run complete setup (installs dependencies, runs migrations, seeds database)
npm run setup

# Start both backend and frontend together
npm run dev
```

**What happens:**
- Installs Python dependencies via pip
- Installs frontend npm packages
- Installs root npm packages
- Runs backend on http://127.0.0.1:8000
- Runs frontend on http://localhost:3000 (after backend is ready)

**Stop with:** `Ctrl+C`

### 5.3 METHOD 2: MANUAL SETUP (Separate Terminals)

#### Terminal 1 - Database Migrations

```bash
cd backend

# Create virtual environment (if needed)
python -m venv .venv

# Activate virtual environment
# Windows CMD:
.venv\Scripts\activate.bat
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
python -m pip install -r requirements.txt

# Apply database migrations
alembic upgrade head
```

#### Terminal 2 - Start Backend

```bash
cd backend

# Activate virtual environment (if not already active)
.venv\Scripts\activate.bat  # Windows CMD
# or
.venv\Scripts\Activate.ps1  # Windows PowerShell

# Start uvicorn server
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Verify with: http://127.0.0.1:8000/docs
```

#### Terminal 3 - Start Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Frontend will be available at: http://localhost:3000
```

### 5.4 DATABASE SEEDING (Optional - Test Data)

**After backend is running:**

```bash
# From project root
python seed_db.py

# If password hashes are invalid (unlikely on fresh machine):
python seed_db.py --repair-passwords
```

**Test Users Created:**
- customer1@fleetops.com / password
- customer2@fleetops.com / password
- driver1@fleetops.com / password
- dispatcher1@fleetops.com / password
- manager1@fleetops.com / password
- admin@fleetops.com / password

---

## ✅ STEP 6: VERIFICATION CHECKLIST

### 6.1 Backend Verification

```bash
# Test backend health endpoint
curl http://127.0.0.1:8000/health

# Expected Response:
# {"status": "ok"}

# Access Swagger API documentation
# Open browser: http://127.0.0.1:8000/docs
```

### 6.2 Frontend Verification - Login Page

**URL:** http://localhost:3000

**Expected:**
- ✅ Login form loads
- ✅ Email input field visible
- ✅ Password input field visible
- ✅ "Sign In" button clickable
- ✅ "Create Account" link visible
- ✅ "Forgot Password" link visible

**Test Login:**
```
Email: customer1@fleetops.com
Password: password
```

### 6.3 Dashboard Verification (After Login)

#### Admin Dashboard
- ✅ Admin dashboard loads at `/admin/dashboard`
- ✅ Navigation sidebar visible
- ✅ Charts and analytics panels visible
- ✅ User management section accessible

#### Dispatcher Dashboard
- ✅ Dispatcher dashboard loads at `/dispatcher/dashboard`
- ✅ Trip assignment panel visible
- ✅ Scheduled bookings viewable
- ✅ Driver activity tracker visible

#### Driver Dashboard
- ✅ Driver dashboard loads at `/driver/dashboard`
- ✅ Active trips visible
- ✅ Route information displayed
- ✅ Earnings/pay information shown

#### Helper Dashboard
- ✅ Helper dashboard loads at `/helper/dashboard`
- ✅ Assigned trips visible
- ✅ Task list displayed

#### Customer Dashboard (Portal)
- ✅ Customer portal loads at `/dashboard`
- ✅ Booking form accessible
- ✅ Cost estimation working
- ✅ Previous bookings visible

#### Manager Dashboard
- ✅ Manager dashboard loads at `/manager/dashboard`
- ✅ Analytics overview visible
- ✅ Fleet metrics displayed
- ✅ Financial reports accessible

### 6.4 API Endpoints Verification

```bash
# Health check
curl http://127.0.0.1:8000/health

# Authentication endpoints
curl http://127.0.0.1:8000/api/auth/login -X POST

# Check Swagger docs for all endpoints
# http://127.0.0.1:8000/docs
```

---

## ❌ TROUBLESHOOTING COMMON ISSUES

### Issue 1: "ModuleNotFoundError: No module named 'fastapi'"

**Cause:** Backend dependencies not installed

**Solution:**
```bash
cd backend
python -m pip install -r requirements.txt
```

### Issue 2: "Error: connect ECONNREFUSED 127.0.0.1:8000"

**Cause:** Backend server not running

**Solution:**
```bash
# Terminal 1 - Ensure backend is running
cd backend
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 - Then start frontend
cd frontend
npm run dev
```

### Issue 3: "Can't connect to MySQL server on 'localhost' (10061)"

**Cause:** MySQL not running in XAMPP

**Solution:**
1. Open XAMPP Control Panel
2. Click "Start" on MySQL module
3. Verify in cmd: `mysql -u root -h localhost -e "SELECT 1;"`

### Issue 4: "PORT 3000 is already in use"

**Cause:** Another process running on port 3000

**Solution:**
```bash
# Find and kill process on port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or change port in next.config.mjs
```

### Issue 5: "DATABASE_URL 'fleetopt' does not exist"

**Cause:** Database not created or incorrect credentials

**Solution:**
```sql
-- Create database
mysql -u root -h localhost -e "CREATE DATABASE fleetopt;"

-- Or update DATABASE_URL in backend/.env
```

### Issue 6: "TypeScript compilation error"

**Cause:** Outdated or missing dependencies

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue 7: "Alembic upgrade fails"

**Cause:** Database not connected or schema conflict

**Solution:**
```bash
cd backend

# Verify connection
python -c "from app.core.config import settings; print(settings.database_url)"

# Check current revision
alembic current

# Upgrade to head
alembic upgrade head
```

### Issue 8: "Login returns 'Invalid credentials'"

**Cause:** Database not seeded or password hashes invalid

**Solution:**
```bash
# From project root, seed test users
python seed_db.py

# Or repair password hashes (development only)
python seed_db.py --repair-passwords
```

### Issue 9: "Cannot find .venv or Python environment"

**Cause:** Virtual environment not created or not activated

**Solution:**
```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows CMD)
.venv\Scripts\activate.bat

# Or activate (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Install dependencies
python -m pip install -r requirements.txt
```

### Issue 10: "npm command not found"

**Cause:** Node.js not installed or not in PATH

**Solution:**
1. Install Node.js from https://nodejs.org/
2. Close and reopen terminal
3. Verify: `node --version` and `npm --version`

---

## 📊 SUMMARY: Fresh Machine Setup Checklist

### Pre-Setup
- [ ] Node.js 18+ installed
- [ ] npm 10+ installed
- [ ] Python 3.12+ installed
- [ ] XAMPP with MySQL installed and running
- [ ] Git repository cloned

### Backend Setup
- [ ] Backend .env file exists with MySQL configuration
- [ ] Python virtual environment created (.venv)
- [ ] Python dependencies installed (pip install -r requirements.txt)
- [ ] Database created (CREATE DATABASE fleetopt)
- [ ] Migrations applied (alembic upgrade head)
- [ ] Backend starts successfully (python -m uvicorn...)

### Frontend Setup
- [ ] Frontend .env.development exists and configured
- [ ] npm dependencies installed (npm install)
- [ ] Frontend builds successfully (npm run build)
- [ ] Frontend starts successfully (npm run dev)

### Verification
- [ ] Backend health check passes (curl http://127.0.0.1:8000/health)
- [ ] Login page loads (http://localhost:3000)
- [ ] Login with test credentials works
- [ ] All dashboards load correctly
- [ ] API Swagger docs accessible (http://127.0.0.1:8000/docs)

### Optional Enhancements
- [ ] Database seeded with test data (python seed_db.py)
- [ ] Clerk authentication configured (if needed)
- [ ] Google Maps API keys configured (for route optimization)
- [ ] Email service configured (if needed)

---

## 📞 QUICK START COMMAND REFERENCE

```bash
# Complete automated setup (from project root)
npm run setup
npm run dev

# Or manual method:

# Terminal 1 - Database and Backend
cd backend
python -m venv .venv
.venv\Scripts\activate.bat  # Windows
python -m pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev

# Terminal 3 - Seed database (optional)
cd /path/to/project/root
python seed_db.py
```

---

## 📝 NOTES FOR FRESH MACHINE SETUP

1. **Windows Python Issue:** If `npm run setup` fails with pip errors, set `FLEETOPS_PYTHON` environment variable to the full Python path
2. **MySQL Port:** Default XAMPP uses port 3306 - ensure not conflicting
3. **API Proxy:** Frontend uses `/api-proxy/*` to avoid CORS issues (proxies to backend)
4. **Database:** SQLite NOT supported - must use MySQL
5. **Clerk Auth:** Optional authentication provider - disabled by default
6. **Route Optimization:** Requires Google Maps API keys for full functionality (optional)
7. **Email Notifications:** Requires Resend API key (optional for development)

---

**Generated:** June 12, 2026 | **For:** Fresh Machine Setup

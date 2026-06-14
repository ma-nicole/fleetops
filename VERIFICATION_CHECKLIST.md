# ⚡ FleetOps - Fresh Machine Verification Checklist

**Quick Reference for Verifying Fresh Machine Setup**

---

## 🔍 PRE-STARTUP VERIFICATION

### System Requirements Check

```bash
# Check Node.js version (need 18+)
node --version
# Expected: v18.x.x or higher

# Check npm version
npm --version
# Expected: 10.x.x or higher

# Check Python version (need 3.12+)
python --version
# Expected: Python 3.12.x or higher

# Check MySQL is running
mysql -u root -h localhost -e "SELECT VERSION();"
# Expected: MySQL version output

# Verify database exists
mysql -u root -h localhost -e "SHOW DATABASES LIKE 'fleetopt';"
# Expected: | fleetopt |
```

### Environment Files Check

**Backend:** `backend/.env`
```bash
# Windows - Check if file exists
if exist backend\.env (echo "✅ Backend .env exists") else (echo "❌ Missing")

# Linux/Mac
[ -f backend/.env ] && echo "✅ Backend .env exists" || echo "❌ Missing"

# Verify DATABASE_URL
grep DATABASE_URL backend/.env
# Expected: DATABASE_URL=mysql+pymysql://root:@localhost:3306/fleetopt
```

**Frontend:** `frontend/.env.development`
```bash
# Check if file exists
[ -f frontend/.env.development ] && echo "✅ Frontend .env.development exists" || echo "❌ Missing"

# Verify API URL
grep NEXT_PUBLIC_API_URL frontend/.env.development
# Expected: NEXT_PUBLIC_API_URL=/api-proxy
```

---

## 🚀 STARTUP VERIFICATION

### Step 1: Start MySQL

```bash
# XAMPP: Start MySQL via Control Panel
# OR verify it's running:
mysql -u root -h localhost -e "SELECT 1;"
# Expected: Output "1" with no errors
```

### Step 2: Apply Database Migrations

```bash
cd backend

# Check current migration status
alembic current
# Expected: Should show current revision

# Apply all pending migrations
alembic upgrade head
# Expected: Output showing migrations applied or "head is already at..."

# Verify tables were created
mysql -u root -h localhost -e "USE fleetopt; SHOW TABLES;" | head -20
# Expected: List of tables including 'users', 'bookings', 'trips', etc.
```

### Step 3: Start Backend

```bash
cd backend

# Activate virtual environment (if using separate terminal)
# Windows CMD:
.venv\Scripts\activate.bat
# Windows PowerShell:
.venv\Scripts\Activate.ps1

# Start backend
python -m uvicorn app.main:app --reload --port 8000
# Expected output:
# INFO:     Uvicorn running on http://127.0.0.1:8000
# INFO:     Application startup complete
```

### Step 4: Verify Backend Health

**In new terminal:**
```bash
# Check health endpoint
curl http://127.0.0.1:8000/health
# Expected: {"status":"ok"}

# Or in PowerShell:
(Invoke-WebRequest -Uri http://127.0.0.1:8000/health).Content
```

### Step 5: Start Frontend

```bash
cd frontend

# Start development server
npm run dev
# Expected output:
# ▲ Next.js 16.2.7
#   - Local:        http://localhost:3000
#   - Network:      http://[IP]:3000
# ✓ Ready in XXXms
```

### Step 6: Verify Frontend Loads

**Open browser:** `http://localhost:3000`

**Expected:**
- ✅ Page loads without errors in console
- ✅ Login form visible with email/password fields
- ✅ "Sign In" button visible and clickable
- ✅ "Create Account" link visible
- ✅ "Forgot Password" link visible

---

## 🧪 FUNCTIONALITY VERIFICATION

### Login Verification (After Seeding Database)

**Test Credentials:**
```
Email: customer1@fleetops.com
Password: password
```

**Steps:**
1. Go to http://localhost:3000
2. Enter email: `customer1@fleetops.com`
3. Enter password: `password`
4. Click "Sign In"
5. Should redirect to customer dashboard

**Expected:** ✅ Successfully logged in, no error messages

### Dashboard Verification

#### Customer Dashboard
```bash
# After login
# URL should be: http://localhost:3000/dashboard
# Visible elements:
# ✅ Booking form or recent bookings
# ✅ Navigation sidebar
# ✅ User profile menu
# ✅ Cost estimation panels (if on booking page)
```

#### Admin Dashboard
```bash
# Login with admin account:
# Email: admin@fleetops.com
# Password: password
# URL: http://localhost:3000/admin/dashboard
# Visible elements:
# ✅ Analytics charts
# ✅ User management section
# ✅ System configuration
# ✅ Sidebar navigation
```

#### Dispatcher Dashboard
```bash
# Login with dispatcher:
# Email: dispatcher1@fleetops.com
# Password: password
# URL: http://localhost:3000/dispatcher/dashboard
# Visible elements:
# ✅ Trip assignment panel
# ✅ Active bookings list
# ✅ Driver activity
# ✅ Scheduled operations
```

#### Driver Dashboard
```bash
# Login with driver:
# Email: driver1@fleetops.com
# Password: password
# URL: http://localhost:3000/driver/dashboard
# Visible elements:
# ✅ Active trips
# ✅ Route information
# ✅ Earnings/Pay info
# ✅ Vehicle status
```

#### Manager Dashboard
```bash
# Login with manager:
# Email: manager1@fleetops.com
# Password: password
# URL: http://localhost:3000/manager/dashboard
# Visible elements:
# ✅ Analytics overview
# ✅ Fleet metrics
# ✅ Financial data
# ✅ Performance KPIs
```

#### Helper Dashboard
```bash
# Login with helper:
# Email: helper1@fleetops.com
# Password: password
# URL: http://localhost:3000/helper/dashboard
# Visible elements:
# ✅ Assigned trips
# ✅ Task list
# ✅ Activity tracking
```

### API Verification

```bash
# Swagger Documentation
curl http://127.0.0.1:8000/docs
# Expected: Swagger UI loads in browser

# Authentication Test
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer1@fleetops.com","password":"password"}'
# Expected: Returns JWT token

# Health Endpoint
curl http://127.0.0.1:8000/health
# Expected: {"status":"ok"}
```

---

## ✅ COMPREHENSIVE VERIFICATION MATRIX

| Component | Check | Pass | Notes |
|-----------|-------|------|-------|
| **Node.js** | `node --version` >= 18 | [ ] | Required for frontend |
| **npm** | `npm --version` >= 10 | [ ] | Package manager |
| **Python** | `python --version` >= 3.12 | [ ] | Backend runtime |
| **MySQL** | `mysql -u root -h localhost -e "SELECT 1"` | [ ] | Database server running |
| **Database** | `mysql ... SHOW DATABASES LIKE 'fleetopt'` | [ ] | Database exists |
| **Backend .env** | File exists: `backend/.env` | [ ] | Configuration file |
| **Frontend .env** | File exists: `frontend/.env.development` | [ ] | Configuration file |
| **Migrations** | `alembic current` shows head | [ ] | Database schema up-to-date |
| **Backend Health** | `curl http://127.0.0.1:8000/health` | [ ] | API server responding |
| **Frontend Load** | http://localhost:3000 loads | [ ] | Web app accessible |
| **Login Works** | Test login succeeds | [ ] | Authentication working |
| **Customer Dashboard** | Page loads after login | [ ] | Frontend routing |
| **Admin Dashboard** | Admin can access `/admin/dashboard` | [ ] | Role-based access |
| **Dispatcher Dashboard** | Dispatcher can access `/dispatcher/dashboard` | [ ] | Role-based access |
| **Driver Dashboard** | Driver can access `/driver/dashboard` | [ ] | Role-based access |
| **Manager Dashboard** | Manager can access `/manager/dashboard` | [ ] | Role-based access |
| **Helper Dashboard** | Helper can access `/helper/dashboard` | [ ] | Role-based access |

---

## 🆘 QUICK TROUBLESHOOTING

### Problem: Backend won't start

```bash
# Check if port 8000 is in use
netstat -ano | findstr :8000  # Windows

# Kill process on port 8000
taskkill /PID <PID> /F

# Check database connection
cd backend
python -c "from app.core.config import settings; from sqlalchemy import create_engine; engine = create_engine(settings.database_url); engine.connect()"
```

### Problem: Frontend won't start

```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000  # Windows

# Kill process on port 3000
taskkill /PID <PID> /F

# Check dependencies
cd frontend
npm install
npm run build
npm run dev:only
```

### Problem: Cannot connect to MySQL

```bash
# Verify XAMPP MySQL is running
# Or check manual installation:
mysql -u root -h localhost -e "SELECT 1;"

# Check DATABASE_URL in backend/.env
grep DATABASE_URL backend/.env
```

### Problem: Login fails

```bash
# Verify database has users
mysql -u root -h localhost -e "USE fleetopt; SELECT email FROM users LIMIT 5;"

# If empty, seed database
python seed_db.py

# If password hashes are broken (unlikely on fresh install)
python seed_db.py --repair-passwords
```

### Problem: TypeScript errors

```bash
# Clear build cache and reinstall
cd frontend
rm -rf node_modules package-lock.json .next
npm install
npm run build
```

### Problem: Alembic migration fails

```bash
# Check current revision
cd backend
alembic current

# Check migration history
alembic history

# If stuck, check database:
mysql -u root -h localhost -e "USE fleetopt; SHOW TABLES LIKE 'alembic%';"
```

---

## 📋 FINAL CHECKLIST

Before declaring setup complete:

- [ ] All system requirements installed and verified
- [ ] Environment files (.env) properly configured
- [ ] Database created and migrations applied
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Backend health endpoint responds
- [ ] Login page loads
- [ ] Login with test credentials succeeds
- [ ] All role dashboards accessible
- [ ] No console errors in browser
- [ ] No error logs in terminal

**✅ Setup Complete When All Boxes Are Checked**

---

## 📞 USEFUL COMMANDS FOR FRESH SETUP

### Quick Start (All-in-One)
```bash
# From project root
npm run setup    # Installs everything
npm run dev      # Starts backend + frontend
```

### Manual Full Setup
```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate.bat  # Windows
python -m pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Database Operations
```bash
# Create database
mysql -u root -h localhost -e "CREATE DATABASE fleetopt;"

# Seed with test data
python seed_db.py

# Repair passwords
python seed_db.py --repair-passwords

# Check migrations
cd backend
alembic current
alembic history
alembic upgrade head
```

### Verification Commands
```bash
# Backend health
curl http://127.0.0.1:8000/health

# List all API endpoints
curl http://127.0.0.1:8000/docs

# Check database connection
mysql -u root -h localhost -e "SHOW DATABASES;"

# List all tables
mysql -u root -h localhost -e "USE fleetopt; SHOW TABLES;"
```

### Kill Process on Port
```bash
# Windows - Find process on port
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac - Find and kill
lsof -i :8000
kill -9 <PID>
```

---

**Created:** June 12, 2026  
**For:** Fresh FleetOps Machine Setup Verification

# 🐛 FleetOps - Troubleshooting Guide for Fresh Machine Setup

**Comprehensive Troubleshooting for Fresh Machine Setup Issues**

---

## 🔴 CRITICAL ISSUES & SOLUTIONS

### 1. MySQL Connection Refused

**Error Message:**
```
Can't connect to MySQL server on 'localhost' (10061)
Error: connect ECONNREFUSED 127.0.0.1:3306
SQLAlchemy Error: Connection refused
```

**Root Causes:**
- XAMPP MySQL module not started
- MySQL not installed
- Port 3306 in use by another process
- Incorrect DATABASE_URL credentials

**Solutions:**

**Step 1: Verify XAMPP MySQL is Running**
```bash
# Open XAMPP Control Panel and click "Start" on MySQL module
# Verify it's running:
mysql -u root -h localhost -e "SELECT 1;"
```

**Step 2: Check Port is Available**
```bash
# Windows - Find process on port 3306
netstat -ano | findstr :3306

# If something is using port 3306:
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3306
kill -9 <PID>
```

**Step 3: Verify DATABASE_URL**
```bash
# Check backend/.env
grep DATABASE_URL backend/.env
# Expected: DATABASE_URL=mysql+pymysql://root:@localhost:3306/fleetopt

# If using password:
DATABASE_URL=mysql+pymysql://root:yourpassword@localhost:3306/fleetopt
```

**Step 4: Test Connection Directly**
```bash
# Try direct MySQL connection
mysql -u root -h localhost -e "SHOW DATABASES;"

# If that works but app doesn't, issue is in DATABASE_URL format
# If that fails, MySQL is not accessible
```

---

### 2. Backend Won't Start - "ModuleNotFoundError: No module named 'fastapi'"

**Error Message:**
```
ModuleNotFoundError: No module named 'fastapi'
ModuleNotFoundError: No module named 'sqlalchemy'
No module named 'uvicorn'
```

**Root Causes:**
- Python dependencies not installed
- Wrong Python interpreter
- Virtual environment not activated

**Solutions:**

**Step 1: Install Dependencies**
```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows CMD:
.venv\Scripts\activate.bat

# Windows PowerShell:
.venv\Scripts\Activate.ps1

# macOS/Linux:
source .venv/bin/activate

# Install requirements
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

**Step 2: Verify Python Version**
```bash
# Check Python version (need 3.12+)
python --version

# If needed, install Python 3.12+ from https://www.python.org/
```

**Step 3: Use Correct Python Interpreter**
```bash
# If you have multiple Python versions:

# Find Python 3.12 path
where python  # Windows
which python  # Mac/Linux

# Use full path
C:\Users\Marion\AppData\Local\Programs\Python\Python312\python.exe -m pip install -r requirements.txt
```

**Step 4: Verify Installation**
```bash
# Test import
python -c "import fastapi; print(fastapi.__version__)"
# Expected: 0.115.6

python -c "import sqlalchemy; print(sqlalchemy.__version__)"
# Expected: 2.0.49
```

---

### 3. Frontend Won't Start - "Cannot find module 'next'"

**Error Message:**
```
Cannot find module 'next'
Error: Cannot find module 'react'
Module not found: Can't resolve 'react-dom'
```

**Root Causes:**
- npm dependencies not installed
- node_modules corrupted
- npm installation failed

**Solutions:**

**Step 1: Clear and Reinstall**
```bash
cd frontend

# Remove old installations
rm -rf node_modules package-lock.json .next

# Clear npm cache
npm cache clean --force

# Reinstall
npm install
```

**Step 2: Check Node.js Version**
```bash
# Need Node.js 18+
node --version
# Expected: v18.x.x or higher

# Need npm 10+
npm --version
# Expected: 10.x.x or higher

# If outdated, install from https://nodejs.org/
```

**Step 3: Verify Installation**
```bash
# Check if node_modules has Next.js
ls node_modules/next
# or
dir node_modules\next

# Should have many files
```

**Step 4: Rebuild TypeScript**
```bash
cd frontend

# Clear build cache
rm -rf .next

# Build again
npm run build
```

---

### 4. Port Already in Use

**Backend Error:**
```
Address already in use: ('127.0.0.1', 8000)
OSError: [WinError 10048] Only one usage of each socket address
```

**Frontend Error:**
```
Error: listen EADDRINUSE: address already in use 127.0.0.1:3000
```

**Solutions:**

**For Port 8000 (Backend):**
```bash
# Windows - Find process on port 8000
netstat -ano | findstr :8000

# Kill the process
taskkill /PID <PID> /F

# Or start backend on different port
python -m uvicorn app.main:app --reload --port 9000
# Then update frontend/.env.development: BACKEND_ORIGIN=http://127.0.0.1:9000
```

**For Port 3000 (Frontend):**
```bash
# Windows - Find process on port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID> /F

# Or modify frontend package.json to use different port
```

**Mac/Linux:**
```bash
# Find process
lsof -i :8000
# Kill it
kill -9 <PID>
```

---

### 5. Database Doesn't Exist

**Error Message:**
```
UnknownDatabaseError: (pymysql.err.OperationalError) (1049, "Unknown database 'fleetopt'")
```

**Solutions:**

**Step 1: Create Database**
```bash
# Connect to MySQL
mysql -u root -h localhost

# Create database
CREATE DATABASE IF NOT EXISTS fleetopt;

# Verify
SHOW DATABASES LIKE 'fleetopt';
```

**Step 2: Apply Migrations**
```bash
cd backend

# Run migrations to create tables
alembic upgrade head

# Verify tables were created
mysql -u root -h localhost -e "USE fleetopt; SHOW TABLES;"
```

**Step 3: Seed Data (Optional)**
```bash
# From project root
python seed_db.py

# Verify
mysql -u root -h localhost -e "USE fleetopt; SELECT COUNT(*) FROM users;"
```

---

### 6. Alembic Migration Fails

**Error Message:**
```
Error: Target database is not up to date
FAILED: Current revision does not match target revision
Foreign key constraint error during migration
```

**Solutions:**

**Step 1: Check Migration Status**
```bash
cd backend

# See current revision
alembic current
# Expected: Some revision number or "head" if up-to-date

# See migration history
alembic history
```

**Step 2: Apply Pending Migrations**
```bash
cd backend

# Upgrade to head
alembic upgrade head

# If that fails, check specific revision
alembic upgrade 20260607_0003
```

**Step 3: Debug Migration Issues**
```bash
# See actual migration SQL
alembic upgrade head --sql

# Check what's in the database
mysql -u root -h localhost -e "USE fleetopt; SHOW TABLES;"

# Check if alembic table exists
mysql -u root -h localhost -e "USE fleetopt; SELECT * FROM alembic_version;"
```

**Step 4: Reset if Completely Broken**
```bash
# WARNING: This deletes all data!
mysql -u root -h localhost -e "DROP DATABASE fleetopt;"
mysql -u root -h localhost -e "CREATE DATABASE fleetopt;"

cd backend
alembic upgrade head

# Re-seed
python seed_db.py
```

---

## 🟡 MEDIUM SEVERITY ISSUES

### 7. Login Fails - "Invalid credentials"

**Error:**
```
Login returns: {"detail": "Invalid credentials"}
User authentication fails
```

**Solutions:**

**Step 1: Verify Test Users Exist**
```bash
# Check database for users
mysql -u root -h localhost -e "USE fleetopt; SELECT email, role FROM users LIMIT 10;"

# If empty, seed database
python seed_db.py
```

**Step 2: Check Password Hashes**
```bash
# If passwords were imported incorrectly
python seed_db.py --repair-passwords

# This sets ALL user passwords to "password"
```

**Step 3: Test Login Manually**
```bash
# Get credentials from database
mysql -u root -h localhost -e "USE fleetopt; SELECT email FROM users LIMIT 1;"

# Try login from API
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer1@fleetops.com","password":"password"}'

# Should return JWT token
```

**Step 4: Check JWT Configuration**
```bash
# Verify SECRET_KEY is set
grep SECRET_KEY backend/.env

# If it's dev-key-*, that's OK for development
```

---

### 8. TypeScript Compilation Errors

**Errors:**
```
Type 'X' is not assignable to type 'Y'
Cannot find module '@types/react'
Property 'X' does not exist on type 'any'
```

**Solutions:**

**Step 1: Verify TypeScript Installation**
```bash
cd frontend

# Check TypeScript version
npm list typescript
# Expected: 5.7.2

# If wrong version:
npm install -D typescript@5.7.2
```

**Step 2: Clear Build Cache**
```bash
cd frontend

# Remove Next.js build cache
rm -rf .next

# Rebuild
npm run build
```

**Step 3: Check Type Definitions**
```bash
# Install missing types
npm install -D @types/node@22.10.2 @types/react@19.0.2 @types/react-dom@19.0.2

# Verify tsconfig.json
cat tsconfig.json
```

**Step 4: Rebuild**
```bash
cd frontend
npm run build

# If still failing, try fresh install
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

### 9. Frontend Can't Connect to Backend

**Error:**
```
Failed to fetch from http://127.0.0.1:8000
CORS error: Access-Control-Allow-Origin missing
Failed to connect to backend API
```

**Solutions:**

**Step 1: Verify Backend is Running**
```bash
# Check backend health
curl http://127.0.0.1:8000/health

# Check from browser
# Open: http://127.0.0.1:8000/docs
```

**Step 2: Verify API Proxy Configuration**
```bash
# Check frontend .env.development
cat frontend/.env.development

# Expected:
# NEXT_PUBLIC_API_URL=/api-proxy
# BACKEND_ORIGIN=http://127.0.0.1:8000
```

**Step 3: Check next.config.mjs**
```bash
# Verify API proxy is configured correctly
cat frontend/next.config.mjs

# Should have rewrites or redirects for /api-proxy
```

**Step 4: Test API Directly**
```bash
# Test API endpoint directly
curl http://127.0.0.1:8000/api/auth/login

# If that works but frontend can't reach it,
# issue is with Next.js proxy configuration
```

---

### 10. npm run setup Fails

**Error:**
```
npm run setup fails with pip installation error
Python not found
Cannot find python executable
```

**Solutions:**

**Step 1: Check Python Installation**
```bash
# Verify Python is installed
python --version

# If not found, install from https://www.python.org/
```

**Step 2: Manually Run Setup Steps**
```bash
# Step 1: Install backend
cd backend
python -m venv .venv
.venv\Scripts\activate.bat  # Windows
python -m pip install -r requirements.txt

# Step 2: Install frontend
cd ../frontend
npm install

# Step 3: Install root
cd ..
npm install
```

**Step 3: Use Full Python Path**
```bash
# Find Python path
where python  # Windows
which python  # Mac/Linux

# Set environment variable
set FLEETOPS_PYTHON=C:\Users\Marion\AppData\Local\Programs\Python\Python312\python.exe

# Try npm run setup again
npm run setup
```

**Step 4: Run Manually**
```bash
# Skip npm run setup, do it manually
cd backend && python -m venv .venv && .venv\Scripts\activate.bat && pip install -r requirements.txt
cd ../frontend && npm install
cd .. && npm install
```

---

## 🟢 MINOR ISSUES

### 11. "npm not found" or "node not found"

**Error:**
```
'npm' is not recognized as an internal or external command
Command 'node' not found
```

**Solution:**
```bash
# Install Node.js from https://nodejs.org/ (includes npm)
# Choose LTS version (18+)

# After installation, open NEW terminal and verify:
node --version
npm --version

# Should show versions, not "command not found"
```

---

### 12. Performance Issues - Backend/Frontend Very Slow

**Symptoms:**
- Pages load slowly
- API responses slow
- High CPU usage

**Solutions:**

**Step 1: Check System Resources**
```bash
# Windows - Check CPU/Memory
tasklist /v

# If backend or node process is using >80% CPU, something is wrong
```

**Step 2: Check for Infinite Loops**
```bash
# Look for suspicious backend logs
# Stop backend (Ctrl+C) and restart
```

**Step 3: Increase Virtual Memory**
```bash
# If system is near max RAM:
# Add 4-8GB swap/virtual memory
```

**Step 4: Restart Everything**
```bash
# Kill all processes
taskkill /F /IM python.exe
taskkill /F /IM node.exe

# Wait 5 seconds
# Start fresh
npm run dev
```

---

### 13. Database Very Large / Slow Queries

**Symptoms:**
- Database operations slow
- CPU spikes when running queries

**Solutions:**

**Step 1: Check Table Sizes**
```bash
mysql -u root -h localhost -e "
USE fleetopt;
SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.tables
WHERE table_schema = 'fleetopt'
ORDER BY size_mb DESC;"
```

**Step 2: Clear Old Data**
```bash
# Backup first
mysqldump -u root fleetopt > backup.sql

# Delete old test data
mysql -u root -h localhost -e "USE fleetopt; DELETE FROM bookings WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);"

# Or completely reset
mysql -u root -h localhost -e "DROP DATABASE fleetopt; CREATE DATABASE fleetopt;"
cd backend && alembic upgrade head
python seed_db.py
```

---

### 14. "YAML parsing error" in Configuration Files

**Error:**
```
YAML parsing error
Invalid configuration format
```

**Solution:**
```bash
# Usually a typo in .env files
# .env files are NOT YAML, just KEY=VALUE format

# Check backend/.env has correct format:
APP_ENV=development              # ✅ Correct
SECRET_KEY=dev-key-change       # ✅ Correct
DATABASE_URL=mysql+pymysql://root:@localhost:3306/fleetopt  # ✅ Correct

# NOT this format:
- APP_ENV: development          # ❌ Wrong (YAML syntax)
APP_ENV: "development"          # ❌ Wrong (YAML syntax)
```

---

## 🔍 DIAGNOSTIC COMMANDS

### Quick Status Check

```bash
# All in one diagnostic
echo "=== System Info ===" && \
node --version && \
npm --version && \
python --version && \
echo "=== MySQL ===" && \
mysql -u root -h localhost -e "SELECT 1;" && \
echo "=== Database ===" && \
mysql -u root -h localhost -e "SHOW DATABASES LIKE 'fleetopt';" && \
echo "=== Backend ===" && \
curl http://127.0.0.1:8000/health && \
echo -e "\n=== Processes ===" && \
netstat -ano | findstr :8000 | head -3 && \
netstat -ano | findstr :3000 | head -3
```

### Backend Diagnostics

```bash
cd backend

# Check Python
python --version

# Check virtual environment
.venv\Scripts\activate.bat
python -m pip list | head -20

# Check database connection
python -c "
from app.core.config import settings
from sqlalchemy import create_engine
print(f'Database URL: {settings.database_url}')
try:
    engine = create_engine(settings.database_url)
    conn = engine.connect()
    print('✅ Database connection successful')
    conn.close()
except Exception as e:
    print(f'❌ Connection failed: {e}')
"

# Check migrations
alembic current
alembic history
```

### Frontend Diagnostics

```bash
cd frontend

# Check Node
node --version
npm --version

# Check dependencies
npm list react next
npm list typescript

# Check build
npm run build

# Check for errors
npm run lint
```

### Database Diagnostics

```bash
# Connect
mysql -u root -h localhost

# Check database
SHOW DATABASES;
USE fleetopt;
SHOW TABLES;

# Check row counts
SELECT 'users' as table_name, COUNT(*) as rows FROM users
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'trips', COUNT(*) FROM trips;

# Check users
SELECT id, email, role, created_at FROM users LIMIT 5;

# Check alembic version
SELECT * FROM alembic_version;
```

---

## 📞 ESCALATION PATH

If issues persist after trying these solutions:

1. **Check all error logs:**
   - Browser console (F12)
   - Terminal output (backend/frontend)
   - MySQL error log

2. **Verify all prerequisites:**
   - Node 18+, npm 10+, Python 3.12+
   - MySQL running
   - Ports 8000/3000 available
   - Database exists and migrations applied

3. **Start completely fresh:**
   ```bash
   # Kill all processes
   taskkill /F /IM python.exe
   taskkill /F /IM node.exe
   
   # Clear caches
   rm -rf backend/.venv
   rm -rf frontend/node_modules frontend/.next
   rm -rf node_modules
   
   # Recreate database
   mysql -u root -h localhost -e "DROP DATABASE fleetopt; CREATE DATABASE fleetopt;"
   
   # Start over
   npm run setup
   npm run dev
   ```

4. **If still broken:**
   - Check that you're following the exact versions in FRESH_MACHINE_SETUP_GUIDE.md
   - Verify each prerequisite is actually installed (not just claimed)
   - Test each component independently before combining

---

**Last Updated:** June 12, 2026  
**Covers:** Common issues on fresh machine setup

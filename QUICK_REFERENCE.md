# ⚡ FleetOps - Quick Reference Card

**One-page cheat sheet for fresh machine setup**

---

## 🚀 QUICKEST SETUP (One Command)

```bash
# From project root - installs and starts everything
npm run setup
npm run dev
```

**Result:** Backend on :8000, Frontend on :3000 (after ~20 seconds)

---

## 📋 SYSTEM REQUIREMENTS

```
Node.js:  18+       (verify: node --version)
npm:      10+       (verify: npm --version)
Python:   3.12+     (verify: python --version)
MySQL:    5.7+      (verify: mysql -u root -h localhost -e "SELECT 1;")
Disk:     5+ GB
RAM:      4+ GB
```

---

## 🔧 ESSENTIAL COMMANDS

### Verify Everything Works
```bash
# Check all systems
node --version && npm --version && python --version && \
mysql -u root -h localhost -e "SELECT 1;" && \
curl http://127.0.0.1:8000/health && \
curl http://localhost:3000
```

### Install & Run (Automated)
```bash
npm run setup    # One-time setup
npm run dev      # Runs backend + frontend together
```

### Manual Setup (Separate Terminals)
```bash
# Terminal 1 - Backend
cd backend && python -m venv .venv && \
.venv\Scripts\activate.bat && \
pip install -r requirements.txt && \
alembic upgrade head && \
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend && npm install && npm run dev:web-only

# Terminal 3 - Seed (optional)
python seed_db.py
```

### Troubleshoot
```bash
# Port in use?
netstat -ano | findstr :8000  # or :3000

# Kill process
taskkill /PID <PID> /F

# Test database
mysql -u root -h localhost -e "SHOW DATABASES LIKE 'fleetopt';"

# Check backend logs
curl http://127.0.0.1:8000/docs

# Fresh start
taskkill /F /IM python.exe & taskkill /F /IM node.exe & npm run dev
```

---

## 📁 FILE LOCATIONS

| Purpose | Location |
|---------|----------|
| Backend config | `backend/.env` |
| Frontend config | `frontend/.env.development` |
| Root scripts | `package.json` |
| Migrations | `backend/alembic/` |
| Database init | `seed_db.py` |

---

## 🌐 URLS AFTER STARTUP

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://127.0.0.1:8000 |
| API Docs | http://127.0.0.1:8000/docs |
| Backend Health | http://127.0.0.1:8000/health |
| Admin Dashboard | http://localhost:3000/admin/dashboard |
| Dispatcher | http://localhost:3000/dispatcher/dashboard |
| Driver | http://localhost:3000/driver/dashboard |
| Manager | http://localhost:3000/manager/dashboard |
| Customer | http://localhost:3000/dashboard |
| Helper | http://localhost:3000/helper/dashboard |

---

## 👤 TEST LOGIN CREDENTIALS

```
Email:    customer1@fleetops.com
Password: password

Alternative users (after seed_db.py):
- dispatcher1@fleetops.com / password
- driver1@fleetops.com / password
- manager1@fleetops.com / password
- admin@fleetops.com / password
- helper1@fleetops.com / password
```

---

## 🔍 QUICK DIAGNOSTICS

```bash
# All-in-one status
echo "Node: $(node --version), npm: $(npm --version), Python: $(python --version)" && \
echo "MySQL: $(mysql -u root -h localhost -e 'SELECT VERSION();' -s -N)" && \
echo "Database: $(mysql -u root -h localhost -e 'SHOW DATABASES LIKE "fleetopt";' -s -N)" && \
echo "Backend: $(curl -s http://127.0.0.1:8000/health)" && \
echo "Frontend: $(curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000)"
```

---

## ⚠️ COMMON ISSUES & QUICK FIXES

| Issue | Quick Fix |
|-------|-----------|
| `Cannot find module 'fastapi'` | `cd backend && python -m pip install -r requirements.txt` |
| `Cannot find module 'next'` | `cd frontend && npm install` |
| Port 8000 in use | `netstat -ano \| findstr :8000` → `taskkill /PID <PID> /F` |
| Port 3000 in use | `netstat -ano \| findstr :3000` → `taskkill /PID <PID> /F` |
| Cannot connect to MySQL | Ensure XAMPP MySQL is running |
| "Unknown database 'fleetopt'" | `mysql -u root -h localhost -e "CREATE DATABASE fleetopt;"` |
| Login fails | `python seed_db.py` (seed test users) |
| TypeScript errors | `cd frontend && npm run build` |
| Alembic fails | `cd backend && alembic upgrade head` |

---

## 📊 ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (localhost:3000)              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Next.js 16 Frontend                             │   │
│  │  • Customer Portal                               │   │
│  │  • Admin Dashboard                               │   │
│  │  • Dispatcher Console                            │   │
│  │  • Driver/Manager/Helper Dashboards              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │ /api-proxy/*
                            ↓
┌─────────────────────────────────────────────────────────┐
│          FastAPI Backend (127.0.0.1:8000)               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  API Endpoints                                   │   │
│  │  • /api/auth (JWT/Clerk)                         │   │
│  │  • /api/bookings                                 │   │
│  │  • /api/trips & /api/dispatch                    │   │
│  │  • /api/admin & /api/manager                     │   │
│  │  • /api/ratings & /api/feedback                  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │ SQLAlchemy/PyMySQL
                            ↓
┌─────────────────────────────────────────────────────────┐
│         MySQL Database (localhost:3306)                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Tables: users, bookings, trips, trucks,         │   │
│  │  ratings, payments, toll_logs, etc.              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 CONFIGURATION CHECKLIST

- [ ] Node.js 18+ installed
- [ ] Python 3.12+ installed
- [ ] MySQL running (XAMPP or other)
- [ ] `backend/.env` exists with DATABASE_URL
- [ ] `frontend/.env.development` exists
- [ ] Port 8000 available
- [ ] Port 3000 available
- [ ] Database `fleetopt` created
- [ ] All migrations applied

---

## 🎯 VERIFICATION ENDPOINTS

```bash
# Check health
curl http://127.0.0.1:8000/health
# Expected: {"status":"ok"}

# Get API docs
curl http://127.0.0.1:8000/docs

# Test login
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer1@fleetops.com","password":"password"}'
# Expected: JWT token in response
```

---

## 🧹 CLEAN UP / RESET

```bash
# Kill all processes
taskkill /F /IM python.exe
taskkill /F /IM node.exe

# Clear caches
del /S frontend\.next backend\.venv node_modules

# Reset database
mysql -u root -h localhost -e "DROP DATABASE fleetopt; CREATE DATABASE fleetopt;"

# Fresh start
npm run setup && npm run dev
```

---

## 📚 FULL DOCUMENTATION

For detailed information, see:
- [FRESH_MACHINE_SETUP_GUIDE.md](FRESH_MACHINE_SETUP_GUIDE.md) - Complete setup guide
- [VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md) - Verification checklist
- [CONFIGURATION_AUDIT.md](CONFIGURATION_AUDIT.md) - Configuration details
- [TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md) - Troubleshooting guide

---

## 💡 PRO TIPS

1. **Use PowerShell on Windows** - Better terminal than CMD
2. **Open 3 terminals** - Backend, Frontend, and utilities (one per terminal)
3. **Keep backend running** - Frontend depends on it
4. **Check browser console** - F12 for detailed error messages
5. **Use API docs** - http://127.0.0.1:8000/docs to test endpoints directly
6. **Seed database early** - `python seed_db.py` to avoid "user not found" errors
7. **Watch logs** - Terminal output shows what's happening
8. **Use `npm run setup` first** - Installs everything in correct order

---

## 🆘 GET HELP

1. **Read TROUBLESHOOTING_GUIDE.md** - Most issues documented there
2. **Run diagnostics** - Check system requirements first
3. **Check logs** - Backend/frontend terminal output
4. **Verify config files** - .env files must be correct
5. **Try fresh start** - Kill processes, clear caches, start again

---

**Quick Reference v1.0** | June 12, 2026 | For FleetOps Fresh Machine Setup

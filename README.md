# 🚚 FleetOpts - Fleet Management & Logistics Platform

> **Complete fleet management system with real-time booking, dispatch optimization, analytics, and driver management.**

FleetOpts is a production-ready SaaS platform for trucking companies. It streamlines customer bookings, dispatcher routing, fleet operations, and manager analytics with advanced cost estimation, route optimization, and predictive forecasting.

---

## 📊 System Overview

**FleetOpts delivers a complete ecosystem for fleet operations:**

| Feature | Capability | Status |
|---------|-----------|--------|
| **📦 Booking** | Real-time cost estimation, validation, email confirmation | ✅ |
| **🎛️ Dispatch** | Smart assignment, A* route optimization, conflict prevention | ✅ |
| **🚗 Driver Ops** | Trip tracking, attendance, salary, performance ratings | ✅ |
| **⭐ Ratings** | Customer ratings, compliance tracking, performance insights | ✅ |
| **📊 Analytics** | KPI dashboard, demand forecasting, maintenance prediction | ✅ |
| **💰 Cost Mgmt** | Multi-component pricing, real-time estimation, tracking | ✅ |
| **🔐 Security** | Clerk RBAC, JWT auth, role-based endpoints, audit logging | ✅ |
| **📧 Notifications** | HTML email templates, booking/trip/maintenance alerts | ✅ |

---

## 🏗️ Architecture

```
Frontend (Next.js 15.1.2)          Backend (FastAPI 0.115.6)        Data Layer (PostgreSQL)
├─ Customer Portal                 ├─ Auth API (Clerk + JWT)        ├─ Users
├─ Dispatcher Console              ├─ Booking API                   ├─ Bookings & Trips
├─ Driver App                      ├─ Dispatch API                  ├─ Fleet
├─ Manager Dashboard               ├─ Driver API                    ├─ Ratings
├─ Admin Panel                     ├─ Manager API                   ├─ Analytics
└─ Clerk Auth Provider             ├─ Admin API                     └─ Compliance
                                   ├─ Ratings API
                                   ├─ Services Layer
                                   │  ├─ Cost Estimation
                                   │  ├─ Route Optimization (A*)
                                   │  ├─ Scheduling
                                   │  ├─ Forecasting
                                   │  ├─ Email Notifications
                                   │  └─ Analytics
                                   └─ Cloud SQL Connector
```

---

## 🚀 Quick Start with XAMPP MySQL

### Prerequisites
- Node.js 18+ | Python 3.12+ | XAMPP (with MySQL) | Git

**Windows:** Prefer **`python -m pip`** instead of **`pip`** for installs. If `pip` fails with *Fatal error in launcher*, the `pip.exe` shortcut still points at an old Python. After installing Python (including **Python Install Manager** from the Store), **open a new terminal or restart Cursor** so PATH updates — otherwise `npm run setup` may not see Python yet. If it still fails, set **`FLEETOPS_PYTHON`** to the full path of **`python.exe`** (often under `%LOCALAPPDATA%\Programs\Python\Python3xx\`), then run **`npm run setup`** again.

### Easiest: one terminal (API + web)

From the **repository root** (after MySQL is running and `backend/.env` exists — see Steps 1–2):

```bash
npm run setup    # once — installs backend deps via `python -m pip` (auto-finds py/python) + frontend + root npm
npm run dev
```

This runs **uvicorn** on port **8000** and **Next.js** on **3000** together; the web app waits until `GET /health` responds before opening the dev server. Stop with **Ctrl+C**.

The **`scripts/resolve-python.mjs`** helper checks **`FLEETOPS_PYTHON`**, **`backend/.venv`**, common folders under **`%LOCALAPPDATA%\Programs\Python`**, **`py`**, then **`python`** on PATH — so a fresh install or a broken **`pip.exe`** shim usually still works after a new terminal session.

### Step 1: Setup XAMPP MySQL

1. **Download & Install XAMPP:** https://www.apachefriends.org/
2. **Launch XAMPP Control Panel** and click **Start** on MySQL
3. **Create Database** via phpMyAdmin (`http://localhost/phpmyadmin`):
   ```sql
   CREATE DATABASE fleetopt;
   CREATE USER 'fleetopt'@'localhost' IDENTIFIED BY 'fleetopt';
   GRANT ALL PRIVILEGES ON fleetopt.* TO 'fleetopt'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Step 2: Configure Backend Environment

```bash
cd backend

# Copy the example environment file
cp .env.example .env

# .env is already configured for XAMPP MySQL
# No additional changes needed!
```

**Verify .env contains:**
```bash
DATABASE_URL=mysql+pymysql://fleetopt:fleetopt@localhost:3306/fleetopt
```

### Step 3: Start Backend

```bash
# Terminal 1 - From backend directory
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# API will be available at http://localhost:8000
# Swagger docs: http://localhost:8000/docs
```

### Step 4: Start Frontend

```bash
# Terminal 2 - From frontend directory
cd frontend
npm install

# Copy env (uses Next.js proxy → fewer "cannot connect to API" errors on Windows)
copy .env.example .env.local   # PowerShell / Cmd on Windows — or cp on Git Bash

npm run dev

# Frontend will be available at http://localhost:3000
```

**Windows (one window):** From the repo root, after Steps 1–2 and `npm install` / `python -m pip install …` in the backend, run:

```powershell
.\dev.ps1
```

This starts **uvicorn** in the background, waits until `GET /health` succeeds, then runs **`npm run dev`**. Stop with Ctrl+C (the API job stops when Next.js exits).

**Important:** Keep **Terminal 1** running with the backend (`uvicorn` on port **8000**). Without it, sign-in shows a connection error.

The default `.env.local` uses **`NEXT_PUBLIC_API_URL=/api-proxy`** so the browser talks only to Next.js; Next forwards `/api-proxy/*` to `BACKEND_ORIGIN` (see `next.config.mjs`). Change `BACKEND_ORIGIN` if your API runs elsewhere.

### Step 5: Seed Database (Optional)

```bash
# Terminal 3 - From project root
python seed_db.py
```

If login returns **Invalid credentials** but you expect `password`, old rows may have a non-bcrypt `password_hash`. From project root:

```bash
python seed_db.py --repair-passwords
```

That sets **every** user’s password to **`password`** (development only).


### Test Credentials

After running `python seed_db.py`:

| Role | Email | Password |
|------|-------|----------|
| 👤 Customer | customer1@fleetops.com | `password` |
| 🎛️ Dispatcher | dispatcher@fleetops.com | `password` |
| 🚗 Driver | driver1@fleetops.com | `password` |
| 📊 Manager | manager@fleetops.com | `password` |
| ⚙️ Admin | admin@fleetops.com | `password` |

*(Ang `seed_db.py` ay `hash_password("password")` ang ginagamit — hindi “any_password”.)*

**Driver / staff:** Hindi maaaring mag-sign up bilang driver sa public registration; kailangan **gumawa ng account sa Admin** (`POST /api/admin/users`, role `driver`) o mag-run ng `seed_db.py` (MySQL).

---

## 🔐 Security & Environment Configuration

### Development vs Production

**Development (.env):**
- Uses default credentials from `.env.example`
- Secret key can be simple
- Database URL points to local/Docker

**Production (.env):**
- Must use strong SECRET_KEY (32+ characters)
  ```bash
  # Generate with:
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- Use managed database services (Cloud SQL, RDS)
- Enable HTTPS/SSL
- Set appropriate CORS origins
- Use secrets management (AWS Secrets Manager, etc.)

### Never Commit Secrets

✅ **DO:**
- Commit `.env.example` with placeholder values
- Use `.env` file for local development (in `.gitignore`)
- Store production secrets in secure vaults

❌ **DON'T:**
- Commit `.env` files to version control
- Hardcode secrets in config files
- Use default credentials in production

---

## 📁 Project Structure

```
FLEETOPS/
├── frontend/                          # Next.js application
│   ├── app/
│   │   ├── booking/page.tsx          # Booking form with real-time cost
│   │   ├── dashboard/[role]/page.tsx # Role-based dashboards
│   │   ├── sign-in|sign-up/          # Clerk auth pages
│   │   └── layout.tsx
│   ├── components/
│   │   ├── AnalyticsDashboard.tsx    # Manager analytics with KPIs
│   │   ├── DriverRatingCard.tsx      # Driver rating component
│   │   └── ...
│   ├── lib/api.ts                    # HTTP client
│   └── package.json
│
├── backend/                           # FastAPI application
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── auth.py               # Authentication (JWT + Clerk)
│   │   │   ├── bookings.py           # Booking lifecycle + emails
│   │   │   ├── dispatch.py           # Trip assignment + routing
│   │   │   ├── driver.py             # Driver operations
│   │   │   ├── manager.py            # Analytics dashboard
│   │   │   ├── admin.py              # System configuration
│   │   │   ├── ratings.py            # Driver ratings
│   │   │   └── reports.py            # CSV exports
│   │   ├── services/
│   │   │   ├── costing.py            # Cost calculation (multi-component)
│   │   │   ├── routing.py            # A* route optimization
│   │   │   ├── scheduler.py          # Availability matching
│   │   │   ├── analytics.py          # Forecasting & predictions
│   │   │   ├── notifications.py      # Email integration
│   │   │   └── email_templates.py    # HTML email templates
│   │   ├── models/entities.py        # SQLAlchemy ORM
│   │   ├── schemas/                  # Pydantic validation
│   │   └── core/
│   │       ├── config.py             # Configuration (Cloud SQL support)
│   │       └── security.py           # Auth & RBAC
│   ├── tests/test_integration.py     # Integration test suite
│   ├── requirements.txt
│   └── Dockerfile
│
├── seed_db.py                        # Database seeding script
├── docker-compose.yml                # Local PostgreSQL
│
├── 📖 QUICKSTART.md                 # 5-minute setup guide
├── 📖 SYSTEM_OVERVIEW.md            # Complete system architecture
├── 📖 UAT_TESTING_GUIDE.md          # Comprehensive test procedures
├── deploy-docker-hostinger.sh      # Hostinger VPS: Docker stack
├── deploy-hostinger.sh             # Hostinger VPS: systemd + Nginx templates
├── 📖 API_REFERENCE.md              # Complete API documentation
├── 📖 PRODUCTION_DEPLOYMENT_CHECKLIST.md # Pre-production checklist
└── README.md                         # This file
```

---

## 🔐 Authentication

### Local Development (JWT)
```env
USE_CLERK_AUTH=false
# Uses local JWT tokens - no external setup needed
```

### Production (Clerk RBAC)
```env
USE_CLERK_AUTH=true
CLERK_API_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
```
- OAuth2 integration
- Role-based access control
- User synchronization
- 5 predefined roles (customer, dispatcher, driver, manager, admin)

**Setup:** Clerk env vars sa `backend/.env` at `frontend/.env.local` (`USE_CLERK_AUTH`, keys).

---

## 🗄️ Database Configuration

### XAMPP MySQL (Development - Recommended)
```bash
# 1. Install XAMPP: https://www.apachefriends.org/
# 2. Start MySQL via XAMPP Control Panel
# 3. Access phpMyAdmin: http://localhost/phpmyadmin
# 4. Create database (see Step 1 in Quick Start above)
# 5. Backend will auto-connect with DATABASE_URL in .env
```

### Production: Google Cloud SQL
```env
USE_CLOUD_SQL=true
GCP_PROJECT_ID=your-project-id
CLOUD_SQL_INSTANCE=project:region:instance
CLOUD_SQL_DB_USER=fleetopt
CLOUD_SQL_DB_PASSWORD=your-password
```

**Setup:** I-set ang `DATABASE_URL` / Cloud SQL flags sa `backend/.env`.

---

## 📊 Core Features

### 1. Booking Workflow
```
Customer fills form → 
Real-time cost calculated → 
Validation checks (weight, distance, date) → 
Booking created → 
Email confirmation sent → 
Dispatcher can assign
```
**Cost Formula:**
```
Total = (Fuel + Toll + Labor) × (1 + Weight × 0.02)
```

### 2. Dispatch & Routing
- Smart assignment based on truck/driver availability
- A* algorithm for route optimization
- Real-time status tracking (Pending → In Transit → Completed)
- Conflict prevention (no double-booking)

### 3. Analytics Dashboard
- 6 KPI cards (bookings, trips, costs, utilization, revenue, ratings)
- Performance trends and revenue targets
- 6-month demand forecasting
- Maintenance risk prediction

### 4. Driver Rating System
- 1-5 star ratings after trip completion
- Automatic average calculation
- Compliance status tracking (compliant, warning, suspended)
- Salary deduction tracking

### 5. Email Notifications
HTML templates for:
- Booking confirmation (with cost & date)
- Trip started (with driver & route)
- Trip completed (with actual cost)
- Maintenance alert (with severity)

---

## 🔌 API Endpoints (25+)

### Bookings
```bash
POST   /api/bookings              # Create booking
GET    /api/bookings              # List bookings
POST   /api/bookings/{id}/cancel  # Cancel booking
```

### Dispatch
```bash
POST   /api/dispatch/{booking_id}/assign        # Assign trip
POST   /api/dispatch/trip/{trip_id}/status      # Update status
GET    /api/dispatch/pending                    # View pending
```

### Ratings
```bash
POST   /api/ratings                 # Submit rating
GET    /api/ratings/{driver_id}     # Get average rating
```

### Analytics (Manager)
```bash
GET    /api/manager/dashboard                   # KPI metrics
POST   /api/analytics/cost-predict              # Cost estimation
GET    /api/analytics/demand-forecast           # Demand forecast
```

**Full Docs:** http://localhost:8000/docs (Swagger UI)

---

## 🧪 Testing

### Unit & Integration Tests
```bash
cd backend
pytest tests/test_integration.py -v
```
- 30+ test cases covering all workflows
- Authentication flow tests
- Cost calculation accuracy tests
- Role-based access control tests
- Email notification tests

### UAT Testing
```
10 test phases with 50+ test cases
- Authentication & access control
- Booking workflow validation
- Dispatch assignment verification
- Driver operations testing
- Rating system testing
- Analytics dashboard validation
- Admin functions testing
- Email notification verification
- Performance benchmarks
- Load testing
```

**Guide:** [UAT_TESTING_GUIDE.md](./UAT_TESTING_GUIDE.md)

---

## 🚀 Deployment

### Option 1: Google Cloud (Recommended for Scale)
- Cloud SQL for PostgreSQL
- Cloud Run for serverless backend
- Firebase Hosting for frontend
- Automated scaling
- Global CDN

**Setup Time:** 2-3 hours

### Option 2: Hostinger VPS (matching this stack)

Ang FleetOpt ay **FastAPI + Next.js + MySQL**. Para sa ganitong kombinasyon, ang angkop na Hostinger tier ay **`KVM VPS`** (Ubuntu, SSH, puedeng mag-install ng Docker/Nginx/Systemd).

| Route | Mga script |
|--------|-------------|
| **Docker** ( pinakamadalí kung VPS may Docker na ) | `chmod +x deploy-docker-hostinger.sh && DOMAIN=https://YOURDOMAIN ./deploy-docker-hostinger.sh` |
| **Walang Docker** (Python virtualenv + `npm build` + Nginx/systemd templates ) | `chmod +x deploy-hostinger.sh && ./deploy-hostinger.sh` |

Hindi mismo sa dokumentasyong ito ang **Shared Web Hosting lamang**: karaniwan hindi kumpleto ang long-running Node + Python API at MySQL tulad ng itinayo dito maliban kung Dedicated/VPS-tier.

Mga requirements: Ubuntu 22.04+ (hinahangaan), Nginx bilang reverse proxy (`/api` → backend port, `/` → frontend), TLS (Let’s Encrypt o SSL sa Hostinger panel).

**Setup Time:** Mga 1–2 oras kapag VPS handa na ang Docker/Linux.

### Option 3: Docker Swarm / Kubernetes (Enterprise)
- Full container orchestration
- Multi-region support
- Advanced load balancing

**Reference:** Standard cloud runbooks (Helm, Terraform) — wala sa repo ang buong Swarm/K8s manifest.

---

## ✅ Pre-Deployment Checklist

Before going live, complete:
- [ ] All tests pass (unit, integration, UAT)
- [ ] Security review completed
- [ ] Database backups configured
- [ ] Email service configured (Resend)
- [ ] Clerk authentication verified
- [ ] Cloud SQL connectivity tested
- [ ] SSL/TLS certificates installed
- [ ] Monitoring & alerting configured
- [ ] Disaster recovery tested
- [ ] Team training completed

**Checklist:** [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [QUICKSTART.md](./QUICKSTART.md) | 5-minute setup for local development |
| [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) | Complete architecture & features |
| [UAT_TESTING_GUIDE.md](./UAT_TESTING_GUIDE.md) | 50+ test cases with procedures |
| `deploy-docker-hostinger.sh`, `deploy-hostinger.sh` | Hostinger VPS: Docker stack o systemd + Nginx templates |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete endpoint documentation |
| [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md) | Pre-production validation |

---

## 🛠️ Common Commands

```bash
# Database (XAMPP)
# Start XAMPP MySQL via Control Panel or:
# mysql -u root -p              # Connect to MySQL CLI
# Use phpMyAdmin at http://localhost/phpmyadmin

python seed_db.py                 # Seed test data

# Backend
cd backend
python -m pip install -r requirements.txt   # Install deps (first time)
python -m uvicorn app.main:app --reload --port 8000  # Start API

# Frontend
cd frontend
npm install                       # Install deps (first time)
npm run dev                       # Start dev server (port 3000)
npm run build                     # Build for production
npm run type-check                # TypeScript check
```

---

## 🔑 Environment Variables

### Backend (.env)
```env
SECRET_KEY=dev-secret-key-minimum-32-chars
DATABASE_URL=mysql+pymysql://fleetopt:fleetopt@localhost:3306/fleetopt
APP_ENV=development
FRONTEND_URL=http://localhost:3000
USE_CLERK_AUTH=false
RESEND_API_KEY=
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=/api-proxy
BACKEND_ORIGIN=http://127.0.0.1:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

For a direct browser → API URL instead of the proxy, use `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api` (must include `/api`) and ensure the backend CORS settings allow your frontend origin.

---

## 📈 Performance Targets

| Metric | Target | Implementation |
|--------|--------|-----------------|
| API Response | < 500ms | Query optimization, indexing |
| Frontend Load | < 3s | Code splitting, lazy loading |
| Dashboard Load | < 3s | Efficient KPI queries |
| Booking Creation | < 2s | Multi-component cost calc |
| Uptime SLA | 99.9% | Monitoring, auto-restart |

---

## 🔒 Security Features

- ✅ HTTPS/TLS encryption
- ✅ Clerk RBAC authentication
- ✅ Role-based access guards on all endpoints
- ✅ Input validation & sanitization
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection (security headers)
- ✅ CSRF protection
- ✅ Rate limiting (100 req/min on auth)
- ✅ Audit logging
- ✅ Database encryption (at rest)

---

## 📞 Support

- 🐛 **Issues:** GitHub Issues
- 📚 **Docs:** See documentation files
- 📧 **Email:** support@fleetops.com (configure)
- 💬 **Chat:** Add Discord link (optional)

---

## 📝 License

Proprietary - FleetOpts Fleet Management System

---

## 🎯 Next Steps

1. **Get Started:** [QUICKSTART.md](./QUICKSTART.md)
2. **Understand System:** [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)
3. **Run UAT:** [UAT_TESTING_GUIDE.md](./UAT_TESTING_GUIDE.md)
4. **Deploy (Hostinger VPS):** `deploy-docker-hostinger.sh` o `deploy-hostinger.sh`
5. **Go Live:** [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)

---

**Ready to optimize your fleet? Let's ship! 🚚✨**

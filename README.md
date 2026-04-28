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

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Node.js 18+ | Python 3.12+ | Docker & Docker Compose | Git

### Installation
```bash
cd /path/to/FLEETOPS

# 1. Start database
docker compose up -d

# 2. Backend (Terminal 1)
cd backend && pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# 3. Frontend (Terminal 2)
cd frontend && npm install && npm run dev

# 4. Seed data (Terminal 3)
python seed_db.py
```

**Access:** http://localhost:3000

**Test Credentials:**
| Role | Email | Password |
|------|-------|----------|
| 👤 Customer | customer1@fleetops.com | any_password |
| 🎛️ Dispatcher | dispatcher@fleetops.com | any_password |
| 🚗 Driver | driver1@fleetops.com | any_password |
| 📊 Manager | manager@fleetops.com | any_password |
| ⚙️ Admin | admin@fleetops.com | any_password |

📖 **Detailed Guide:** See [QUICKSTART.md](./QUICKSTART.md)

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
├── 📖 DEPLOYMENT_GUIDE.md           # Cloud/Hostinger deployment
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

**Setup:** See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#clerk-setup)

---

## 🗄️ Database Configuration

### Option A: Local PostgreSQL (Development)
```bash
docker compose up -d
# Runs PostgreSQL on localhost:5432
```

### Option B: Google Cloud SQL (Production)
```env
USE_CLOUD_SQL=true
GCP_PROJECT_ID=your-project-id
CLOUD_SQL_INSTANCE=project:region:instance
CLOUD_SQL_DB_USER=fleetopt
CLOUD_SQL_DB_PASSWORD=your-password
```

**Setup:** See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#cloud-sql-setup)

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

### Option 2: Hostinger VPS (Cost-Effective)
- Ubuntu 22.04 LTS
- Docker containers
- Nginx reverse proxy
- Let's Encrypt SSL
- Manual scaling

**Setup Time:** 1-2 hours

### Option 3: Docker Swarm / Kubernetes (Enterprise)
- Full container orchestration
- Multi-region support
- Advanced load balancing

**Guide:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

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
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Cloud SQL, Clerk, Hostinger setup |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete endpoint documentation |
| [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md) | Pre-production validation |

---

## 🛠️ Common Commands

```bash
# Database
docker compose up -d              # Start PostgreSQL
python seed_db.py                 # Seed test data
docker compose down -v            # Reset everything

# Backend
cd backend
pip install -r requirements.txt   # Install deps
uvicorn app.main:app --reload     # Start API (port 8000)
pytest tests/ -v                  # Run tests

# Frontend
cd frontend
npm install                       # Install deps
npm run dev                       # Start dev server (port 3000)
npm run build                     # Build for production
npm run type-check                # TypeScript check
```

---

## 🔑 Environment Variables

### Backend (.env)
```env
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:pass@localhost:5432/fleetops
USE_CLOUD_SQL=false
USE_CLERK_AUTH=false
RESEND_API_KEY=your-resend-key
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
```

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
4. **Deploy:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
5. **Go Live:** [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)

---

**Ready to optimize your fleet? Let's ship! 🚚✨**

### 1. Start Database

```bash
# Option A: Local PostgreSQL with Docker
docker compose up -d

# Option B: Use existing PostgreSQL
# Ensure it's running on localhost:5432
```

### 2. Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On Linux/Mac:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template and update
cp .env.example .env
# Edit .env with your configuration

# Run backend
uvicorn app.main:app --reload --port 8000
```

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template and update
cp .env.example .env.local
# Edit .env.local with your configuration

# Run frontend development server
npm run dev
# Access at http://localhost:3000
```

## 🔐 Authentication Setup

### Option 1: Local Development (JWT)
- Uses local JWT token authentication
- No additional setup required
- Register/login via API endpoints

### Option 2: Clerk (Recommended for Production)

1. **Create Clerk Account**
   - Go to https://clerk.com
   - Create an application

2. **Get API Keys**
   - Backend: `CLERK_API_KEY` (Secret Key)
   - Frontend: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Publishable Key)

3. **Configure Environment Files**

   **backend/.env**:
   ```env
   USE_CLERK_AUTH=true
   CLERK_API_KEY=sk_live_xxxxxxxxxxxx
   CLERK_FRONTEND_API=https://your-app.clerk.accounts.com
   ```

   **frontend/.env.local**:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxx
   ```

4. **Setup Webhooks** (in Clerk Dashboard)
   - Endpoint: `https://yourdomain.com/api/clerk/webhook`
   - Subscribe to: `user.created`, `user.updated`, `user.deleted`

## 🗄️ Database Configuration

### Option 1: Local PostgreSQL (Development)
```env
DATABASE_URL=postgresql+psycopg://fleetopt:fleetopt@localhost:5432/fleetopt
USE_CLOUD_SQL=false
```

### Option 2: Google Cloud SQL (Production)

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#part-1-google-cloud-sql-setup) for detailed instructions.

```env
USE_CLOUD_SQL=true
GCP_PROJECT_ID=your-project-id
CLOUD_SQL_INSTANCE=your-project:region:instance-name
CLOUD_SQL_DB_USER=fleetopt
CLOUD_SQL_DB_PASSWORD=your-strong-password
CLOUD_SQL_DB_NAME=fleetopt
```

## 📊 Core Implemented Flows

✓ Customer booking request with cost estimation
✓ Dispatcher assignment of truck and driver with availability matching
✓ A* routing optimization by distance, time, or cost
✓ Manager analytics dashboard with demand forecasting and KPIs
✓ Driver profile and attendance management
✓ Admin fleet and user configuration
✓ CSV batch reports (bookings, fleet performance)
✓ Email notifications via Resend

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/clerk/webhook` - Clerk user sync webhook

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - List user bookings
- `POST /api/bookings/{booking_id}/cancel` - Cancel booking

### Dispatch & Assignment
- `POST /api/dispatch/{booking_id}/assign` - Assign truck and driver
- `POST /api/dispatch/trip/{trip_id}/status` - Update trip status

### Driver Operations
- `GET /api/driver/trips` - Get assigned trips
- `POST /api/driver/attendance/check-in` - Record check-in
- `GET /api/driver/salary` - View salary breakdown

### Manager (Analytics & Configuration)
- `GET /api/manager/dashboard` - Analytics dashboard with KPIs
- `POST /api/manager/pricing` - Configure service pricing
- `POST /api/manager/drivers/profile` - Manage driver profiles

### Admin (Configuration)
- `GET /api/admin/users` - List all users
- `POST /api/admin/trucks` - Add truck
- `DELETE /api/admin/trucks/{truck_id}` - Remove truck

### Reports
- `GET /api/reports/bookings.csv` - Booking report
- `GET /api/reports/fleet.csv` - Fleet performance report

## 🚢 Deployment on Hostinger

### Prerequisites
- Hostinger VPS or Cloud hosting account
- SSH access to server
- Domain name (optional but recommended)

### Quick Deployment

```bash
# 1. SSH into Hostinger server
ssh user@yourdomain.com

# 2. Clone repository
git clone https://github.com/yourusername/fleetopt.git
cd fleetopt

# 3. Run deployment script
chmod +x deploy-hostinger.sh
./deploy-hostinger.sh

# 4. Update environment files with your credentials
# Edit backend/.env and frontend/.env.local

# 5. Start services
sudo systemctl start fleetopt-backend
sudo systemctl start fleetopt-frontend
sudo systemctl restart nginx
```

### Detailed Deployment Guide

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for:
- Google Cloud SQL setup and connection
- Clerk authentication configuration
- Hostinger-specific deployment steps
- Nginx reverse proxy configuration
- SSL/HTTPS setup
- Monitoring and logging
- Security best practices

## 📋 Environment Variables

### Backend (.env)

```env
# Application
SECRET_KEY=change-me-to-strong-secret
APP_ENV=production

# Database
USE_CLOUD_SQL=false
DATABASE_URL=postgresql+psycopg://fleetopt:fleetopt@localhost:5432/fleetopt

# Cloud SQL (if USE_CLOUD_SQL=true)
GCP_PROJECT_ID=your-project-id
CLOUD_SQL_INSTANCE=project:region:instance
CLOUD_SQL_DB_USER=fleetopt
CLOUD_SQL_DB_PASSWORD=your-password
CLOUD_SQL_DB_NAME=fleetopt

# Clerk
USE_CLERK_AUTH=false
CLERK_API_KEY=
CLERK_FRONTEND_API=

# Frontend
FRONTEND_URL=http://localhost:3000

# Notifications
RESEND_API_KEY=
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

## 🛠️ Development Commands

```bash
# Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev

# Database migration
bash migrate-db.sh

# Run tests
pytest backend/

# Build production
# Backend: docker build -t fleetopt-backend backend/
# Frontend: npm run build
```

## 🐳 Docker Deployment

```bash
# Build images
docker build -t fleetopt-backend ./backend
docker build -t fleetopt-frontend ./frontend

# Run containers
docker run -e DATABASE_URL=... -p 8000:8000 fleetopt-backend
docker run -e NEXT_PUBLIC_API_URL=... -p 3000:3000 fleetopt-frontend

# Or use docker-compose
docker compose -f docker-compose.yml up
```

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Google Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)

## 📝 License

This project is provided as-is for the FleetOpt fleet management system.

## 🤝 Support

For deployment issues, refer to [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) or contact support.


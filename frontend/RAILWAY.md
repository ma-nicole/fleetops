# FleetOpt Frontend — Railway deployment

Deploy the **Next.js UI** as a **second service** in the same Railway project as the API.

## Step-by-step

### 1. Add frontend service

1. Open your Railway **project** (same project as API + MySQL)
2. Click **+ New** → **GitHub Repo**
3. Select the same `fleetops` repository
4. Rename the service to something clear, e.g. `fleetops-frontend`

### 2. Set root directory

1. Click **fleetops-frontend** service
2. **Settings** → **Source** → **Root Directory** → `frontend`
3. Save (redeploys automatically)

### 3. Environment variables

**Variables** → **Raw Editor** — paste from `frontend/railway.env` or use references:

```env
NEXT_PUBLIC_API_URL=https://${{fleetops-api.RAILWAY_PUBLIC_DOMAIN}}/api
BACKEND_ORIGIN=https://${{fleetops-api.RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_DIESEL_PRICE_PHP_PER_LITER=74.75
NEXT_PUBLIC_TOLL_FEES_PHP_PER_TRIP=0
```

Replace `fleetops-api` with your **actual backend service name** in Railway.

Or paste the full backend URL manually:

```env
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app/api
BACKEND_ORIGIN=https://your-api.up.railway.app
```

### 4. Update backend CORS

On the **API service** → **Variables**, add the frontend URL to `CORS_ORIGINS`:

```env
FRONTEND_URL=https://your-frontend.up.railway.app
CORS_ORIGINS=https://your-frontend.up.railway.app,https://fleetopsapp.xyz,https://www.fleetopsapp.xyz
```

Redeploy the API after changing CORS.

### 5. Generate public domain

1. Frontend service → **Settings** → **Networking** → **Generate Domain**
2. Open `https://your-frontend.up.railway.app` in the browser

### 6. Custom domain (optional — fleetopsapp.xyz)

1. Frontend service → **Settings** → **Networking** → **Custom Domain**
2. Add `fleetopsapp.xyz`
3. In **Hostinger** → **Domains** → **DNS**, point to Railway (CNAME record Railway provides)
4. Add `https://fleetopsapp.xyz` to API `CORS_ORIGINS`

---

## Your Railway project should look like

```
Project: fleetops
├── fleetops-api      (root: backend)   → FastAPI
├── fleetops-frontend (root: frontend)  → Next.js
└── MySQL             → database
```

---

## Hostinger Single plan

You do **not** need Hostinger to run the app anymore:

- **Frontend** → Railway (this service)
- **Backend** → Railway (API service)
- **Hostinger Single** → DNS only (point `fleetopsapp.xyz` to Railway frontend)

You can remove or ignore the Git deploy on Hostinger.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails: missing env vars | Set `NEXT_PUBLIC_API_URL` and `BACKEND_ORIGIN` before build |
| API calls blocked (CORS) | Add frontend Railway URL to API `CORS_ORIGINS` |
| 404 on pages | Confirm Root Directory = `frontend` |
| Wrong API URL in browser | Redeploy frontend after changing `NEXT_PUBLIC_*` vars |

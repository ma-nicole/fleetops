# FleetOpt Backend — Railway Deployment

## Service layout

```
Railway project
├── fleetops   (GitHub repo, Root Directory: backend)
└── MySQL      (Railway database)
```

## fleetops service settings

| Setting | Value |
|---------|--------|
| Root Directory | `backend` |
| Builder | Dockerfile |
| Start Command | *(leave empty — Dockerfile runs `start.sh`)* |
| Public domain port | Use Railway `PORT` variable after deploy (default `8000`) |

## Environment variables

1. Open **fleetops** → **Variables** → **Raw Editor**
2. Paste from [`railway.env.example`](railway.env.example)
3. Set `SECRET_KEY` to a 32+ character random string
4. For `DATABASE_URL`, prefer **Add Reference** → **MySQL** → `MYSQL_URL`

Save triggers a redeploy. Migrations run automatically on container start via `start.sh`.

## Verify

| URL | Expected |
|-----|----------|
| `https://YOUR-RAILWAY-DOMAIN/health` | `{"status":"ok"}` |
| `https://YOUR-RAILWAY-DOMAIN/ready` | `{"status":"ready"}` |

## Vercel frontend (same project)

```
NEXT_PUBLIC_API_URL=https://YOUR-RAILWAY-DOMAIN/api
BACKEND_ORIGIN=https://YOUR-RAILWAY-DOMAIN
```

Redeploy Vercel after saving env vars.

## Troubleshooting

| Log / symptom | Fix |
|---------------|-----|
| Console says **container is not running (exited)** | Open **Deployments → View Logs** (not Console). Fix env vars below, then redeploy. |
| `ValidationError` on `SECRET_KEY` / `FRONTEND_URL` | Set all vars in `railway.env.example` |
| `No module named 'app'` | Root Directory must be `backend` |
| `/health` OK, `/ready` fails | Check `DATABASE_URL` uses internal `mysql.railway.internal` URL |
| Login works locally but not on Vercel | Redeploy Vercel; confirm `NEXT_PUBLIC_API_URL` ends with `/api` |

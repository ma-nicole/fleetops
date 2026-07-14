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
| Builder | **Dockerfile** (see [`railway.toml`](railway.toml)) |
| **Start Command** | **EMPTY** in UI — config file sets `python run_server.py` |
| Public domain port | Match Railway **Variables → PORT** (often `8080`) |

### Still seeing `'$PORT' is not a valid integer`?

Railway is running `uvicorn ... --port $PORT` instead of our Dockerfile. Fix **all**:

1. **Settings → Deploy → Custom Start Command** → delete all text → Save
2. **Variables** → delete `PORT` if its value is literally `$PORT`; Railway injects `PORT` automatically
3. **Settings → Build** → Builder = **Dockerfile**
4. **Redeploy** from latest GitHub commit (not just Restart)

Good logs look like:
```
Running database migrations...
Starting uvicorn on port 8080...
```

## Environment variables

1. Open **fleetops** → **Variables** → **Raw Editor**
2. Paste from [`railway.env.example`](railway.env.example)
3. Set `SECRET_KEY` to a 32+ character random string
4. For `DATABASE_URL`, prefer **Add Reference** → **MySQL** → `MYSQL_URL`

Save triggers a redeploy. Migrations run automatically on container start via `run_server.py`.

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
| `'$PORT' is not a valid integer` | Clear Custom Start Command; remove bad `PORT` variable; use Dockerfile + `railway.toml` |
| Login works locally but not on Vercel | Redeploy Vercel; confirm `NEXT_PUBLIC_API_URL` ends with `/api` |
| Helper proofs upload OK but images 404 later | Mount a **Railway Volume** at `/app/uploads` (`UPLOADS_ROOT`). Ephemeral disk loses files on redeploy. |
| Uploads 404 on Netlify | Confirm `netlify.toml` proxies `/uploads/*` to Railway `BACKEND_ORIGIN` |

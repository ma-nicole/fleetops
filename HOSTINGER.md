# Hostinger deployment — fix 403 Forbidden & empty File Manager

FleetOps is **FastAPI (Python) + Next.js (Node.js)**, not Laravel/PHP. Hostinger’s web server serves **`public_html`** and returns **403** when that folder has no `index.html` / `index.php` or when the Git clone landed outside `public_html`.

This guide fixes document root, index files, permissions, and the correct Hostinger product for this stack.

---

## Quick diagnosis

| Symptom | Likely cause |
|--------|----------------|
| File Manager: “files do not exist” | Git deployed outside `public_html`, or `public_html` is empty |
| 403 Forbidden | No index file in document root, or directory listing disabled |
| Repo visible but site blank | Serving source code, not a built Next.js app |
| `/api` does not work on shared hosting | FastAPI needs VPS or a separate API host — not plain shared Git |

---

## Option A — Hostinger Node.js Web App (shared / Cloud — frontend only)

Use this for the **Next.js UI** on Business or Cloud plans with Node.js support.

1. **Remove** the old website that used plain Git-only deploy (back up first).
2. hPanel → **Websites** → **Add Website** → **Node.js Apps** → **Import Git Repository**.
3. Select this repository.
4. Build settings:

   | Setting | Value |
   |---------|--------|
   | Framework | **Next.js** (or **Other** if not detected) |
   | Root directory | repository root (where root `package.json` is) |
   | Install command | `npm install` |
   | Build command | `npm run build` |
   | Start command | `npm run start -- -p $PORT` |
   | Output directory | `frontend/.next` |
   | Node.js version | **20** or **22** |

5. Environment variables (Hostinger → Environment Variables):

   ```env
   NEXT_PUBLIC_API_URL=https://fleetopsapp.xyz/api
   BACKEND_ORIGIN=http://127.0.0.1:8000
   ```

6. Click **Deploy**. Hostinger places build output under `~/domains/<domain>/nodejs` and writes `public_html/.htaccess` to proxy to Node.

> **Backend:** FastAPI does not run on Node.js hosting. Run the API on a **KVM VPS** (Option B) or another host and point `NEXT_PUBLIC_API_URL` at it.

---

## Option B — KVM VPS (full stack — recommended)

Run backend + frontend + MySQL with the included scripts:

```bash
chmod +x deploy-docker-hostinger.sh
DOMAIN=https://fleetopsapp.xyz ./deploy-docker-hostinger.sh
```

Or without Docker:

```bash
chmod +x deploy-hostinger.sh
./deploy-hostinger.sh
```

Then point Nginx at ports **8000** (API) and **3000** (Next.js). Document root on the VPS is **not** `public_html`; Nginx proxies `/` → frontend and `/api` → backend.

---

## Option C — Plain Git deploy on shared hosting (bootstrap only)

If you must keep hPanel **Git** (Advanced → Git):

1. **Install path:** `public_html` (for the main domain).
2. **Build command:**

   ```bash
   chmod +x scripts/hostinger-post-deploy.sh && FLEETOPS_DOMAIN=fleetopsapp.xyz ./scripts/hostinger-post-deploy.sh
   ```

3. Click **Pull** / push to redeploy.

The repo now includes:

- `index.html` + `index.php` — stops immediate **403**
- `.htaccess` — `DirectoryIndex`, blocks `/backend` and `.env` from the web
- `scripts/hostinger-post-deploy.sh` — permissions, empty `public_html` symlink, optional frontend build

This alone does **not** run FastAPI or SSR Next.js. Upgrade to Option A + B for a live app.

---

## Document root & clone path (SSH)

Hostinger expects:

```
~/domains/fleetopsapp.xyz/public_html   ← Apache/LiteSpeed document root
```

If Git cloned to `~/domains/fleetopsapp.xyz/` (parent) and `public_html` is empty:

```bash
cd ~/domains/fleetopsapp.xyz
rm -rf public_html          # only if empty or backed up
ln -sfn "$(pwd)" public_html
# Or if the repo is in a subfolder:
# ln -sfn "$(pwd)/fleetops" public_html
```

**Not Laravel:** there is no `/public` folder to point at. The web entry is root `index.html` / Node.js proxy, not `public/index.php`.

---

## Permissions

On the server after deploy:

```bash
find . -type d -not -path './.git/*' -exec chmod 755 {} +
find . -type f -not -path './.git/*' -exec chmod 644 {} +
chmod +x scripts/hostinger-post-deploy.sh deploy-*.sh
```

`hostinger-post-deploy.sh` applies these automatically.

---

## Verify

1. File Manager → `domains/fleetopsapp.xyz/public_html` → should contain `index.html`, `.htaccess`, `frontend/`, `backend/`.
2. Browser → `https://fleetopsapp.xyz` → no 403 (static bootstrap or Next.js app).
3. Node.js dashboard → last deployment **success**.
4. VPS: `curl http://127.0.0.1:8000/health` and `curl http://127.0.0.1:3000`.

---

## Files added for Hostinger

| File | Purpose |
|------|---------|
| `index.html` | Web entry when document root = repo root |
| `index.php` | Apache/LiteSpeed `DirectoryIndex` fallback |
| `.htaccess` | Index + block sensitive paths |
| `scripts/hostinger-post-deploy.sh` | Post-pull fix script |
| Root `package.json` `build` / `start` | Hostinger Node.js monorepo detection |

See also: `deploy-hostinger.sh`, `deploy-docker-hostinger.sh`, `README.md` (Option 2: Hostinger VPS).

# Phase 3.1 Deployment Smoke Check

Use this after deploying FleetOpt to Hostinger/VPS.

## Script

`scripts/phase3_1_smoke_check.sh`

## Where to place it on VPS

Place it inside your project folder (recommended):

- `/opt/fleetopt/scripts/phase3_1_smoke_check.sh`

## Run command

From project root:

```bash
chmod +x ./scripts/phase3_1_smoke_check.sh
BASE_URL="https://fleetopsapp.xyz" ./scripts/phase3_1_smoke_check.sh
```

## Optional deep-check variables

Use these when your paths/tokens differ:

```bash
BASE_URL="https://fleetopsapp.xyz" \
API_BASE_URL="https://fleetopsapp.xyz/api" \
BACKEND_DIRECT_URL="http://127.0.0.1:8000" \
BACKEND_ENV_FILE="/opt/fleetopt/backend/.env" \
FRONTEND_ENV_FILE="/opt/fleetopt/frontend/.env.local" \
NGINX_CONF_PATH="/etc/nginx/sites-enabled/fleetopt" \
AUTH_TOKEN="<jwt-token>" \
PAYMENT_PROOF_ID="123" \
./scripts/phase3_1_smoke_check.sh
```

## What it checks

1. Frontend is reachable
2. Backend `/health` is reachable
3. Backend `/ready` validates DB connection
4. API base URL format is correct
5. CORS preflight for login endpoint
6. Login/auth endpoint responds
7. Upload route reachability
8. Nginx upload size limit vs backend minimum expectation
9. Uploaded file preview route response (auth-aware)
10. Static assets load
11. No localhost references in served production pages/assets
12. Required environment variables exist in backend/frontend env files

## Output format

- `✅ PASS - ...` means check is healthy.
- `❌ FAIL - ...` means action required before production sign-off.
- `⚠️ WARN - ...` means check was skipped or incomplete (usually missing optional inputs/files).

Script exit code:

- `0` = no failed checks
- `1` = one or more failed checks
- `2` = missing required script input (e.g., `BASE_URL`)


#!/usr/bin/env bash
set -u

# FleetOpt Phase 3.1 post-deploy smoke checks
# Usage:
#   BASE_URL="https://fleetopsapp.xyz" ./scripts/phase3_1_smoke_check.sh
# Optional:
#   API_BASE_URL="https://fleetopsapp.xyz/api"
#   BACKEND_DIRECT_URL="http://127.0.0.1:8000"
#   BACKEND_ENV_FILE="/opt/fleetopt/backend/.env"
#   FRONTEND_ENV_FILE="/opt/fleetopt/frontend/.env.local"
#   NGINX_CONF_PATH="/etc/nginx/sites-enabled/fleetopt"
#   AUTH_TOKEN="Bearer token..."
#   PAYMENT_PROOF_ID=123

BASE_URL="${BASE_URL:-}"
API_BASE_URL="${API_BASE_URL:-}"
BACKEND_DIRECT_URL="${BACKEND_DIRECT_URL:-http://127.0.0.1:8000}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-/opt/fleetopt/backend/.env}"
FRONTEND_ENV_FILE="${FRONTEND_ENV_FILE:-/opt/fleetopt/frontend/.env.local}"
NGINX_CONF_PATH="${NGINX_CONF_PATH:-/etc/nginx/sites-enabled/fleetopt}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
PAYMENT_PROOF_ID="${PAYMENT_PROOF_ID:-1}"
MIN_EXPECTED_UPLOAD_MB=12

if [[ -z "$BASE_URL" ]]; then
  echo "Usage: BASE_URL=\"https://fleetopsapp.xyz\" $0"
  exit 2
fi

if [[ -z "$API_BASE_URL" ]]; then
  API_BASE_URL="${BASE_URL%/}/api"
fi

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { echo "✅ PASS - $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "❌ FAIL - $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { echo "⚠️ WARN - $1"; WARN_COUNT=$((WARN_COUNT + 1)); }

tmp_body="$(mktemp)"
tmp_headers="$(mktemp)"
tmp_home="$(mktemp)"
tmp_assets="$(mktemp)"

cleanup() {
  rm -f "$tmp_body" "$tmp_headers" "$tmp_home" "$tmp_assets"
}
trap cleanup EXIT

http_code() {
  local method="$1"
  local url="$2"
  shift 2
  curl -sS -X "$method" "$url" -o "$tmp_body" -D "$tmp_headers" -w "%{http_code}" "$@" || echo "000"
}

header_value() {
  local key="$1"
  awk -F': ' -v k="$(echo "$key" | tr '[:upper:]' '[:lower:]')" '
    tolower($1)==k {gsub("\r","",$2); print $2}
  ' "$tmp_headers" | tail -n 1
}

contains_localhost() {
  grep -Eiq "localhost|127\.0\.0\.1" "$1"
}

echo "FleetOpt Phase 3.1 smoke check"
echo "BASE_URL=$BASE_URL"
echo "API_BASE_URL=$API_BASE_URL"
echo "BACKEND_DIRECT_URL=$BACKEND_DIRECT_URL"
echo ""

# 1) Frontend reachable
code="$(http_code GET "${BASE_URL%/}/")"
if [[ "$code" =~ ^20[0-9]$ || "$code" =~ ^30[1278]$ ]]; then
  pass "Frontend reachable (${code})"
else
  fail "Frontend not reachable at ${BASE_URL%/}/ (HTTP ${code})"
fi

# 2) Backend /health reachable
code="$(http_code GET "${BACKEND_DIRECT_URL%/}/health")"
if [[ "$code" == "200" ]]; then
  pass "Backend health check (${BACKEND_DIRECT_URL%/}/health)"
else
  fail "Backend /health unreachable (HTTP ${code})"
fi

# 3) Backend /ready (DB readiness)
code="$(http_code GET "${BACKEND_DIRECT_URL%/}/ready")"
if [[ "$code" == "200" ]]; then
  pass "Backend readiness check with DB connection (${BACKEND_DIRECT_URL%/}/ready)"
else
  fail "Backend /ready failed (DB not ready or endpoint unavailable, HTTP ${code})"
fi

# 4) API base URL correctness
if [[ "$API_BASE_URL" =~ /api/?$ ]]; then
  pass "API base URL format is correct (${API_BASE_URL})"
else
  fail "API base URL should end in /api (${API_BASE_URL})"
fi

# 5) CORS check
code="$(http_code OPTIONS "${API_BASE_URL%/}/auth/login" \
  -H "Origin: ${BASE_URL%/}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization")"
acao="$(header_value "access-control-allow-origin")"
if [[ "$code" =~ ^20[04]$ ]] && [[ "$acao" == "${BASE_URL%/}" || "$acao" == "*" ]]; then
  pass "CORS preflight responds with allow-origin (${acao})"
else
  fail "CORS preflight failed for ${API_BASE_URL%/}/auth/login (HTTP ${code}, ACAO=${acao:-<none>})"
fi

# 6) Login/auth endpoint responds
code="$(http_code POST "${API_BASE_URL%/}/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "username=smoke-test@example.com&password=invalid-password")"
if [[ "$code" == "401" || "$code" == "423" || "$code" == "422" || "$code" == "400" ]]; then
  pass "Login endpoint responds (${code})"
else
  fail "Login endpoint unexpected response (HTTP ${code})"
fi

# 7) Upload route works (route-level reachability)
code="$(http_code GET "${BASE_URL%/}/uploads/smoke-not-existing-file.txt")"
if [[ "$code" == "404" || "$code" == "403" || "$code" == "400" ]]; then
  pass "Upload route reachable (${code})"
else
  fail "Upload route issue at /uploads/* (HTTP ${code})"
fi

# 8) Upload size limit check (nginx config)
if [[ -f "$NGINX_CONF_PATH" ]]; then
  raw_size="$(grep -Ei "client_max_body_size" "$NGINX_CONF_PATH" | head -n 1 | sed -E 's/.*client_max_body_size[[:space:]]+([^;]+).*/\1/i' | tr -d '[:space:]')"
  if [[ -n "$raw_size" ]]; then
    # Supports values like 15M, 20m, 1G
    num="$(echo "$raw_size" | sed -E 's/[^0-9.]//g')"
    unit="$(echo "$raw_size" | sed -E 's/[0-9.]//g' | tr '[:upper:]' '[:lower:]')"
    limit_mb=0
    case "$unit" in
      g) limit_mb="$(awk "BEGIN {printf \"%.0f\", $num*1024}")" ;;
      m|"") limit_mb="$(awk "BEGIN {printf \"%.0f\", $num}")" ;;
      k) limit_mb="$(awk "BEGIN {printf \"%.0f\", $num/1024}")" ;;
      *) limit_mb=0 ;;
    esac
    if [[ "$limit_mb" -ge "$MIN_EXPECTED_UPLOAD_MB" ]]; then
      pass "Upload size limit is acceptable (${raw_size} in nginx)"
    else
      fail "Upload size limit too low (${raw_size} < ${MIN_EXPECTED_UPLOAD_MB}M)"
    fi
  else
    warn "Could not parse client_max_body_size from ${NGINX_CONF_PATH}"
  fi
else
  warn "Nginx config not found at ${NGINX_CONF_PATH} (skipping size-limit config check)"
fi

# 9) Uploaded file preview route works (payment proof)
if [[ -n "$AUTH_TOKEN" ]]; then
  code="$(http_code GET "${API_BASE_URL%/}/payments/${PAYMENT_PROOF_ID}/proof" \
    -H "Authorization: Bearer ${AUTH_TOKEN}")"
  if [[ "$code" == "200" || "$code" == "404" || "$code" == "403" ]]; then
    pass "Authenticated preview route responds (/payments/${PAYMENT_PROOF_ID}/proof => ${code})"
  else
    fail "Authenticated preview route failed (/payments/${PAYMENT_PROOF_ID}/proof => ${code})"
  fi
else
  code="$(http_code GET "${API_BASE_URL%/}/payments/${PAYMENT_PROOF_ID}/proof")"
  if [[ "$code" == "401" || "$code" == "403" ]]; then
    pass "Preview route exists and is protected (HTTP ${code})"
  else
    warn "Preview route check without AUTH_TOKEN returned HTTP ${code}; set AUTH_TOKEN for full verification"
  fi
fi

# 10) Static assets load correctly
curl -sS "${BASE_URL%/}/" -o "$tmp_home" || true
asset_path="$(grep -Eo "/_next/static/[^\"]+" "$tmp_home" | head -n 1 || true)"
if [[ -n "$asset_path" ]]; then
  code="$(http_code GET "${BASE_URL%/}${asset_path}")"
  if [[ "$code" == "200" ]]; then
    pass "Static asset loads (${asset_path})"
  else
    fail "Static asset failed to load (${asset_path}, HTTP ${code})"
  fi
else
  warn "Could not find _next static asset path in homepage HTML"
fi

# 11) No localhost in production responses
curl -sS "${BASE_URL%/}/" -o "$tmp_home" || true
if contains_localhost "$tmp_home"; then
  fail "Homepage HTML contains localhost/127.0.0.1 references"
else
  pass "No localhost references in homepage HTML"
fi

# Check a few static JS files too
grep -Eo "/_next/static/[^\"]+\.js" "$tmp_home" > "$tmp_assets" || true
if [[ -s "$tmp_assets" ]]; then
  while IFS= read -r path; do
    curl -sS "${BASE_URL%/}${path}" >> "$tmp_body" || true
  done < <(head -n 3 "$tmp_assets")
  if contains_localhost "$tmp_body"; then
    fail "Static JS includes localhost/127.0.0.1 references"
  else
    pass "No localhost references in sampled static JS bundles"
  fi
else
  warn "No JS bundle paths found for localhost scan"
fi

# 12) Environment variable detection
required_backend_vars=(APP_ENV SECRET_KEY DATABASE_URL FRONTEND_URL UPLOADS_ROOT)
required_frontend_vars=(NEXT_PUBLIC_API_URL BACKEND_ORIGIN)

if [[ -f "$BACKEND_ENV_FILE" ]]; then
  missing=()
  for var in "${required_backend_vars[@]}"; do
    if ! grep -Eq "^[[:space:]]*${var}=.+" "$BACKEND_ENV_FILE"; then
      missing+=("$var")
    fi
  done
  if [[ "${#missing[@]}" -eq 0 ]]; then
    pass "Backend env file contains required variables (${BACKEND_ENV_FILE})"
  else
    fail "Backend env missing values: ${missing[*]} (${BACKEND_ENV_FILE})"
  fi
else
  warn "Backend env file not found at ${BACKEND_ENV_FILE}"
fi

if [[ -f "$FRONTEND_ENV_FILE" ]]; then
  missing=()
  for var in "${required_frontend_vars[@]}"; do
    if ! grep -Eq "^[[:space:]]*${var}=.+" "$FRONTEND_ENV_FILE"; then
      missing+=("$var")
    fi
  done
  if [[ "${#missing[@]}" -eq 0 ]]; then
    pass "Frontend env file contains required variables (${FRONTEND_ENV_FILE})"
  else
    fail "Frontend env missing values: ${missing[*]} (${FRONTEND_ENV_FILE})"
  fi

  if grep -Eq "^[[:space:]]*NEXT_PUBLIC_API_URL=.*(localhost|127\.0\.0\.1)" "$FRONTEND_ENV_FILE"; then
    fail "Frontend NEXT_PUBLIC_API_URL still points to localhost in env file"
  else
    pass "Frontend NEXT_PUBLIC_API_URL is not localhost in env file"
  fi
else
  warn "Frontend env file not found at ${FRONTEND_ENV_FILE}"
fi

echo ""
echo "Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed, ${WARN_COUNT} warnings"
if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
exit 0


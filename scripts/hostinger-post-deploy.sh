#!/bin/bash
# FleetOps — run on the Hostinger server after Git pull (hPanel → Git → Build commands).
# Fixes: empty public_html, wrong clone path, missing index, and directory permissions.
#
# Example hPanel Git build command:
#   chmod +x scripts/hostinger-post-deploy.sh && ./scripts/hostinger-post-deploy.sh
#
set -euo pipefail

DOMAIN="${FLEETOPS_DOMAIN:-fleetopsapp.xyz}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { echo "[hostinger-post-deploy] $*"; }

fix_permissions() {
  log "Setting permissions (dirs 755, files 644)..."
  find "$REPO_ROOT" -type d -not -path '*/.git/*' -exec chmod 755 {} + 2>/dev/null || true
  find "$REPO_ROOT" -type f -not -path '*/.git/*' -exec chmod 644 {} + 2>/dev/null || true
  chmod 755 "$REPO_ROOT/scripts"/*.sh 2>/dev/null || true
  chmod 755 "$REPO_ROOT"/deploy-*.sh 2>/dev/null || true
  chmod 644 "$REPO_ROOT/.htaccess" 2>/dev/null || true
  chmod 644 "$REPO_ROOT/index.html" "$REPO_ROOT/index.php" 2>/dev/null || true
}

ensure_index_files() {
  if [[ ! -f "$REPO_ROOT/index.html" ]]; then
    log "WARN: index.html missing from repository — commit root index.html and redeploy."
  fi
  if [[ ! -f "$REPO_ROOT/.htaccess" ]]; then
    log "WARN: .htaccess missing from repository — commit root .htaccess and redeploy."
  fi
}

# Hostinger layout: ~/domains/example.com/public_html
link_public_html_if_needed() {
  local domain_dir="${HOME}/domains/${DOMAIN}"
  local public_html="${domain_dir}/public_html"

  [[ -d "$domain_dir" ]] || {
    log "Not on standard Hostinger path ($domain_dir); skipping public_html symlink step."
    return 0
  }

  # Already deployed inside public_html
  if [[ "$(realpath "$REPO_ROOT" 2>/dev/null || echo "$REPO_ROOT")" == "$(realpath "$public_html" 2>/dev/null || echo "$public_html")" ]]; then
    log "Repository is already the document root ($public_html)."
    return 0
  fi

  # Repo cloned beside public_html (common when Git target is domain root, not public_html)
  if [[ -d "$public_html" ]] && [[ -z "$(ls -A "$public_html" 2>/dev/null || true)" ]]; then
    log "public_html is empty — linking to repository at $REPO_ROOT"
    rmdir "$public_html" 2>/dev/null || rm -rf "$public_html"
    ln -sfn "$REPO_ROOT" "$public_html"
    return 0
  fi

  # Repo at domain root, public_html is a separate empty or default folder
  if [[ -f "$REPO_ROOT/index.html" || -f "$REPO_ROOT/package.json" ]] && [[ -d "$public_html" ]]; then
    if [[ ! -e "$public_html/index.html" && ! -e "$public_html/index.php" ]]; then
      log "Document root has no index — replacing public_html with symlink to $REPO_ROOT"
      backup="${public_html}.bak.$(date +%s)"
      [[ -d "$public_html" ]] && mv "$public_html" "$backup" && log "Backed up old public_html to $backup"
      ln -sfn "$REPO_ROOT" "$public_html"
    fi
  fi
}

build_frontend_if_node() {
  if ! command -v npm >/dev/null 2>&1; then
    log "npm not available (use Hostinger Node.js Web App or VPS). Skipping frontend build."
    return 0
  fi

  log "Building frontend..."
  cd "$REPO_ROOT"
  if [[ -f package.json ]] && grep -q '"build"' package.json; then
    npm run build
  else
    cd frontend
    npm install
    if [[ ! -f .env.local && -f .env.production ]]; then
      cp .env.production .env.local
      log "Created frontend/.env.local from .env.production"
    fi
    npm run build
  fi
}

main() {
  log "FleetOps post-deploy (domain=${DOMAIN}, root=${REPO_ROOT})"
  ensure_index_files
  link_public_html_if_needed
  fix_permissions
  build_frontend_if_node
  log "Done. If the site still shows 403, use Hostinger Node.js Web App or VPS deploy — see HOSTINGER.md"
}

main "$@"

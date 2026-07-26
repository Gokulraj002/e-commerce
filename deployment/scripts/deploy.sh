#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy.sh — Zero-downtime deploy for Elite NonVeg on the VPS.
#
# Invoked on the VPS by CI/CD over SSH, or manually by an operator:
#   cd /home/deploy/elite && bash deployment/scripts/deploy.sh
#
# Assumes:
#   - cwd (or the ELITE_ROOT env) is the repo root under /home/deploy/elite
#   - the `deploy` user owns the tree
#   - Node 20, npm, pm2, rsync are installed (setup-server.sh)
#   - real secrets exist at $ELITE_ROOT/.env and $ELITE_ROOT/.env.worker
#
# What it does (all steps abort on error, colored [OK]/[ERR] output):
#   1. tag current HEAD as `last-deploy-previous` (rollback anchor)
#   2. git fetch --all --tags
#   3. git reset --hard $DEPLOY_REF          (default: origin/main)
#   4. tag new HEAD as `last-deploy`
#   5. npm ci --workspaces --include-workspace-root
#   6. npm run build:shared
#   7. npm --workspace backend run prisma:deploy       (forward-only migrations)
#   8. npm --workspace backend run build
#   9. npm --workspace frontend run build
#  10. npm --workspace admin    run build
#  11. rsync frontend/dist -> /var/www/elite/frontend/
#  12. rsync admin/dist    -> /var/www/elite/admin/
#  13. pm2 reload deployment/pm2/ecosystem.config.cjs --update-env
#  14. pm2 save
# ---------------------------------------------------------------------------
set -euo pipefail

# ---------- pretty output --------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { printf "${GREEN}[OK]${NC}  %s\n" "$*"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
err()  { printf "${RED}[ERR]${NC} %s\n" "$*" >&2; }
step() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }

# ---------- config ---------------------------------------------------------
ELITE_ROOT="${ELITE_ROOT:-$(pwd)}"
DEPLOY_REF="${DEPLOY_REF:-origin/main}"
WWW_FRONTEND="${WWW_FRONTEND:-/var/www/elite/frontend}"
WWW_ADMIN="${WWW_ADMIN:-/var/www/elite/admin}"
PM2_ECOSYSTEM="${PM2_ECOSYSTEM:-deployment/pm2/ecosystem.config.cjs}"

# Fail loudly with the line number where anything blew up.
trap 'err "deploy.sh failed at line $LINENO (last command: $BASH_COMMAND)"; exit 1' ERR

cd "${ELITE_ROOT}"
if [[ ! -d .git ]]; then
  err "ELITE_ROOT=${ELITE_ROOT} is not a git repo. Cannot deploy."
  exit 1
fi
if [[ ! -f "${PM2_ECOSYSTEM}" ]]; then
  err "PM2 ecosystem file not found at ${PM2_ECOSYSTEM}"
  exit 1
fi

STARTED_AT="$(date -u +%FT%TZ)"
CURRENT_SHA="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"

step "Deploying Elite NonVeg"
echo "  repo root:    ${ELITE_ROOT}"
echo "  target ref:   ${DEPLOY_REF}"
echo "  current sha:  ${CURRENT_SHA}"
echo "  started (UTC): ${STARTED_AT}"

# ---------- 1. tag rollback anchor -----------------------------------------
step "Tagging current HEAD as 'last-deploy-previous' (rollback anchor)"
# If a `last-deploy` tag exists (from a prior run), that IS the previous
# release — promote it to `last-deploy-previous`. Otherwise anchor at HEAD.
if git rev-parse --verify --quiet refs/tags/last-deploy >/dev/null; then
  git tag -f last-deploy-previous "$(git rev-parse last-deploy)"
  ok "last-deploy-previous -> $(git rev-parse --short last-deploy-previous)"
else
  git tag -f last-deploy-previous HEAD
  warn "No prior last-deploy tag; anchoring last-deploy-previous at HEAD ($(git rev-parse --short HEAD))"
fi

# ---------- 2. fetch + reset -----------------------------------------------
step "Fetching from origin"
git fetch --all --tags --prune
ok "git fetch complete"

step "Resetting working tree to ${DEPLOY_REF}"
git reset --hard "${DEPLOY_REF}"
NEW_SHA="$(git rev-parse HEAD)"
ok "HEAD is now $(git rev-parse --short HEAD) — $(git log -1 --pretty=format:'%s')"

step "Tagging new HEAD as 'last-deploy'"
git tag -f last-deploy HEAD
ok "last-deploy -> $(git rev-parse --short last-deploy)"

# ---------- 3. install deps ------------------------------------------------
step "npm ci --workspaces --include-workspace-root"
npm ci --workspaces --include-workspace-root
ok "dependencies installed"

# ---------- 4. build shared first (backend + SPAs depend on it) ------------
step "Building shared package"
npm run build:shared
ok "shared built"

# ---------- 5. run pending prisma migrations (forward-only) ---------------
step "Applying database migrations (prisma migrate deploy)"
npm --workspace backend run prisma:deploy
ok "migrations applied"

# ---------- 6. build backend ----------------------------------------------
step "Building backend (TypeScript -> dist/)"
npm --workspace backend run build
ok "backend built"

# ---------- 7. build customer SPA -----------------------------------------
step "Building customer SPA (frontend)"
npm --workspace frontend run build
ok "frontend built"

# ---------- 8. build admin SPA --------------------------------------------
step "Building admin SPA"
npm --workspace admin run build
ok "admin built"

# ---------- 9. publish static SPA builds to NGINX docroots ----------------
step "Publishing customer SPA to ${WWW_FRONTEND}"
if [[ ! -d frontend/dist ]]; then
  err "frontend/dist/ missing after build — cannot rsync"
  exit 1
fi
rsync -a --delete frontend/dist/ "${WWW_FRONTEND}/"
ok "customer SPA published"

step "Publishing admin SPA to ${WWW_ADMIN}"
if [[ ! -d admin/dist ]]; then
  err "admin/dist/ missing after build — cannot rsync"
  exit 1
fi
rsync -a --delete admin/dist/ "${WWW_ADMIN}/"
ok "admin SPA published"

# ---------- 10. zero-downtime PM2 reload ----------------------------------
step "Reloading PM2 (${PM2_ECOSYSTEM})"
# `reload` restarts cluster workers one at a time — the API keeps serving.
# `--update-env` re-reads env_file so rotated secrets take effect.
pm2 reload "${PM2_ECOSYSTEM}" --update-env
pm2 save
ok "PM2 reloaded"

# ---------- summary --------------------------------------------------------
FINISHED_AT="$(date -u +%FT%TZ)"
printf "\n${GREEN}==========================================================${NC}\n"
ok  "Deploy succeeded"
echo "  previous sha: ${CURRENT_SHA}"
echo "  new sha:      ${NEW_SHA}"
echo "  started:      ${STARTED_AT}"
echo "  finished:     ${FINISHED_AT}"
echo "  rollback:     bash deployment/scripts/rollback.sh"
printf "${GREEN}==========================================================${NC}\n"

#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# rollback.sh — Roll the VPS back to the previous known-good release.
#
# LAST RESORT. Prefer a normal `deploy.sh` of a specific good commit over
# this script. Rollback is only safe when the previous code version can
# still run against the current database schema. Because Prisma migrations
# are forward-only, this script does NOT undo migrations — it re-runs
# `prisma migrate deploy` against the older code (a no-op if no new
# migrations were introduced in the release you're rolling back from).
#
# How it works:
#   1. verifies the `last-deploy-previous` tag exists (set by deploy.sh)
#   2. hard-resets the working tree to that tag
#   3. re-runs install + build + migrate + PM2 reload
#
# Usage:
#   cd /home/deploy/elite && bash deployment/scripts/rollback.sh
# ---------------------------------------------------------------------------
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { printf "${GREEN}[OK]${NC}  %s\n" "$*"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
err()  { printf "${RED}[ERR]${NC} %s\n" "$*" >&2; }
step() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }

ELITE_ROOT="${ELITE_ROOT:-$(pwd)}"

trap 'err "rollback.sh failed at line $LINENO (last command: $BASH_COMMAND)"; exit 1' ERR

cd "${ELITE_ROOT}"
if [[ ! -d .git ]]; then
  err "ELITE_ROOT=${ELITE_ROOT} is not a git repo. Cannot roll back."
  exit 1
fi

if ! git rev-parse --verify --quiet refs/tags/last-deploy-previous >/dev/null; then
  err "Tag 'last-deploy-previous' does not exist. Nothing to roll back to."
  err "Anchor tags are created by deploy.sh — this VPS may not have deployed via that script yet."
  exit 1
fi

PREV_SHA="$(git rev-parse last-deploy-previous)"
CURR_SHA="$(git rev-parse HEAD)"

warn "LAST-RESORT ROLLBACK"
echo "  current HEAD:            ${CURR_SHA}"
echo "  last-deploy-previous:    ${PREV_SHA}"
echo ""
echo "This will hard-reset the working tree, re-run migrations, rebuild all"
echo "artifacts, and pm2-reload the API + worker."
echo ""
read -r -p "Proceed with rollback? (type 'yes' to continue) " confirm
if [[ "${confirm}" != "yes" ]]; then
  err "Aborted by operator."
  exit 1
fi

step "Resetting working tree to last-deploy-previous (${PREV_SHA})"
# Preserve the current head-tag before rewinding, so a re-roll forward stays possible.
git tag -f rollback-from HEAD
git reset --hard last-deploy-previous
ok "HEAD is now $(git rev-parse --short HEAD)"

# Re-run the full deploy pipeline against the older ref. DEPLOY_REF=HEAD skips
# the fetch/reset inside deploy.sh so we stay on the pinned rollback commit.
step "Re-running install + migrate + build + reload via deploy.sh (DEPLOY_REF=HEAD)"
DEPLOY_REF="HEAD" bash deployment/scripts/deploy.sh

ok "Rollback complete. Head is at ${PREV_SHA}."
warn "Investigate the failing deploy before rolling forward again."

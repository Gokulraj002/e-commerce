#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# restore.sh — Restore a PostgreSQL dump produced by backup.sh.
#
# DESTRUCTIVE. This drops all objects in the current DB (via
# `DROP SCHEMA public CASCADE`) and replays the dump on top. Use only
# when you have accepted losing whatever is currently in the DB.
#
# Usage:
#   bash deployment/scripts/restore.sh <path/to/db-*.sql.gz>
#   bash deployment/scripts/restore.sh /var/backups/elite/2026-07-24/db-elite_prod-2026-07-24T021500Z.sql.gz
#
# Overridable env:
#   DATABASE_URL     — target DB to restore into. Defaults to the one in
#                      /home/deploy/elite/.env (parse-only, never printed).
#   SKIP_CONFIRM=1   — skip the interactive "type the db name" confirmation
#                      (only set this from another script that already
#                      confirmed with the operator).
#
# What it does:
#   1. validates the dump file exists and is readable
#   2. resolves DATABASE_URL and extracts the DB name
#   3. asks the operator to type the DB name to confirm
#   4. `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` on the target
#   5. streams the gunzipped dump into psql
# ---------------------------------------------------------------------------
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { printf "${GREEN}[OK]${NC}  %s\n" "$*"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
err()  { printf "${RED}[ERR]${NC} %s\n" "$*" >&2; }
step() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }

trap 'err "restore.sh failed at line $LINENO (last command: $BASH_COMMAND)"; exit 1' ERR

ELITE_ROOT="${ELITE_ROOT:-/home/deploy/elite}"
ENV_FILE="${ENV_FILE:-${ELITE_ROOT}/.env}"

if [[ $# -lt 1 ]]; then
  err "Usage: $0 <path/to/db-*.sql.gz>"
  exit 2
fi

DUMP_FILE="$1"
if [[ ! -r "${DUMP_FILE}" ]]; then
  err "dump file not readable: ${DUMP_FILE}"
  exit 1
fi

# ---------- resolve DATABASE_URL ------------------------------------------
if [[ -z "${DATABASE_URL:-}" && -r "${ENV_FILE}" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/')"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  err "DATABASE_URL not set and not readable from ${ENV_FILE}"
  exit 1
fi

DB_PATH="${DATABASE_URL#*://*/}"
DB_NAME="${DB_PATH%%\?*}"
DB_NAME="${DB_NAME%%/*}"

if [[ -z "${DB_NAME}" ]]; then
  err "Could not parse DB name from DATABASE_URL"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  err "psql not found on PATH"
  exit 1
fi
if ! command -v gunzip >/dev/null 2>&1; then
  err "gunzip not found on PATH"
  exit 1
fi

step "Elite NonVeg DB restore"
echo "  dump file:  ${DUMP_FILE}"
echo "  target DB:  ${DB_NAME}"
warn "This will DROP the current public schema and replay the dump."

# ---------- confirm -------------------------------------------------------
if [[ "${SKIP_CONFIRM:-0}" != "1" ]]; then
  read -r -p "Type the database name (${DB_NAME}) to confirm: " typed
  if [[ "${typed}" != "${DB_NAME}" ]]; then
    err "Confirmation did not match. Aborted."
    exit 1
  fi
fi

# ---------- 1. drop + recreate public schema ------------------------------
step "Dropping and recreating schema public"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO PUBLIC;
SQL
ok "schema public reset"

# ---------- 2. stream the dump into psql ----------------------------------
step "Restoring from ${DUMP_FILE}"
gunzip -c "${DUMP_FILE}" | psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -q >/dev/null
ok "restore complete"

warn "Reload the API so any cached DB metadata is refreshed:"
echo "  sudo -u deploy pm2 reload ${ELITE_ROOT}/deployment/pm2/ecosystem.config.cjs --update-env"

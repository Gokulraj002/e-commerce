#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# backup.sh — Nightly backups for Elite NonVeg (cron-friendly, idempotent).
#
# Produces three artifacts per run under /var/backups/elite/YYYY-MM-DD/:
#   1. db-<dbname>-<UTC-timestamp>.sql.gz   — gzipped pg_dump
#   2. env-<UTC-timestamp>.tar.gz           — snapshot of .env / .env.worker
#   3. pm2-dump-<UTC-timestamp>.json        — pm2 process list (`pm2 save`)
#
# Retention: keeps the last 14 day-folders under BACKUP_ROOT.
#
# Reads DATABASE_URL from (in order): env var, ${ELITE_ROOT}/.env,
# /home/deploy/elite/.env. The db name is parsed out of the URL — the whole
# URL is passed straight to pg_dump so credentials work as-is.
#
# Cron example (as `deploy`, 02:15 UTC nightly):
#   15 2 * * *  bash /home/deploy/elite/deployment/scripts/backup.sh >> /var/log/elite/backup.log 2>&1
# ---------------------------------------------------------------------------
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { printf "${GREEN}[OK]${NC}  %s\n" "$*"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
err()  { printf "${RED}[ERR]${NC} %s\n" "$*" >&2; }
step() { printf "\n${BLUE}==>${NC} %s\n" "$*"; }

# ---------- config ---------------------------------------------------------
ELITE_ROOT="${ELITE_ROOT:-/home/deploy/elite}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/elite}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
ENV_FILE="${ENV_FILE:-${ELITE_ROOT}/.env}"
ENV_WORKER_FILE="${ENV_WORKER_FILE:-${ELITE_ROOT}/.env.worker}"

trap 'err "backup.sh failed at line $LINENO (last command: $BASH_COMMAND)"; exit 1' ERR

# ---------- load DATABASE_URL if not in env -------------------------------
if [[ -z "${DATABASE_URL:-}" && -r "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/')"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  err "DATABASE_URL is not set and could not be read from ${ENV_FILE}"
  exit 1
fi

# ---------- parse DB name out of the URL ----------------------------------
# postgresql://user:pass@host:port/dbname?sslmode=require  ->  dbname
DB_PATH="${DATABASE_URL#*://*/}"      # strip scheme + creds + host:port + '/'
DB_NAME="${DB_PATH%%\?*}"             # strip ?query params
DB_NAME="${DB_NAME%%/*}"              # defensively strip any trailing path
if [[ -z "${DB_NAME}" ]]; then
  err "Could not parse a database name out of DATABASE_URL"
  exit 1
fi

# ---------- output paths --------------------------------------------------
DATE_UTC="$(date -u +%F)"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
OUT_DIR="${BACKUP_ROOT}/${DATE_UTC}"
mkdir -p "${OUT_DIR}"
chmod 750 "${OUT_DIR}"

DB_OUT="${OUT_DIR}/db-${DB_NAME}-${TIMESTAMP}.sql.gz"
ENV_OUT="${OUT_DIR}/env-${TIMESTAMP}.tar.gz"
PM2_OUT="${OUT_DIR}/pm2-dump-${TIMESTAMP}.json"

step "Elite NonVeg nightly backup"
echo "  db name:      ${DB_NAME}"
echo "  output dir:   ${OUT_DIR}"
echo "  retention:    ${RETENTION_DAYS} days"

# ---------- 1. pg_dump ----------------------------------------------------
step "Dumping PostgreSQL database"
if ! command -v pg_dump >/dev/null 2>&1; then
  err "pg_dump not found on PATH"
  exit 1
fi
pg_dump --format=plain --no-owner --no-privileges "${DATABASE_URL}" | gzip -9 > "${DB_OUT}"
chmod 640 "${DB_OUT}"
DB_BYTES="$(stat -c%s "${DB_OUT}" 2>/dev/null || stat -f%z "${DB_OUT}")"
ok "wrote ${DB_OUT} (${DB_BYTES} bytes)"

# ---------- 2. .env snapshot ----------------------------------------------
step "Snapshotting .env files"
ENV_ARGS=()
for f in "${ENV_FILE}" "${ENV_WORKER_FILE}"; do
  if [[ -r "${f}" ]]; then
    ENV_ARGS+=("${f}")
  else
    warn "skipping ${f} (not readable)"
  fi
done
if [[ ${#ENV_ARGS[@]} -gt 0 ]]; then
  tar -czf "${ENV_OUT}" "${ENV_ARGS[@]}"
  chmod 600 "${ENV_OUT}"
  ok "wrote ${ENV_OUT}"
else
  warn "no .env files were snapshotted"
fi

# ---------- 3. pm2 dump ---------------------------------------------------
step "Snapshotting PM2 process list"
if command -v pm2 >/dev/null 2>&1; then
  # `pm2 save` writes ~/.pm2/dump.pm2. Copy it out with a timestamp so this
  # backup contains a self-describing snapshot.
  pm2 save >/dev/null || warn "pm2 save reported non-zero"
  PM2_DUMP="${HOME}/.pm2/dump.pm2"
  if [[ -r "${PM2_DUMP}" ]]; then
    cp "${PM2_DUMP}" "${PM2_OUT}"
    chmod 640 "${PM2_OUT}"
    ok "wrote ${PM2_OUT}"
  else
    warn "PM2 dump file not found at ${PM2_DUMP}"
  fi
else
  warn "pm2 not on PATH; skipping process-list snapshot"
fi

# ---------- 4. prune old day-folders --------------------------------------
step "Pruning day-folders older than ${RETENTION_DAYS} days"
# -mindepth 1 -maxdepth 1 keeps this scoped to top-level YYYY-MM-DD dirs.
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -print -exec rm -rf {} + \
  | sed 's/^/  removed: /' || true
ok "prune complete"

step "Summary"
ls -lh "${OUT_DIR}" | sed 's/^/  /'
ok "backup finished successfully"

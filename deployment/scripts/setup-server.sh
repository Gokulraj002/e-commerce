#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# setup-server.sh — Bootstrap a fresh Ubuntu 22.04 host for Elite NonVeg.
#
# One-shot provisioner. Safe to re-run (each step is guarded / idempotent):
#   - creates the `deploy` user + SSH dir stubs (no keys hardcoded)
#   - installs base packages (curl, git, build-essential, ufw, certbot, nginx)
#   - installs Node.js 20 (NodeSource) + pm2 global
#   - installs PostgreSQL 15 + Redis, starts + enables both
#   - opens ufw ports 22/80/443
#   - wires `pm2 startup` under the `deploy` user
#
# What it deliberately does NOT do:
#   - clone the repo, write .env, create the app DB/role, or issue TLS certs
#     (those steps belong to the operator — see deployment/README.md).
#
# Run as root (or with sudo) on a brand-new VPS:
#   sudo bash deployment/scripts/setup-server.sh
# ---------------------------------------------------------------------------
set -euo pipefail

# ---------- pretty output --------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { printf "${GREEN}[OK]${NC}  %s\n" "$*"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
err()  { printf "${RED}[ERR]${NC} %s\n" "$*" >&2; }
info() { printf "${BLUE}[..]${NC}  %s\n" "$*"; }

trap 'err "setup-server.sh failed at line $LINENO"; exit 1' ERR

# ---------- config (override via env) --------------------------------------
DEPLOY_USER="${DEPLOY_USER:-deploy}"
NODE_MAJOR="${NODE_MAJOR:-20}"
APP_ROOT="${APP_ROOT:-/home/${DEPLOY_USER}/elite}"
LOG_DIR="${LOG_DIR:-/var/log/elite}"
WWW_ROOT="${WWW_ROOT:-/var/www/elite}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/elite}"

# ---------- must be root ---------------------------------------------------
if [[ "${EUID}" -ne 0 ]]; then
  err "Run this script as root (or with sudo)."
  exit 1
fi

# ---------- must be Ubuntu -------------------------------------------------
if ! grep -qi 'ubuntu' /etc/os-release 2>/dev/null; then
  warn "This script is designed for Ubuntu 22.04. Continuing anyway."
fi

info "Provisioning Elite NonVeg host (user=${DEPLOY_USER}, node=${NODE_MAJOR})"

# ---------- 1. base packages ----------------------------------------------
info "Updating apt cache + installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg lsb-release \
  git build-essential \
  ufw fail2ban unattended-upgrades \
  nginx \
  certbot python3-certbot-nginx \
  rsync cron logrotate \
  jq unzip
ok "Base packages installed"

# ---------- 2. deploy user + ssh dir stubs --------------------------------
if id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  ok "User '${DEPLOY_USER}' already exists"
else
  info "Creating user '${DEPLOY_USER}' with sudo access"
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
  usermod -aG sudo "${DEPLOY_USER}"
  ok "User '${DEPLOY_USER}' created"
fi

DEPLOY_HOME="/home/${DEPLOY_USER}"
install -d -m 700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${DEPLOY_HOME}/.ssh"
touch "${DEPLOY_HOME}/.ssh/authorized_keys"
chmod 600 "${DEPLOY_HOME}/.ssh/authorized_keys"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_HOME}/.ssh/authorized_keys"
warn "Add operator + CI/CD SSH public keys to ${DEPLOY_HOME}/.ssh/authorized_keys (none hardcoded)."

# ---------- 3. app / log / www / backup dirs ------------------------------
info "Creating application directories"
install -d -m 755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${APP_ROOT}"
install -d -m 755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${LOG_DIR}"
install -d -m 755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${WWW_ROOT}"
install -d -m 755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${WWW_ROOT}/frontend"
install -d -m 755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${WWW_ROOT}/admin"
install -d -m 750 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${BACKUP_DIR}"
ok "Directories ready: ${APP_ROOT}, ${LOG_DIR}, ${WWW_ROOT}, ${BACKUP_DIR}"

# ---------- 4. Node.js 20 (NodeSource) ------------------------------------
if command -v node >/dev/null 2>&1 && node -v | grep -q "^v${NODE_MAJOR}\."; then
  ok "Node.js $(node -v) already installed"
else
  info "Installing Node.js ${NODE_MAJOR}.x from NodeSource"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
  ok "Node.js $(node -v) installed"
fi

# ---------- 5. PM2 global + startup unit ----------------------------------
if command -v pm2 >/dev/null 2>&1; then
  ok "PM2 $(pm2 -v) already installed"
else
  info "Installing PM2 globally"
  npm install -g pm2@latest
  ok "PM2 $(pm2 -v) installed"
fi

info "Wiring pm2 startup under ${DEPLOY_USER} (systemd unit)"
# pm2 startup prints the exact command; execute it directly so it's non-interactive.
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "${DEPLOY_USER}" --hp "${DEPLOY_HOME}" >/dev/null
ok "pm2 systemd unit installed (run 'sudo -u ${DEPLOY_USER} pm2 save' after first start)"

# ---------- 6. PostgreSQL 15 ----------------------------------------------
if command -v psql >/dev/null 2>&1; then
  ok "PostgreSQL already installed ($(psql --version))"
else
  info "Installing PostgreSQL 15 from PGDG apt repo"
  install -d /etc/apt/keyrings
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
  echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -y
  apt-get install -y postgresql-15 postgresql-contrib-15
  ok "PostgreSQL 15 installed"
fi
systemctl enable --now postgresql
ok "postgresql service enabled + running"

# ---------- 7. Redis ------------------------------------------------------
if command -v redis-server >/dev/null 2>&1; then
  ok "Redis already installed ($(redis-server --version | awk '{print $3}'))"
else
  info "Installing redis-server"
  apt-get install -y redis-server
  ok "Redis installed"
fi
systemctl enable --now redis-server
ok "redis-server enabled + running"

# ---------- 8. UFW firewall -----------------------------------------------
info "Configuring ufw (allow 22 / 80 / 443, deny everything else inbound)"
ufw --force default deny incoming
ufw --force default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (certbot + 301 redirect)
ufw allow 443/tcp   # HTTPS
ufw --force enable
ok "ufw active"

# ---------- 9. unattended-upgrades (security patches) ---------------------
info "Enabling unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null
ok "unattended-upgrades active"

# ---------- next steps ----------------------------------------------------
cat <<EOF

${GREEN}==========================================================================
  Elite NonVeg — server bootstrap complete.
==========================================================================${NC}

Next steps (in order):

  1. Add operator + CI/CD SSH public keys:
       ${DEPLOY_HOME}/.ssh/authorized_keys
     Then harden sshd (PermitRootLogin no, PasswordAuthentication no) and
     reload sshd:  sudo systemctl reload ssh

  2. Create the app database + least-privilege role in Postgres, e.g.:
       sudo -u postgres createuser --pwprompt elite
       sudo -u postgres createdb -O elite elite_prod

  3. Configure Redis:
       - set 'requirepass <strong-secret>' in /etc/redis/redis.conf
       - set 'bind 127.0.0.1 ::1'
       - set 'appendonly yes'
       sudo systemctl restart redis-server

  4. Clone the repo as the deploy user:
       sudo -u ${DEPLOY_USER} git clone <REPO_URL> ${APP_ROOT}

  5. Copy real secrets into place (chmod 600, owned by ${DEPLOY_USER}):
       ${APP_ROOT}/.env
       ${APP_ROOT}/.env.worker

  6. Run the first deploy:
       sudo -u ${DEPLOY_USER} bash ${APP_ROOT}/deployment/scripts/deploy.sh

  7. Symlink and enable NGINX site configs from
       ${APP_ROOT}/deployment/nginx/sites-available/
     into /etc/nginx/sites-enabled/, then:
       sudo nginx -t && sudo systemctl reload nginx

  8. Issue TLS certificates:
       sudo certbot --nginx -d store.example.com -d admin.example.com -d api.example.com

  9. Persist the PM2 process list across reboots:
       sudo -u ${DEPLOY_USER} pm2 save

EOF

ok "setup-server.sh finished"

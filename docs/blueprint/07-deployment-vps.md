# 07 — DEPLOYMENT (NATIVE VPS, NO DOCKER)

> **Project:** Ojiva AI Technologies — Enterprise E-Commerce Web Application (single-store, fresh-meat cold-chain delivery)
> **Reference:** elitenonveg.com · **Currency:** INR (₹) · **Service area:** Hyderabad (hyperlocal, pincode/zone based)
> **Stack (fixed):** React + Bootstrap 5 (Customer & Admin) · Node + Express + **TypeScript** REST + JWT · PostgreSQL + **Prisma** · Redis · **BullMQ** · S3/Cloudinary
> **Deployment (this chapter):** Single **Ubuntu VPS** · **NGINX** reverse proxy + static serving · **PM2** (cluster) · **PostgreSQL** + **Redis** installed natively on the host · GitHub Actions **SSH deploy** (`git pull` → install → migrate → build → `pm2 reload`). **No Docker, no docker-compose, no containers anywhere.**

---

# CHAPTER 16 — DEPLOYMENT (NATIVE VPS)

## 16.1 Purpose & Philosophy

This chapter is the operational runbook that takes the finished codebase (Chapters 2–15) to a live, monitored, zero-downtime production system on a **single Ubuntu VPS**. Every tier — NGINX, the Node API, the BullMQ worker, PostgreSQL and Redis — runs as a **native OS service** on one machine. There is no container runtime, no image registry, and no orchestration layer.

The rationale (detailed in Chapter 2.2.7) in one line: for a single-store, single-region (Hyderabad) business at Phase-1 volume, native processes under PM2 + NGINX are the **simplest, lowest-overhead, most debuggable** path to a resilient deployment — with a clean, no-rewrite upgrade path to Docker/orchestration if scale ever demands it.

| Principle | What it means operationally |
|-----------|-----------------------------|
| **One box, native services** | `nginx`, `postgresql`, `redis-server` run under systemd; Node processes run under PM2. Managed with standard Linux tooling the team already knows. |
| **NGINX is the only public door** | Only ports 80/443 are open to the internet. Node (`:4000`), PostgreSQL (`:5432`) and Redis (`:6379`) bind to `127.0.0.1` and are never exposed. |
| **Zero-downtime deploys** | `pm2 reload` restarts cluster workers one at a time; a live worker always serves traffic during a deploy. |
| **Idempotent, scripted ops** | Provisioning, deploy, backup and restore are shell scripts in `deployment/scripts/` — repeatable and reviewable, never ad-hoc SSH typing. |
| **Secrets never in git** | Real `.env` files live only on the server (`chmod 600`); the repo carries `.env.*.example` templates only. |
| **Split later, not now** | The same app runs unchanged when Postgres/Redis move to managed instances or when a second VPS joins the NGINX upstream. |

---

## 16.2 Target Server

**Phase 1: one Ubuntu VPS** (Ubuntu 22.04 LTS or 24.04 LTS) sized for the whole stack.

| Resource | Baseline recommendation | Notes |
|----------|-------------------------|-------|
| **vCPU** | 4 cores | PM2 runs one API worker per core; leaves headroom for Postgres/Redis. |
| **RAM** | 8 GB | Postgres shared buffers + Redis + Node cluster + NGINX comfortably fit. |
| **Disk** | 80–160 GB SSD | DB data, media temp, PM2 logs, NGINX logs, OS. Media itself lives in S3/Cloudinary. |
| **Network** | Static public IP, 1 Gbps | DNS A-records point the storefront + admin subdomain here. |
| **Region** | India (Mumbai) | Low latency to the Hyderabad customer base. |

**Splitting to multiple servers later (no app rewrite):**

| Growth signal | Action |
|---------------|--------|
| DB CPU/IO is the bottleneck | Move PostgreSQL to a **managed instance** (or a dedicated DB VPS); update `DATABASE_URL`. |
| Cache/queue contention | Move Redis to a dedicated/managed instance; update `REDIS_URL`. |
| Web tier saturated | Add a second **app VPS**; add it to the NGINX `upstream` block (or put a managed load balancer in front of two NGINX nodes). |
| Read/report load heavy | Add a **Postgres read replica**; point analytics/report queries at it. |

---

## 16.3 Server Topology

```
                                   Internet (customers, admin staff, payment webhooks)
                                                     │
                                             DNS A-records
                            store.example.com  ·  admin.example.com  ·  api.example.com
                                                     │  HTTPS 443 (HTTP 80 → 301 redirect)
                                                     ▼
        ┌──────────────────────────── Ubuntu VPS (single host) ─────────────────────────────┐
        │                                                                                    │
        │   ┌────────────────────────────── NGINX (systemd service) ───────────────────────┐ │
        │   │  TLS termination (Let's Encrypt) · HTTP→HTTPS · gzip · caching · rate-limit   │ │
        │   │                                                                               │ │
        │   │   store.example.com  ─▶ static  /var/www/customer/  (React build, SPA)        │ │
        │   │   admin.example.com  ─▶ static  /var/www/admin/     (React build, SPA)        │ │
        │   │   /api/*             ─▶ reverse-proxy  127.0.0.1:4000  (PM2 cluster)          │ │
        │   └───────────────────────────────────────────┬───────────────────────────────────┘ │
        │                                                │ loopback 127.0.0.1 (private)        │
        │                   ┌────────────────────────────┴───────────────┐                     │
        │                   ▼                                            ▼                      │
        │   ┌───────────────────────────────┐          ┌──────────────────────────────────┐    │
        │   │  PM2 — API (cluster mode)      │          │  PM2 — Worker (BullMQ)           │    │
        │   │  Node+Express+TS  :4000        │          │  notifications · invoices ·      │    │
        │   │  1 process per CPU core        │          │  image jobs · delivery assign    │    │
        │   └───────────────┬───────────────┘          └───────────────┬──────────────────┘    │
        │                   │                                          │                        │
        │        ┌──────────┴──────────────────────────────┬──────────┘                        │
        │        ▼                                          ▼                                   │
        │   ┌─────────────────────────┐          ┌──────────────────────────┐                   │
        │   │ PostgreSQL  :5432 local │          │ Redis  :6379 local       │                   │
        │   │ system of record (ACID) │          │ cache + BullMQ broker    │                   │
        │   └─────────────────────────┘          └──────────────────────────┘                   │
        │                                                                                    │
        │        (external, off-box) ──▶ AWS S3 / Cloudinary CDN  ·  Off-box backup bucket   │
        └────────────────────────────────────────────────────────────────────────────────────┘

   Deploy path: GitHub Actions ──SSH──▶ VPS ──▶ deployment/scripts/deploy.sh (pm2 reload, zero-downtime)
```

**Why two React SPAs are served as static files:** the customer and admin apps compile to static `index.html` + hashed JS/CSS bundles. NGINX serves them directly from `/var/www` (fast, cached, no Node involved). Only `/api/*` calls hit the Node cluster. This keeps the request path for browsing extremely light.

---

## 16.4 Provisioning the Server (step-by-step)

All of the following is codified in `deployment/scripts/setup-server.sh` (run once per fresh VPS). It is documented step-by-step here so an operator understands every action.

### 16.4.1 Users & SSH hardening

| Step | Action | Rationale |
|------|--------|-----------|
| 1 | Create a non-root `deploy` user with sudo | Never deploy or run services as root. |
| 2 | Add the CI/CD and operator **public keys** to `/home/deploy/.ssh/authorized_keys` | Key-based auth only. |
| 3 | In `/etc/ssh/sshd_config`: `PermitRootLogin no`, `PasswordAuthentication no`, `PubkeyAuthentication yes` | Eliminates password brute-force and root login. |
| 4 | (Recommended) move SSH to a non-default port; install **fail2ban** | Cuts automated scanning noise. |
| 5 | `sudo systemctl reload ssh` | Apply hardening. |

### 16.4.2 Firewall (ufw)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow <ssh-port>/tcp        # SSH (custom port if changed)
sudo ufw allow 80/tcp                # HTTP (Certbot + 301 redirect)
sudo ufw allow 443/tcp               # HTTPS
sudo ufw enable
```

PostgreSQL (5432), Redis (6379) and Node (4000) are **deliberately not opened** — they are reachable only via `127.0.0.1` on the host.

### 16.4.3 Install the runtimes & services

| Component | Install approach | Notes |
|-----------|------------------|-------|
| **Node.js (LTS)** | NodeSource apt repo **or** `nvm` for the `deploy` user (pin via repo `.nvmrc`) | Match the version the app is built/tested against. |
| **PM2** | `npm install -g pm2` | Global process manager. |
| **PostgreSQL** | `sudo apt install postgresql` | Native service under systemd; create app DB + least-privilege role. |
| **Redis** | `sudo apt install redis-server` | Set `supervised systemd`; enable AOF persistence; bind to `127.0.0.1`; set a strong `requirepass`. |
| **NGINX** | `sudo apt install nginx` | Native reverse proxy + static server. |
| **Certbot** | `sudo apt install certbot python3-certbot-nginx` | Let's Encrypt certificates + auto-renewal. |
| **Build essentials** | `git`, `build-essential`, `ufw`, `fail2ban` | Required for `npm ci` native modules and hardening. |

### 16.4.4 Database & cache bootstrap

- Create the application database and a **least-privilege** role (owns only the app schema; no superuser).
- Redis: enable persistence (`appendonly yes`), set `maxmemory` + an eviction policy appropriate for cache keys, and require a password.
- Record `DATABASE_URL` and `REDIS_URL` into the server-side `.env` (see 16.8), never into git.

---

## 16.5 App Layout on the Server

```
/var/www/
├── customer/            # Customer React build (static) — served by NGINX at store.example.com
│   └── (index.html + assets/*.hashed.js|css)
└── admin/               # Admin React build (static) — served by NGINX at admin.example.com

/home/deploy/app/        # Backend + monorepo working tree (git clone)
├── backend/             # Node + Express + TS API (built to dist/)
├── database/            # Prisma schema + migrations
├── shared/              # Shared types/DTOs
├── deployment/
│   ├── nginx/           # customer.conf · admin.conf · api.conf · gzip.conf · rate-limit.conf
│   ├── pm2/ecosystem.config.js
│   └── scripts/         # setup-server.sh · deploy.sh · backup.sh · restore-db.sh · health-check.sh
├── .env                 # REAL backend secrets — chmod 600, NOT in git
└── .env.worker          # REAL worker secrets — chmod 600, NOT in git
```

**Frontend build placement:** the deploy script builds the two React apps and copies (`rsync`) their `dist/` output into `/var/www/customer` and `/var/www/admin`. The backend runs from `/home/deploy/app/backend` under PM2. NGINX config lives in the repo and is symlinked into `/etc/nginx/sites-available` + `/etc/nginx/sites-enabled`.

---

## 16.6 PM2 Process Model

PM2 runs **two logical apps** from one `ecosystem.config.js`: the HTTP **API in cluster mode** (one process per CPU core, load-balanced by PM2 across the cluster) and the **BullMQ worker** as a separate process (so a burst of notification/image jobs never steals CPU from request handling).

```js
// deployment/pm2/ecosystem.config.js  (illustrative — minimal essential config)
module.exports = {
  apps: [
    {
      name: "meat-api",
      cwd: "/home/deploy/app/backend",
      script: "dist/server.js",
      instances: "max",          // one worker per CPU core
      exec_mode: "cluster",      // enables zero-downtime `pm2 reload`
      max_memory_restart: "500M",
      env_file: "/home/deploy/app/.env"
    },
    {
      name: "meat-worker",
      cwd: "/home/deploy/app/backend",
      script: "dist/worker.js",  // BullMQ consumers
      instances: 1,              // scale up if queues back up
      exec_mode: "fork",
      max_memory_restart: "400M",
      env_file: "/home/deploy/app/.env.worker"
    }
  ]
};
```

**Persistence across reboots:** run `pm2 startup` once (generates a systemd unit that resurrects PM2 on boot) and `pm2 save` after the first successful start, so the API + worker come back automatically after any restart.

| PM2 command | Use |
|-------------|-----|
| `pm2 start ecosystem.config.js` | First-time start of API + worker. |
| `pm2 reload meat-api` | **Zero-downtime** rolling restart of the API cluster (used by every deploy). |
| `pm2 restart meat-worker` | Restart the worker (acceptable brief gap; jobs are retried). |
| `pm2 status` / `pm2 logs` / `pm2 monit` | Health, logs, live resource monitoring. |
| `pm2 save` | Persist the current process list for boot resurrection. |

---

## 16.7 NGINX Configuration

NGINX serves the two SPAs as static files, reverse-proxies `/api` to the PM2 cluster, terminates TLS, compresses responses, sets cache headers, and applies SPA fallback (so client-side routes deep-link correctly).

**Customer / admin SPA server block (pattern, `customer.conf`):**

```nginx
server {
    listen 443 ssl http2;
    server_name store.example.com;

    ssl_certificate     /etc/letsencrypt/live/store.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/store.example.com/privkey.pem;

    root /var/www/customer;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # Long-cache hashed static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback — client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
*(`admin.conf` is identical with `server_name admin.example.com` and `root /var/www/admin`.)*

**API reverse-proxy server block (`api.conf`):**

```nginx
upstream meat_api { server 127.0.0.1:4000; keepalive 32; }

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    client_max_body_size 15m;               # product image uploads

    location /api/ {
        limit_req zone=api_zone burst=20 nodelay;   # from rate-limit.conf
        proxy_pass         http://meat_api;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

**HTTP → HTTPS redirect:** a `listen 80` server block per host issues a `301` to `https://`.

**Rate-limit zones (`rate-limit.conf`, in the `http {}` context):** separate zones for login/OTP/checkout/webhook mirror the edge-throttling design in Chapter 3.3.

### 16.7.1 SSL with Let's Encrypt

```bash
sudo certbot --nginx -d store.example.com -d admin.example.com -d api.example.com
```

Certbot installs the certs, wires them into the NGINX blocks, and adds a **systemd timer** that auto-renews (`certbot renew`) and reloads NGINX. Verify renewal with `sudo certbot renew --dry-run`.

---

## 16.8 Environment & Secrets Management

| Rule | Detail |
|------|--------|
| **Templates in git, secrets on server** | Repo ships `deployment/env/.env.*.example` (every key, no values). Real `.env` / `.env.worker` live only in `/home/deploy/app/`, `chmod 600`, owned by `deploy`. |
| **What lives here** | `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, Razorpay/PhonePe/Cashfree keys + webhook secrets, S3/Cloudinary creds, SMTP/SMS/WhatsApp creds, `NODE_ENV=production`, `PORT=4000`. |
| **Loaded by PM2** | Via `env_file` in `ecosystem.config.js` — the app never reads secrets from anywhere but the server-side file. |
| **Rotation** | Rotating a secret = edit `.env` on the server → `pm2 reload meat-api`. No rebuild, no redeploy. |
| **GitHub side** | CI/CD stores only the **SSH deploy key** and host details as GitHub Actions **encrypted secrets** — never application secrets. |

---

## 16.9 CI/CD — GitHub Actions SSH Deploy

The pipeline is intentionally simple: on merge to the production branch, GitHub Actions **SSHes into the VPS and runs the deploy script**. There is no image build and no registry.

```
┌──────────────┐   push/merge    ┌─────────────────────┐   SSH (deploy key)   ┌──────────────────────┐
│ GitHub repo  │ ───────────────▶│  GitHub Actions job │ ────────────────────▶│  Ubuntu VPS (deploy) │
│ main branch  │                 │  lint · typecheck   │                      │  runs deploy.sh      │
└──────────────┘                 │  test (CI gate)     │                      └──────────┬───────────┘
                                 └─────────────────────┘                                 │
                                                                                         ▼
                     git pull ─▶ npm ci ─▶ prisma migrate deploy ─▶ build (api+SPAs) ─▶ pm2 reload
                                                                              (zero-downtime)
```

**Deploy workflow design (`.github/workflows/deploy.yml`):**

| Stage | Runs on | Action |
|-------|---------|--------|
| **CI gate** | GitHub runner | `npm ci`, ESLint, `tsc --noEmit`, unit/integration tests. Fails the deploy if red. |
| **Deploy** | GitHub runner → SSH | Uses the stored SSH key to connect as `deploy@vps` and execute `deployment/scripts/deploy.sh`. |

**`deployment/scripts/deploy.sh` (steps):**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /home/deploy/app

git pull --ff-only origin main            # fetch new code
npm ci                                    # install exact locked deps

npx prisma migrate deploy                 # apply pending DB migrations (safe, forward-only)

npm run build --workspace backend         # TS → dist/
npm run build --workspace frontend        # customer SPA → dist/
npm run build --workspace admin           # admin SPA → dist/

rsync -a --delete frontend/dist/ /var/www/customer/
rsync -a --delete admin/dist/    /var/www/admin/

pm2 reload deployment/pm2/ecosystem.config.js --only meat-api   # zero-downtime
pm2 restart meat-worker                                         # pick up new job code
pm2 save
```

**Zero-downtime guarantee:** `pm2 reload` on the clustered API restarts workers one at a time — at least one worker is always accepting connections, so in-flight requests are never dropped during a release.

### 16.9.1 Rollback

Because deploys are Git-driven, rollback is a redeploy of a known-good commit:

```bash
cd /home/deploy/app
git checkout <last-good-commit>     # or: git reset --hard <tag>
npm ci && npm run build --workspace backend
pm2 reload deployment/pm2/ecosystem.config.js --only meat-api
```

| Rollback concern | Handling |
|------------------|----------|
| **Code** | Check out the previous release tag and reload PM2 (seconds). |
| **Database migrations** | Prisma migrations are **forward-only**; write migrations to be **backward-compatible** (expand→migrate→contract) so the previous app version still runs against the new schema during a rollback window. Never destructive-drop in the same release that removes usage. |
| **Frontend** | Previous SPA build is restored by the same checkout + build + rsync. |
| **Fast safety net** | Tag every release (`git tag release-YYYYMMDD-HHMM`) so the last-good target is unambiguous. |

---

## 16.10 Database Migrations in Production

| Aspect | Practice |
|--------|----------|
| **Tool** | `prisma migrate deploy` (applies committed migrations only — never `migrate dev` in prod). |
| **When** | Inside `deploy.sh`, **before** the app build/reload, so schema is ready when new code starts. |
| **Safety** | Expand-and-contract pattern: add columns/tables first (compatible), backfill, switch code, then remove old columns in a **later** release. |
| **Pre-migration backup** | `deploy.sh` can invoke `backup.sh` immediately before `migrate deploy` for a restore point on risky migrations. |
| **Long migrations** | For big backfills, run as a one-off maintenance job/worker rather than blocking the deploy. |

---

## 16.11 Backups, Logs, Monitoring & Hardening

### 16.11.1 Database backups

```bash
# deployment/scripts/backup.sh  (cron: daily + before risky migrations)
pg_dump "$DATABASE_URL" | gzip > /tmp/meat-$(date +%F-%H%M).sql.gz
aws s3 cp /tmp/meat-*.sql.gz s3://ojiva-meat-backups/db/    # off-box, encrypted bucket
```

| Backup control | Setting |
|----------------|---------|
| **Schedule** | Daily `pg_dump` via cron; retain 7 daily + 4 weekly + 3 monthly. |
| **Off-box** | Uploaded to a private S3 bucket (never only on the VPS). |
| **Restore-tested** | `restore-db.sh` periodically validated on a staging DB — an untested backup is not a backup. |
| **PITR (later)** | When volume warrants, add WAL archiving for point-in-time recovery (see Chapter 3.7). |

### 16.11.2 Log rotation

| Source | Rotation |
|--------|----------|
| **PM2 logs** | `pm2-logrotate` module (size + date cap, compression, retention). |
| **NGINX logs** | System `logrotate` (`/etc/logrotate.d/nginx`), daily, compressed, 14–30 day retention. |
| **PostgreSQL logs** | Postgres log rotation + retention tuned to disk. |

### 16.11.3 Monitoring & health

| Signal | Mechanism |
|--------|-----------|
| **App health** | Backend exposes `GET /health` (checks DB + Redis connectivity); NGINX/uptime monitor pings it. |
| **Process health** | `pm2 status` + `pm2 monit`; `max_memory_restart` auto-recycles a leaking worker. |
| **Uptime/alerting** | External uptime monitor (e.g. UptimeRobot / BetterStack) on `store`, `admin`, `api` + TLS-expiry alert. |
| **Queue health** | BullMQ dashboard / metrics for depth, failures, retries. |
| **Resource** | `htop`, `df -h`, and a lightweight node exporter if metrics are centralised later. |

### 16.11.4 Basic hardening checklist

- SSH: key-only, no root, non-default port, `fail2ban`.
- `ufw`: only 80/443 (+ SSH) inbound; DB/Redis/Node bound to loopback.
- Unattended security updates (`unattended-upgrades`).
- NGINX security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) + `client_max_body_size` caps.
- Redis `requirepass` + loopback bind; PostgreSQL least-privilege app role.
- Secrets `chmod 600`, owned by `deploy`; TLS auto-renew verified.

---

## 16.12 Deployment Checklist

| # | Item | Owner | Done when |
|---|------|-------|-----------|
| 1 | VPS provisioned (Ubuntu LTS, static IP, DNS A-records) | DevOps | `store`/`admin`/`api` resolve to the VPS |
| 2 | `deploy` user + SSH hardening (key-only, no root, fail2ban) | DevOps | Password/root login rejected |
| 3 | `ufw` firewall (only 80/443 + SSH) | DevOps | `ufw status` shows expected rules |
| 4 | Node + PM2 installed, version pinned | DevOps | `node -v` matches `.nvmrc`; `pm2 -v` works |
| 5 | PostgreSQL installed, app DB + least-priv role, loopback bind | DevOps | App connects via `DATABASE_URL` |
| 6 | Redis installed, AOF + password + loopback bind | DevOps | App connects via `REDIS_URL` |
| 7 | NGINX installed; customer/admin/api server blocks enabled | DevOps | `nginx -t` passes; sites reachable |
| 8 | SSL issued (Certbot) + auto-renew verified | DevOps | HTTPS green; `renew --dry-run` OK |
| 9 | Server-side `.env` / `.env.worker` populated (`chmod 600`) | DevOps | All required keys present, not in git |
| 10 | PM2 ecosystem started (API cluster + worker) | DevOps | `pm2 status` all online |
| 11 | `pm2 startup` + `pm2 save` (survives reboot) | DevOps | Processes return after `sudo reboot` |
| 12 | GitHub Actions deploy workflow + SSH deploy key wired | DevOps | Test deploy runs `deploy.sh` end-to-end |
| 13 | First deploy: migrate + build + reload succeeds | DevOps | Live site serves new build, zero downtime |
| 14 | Rollback tested (checkout prior tag + reload) | DevOps | Previous release restored cleanly |
| 15 | Backups: daily `pg_dump` → S3, restore-tested | DevOps | Restore verified on staging DB |
| 16 | Log rotation (PM2 + NGINX + Postgres) | DevOps | Logs rotate + compress on schedule |
| 17 | Monitoring: `/health`, uptime, TLS-expiry, queue depth | DevOps | Alerts fire on induced failure |
| 18 | Payment webhooks reachable + signature-verified in prod | Backend | Sandbox→live webhook round-trip OK |
| 19 | Serviceability + slot flow verified on real Hyderabad pincodes | QA | End-to-end order placed live |
| 20 | Ops runbook + handover complete | Tech Lead | Client team can deploy + roll back |

---

*End of Chapter 16 — Deployment (Native VPS, No Docker). Consistent with `00-PROJECT-BRIEF.md` (Ojiva AI Technologies, INR, Hyderabad hyperlocal cold-chain, fixed React/Bootstrap/Node/TS/PostgreSQL/Prisma/Redis/BullMQ stack, Phase-1 web-only, API-first) and the native-VPS deployment defined in Chapters 2–3.*

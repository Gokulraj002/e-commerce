# Deploy — Elite NonVeg

Deployment target: **one Ubuntu VPS** running native services (NGINX, PM2,
PostgreSQL, Redis). **No Docker anywhere.** This document is a fast-lookup
reference. The full operational runbook — provisioning, TLS, backup, rollback,
scaling — is in [docs/blueprint/07-deployment-vps.md](blueprint/07-deployment-vps.md).

---

## 1. First deploy (one-time provisioning)

```bash
# On the fresh Ubuntu 22.04/24.04 VPS as root (or via ssh + sudo):
git clone <repo> /home/deploy/elite
cd /home/deploy/elite
bash deployment/scripts/setup-server.sh
```

`setup-server.sh` installs and configures Node 20, PostgreSQL 15, Redis 7,
NGINX, PM2 (globally), a `deploy` user, SSH hardening, UFW firewall rules
(open only `22`, `80`, `443`), and the systemd services. Postgres and Redis
bind to `127.0.0.1` — they must never be exposed publicly.

Once the base host is up:

1. Copy `.env.example` to `/home/deploy/elite/backend/.env` and fill in real
   secrets (DB URL, JWT, gateway keys, SMTP, etc.). `chmod 600 backend/.env`.
2. Install TLS certificates for the three subdomains
   (`store.example.com`, `admin.example.com`, `api.example.com`) via
   `certbot --nginx` — the NGINX config in `deployment/nginx/` already declares
   the vhosts.
3. Run the first deploy: `bash deployment/scripts/deploy.sh`.

The chapter linked above walks each step in detail (users, SSH, TLS, log
rotation, backup schedule, monitoring hooks).

---

## 2. Continuous deploy

Push to `main` → GitHub Actions SSHes into the VPS and runs
`deployment/scripts/deploy.sh`. That script is the **single source of truth**
for what "deploy" means; the workflow only invokes it.

`deployment/scripts/deploy.sh` performs, in order:

1. `git fetch --all --tags` and check out `$DEPLOY_REF` (defaults to the pushed SHA).
2. `npm ci` (root, using workspaces cache).
3. `npm run build:shared` then `npm --workspace backend run build`
   (`prisma generate && tsc`).
4. `npm --workspace backend run prisma:deploy` — applies pending migrations
   idempotently without a shadow DB.
5. `npm --workspace frontend run build` and `npm --workspace admin run build`
   — outputs to `/var/www/customer` and `/var/www/admin`.
6. `pm2 reload deployment/pm2/ecosystem.config.cjs --update-env` — zero-downtime
   rolling restart of the API cluster and the worker.

**Rollback** is manual and one command:

```bash
ssh deploy@prod
cd /home/deploy/elite && bash deployment/scripts/rollback.sh
```

The rollback script checks out the previous release tag, re-installs, and
`pm2 reload`s. Every deploy tags the previous release before applying, so this
is safe to run without external state.

---

## 3. What CI does

Workflows live at `.github/workflows/`. Full README:
[.github/workflows/README.md](../.github/workflows/README.md).

| Workflow      | Trigger                                          | Jobs                                                          |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `ci.yml`      | Every PR into `main`, push to non-main, manual   | `lint`, `typecheck`, `build` (matrix: backend/frontend/admin), `test-backend` |
| `deploy.yml`  | Push to `main`, manual (`workflow_dispatch.ref`) | Single SSH step that runs `deployment/scripts/deploy.sh`      |

Highlights of `ci.yml`:

- Node 20 with the npm cache.
- `build` and `test-backend` spin up `postgres:15` and `redis:7` service
  containers on the runner so `prisma generate` and future integration tests
  have a live database URL.
- `npm test --if-present` — a no-op until Vitest/Jest is added.

Highlights of `deploy.yml`:

- Uses `appleboy/ssh-action@v1.0.3` pinned to a version.
- `concurrency: deploy-production` + `cancel-in-progress: false` — deploys
  never race, and a running deploy is never cancelled halfway.
- `environment: production` — attach required-reviewer protection to the
  GitHub environment if you want manual approvals.

**Required secrets** (Settings → Secrets and variables → Actions):

| Secret        | Purpose                                           |
| ------------- | ------------------------------------------------- |
| `DEPLOY_HOST` | Hostname / IP of the production VPS.              |
| `DEPLOY_USER` | SSH user permitted to run `deploy.sh`.            |
| `DEPLOY_KEY`  | Private SSH key (dedicated for CI, not personal). |

The corresponding public key must be in `~/.ssh/authorized_keys` for
`$DEPLOY_USER` on the VPS.

---

## 4. Environment variables

Template: [`.env.example`](../.env.example). The backend validates its env at
boot in `backend/src/config/env.ts` — the process **exits** if a required
variable is missing or malformed.

### Required by the schema

| Name                  | Purpose                                                       | Required | Example                                                          |
| --------------------- | ------------------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string (Prisma).                        | Yes      | `postgresql://elite:elite@localhost:5432/elite_nonveg?schema=public` |
| `JWT_ACCESS_SECRET`   | Signs 15-minute access tokens.                                | Yes      | `at-least-8-chars-of-random-hex`                                 |
| `JWT_REFRESH_SECRET`  | Signs 7-day refresh tokens.                                   | Yes      | `another-random-hex`                                             |

### Defaulted (validated but with fallbacks)

| Name                       | Default                                                    | Purpose                                                        |
| -------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| `NODE_ENV`                 | `development`                                              | `development` / `test` / `production`.                         |
| `PORT`                     | `4000`                                                     | API port bound to loopback in production (NGINX proxies here). |
| `API_PREFIX`               | `/api/v1`                                                  | Base path mounted by `apiRouter`.                              |
| `CORS_ORIGINS`             | `http://localhost:5173,http://localhost:5174`              | Comma-separated allow-list of browser origins.                 |
| `REDIS_URL`                | `redis://localhost:6379`                                   | Redis for cache + BullMQ.                                      |
| `JWT_ACCESS_EXPIRES`       | `15m`                                                      | Any [ms](https://www.npmjs.com/package/ms) duration string.    |
| `JWT_REFRESH_EXPIRES`      | `7d`                                                       | Same format.                                                   |
| `FREE_SHIPPING_THRESHOLD`  | `699` (rupees)                                             | Cart total above this ships free.                              |

### Provider integrations (optional — the provider is disabled if absent)

| Name(s)                                                                                             | Purpose                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `STORAGE_DRIVER` = `s3` \| `cloudinary`                                                            | Which storage backend to use.        |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`                              | Cloudinary uploads.                  |
| `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`                       | S3 uploads.                          |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`                                 | Razorpay payments + webhook.         |
| `PHONEPE_MERCHANT_ID`, `PHONEPE_SALT_KEY`, `PHONEPE_SALT_INDEX`                                     | PhonePe payments.                    |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`                                                            | Cashfree payments.                   |
| `GOOGLE_MAPS_API_KEY`                                                                               | Address autocomplete / distance.     |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`                                     | Transactional email.                 |
| `SMS_API_KEY`, `SMS_SENDER_ID`                                                                      | SMS notifications.                   |
| `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE`                                          | WhatsApp notifications.              |
| `STORE_NAME`, `STORE_CURRENCY`                                                                      | Store-wide display defaults.          |

**Payment providers are stubbed until credentials are set.** With `RAZORPAY_KEY_ID`
absent, calling `POST /payments/init` for a Razorpay order fails at the
provider factory. To exercise the full checkout locally without live keys, use
`paymentMethod: "COD"` — the payment record is created without contacting a
gateway.

---

## 5. Post-deploy sanity checks

```bash
# On the VPS.
pm2 status                                 # both processes 'online', 0 restarts
curl -sf http://127.0.0.1:4000/api/v1/health | jq
sudo systemctl status nginx postgresql redis-server
sudo tail -f /var/log/nginx/error.log
pm2 logs elite-api --lines 100
```

Externally, from a laptop:

```bash
curl -sf https://api.example.com/api/v1/health | jq
```

If `db` or `cache` reports `"down"`, roll back and inspect `pm2 logs`.

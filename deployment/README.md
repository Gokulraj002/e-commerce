# Elite NonVeg — Deployment

Operational runbook and scripts for the **single Ubuntu VPS, native services, no Docker** deployment described in `docs/blueprint/07-deployment-vps.md`.

Everything under this folder is safe to commit to git. Real secrets live only on the server, `chmod 600`, owned by the `deploy` user.

## What's in here

```
deployment/
├── README.md                       ← this file
├── nginx/
│   ├── sites-available/            ← customer + admin + api server blocks (symlink into /etc/nginx/sites-enabled)
│   └── snippets/                   ← reusable NGINX snippets (gzip, rate-limit, security headers)
├── pm2/
│   └── ecosystem.config.cjs        ← two PM2 apps: elite-api (cluster) + elite-worker (fork)
└── scripts/
    ├── setup-server.sh             ← one-shot bootstrap for a fresh Ubuntu 22.04 VPS
    ├── deploy.sh                   ← zero-downtime deploy (git → install → migrate → build → pm2 reload)
    ├── rollback.sh                 ← last-resort revert to the `last-deploy-previous` git tag
    ├── backup.sh                   ← nightly pg_dump + .env + pm2 dump, 14-day retention
    └── restore.sh                  ← restore a pg_dump gz produced by backup.sh
```

## Server topology (recap)

| Concern            | Where it lives on the VPS                                       |
|--------------------|-----------------------------------------------------------------|
| Repo checkout      | `/home/deploy/elite/` (workspace root; `.env` + `.env.worker` sit here) |
| Backend API        | PM2 app `elite-api`, `dist/server.js`, cluster, bound to `127.0.0.1:4000` |
| BullMQ worker      | PM2 app `elite-worker`, `dist/worker.js`, fork mode              |
| Customer SPA build | `/var/www/elite/frontend/` (static, served by NGINX)             |
| Admin SPA build    | `/var/www/elite/admin/` (static, served by NGINX)                |
| PM2 logs           | `/var/log/elite/{api,worker}-{out,err}.log`                      |
| Backups            | `/var/backups/elite/YYYY-MM-DD/`                                 |
| Public ports       | `22` (SSH), `80` (Certbot + 301 redirect), `443` (HTTPS) via `ufw` |

The customer and admin SPAs are **static builds** — they are NOT PM2 processes. NGINX serves them directly and only proxies `/api/*` to the Node cluster.

## Installation order (first-time provisioning)

Follow these in order on a fresh Ubuntu 22.04 VPS. Every step is idempotent; safe to re-run.

1. **Bootstrap the OS** (as root)
   ```bash
   sudo bash deployment/scripts/setup-server.sh
   ```
   Installs Node 20, PostgreSQL 15, Redis, NGINX, Certbot, PM2, ufw. Creates the `deploy` user, wires the `pm2` systemd unit, and prepares the app / log / www / backup directories.

2. **Add SSH keys** for operators + CI/CD to `/home/deploy/.ssh/authorized_keys`, then harden `sshd` (`PermitRootLogin no`, `PasswordAuthentication no`) and `sudo systemctl reload ssh`.

3. **Create the app DB + least-privilege role**
   ```bash
   sudo -u postgres createuser --pwprompt elite
   sudo -u postgres createdb -O elite elite_prod
   ```

4. **Harden Redis** — edit `/etc/redis/redis.conf`: set `requirepass <secret>`, `bind 127.0.0.1 ::1`, `appendonly yes`. Then `sudo systemctl restart redis-server`.

5. **Clone the repo** as the deploy user
   ```bash
   sudo -u deploy git clone <REPO_URL> /home/deploy/elite
   ```

6. **Copy real secrets** into place (never commit these):
   ```bash
   sudo -u deploy cp /path/to/prod.env         /home/deploy/elite/.env
   sudo -u deploy cp /path/to/prod.worker.env  /home/deploy/elite/.env.worker
   sudo chmod 600 /home/deploy/elite/.env /home/deploy/elite/.env.worker
   ```

7. **Run the first deploy**
   ```bash
   cd /home/deploy/elite
   sudo -u deploy bash deployment/scripts/deploy.sh
   ```
   This installs, migrates, builds all workspaces, publishes the SPA `dist/` folders under `/var/www/elite/`, and brings the PM2 processes up.

8. **Enable NGINX site configs**
   ```bash
   sudo ln -s /home/deploy/elite/deployment/nginx/sites-available/*.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

9. **Issue TLS certs** (Let's Encrypt)
   ```bash
   sudo certbot --nginx -d store.example.com -d admin.example.com -d api.example.com
   ```
   Certbot writes a systemd timer that auto-renews and reloads NGINX.

## No-domain (IP-only) bootstrap mode

If you don't have a domain pointed at the VPS yet, use the IP-only site configs
instead of steps 8–9 above:

```bash
sudo ln -s /home/deploy/elite/deployment/nginx/sites-available/elitenonveg-ip.conf       /etc/nginx/sites-enabled/
sudo ln -s /home/deploy/elite/deployment/nginx/sites-available/elitenonveg-admin-ip.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo ufw allow 8080/tcp   # admin panel lives on its own port with no hostname to route by
```

- Customer storefront → `http://<VPS_IP>/`
- Admin panel → `http://<VPS_IP>:8080/`
- No TLS is possible for a bare IP (Let's Encrypt requires domain validation), so this is HTTP-only — fine for initial setup/testing, not for real staff logins day-to-day.
- **Check your VPS provider's network/cloud firewall too** (e.g. Hostinger's hPanel → VPS → Firewall) — `ufw` only controls the OS firewall; the provider's edge firewall can independently block a port even if `ufw` allows it.

**Migrating to a domain later:** disable the two `*-ip.conf` symlinks, enable `elitenonveg.conf` + `elitenonveg-admin.conf` instead, update `CORS_ORIGINS` in `.env` to the real hostnames, then run step 9 (certbot). No application code changes needed.

10. **Persist PM2 across reboots**
    ```bash
    sudo -u deploy pm2 save
    ```

11. **Schedule nightly backups** — add to the `deploy` user's crontab:
    ```
    15 2 * * *  bash /home/deploy/elite/deployment/scripts/backup.sh >> /var/log/elite/backup.log 2>&1
    ```

## Everyday operations

| Task                         | Command                                                                            |
|------------------------------|------------------------------------------------------------------------------------|
| Deploy latest `main`         | `sudo -u deploy bash /home/deploy/elite/deployment/scripts/deploy.sh`              |
| Deploy a specific ref        | `DEPLOY_REF=origin/hotfix-x  bash deployment/scripts/deploy.sh`                    |
| Zero-downtime restart        | `sudo -u deploy pm2 reload deployment/pm2/ecosystem.config.cjs --update-env`       |
| Tail logs                    | `sudo -u deploy pm2 logs elite-api` / `pm2 logs elite-worker`                      |
| Process status               | `sudo -u deploy pm2 status`                                                        |
| Nightly backup (manual)      | `sudo -u deploy bash deployment/scripts/backup.sh`                                 |
| Restore a DB dump            | `sudo -u deploy bash deployment/scripts/restore.sh /var/backups/elite/…/db-*.sql.gz` |
| Rollback (last resort)       | `sudo -u deploy bash deployment/scripts/rollback.sh`                               |
| NGINX config test + reload   | `sudo nginx -t && sudo systemctl reload nginx`                                     |
| Renew TLS certs (dry-run)    | `sudo certbot renew --dry-run`                                                     |

## Rollback

`deploy.sh` tags every release. Before hard-resetting to the new ref it promotes the existing `last-deploy` tag to `last-deploy-previous`, then re-tags HEAD as `last-deploy`. That gives you exactly two anchors:

- `last-deploy`          → the release currently running
- `last-deploy-previous` → the release before it (rollback target)

`rollback.sh` uses `last-deploy-previous` as its target, re-runs migrations, rebuilds, and reloads PM2. Note that Prisma migrations are forward-only — write them in the expand→migrate→contract pattern so the previous code version can still run against the current schema.

## Environment / secrets

- **In the repo:** templates only (e.g. `.env.example`). Never real values.
- **On the server:** `/home/deploy/elite/.env` and `/home/deploy/elite/.env.worker`, `chmod 600`, owned by `deploy`.
- **Loaded by PM2:** via `env_file` in `ecosystem.config.cjs`. Rotating a secret = edit the file → `pm2 reload … --update-env`. No rebuild needed.

## Related docs

- `docs/blueprint/07-deployment-vps.md` — the full deployment chapter this folder implements.

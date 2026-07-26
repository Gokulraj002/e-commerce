# NGINX Configuration — Elite NonVeg (Native VPS)

Production-ready NGINX configs for the single-Ubuntu-VPS deployment described
in `docs/blueprint/07-deployment-vps.md` (Chapter 16 — Deployment). One host
serves the customer SPA, the admin SPA, and reverse-proxies `/api/*` to the
Node/Express + PM2 cluster on `127.0.0.1:4000`.

No Docker. No containers. No commands are run by this repo — every file below
is meant to be installed by an operator (or `deployment/scripts/setup-server.sh`)
on the target VPS.

---

## Layout

```
deployment/nginx/
├── README.md                             (this file)
├── nginx.conf                            optional main-config snippet
│                                         (workers, http{}, upstream elite_api,
│                                          $connection_upgrade map, gzip, etc.)
├── snippets/                             reusable includes
│   ├── security-headers.conf             HSTS, X-Frame-Options, nosniff, etc.
│   ├── gzip.conf                         gzip for text/js/css/json/svg/fonts
│   ├── spa-fallback.conf                 try_files → /index.html + no-cache
│   └── proxy-api.conf                    proxy_pass elite_api + WS + 60s TO
└── sites-available/                      one server block per hostname
    ├── elitenonveg.conf                  customer SPA — elitenonveg.com
    ├── elitenonveg-admin.conf            admin SPA    — admin.elitenonveg.com
    └── elitenonveg-api.conf              OPTIONAL     — api.elitenonveg.com
```

`sites-available/` files are inert until symlinked into `sites-enabled/`
(standard Debian/Ubuntu convention). `snippets/` are referenced by absolute
path (`/etc/nginx/snippets/...`) from every server block, so those files must
also be reachable at that path — install them via symlink too.

---

## Target paths on the VPS

| Purpose                    | Path                                    |
|----------------------------|-----------------------------------------|
| Customer SPA build         | `/var/www/elite/frontend/`              |
| Admin SPA build            | `/var/www/elite/admin/`                 |
| ACME HTTP-01 challenge dir | `/var/www/certbot/`                     |
| NGINX main config          | `/etc/nginx/nginx.conf`                 |
| NGINX snippets             | `/etc/nginx/snippets/`                  |
| NGINX site files           | `/etc/nginx/sites-available/`           |
| NGINX enabled sites        | `/etc/nginx/sites-enabled/`             |
| Let's Encrypt live certs   | `/etc/letsencrypt/live/<domain>/`       |
| Node API (loopback only)   | `http://127.0.0.1:4000` (PM2 cluster)   |

The backend owns the API prefix `/api/v1` (see `backend/src/config/env.ts`,
`API_PREFIX`). NGINX proxies the entire `/api/` subtree unchanged; the version
prefix is a backend concern, not an NGINX concern.

---

## Install

The commands below are documentation only — run them by hand on the VPS or
wire them into `deployment/scripts/setup-server.sh`. **Nothing in this repo
executes them.**

### 1. Clone the repo on the VPS

Per Chapter 16.5 the working tree lives at `/home/deploy/app`, so this
directory ends up at `/home/deploy/app/deployment/nginx/`. Adjust the paths
below if your operator uses a different location.

### 2. Install the main config snippet

Either merge the directives from `nginx.conf` into the distro default
`/etc/nginx/nginx.conf`, or (on a VPS dedicated to Elite NonVeg) replace it:

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.dist.bak
sudo cp /home/deploy/app/deployment/nginx/nginx.conf /etc/nginx/nginx.conf
```

The main config defines `upstream elite_api` and the `$connection_upgrade`
map used by `snippets/proxy-api.conf` — if you skip this step, add the
upstream and map manually inside the `http {}` block of your existing config.

### 3. Symlink the snippets

```bash
sudo mkdir -p /etc/nginx/snippets
sudo ln -sf /home/deploy/app/deployment/nginx/snippets/security-headers.conf /etc/nginx/snippets/security-headers.conf
sudo ln -sf /home/deploy/app/deployment/nginx/snippets/gzip.conf             /etc/nginx/snippets/gzip.conf
sudo ln -sf /home/deploy/app/deployment/nginx/snippets/spa-fallback.conf     /etc/nginx/snippets/spa-fallback.conf
sudo ln -sf /home/deploy/app/deployment/nginx/snippets/proxy-api.conf        /etc/nginx/snippets/proxy-api.conf
```

Symlinks (not copies) keep a `git pull` on the VPS in sync with the running
NGINX without a redeploy step.

### 4. Symlink the site files into sites-available/

```bash
sudo ln -sf /home/deploy/app/deployment/nginx/sites-available/elitenonveg.conf       /etc/nginx/sites-available/elitenonveg.conf
sudo ln -sf /home/deploy/app/deployment/nginx/sites-available/elitenonveg-admin.conf /etc/nginx/sites-available/elitenonveg-admin.conf
sudo ln -sf /home/deploy/app/deployment/nginx/sites-available/elitenonveg-api.conf   /etc/nginx/sites-available/elitenonveg-api.conf
```

### 5. Enable the sites you want live

```bash
sudo ln -sf /etc/nginx/sites-available/elitenonveg.conf       /etc/nginx/sites-enabled/elitenonveg.conf
sudo ln -sf /etc/nginx/sites-available/elitenonveg-admin.conf /etc/nginx/sites-enabled/elitenonveg-admin.conf

# Only if you are exposing the API on its own hostname (see the header
# comment inside elitenonveg-api.conf for when this is worthwhile):
# sudo ln -sf /etc/nginx/sites-available/elitenonveg-api.conf /etc/nginx/sites-enabled/elitenonveg-api.conf
```

### 6. Prepare the ACME webroot

Each site file serves `/.well-known/acme-challenge/` from `/var/www/certbot`.
Create it before the first cert issuance:

```bash
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot
```

### 7. First cert issuance (Let's Encrypt via certbot)

Before running certbot the sites' `ssl_certificate` paths point at files that
do not exist yet, so a full config test will fail. Two options:

**Option A — certbot's `--nginx` plugin (easiest).** Temporarily comment the
`listen 443 ssl http2` server blocks (or use the placeholder `nginx-http` -only
configs certbot ships), then:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx \
    -d elitenonveg.com -d www.elitenonveg.com \
    -d admin.elitenonveg.com \
    -d api.elitenonveg.com          # add only if the api subdomain is live
```

Certbot will edit the server blocks in place; once certs exist, uncomment the
443 blocks (or restore this repo's version) and reload.

**Option B — webroot mode (no NGINX edits).** Serve HTTP only for the first
run, then flip the SSL blocks on:

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
    -d elitenonveg.com -d www.elitenonveg.com

sudo certbot certonly --webroot -w /var/www/certbot \
    -d admin.elitenonveg.com

sudo certbot certonly --webroot -w /var/www/certbot \
    -d api.elitenonveg.com          # optional
```

Certbot installs a systemd timer (`certbot.timer`) that renews any expiring
cert twice a day and reloads NGINX automatically. Verify with:

```bash
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

### 8. Test & reload

Never `restart` NGINX in production — `reload` re-reads config with zero
dropped connections. Always run `nginx -t` first.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 9. Deploy the SPA builds

The frontend builds are copied by `deployment/scripts/deploy.sh` (Chapter 16.9)
via `rsync -a --delete` into `/var/www/elite/frontend/` and
`/var/www/elite/admin/`. The hashed bundles end up under `/var/www/elite/*/assets/`,
which the `location /assets/ { ... immutable ... }` block caches for a year.

---

## Verification checklist

After the first reload, from a workstation off the VPS:

| Check                                                   | Expected                                     |
|---------------------------------------------------------|----------------------------------------------|
| `curl -I http://elitenonveg.com/`                       | `301` → `https://elitenonveg.com/`           |
| `curl -I https://elitenonveg.com/`                      | `200`, `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN` |
| `curl -I https://elitenonveg.com/assets/<any-file>`     | `Cache-Control: public, immutable, max-age=31536000` |
| `curl -I https://elitenonveg.com/`                      | `Cache-Control: no-store...` on the SPA shell |
| `curl -i https://elitenonveg.com/api/v1/health` (or similar) | JSON body from Node, `X-Request-Id` header round-trip |
| `curl -I https://admin.elitenonveg.com/`                | `200` with the admin SPA shell               |
| `curl https://elitenonveg.com/some/deep/route`          | Serves `index.html` (SPA fallback works)     |

If any of these fail, tail the two per-site logs configured in the site files:

```bash
sudo tail -n 200 -f /var/log/nginx/elitenonveg.error.log
sudo tail -n 200 -f /var/log/nginx/elitenonveg-admin.error.log
```

---

## Editing rules

- Change hostnames or doc-roots in `sites-available/*.conf` only — never
  hard-code URLs in the snippets.
- Keep `location /assets/` **above** `location /` in every site file, so the
  longest-prefix match wins for static assets.
- After editing anything under `add_header`, remember NGINX's inheritance
  quirk: any new `add_header` inside a nested `location {}` resets the parent
  block's headers. Re-`include snippets/security-headers.conf;` there.
- Do not add `Access-Control-Allow-*` here — the API already emits CORS from
  `env.corsOrigins` in `backend/src/config/env.ts`. Duplicating leads to
  header collisions and preflight failures.
- When the backend starts using a `/api/v2/...` prefix, no NGINX change is
  needed — the `/api/` location proxies the entire subtree.

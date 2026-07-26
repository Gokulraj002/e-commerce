/**
 * PM2 v5 ecosystem file — Elite NonVeg on a SHARED Hostinger VPS.
 *
 * Use this INSTEAD of ecosystem.config.cjs when the app is deployed under
 * `/root/elite` alongside other root-owned projects (matches the existing
 * convention on this box — e.g. `/root/ojiva-crm`), rather than the isolated
 * `deploy` user + `/home/deploy/elite` layout the default file assumes.
 *
 * Same two processes, same ports, same behavior — only the filesystem paths
 * differ:
 *   1. elite-api    — Express HTTP API (cluster mode), 127.0.0.1:4000
 *   2. elite-worker — BullMQ consumer (single fork process)
 *
 * NOT MANAGED BY PM2: the customer SPA and admin SPA are static `dist/`
 * bundles served directly by NGINX from /var/www/elite/{frontend,admin}.
 *
 * USAGE (from /root/elite):
 *   PM2_ECOSYSTEM=deployment/pm2/ecosystem.hostinger.config.cjs bash deployment/scripts/deploy.sh
 *   pm2 reload  deployment/pm2/ecosystem.hostinger.config.cjs --update-env
 *   pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'elite-api',
      cwd: '/root/elite/backend',
      script: 'dist/server.js',
      exec_mode: 'cluster',
      instances: 'max', // one Node worker per CPU core; drop to 2 on a small VPS
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
      },
      env_file: '/root/elite/.env',
      out_file: '/var/log/elite/api-out.log',
      error_file: '/var/log/elite/api-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      name: 'elite-worker',
      cwd: '/root/elite/backend',
      script: 'dist/worker.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      kill_timeout: 30000,
      env: {
        NODE_ENV: 'production',
      },
      env_file: '/root/elite/.env.worker',
      out_file: '/var/log/elite/worker-out.log',
      error_file: '/var/log/elite/worker-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
  ],
};

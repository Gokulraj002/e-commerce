/**
 * PM2 v5 ecosystem file — Elite NonVeg (native Ubuntu VPS, no Docker).
 *
 * TWO PROCESSES ONLY:
 *   1. elite-api    — Express HTTP API (cluster mode, 1 worker per CPU core)
 *   2. elite-worker — BullMQ consumer (single fork process)
 *
 * NOT MANAGED BY PM2:
 *   - The customer SPA (workspace `frontend`) and the admin SPA (workspace
 *     `admin`) compile to static `dist/` bundles and are served directly by
 *     NGINX from /var/www/elite/frontend/ and /var/www/elite/admin/.
 *     They are NOT Node processes; they never appear in `pm2 status`.
 *
 * WORKER SCRIPT STATUS:
 *   backend/package.json currently exposes { dev, build, start, typecheck,
 *   prisma:generate, prisma:migrate, prisma:deploy, prisma:studio, seed }.
 *   It does NOT yet define `worker` or `worker:start`, and backend/src/worker.ts
 *   does not exist yet either. This ecosystem file references the compiled
 *   worker at dist/worker.js so the process slot is reserved — add the
 *   src/worker.ts entry point plus the matching `worker` / `worker:start`
 *   package.json scripts when the BullMQ consumers land, and this file will
 *   already be pointing at the right build output.
 *
 * USAGE:
 *   pm2 start   deployment/pm2/ecosystem.config.cjs
 *   pm2 reload  deployment/pm2/ecosystem.config.cjs --update-env   # zero-downtime
 *   pm2 restart deployment/pm2/ecosystem.config.cjs --only elite-worker
 *   pm2 save                                                       # persist for reboot
 */

module.exports = {
  apps: [
    {
      name: 'elite-api',
      cwd: '/home/deploy/elite/backend',
      script: 'dist/server.js',
      exec_mode: 'cluster',
      instances: 'max', // one Node worker per CPU core; drop to 2 on small VPS
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      kill_timeout: 5000, // ms grace for in-flight requests during reload
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
      },
      // Real secrets live only on the server, chmod 600, owned by `deploy`.
      env_file: '/home/deploy/elite/.env',
      out_file: '/var/log/elite/api-out.log',
      error_file: '/var/log/elite/api-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
    {
      name: 'elite-worker',
      cwd: '/home/deploy/elite/backend',
      script: 'dist/worker.js',
      exec_mode: 'fork',
      instances: 1, // scale up (or add a second entry) if queue depth grows
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      kill_timeout: 30000, // give BullMQ jobs a chance to finish/nack cleanly
      env: {
        NODE_ENV: 'production',
      },
      env_file: '/home/deploy/elite/.env.worker',
      out_file: '/var/log/elite/worker-out.log',
      error_file: '/var/log/elite/worker-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
  ],
};

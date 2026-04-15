// PM2 ecosystem file — runs the API server and the BullMQ webhook worker.
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 restart ecosystem.config.cjs
//   pm2 restart tawasel-app tawasel-worker

module.exports = {
  apps: [
    {
      name: "tawasel-app",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "server.ts",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
      kill_timeout: 15000, // give graceful shutdown up to 15s
      listen_timeout: 10000,
      wait_ready: false,
    },
    {
      name: "tawasel-worker",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "server/worker.ts",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
      kill_timeout: 15000,
    },
  ],
};

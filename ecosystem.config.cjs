module.exports = {
  apps: [
    {
      // PM2 entrypoint for joggediballa.
      // Loaded via `pm2 start ecosystem.config.cjs` after a deploy if the
      // process was deleted; the automated deploy (.github/workflows/deploy.yml
      // -> forced command on the server) uses `pm2 reload`, which doesn't
      // re-read this file. After editing, run:
      //   pm2 delete joggediballa && pm2 start ecosystem.config.cjs && pm2 save
      // so /root/.pm2/dump.pm2 picks up the new config for resurrect-on-boot.
      name: 'joggediballa',
      script: 'dist/index.js',
      cwd: '/var/www/joggediballa-mainpage',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=512',
      },
      max_memory_restart: '600M',
      // .env is loaded by `import 'dotenv/config'` at the top of dist/index.js,
      // so PM2 doesn't need to inject it. Earlier setups used a bash wrapper
      // (`bash -c dotenv -e .env -- node dist/index.js`) for the same effect;
      // dropped because it's redundant + breaks signal propagation under PM2 reload.
    },
  ],
};

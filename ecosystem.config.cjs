module.exports = {
  apps: [
    {
      name: "maison-olive-shop",
      cwd: "C:/Cline/maison-olive-shop",
      script: "./node_modules/next/dist/bin/next",
      args: "start --hostname 0.0.0.0 --port 3101",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3101",
      },
      env_production: {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3101",
      },
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      time: true,
    },
  ],
};

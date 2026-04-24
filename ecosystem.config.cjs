module.exports = {
  apps: [
    {
      name: "chez-olive-shop",
      cwd: __dirname,
      script: "./node_modules/next/dist/bin/next",
      args: "start --hostname 0.0.0.0 --port 3101",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://chezolive.ca",
        BUSINESS_SUPPORT_EMAIL: "support@chezolive.ca",
      },
      env_production: {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://chezolive.ca",
        BUSINESS_SUPPORT_EMAIL: "support@chezolive.ca",
      },
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      time: true,
    },
    {
      name: "chezolive-tunnel",
      cwd: __dirname,
      script: "./tools/cloudflared.exe",
      args: "tunnel --config C:\\Users\\Gary\\.cloudflared\\config.yml run",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
      env_production: {
        NODE_ENV: "production",
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



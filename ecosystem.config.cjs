/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const dataRoot = process.env.CHEZOLIVE_DATA_ROOT
  ? path.resolve(__dirname, process.env.CHEZOLIVE_DATA_ROOT)
  : path.resolve(__dirname, "..", "maison-olive-data");
const logDir = process.env.CHEZOLIVE_LOG_DIR
  ? path.resolve(__dirname, process.env.CHEZOLIVE_LOG_DIR)
  : path.join(dataRoot, "logs");
const secretsFile = process.env.CHEZOLIVE_SECRETS_FILE
  ? path.resolve(__dirname, process.env.CHEZOLIVE_SECRETS_FILE)
  : path.join(dataRoot, "secrets", "chez-olive.production.env");

fs.mkdirSync(logDir, { recursive: true });

function loadEnvFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalIndex = line.indexOf("=");
    if (equalIndex <= 0) continue;

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function pickEnv(keys) {
  return Object.fromEntries(
    keys
      .map((key) => [key, process.env[key]])
      .filter((entry) => typeof entry[1] === "string" && entry[1].length > 0),
  );
}

loadEnvFileIfExists(secretsFile);

const optionalAppEnv = pickEnv([
  "WEB_PUSH_PUBLIC_KEY",
  "WEB_PUSH_PRIVATE_KEY",
  "WEB_PUSH_SUBJECT",
  "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY",
  "SMS_NOTIFICATIONS_ENABLED",
  "SMS_DRY_RUN",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_MESSAGING_SERVICE_SID",
  "TWILIO_FROM_NUMBER",
]);

module.exports = {
  apps: [
    {
      name: "chez-olive-shop",
      cwd: __dirname,
      script: "./node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3101",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://chezolive.ca",
        BUSINESS_SUPPORT_EMAIL: "support@chezolive.ca",
        ...optionalAppEnv,
      },
      env_production: {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://chezolive.ca",
        BUSINESS_SUPPORT_EMAIL: "support@chezolive.ca",
        ...optionalAppEnv,
      },
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      time: true,
      out_file: path.join(logDir, "chez-olive-shop.out.log"),
      error_file: path.join(logDir, "chez-olive-shop.error.log"),
      log_file: path.join(logDir, "chez-olive-shop.combined.log"),
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
      out_file: path.join(logDir, "chezolive-tunnel.out.log"),
      error_file: path.join(logDir, "chezolive-tunnel.error.log"),
      log_file: path.join(logDir, "chezolive-tunnel.combined.log"),
    },
  ],
};



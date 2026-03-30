const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = 'localhost';
const PORT = 3101;
const CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes
const MAX_FAILURES = 3;
const PROJECT_DIR = __dirname;

let failureCount = 0;
let serverProcess = null;

function startServer() {
  console.log(`[${new Date().toISOString()}] Starting Next.js dev server...`);
  serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: PROJECT_DIR,
    stdio: 'pipe',
    shell: true
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Next.js] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Next.js ERR] ${data.toString().trim()}`);
  });

  serverProcess.on('close', (code) => {
    console.error(`[${new Date().toISOString()}] Next.js process exited with code ${code}`);
    serverProcess = null;
    failureCount++;
    if (failureCount >= MAX_FAILURES) {
      console.error(`[${new Date().toISOString()}] Too many failures (${failureCount}), stopping keep‑alive.`);
      process.exit(1);
    }
    // Wait a bit before restarting
    setTimeout(startServer, 10000);
  });

  // Give server time to start
  setTimeout(() => {
    console.log(`[${new Date().toISOString()}] Server started, waiting for readiness...`);
  }, 5000);
}

function pingServer() {
  const req = http.request({
    hostname: HOST,
    port: PORT,
    path: '/',
    method: 'HEAD',
    timeout: 10000
  }, (res) => {
    console.log(`[${new Date().toISOString()}] Keep‑alive ping successful: ${res.statusCode}`);
    failureCount = 0; // reset on success
  });

  req.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Keep‑alive ping failed: ${err.message}`);
    failureCount++;
    if (failureCount >= MAX_FAILURES && !serverProcess) {
      console.error(`[${new Date().toISOString()}] Server appears down, restarting...`);
      startServer();
    }
  });

  req.on('timeout', () => {
    console.error(`[${new Date().toISOString()}] Keep‑alive ping timeout`);
    req.destroy();
    failureCount++;
    if (failureCount >= MAX_FAILURES && !serverProcess) {
      console.error(`[${new Date().toISOString()}] Server appears down, restarting...`);
      startServer();
    }
  });

  req.end();
}

// Start server initially
startServer();

// Start periodic ping
setInterval(pingServer, CHECK_INTERVAL);

// Also ping shortly after start
setTimeout(pingServer, 15000);

console.log(`[${new Date().toISOString()}] Enhanced keep‑alive started for ${HOST}:${PORT}`);
console.log(`[${new Date().toISOString()}] Will check every ${CHECK_INTERVAL/60000} minutes and restart server if needed.`);
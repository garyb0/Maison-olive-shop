const http = require('http');

const host = 'localhost';
const port = 3101;
const interval = 5 * 60 * 1000; // 5 minutes

function ping() {
  const req = http.request({
    hostname: host,
    port: port,
    path: '/',
    method: 'HEAD',
    timeout: 5000
  }, (res) => {
    console.log(`[${new Date().toISOString()}] Keep‑alive ping successful: ${res.statusCode}`);
  });

  req.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Keep‑alive ping failed: ${err.message}`);
  });

  req.on('timeout', () => {
    console.error(`[${new Date().toISOString()}] Keep‑alive ping timeout`);
    req.destroy();
  });

  req.end();
}

console.log(`Starting keep‑alive for ${host}:${port} every ${interval/60000} minutes`);
ping();
setInterval(ping, interval);
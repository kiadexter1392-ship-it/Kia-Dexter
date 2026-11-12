'use strict';
/*
 * اجرای هر دو سایت با reverse proxy:
 *   پورت اصلی (Railway) → /coach/* و /member/*
 *   لوکال → :4173 (مربی) و :4174 (شاگردان)
 */

const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = Number(process.env.PORT || 0);
const COACH_PORT = process.env.COACH_PORT || 4173;
const MEMBER_PORT = process.env.MEMBER_PORT || 4174;
const MEMBERS_SITE_URL = process.env.MEMBERS_SITE_URL || null;

const children = [];

function start(label, script, color) {
  const child = spawn(process.execPath, [path.join(__dirname, script)], {
    env: { ...process.env, COACH_PORT, MEMBER_PORT, MEMBERS_SITE_URL },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const prefix = `\x1b[${color}m[${label}]\x1b[0m `;
  child.stdout.on('data', (d) => process.stdout.write(prefix + String(d).replace(/\n$/, '').split('\n').join('\n' + prefix) + '\n'));
  child.stderr.on('data', (d) => process.stderr.write(prefix + String(d)));
  child.on('exit', (code) => {
    console.log(`${prefix}خروج با کد ${code}`);
    shutdown(code === 0 ? 0 : 1);
  });
  children.push(child);
  return child;
}

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  children.forEach((c) => { try { c.kill('SIGTERM'); } catch { /* ignore */ } });
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

/* --- Reverse Proxy --- */
function proxy(targetPort) {
  return function proxyHandler(req, res) {
    const opts = {
      hostname: '127.0.0.1',
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `localhost:${targetPort}` }
    };
    const proxyReq = http.request(opts, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    proxyReq.on('error', () => {
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    req.pipe(proxyReq, { end: true });
  };
}

console.log('باشگاه آنلاین ارسلان دوجو');
console.log('─────────────────────────────────────────────');

if (PORT) {
  /* Railway: یک پورت، دو سرویس با reverse proxy */
  const proxyServer = http.createServer((req, res) => {
    /* مسیرهای اختصاصی شاگردان */
    const memberPaths = ['/impersonate', '/register', '/login', '/panel', '/api/payment', '/api/faq', '/api/register', '/api/login', '/api/logout', '/api/me', '/api/plans', '/api/assignments', '/api/progress', '/api/self-report', '/api/announcements', '/api/notifications', '/api/club', '/api/password'];
    const isMemberPath = memberPaths.some(p => req.url.startsWith(p));

    if (isMemberPath) {
      return proxy(MEMBER_PORT)(req, res);
    }
    /* بقیه مسیرها → مربی (پیش‌فرض) */
    proxy(COACH_PORT)(req, res);
  });
  proxyServer.listen(PORT, '0.0.0.0', () => {
    console.log(`  پروکسی      →  http://0.0.0.0:${PORT}`);
    console.log(`  پنل مربی     →  http://localhost:${COACH_PORT}`);
    console.log(`  پنل شاگردان  →  http://localhost:${MEMBER_PORT}`);
    console.log('─────────────────────────────────────────────');
    start('مربی', 'coach/server.js', '31');
    start('شاگردان', 'members/server.js', '33');
  });
} else {
  /* لوکال: دو پورت جدا */
  console.log(`  پنل مربی     →  http://localhost:${COACH_PORT}`);
  console.log(`  پنل شاگردان  →  http://localhost:${MEMBER_PORT}`);
  console.log('─────────────────────────────────────────────');
  start('مربی', 'coach/server.js', '31');
  start('شاگردان', 'members/server.js', '33');
}

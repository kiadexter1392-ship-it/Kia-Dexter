'use strict';
/*
 * اجرای هر دو سایت با reverse proxy:
 *   پورت 8080 → شاگردان (و /coach برای دسترسی سازگار به مربی)
 *   پورت 4174 → مربی؛ پورت 4173 → سرور داخلی شاگردان
 */

const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const { readPorts } = require('./shared/ports');
const { proxy } = require('./shared/proxy');
const { gateway: PORT, coach: COACH_PORT, member: MEMBER_PORT } = readPorts();
const MEMBERS_SITE_URL = process.env.MEMBERS_SITE_URL || null;

const children = [];

function start(label, script, color) {
  const child = spawn(process.execPath, [path.join(__dirname, script)], {
    env: { ...process.env, COACH_PORT, MEMBER_PORT, MEMBERS_SITE_URL: MEMBERS_SITE_URL || '' },
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

console.log('باشگاه آنلاین ارسلان دوجو');
console.log('─────────────────────────────────────────────');

if (PORT) {
  /* Railway: یک پورت، دو سرویس با reverse proxy */
  const proxyServer = http.createServer((req, res) => {
    const url = req.url;
    const parsed = new URL(url, 'http://localhost');
    // Canonical trailing slash makes relative form and asset URLs work correctly.
    if (parsed.pathname === '/coach' || parsed.pathname === '/dashboard') {
      res.writeHead(302, { Location: (parsed.pathname === '/coach' ? '/coach/' : '/coach/dashboard') + parsed.search });
      return res.end();
    }

    if (parsed.pathname === '/admin' || parsed.pathname.startsWith('/admin/')) return proxy(COACH_PORT)(req, res);

    /* مسیرهای پنل مربی (با پیشوند /coach) */
    if (parsed.pathname.startsWith('/coach/') || parsed.pathname.startsWith('/v1/')) {
      req.url = url.replace(/^\/coach/, '') || '/';
      return proxy(COACH_PORT, { prefix: '/coach' })(req, res);
    }

    /* بقیه مسیرها → شاگردان (پیش‌فرض) */
    proxy(MEMBER_PORT)(req, res);
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

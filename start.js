'use strict';
/*
 * اجرای هم‌زمان هر دو سایت:
 *   سایت ۱ — پنل مربی    : http://localhost:4173
 *   سایت ۲ — پنل شاگردان : http://localhost:4174
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const COACH_PORT = process.env.COACH_PORT || 4173;
const MEMBER_PORT = process.env.MEMBER_PORT || 4174;

const children = [];

function start(label, script, color) {
  const child = spawn(process.execPath, [path.join(__dirname, script)], {
    env: { ...process.env, COACH_PORT, MEMBER_PORT },
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
console.log(`  پنل مربی     →  http://localhost:${COACH_PORT}   (arsalan / arsalan123)`);
console.log(`  پنل شاگردان  →  http://localhost:${MEMBER_PORT}   (ali / 123456)`);
console.log('─────────────────────────────────────────────');

start('مربی', 'coach/server.js', '31');
start('شاگردان', 'members/server.js', '33');

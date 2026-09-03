'use strict';
/*
 * فریم‌ورک کوچک HTTP بدون وابستگی بیرونی:
 * مسیریابی، پارس JSON، کوکی، فایل‌های استاتیک و مدیریت خطا.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

function parseCookies(req) {
  const raw = req.headers.cookie;
  const out = {};
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function readBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('حجم داده ارسالی زیاد است'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      const type = String(req.headers['content-type'] || '');
      if (type.includes('application/json')) {
        try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('JSON نامعتبر'), { status: 400 })); }
      } else if (type.includes('application/x-www-form-urlencoded')) {
        resolve(Object.fromEntries(new URLSearchParams(raw)));
      } else {
        try { resolve(JSON.parse(raw)); } catch { resolve({ raw }); }
      }
    });
    req.on('error', reject);
  });
}

function matchRoute(pattern, pathname) {
  const p = pattern.split('/').filter(Boolean);
  const u = pathname.split('/').filter(Boolean);
  if (p.length !== u.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i += 1) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(u[i]);
    else if (p[i] !== u[i]) return null;
  }
  return params;
}

const SAFE_FILE = /^[A-Za-z0-9._\-/\u0600-\u06FF ]+$/;

function sendFile(res, filePath, status = 200) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('فایل پیدا نشد');
  });
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  });
  stream.pipe(res);
}

function createServer(options = {}) {
  const {
    name = 'server',
    publicDirs = [],
    cookieName = 'session',
    logger = console
  } = options;

  const routes = { GET: [], POST: [], PUT: [], PATCH: [], DELETE: [] };

  function add(method, pattern, handler) {
    routes[method].push({ pattern, handler });
  }

  const app = {
    name,
    cookieName,
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    put: (p, h) => add('PUT', p, h),
    patch: (p, h) => add('PATCH', p, h),
    delete: (p, h) => add('DELETE', p, h),
    use: (middleware) => { middlewares.push(middleware); return app; },
    listen
  };

  const middlewares = [];

  async function handle(req, res) {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const pathname = decodeURIComponent(url.pathname).replace(/\/{2,}/g, '/') || '/';
    const method = req.method.toUpperCase();

    let body = {};
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = await readBody(req);
      } catch (err) {
        return json(res, { ok: false, error: err.message || 'خطا در خواندن داده' }, err.status || 400);
      }
    }

    const cookieJar = parseCookies(req);
    const setCookies = [];

    const ctx = {
      req,
      res,
      method,
      path: pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      url,
      body,
      cookies: cookieJar,
      setCookie(value, opts = {}) {
        const parts = [`${cookieName}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
        if (opts.maxAgeSeconds) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
        if (opts.expires) parts.push(`Expires=${opts.expires}`);
        setCookies.push(parts.join('; '));
      },
      clearCookie() {
        setCookies.push(`${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
      },
      json(data, status = 200) { return json(res, data, status, setCookies); },
      text(data, status = 200, type = 'text/plain; charset=utf-8') {
        for (const c of setCookies) res.setHeader('Set-Cookie', c);
        res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(data);
      },
      redirect(to, status = 302) {
        for (const c of setCookies) res.setHeader('Set-Cookie', c);
        res.writeHead(status, { Location: to });
        res.end();
      },
      file(filePath, status) {
        for (const c of setCookies) res.setHeader('Set-Cookie', c);
        sendFile(res, filePath, status);
      }
    };

    for (const mw of middlewares) {
      const out = await mw(ctx);
      if (res.writableEnded) return out;
      if (out === 'stop') return;
    }

    const list = routes[method] || [];
    for (const route of list) {
      const params = matchRoute(route.pattern, pathname);
      if (!params) continue;
      ctx.params = params;
      try {
        await route.handler(ctx);
      } catch (err) {
        const status = err.status || 500;
        if (status >= 500) logger.error(`[${name}] ${method} ${pathname}`, err);
        if (!res.writableEnded) json(res, { ok: false, error: err.message || 'خطای داخلی سرور' }, status, setCookies);
      }
      return;
    }

    // فایل‌های استاتیک
    if (method === 'GET' || method === 'HEAD') {
      const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      if (!SAFE_FILE.test(rel) || rel.includes('..')) {
        return json(res, { ok: false, error: 'مسیر نامعتبر' }, 400);
      }
      for (const dir of publicDirs) {
        const candidate = path.join(dir, rel);
        if (candidate.startsWith(dir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          for (const c of setCookies) res.setHeader('Set-Cookie', c);
          return sendFile(res, candidate);
        }
      }
    }

    json(res, { ok: false, error: 'پیدا نشد' }, 404, setCookies);
  }

  function json(res, data, status = 200, setCookies = []) {
    for (const c of setCookies) res.setHeader('Set-Cookie', c);
    const payload = Buffer.from(JSON.stringify(data), 'utf8');
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': payload.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(payload);
  }

  function listen(port, host = '0.0.0.0', callback) {
    const server = http.createServer((req, res) => {
      handle(req, res).catch((err) => {
        logger.error(`[${name}] unhandled`, err);
        if (!res.writableEnded) {
          try { json(res, { ok: false, error: 'خطای داخلی سرور' }, 500); } catch { /* ignore */ }
        }
      });
    });
    server.listen(port, host, () => {
      logger.log(`[${name}] آماده روی http://${host}:${port}`);
      if (callback) callback(server);
    });
    return server;
  }

  return app;
}

module.exports = { createServer, parseCookies, sendFile, MIME };

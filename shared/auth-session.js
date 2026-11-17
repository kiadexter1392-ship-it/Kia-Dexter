'use strict';
const db = require('./db');
const { DAY_SECONDS, lifetimeSeconds } = require('./session-policy');
const restored = new WeakMap();
function cookieOptions(name, site, expires) {
  return { name, sameSite: site === 'admin' ? 'Strict' : 'Lax',
    maxAgeSeconds: lifetimeSeconds(site), expires: new Date(expires).toUTCString() };
}
function signIn(ctx, userId, site, cookieName) {
  // Each browser receives its own random server-side session. Signing in on another
  // device does not revoke this one; logout only revokes the cookie presented there.
  const session = db.createSession(userId, site, lifetimeSeconds(site) / DAY_SECONDS);
  db.destroySession(ctx.cookies[cookieName]);
  ctx.setCookie(session.token, cookieOptions(cookieName, site, session.expires));
  return session;
}
function restore(ctx, cookieName, site, accepts) {
  let cache = restored.get(ctx);
  if (!cache) { cache = new Map(); restored.set(ctx, cache); }
  const key = cookieName + ':' + site;
  if (cache.has(key)) return cache.get(key);
  const token = ctx.cookies[cookieName];
  const user = db.sessionUser(token, site);
  if (!user || !accepts(user)) {
    if (token) ctx.clearCookie({ name: cookieName, sameSite: site === 'admin' ? 'Strict' : 'Lax' });
    cache.set(key, null); return null;
  }
  // Refresh database and browser expiries together, at most once per day. A closed
  // browser needs no background task; the next authenticated visit does the refresh.
  const renewed = db.renewSession(token, site);
  if (renewed) ctx.setCookie(token, cookieOptions(cookieName, site, renewed.expires));
  cache.set(key, user); return user;
}
function signOut(ctx, cookieName, site) {
  db.destroySession(ctx.cookies[cookieName]);
  ctx.clearCookie({ name: cookieName, sameSite: site === 'admin' ? 'Strict' : 'Lax' });
}
module.exports = { signIn, restore, signOut };

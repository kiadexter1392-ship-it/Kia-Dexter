'use strict';
// Server-side only. Set the secret in the service environment, never in argv.
const role = process.argv[2];
const { ACCOUNT_USERNAME: username, ACCOUNT_PASSWORD: password } = process.env;
if (!['admin', 'coach'].includes(role) || !/^[-a-zA-Z0-9._]{3,30}$/.test(username || '') || typeof password !== 'string' || password.length < 12) {
  console.error('Set ACCOUNT_USERNAME and a private ACCOUNT_PASSWORD of at least 12 characters; run node scripts/reset-account-password.js admin|coach.');
  process.exit(1);
}
const db = require('../shared/db');
require('../shared/academy');
try {
  db.execWithRetry('BEGIN IMMEDIATE');
  const user = db.findByUsername(username);
  const isAdmin = user && !!db.get('SELECT user_id FROM academy_admins WHERE user_id=?', user.id);
  if (!user || user.role !== 'coach' || !user.active || !user.verified || (role === 'admin') !== isAdmin) {
    throw new Error('Active verified account with that username and role not found; no changes made.');
  }
  db.setPassword(user.id, password); // also revokes all sessions for this account
  db.logActivity(user.id, user.full_name, 'بازنشانی رمز با ابزار سرور', role);
  db.db.exec('COMMIT');
  console.log(`Password reset for ${role} account ${user.username}; existing sessions were revoked.`);
} catch (error) {
  try { db.db.exec('ROLLBACK'); } catch { /* no active transaction */ }
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.db.close();
}

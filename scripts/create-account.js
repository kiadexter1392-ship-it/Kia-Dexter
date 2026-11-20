'use strict';
// Run on the server with a secret environment variable, not a password in argv/history.
const db = require('../shared/db');
require('../shared/academy');
const role = process.argv[2];
const { ACCOUNT_USERNAME: username, ACCOUNT_PASSWORD: password, ACCOUNT_NAME: full_name } = process.env;
if (!['admin','coach'].includes(role) || !/^[-a-zA-Z0-9._]{3,30}$/.test(username || '') || String(password || '').length < 12 || String(full_name || '').trim().length < 3) {
  console.error('Usage: ACCOUNT_USERNAME=... ACCOUNT_NAME=... ACCOUNT_PASSWORD=<secret> node scripts/create-account.js admin|coach\nPassword must have at least 12 characters. Existing accounts are never overwritten.');
  process.exit(1);
}
try {
  db.execWithRetry('BEGIN IMMEDIATE');
  if (db.findByUsername(username)) throw new Error('Account already exists; no changes made.');
  const user = db.createUser({username, password, full_name}, 'coach');
  if (role === 'admin') db.run('INSERT INTO academy_admins(user_id) VALUES (?)',user.id);
  db.logActivity(user.id, user.full_name, 'ایجاد حساب اولیه با ابزار سرور', role);
  db.db.exec('COMMIT');
  console.log(`Created ${role} account: ${username}. No default credentials or demonstration data were created.`);
} catch (error) {
  try { db.db.exec('ROLLBACK'); } catch { /* no active transaction */ }
  console.error(error.message); process.exitCode=1;
} finally { db.db.close(); }

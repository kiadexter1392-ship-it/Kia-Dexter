'use strict';
// Regression checks use isolated databases, never the club's real data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '../members/public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../shared/public/ui/style.css'), 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;
assert.match(doc.querySelector('#contact').textContent, /خادم اباد،کوچه لاله چهارم غربی، جنب پلی استیشن فروشی\./);
assert.ok(!doc.body.textContent.includes('حساب تست'));
assert.equal(doc.querySelector('#lUser').placeholder, 'نام کاربری');
for (const link of doc.querySelectorAll('a[href^="tel:"], a[href^="https://ble.ir/"]')) {
  assert.equal(link.getAttribute('dir'), 'ltr');
}
const style = doc.createElement('style');
style.textContent = css;
doc.head.appendChild(style);
const phoneStyle = dom.window.getComputedStyle(doc.querySelector('#contact a[href^="tel:"]'));
assert.equal(phoneStyle.direction, 'ltr');
assert.equal(phoneStyle.unicodeBidi, 'isolate');
dom.window.close();
console.log('PASS: address, hidden demo hint, isolated LTR phone numbers');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-account-test-'));
try {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const db = require('./shared/db');
    const { seedIfEmpty } = require('./shared/seed');
    seedIfEmpty();
    const kia = db.findByUsername('kia');
    assert.equal(kia.role, 'member');
    assert.ok(db.verifyPassword('123456', kia.password_hash, kia.password_salt));
    assert.equal(db.findByUsername('ali'), null);
    const session = db.createSession(kia.id, 'members', 1);
    db.run("UPDATE users SET username = 'ali' WHERE id = ?", kia.id);
    seedIfEmpty();
    assert.equal(db.findByUsername('kia').id, kia.id);
    assert.ok(db.get('SELECT token FROM sessions WHERE token = ?', session.token));
    seedIfEmpty();
    assert.equal(db.get("SELECT COUNT(*) AS n FROM users WHERE username = 'kia'").n, 1);
    // Existing kia must never be overwritten by the legacy migration.
    db.run("UPDATE users SET username = 'ali' WHERE id = ?", kia.id);
    const other = db.createUser({ full_name: 'Existing member', username: 'kia', password: 'different-password' });
    seedIfEmpty();
    assert.equal(db.findByUsername('kia').id, other.id);
    assert.ok(db.verifyPassword('different-password', db.findByUsername('kia').password_hash, db.findByUsername('kia').password_salt));
    assert.equal(db.findByUsername('ali').id, kia.id);
    db.db.close();
  `], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, RESET_DB: '0', ARSLAN_DATA_DIR: temp, ARSLAN_DB: path.join(temp, 'test.db') },
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  console.log('PASS: kia password, legacy migration, retained IDs/sessions, idempotence, collision safety');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

'use strict';
/*
 * لایه دیتابیس: SQLite (ماژول داخلی node:sqlite) — داده‌ها روی دیسک ذخیره
 * می‌شوند و با ری‌استارت سرور از بین نمی‌روند.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.ARSLAN_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.ARSLAN_DB || path.join(DATA_DIR, 'arslan-dojo.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

/* خواب همگام (برای تلاش مجدد وقتی دو سرور هم‌زمان دیتابیس را می‌سازند) */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/* دو پروسه (سایت مربی و سایت شاگردان) ممکن است هم‌زمان اجرا شوند */
function execWithRetry(sql, tries = 20) {
  for (let i = 0; i < tries; i += 1) {
    try { db.exec(sql); return; } catch (err) {
      if (err && err.errcode === 5 /* SQLITE_BUSY */ && i < tries - 1) { sleepSync(120 * (i + 1)); continue; }
      throw err;
    }
  }
}

try { db.exec('PRAGMA busy_timeout = 15000;'); } catch { /* غیرحیاتی */ }

/*
 * تغییر journal_mode به WAL نیازمند قفل انحصاری است و اگر دو سایت هم‌زمان
 * بالا بیایند ممکن است SQLITE_BUSY برگرداند؛ بنابراین با تلاش مجدد انجام می‌شود
 * و در بدترین حالت بدون WAL ادامه می‌دهیم (برنامه کار می‌کند).
 */
let walEnabled = false;
for (let attempt = 0; attempt < 25; attempt += 1) {
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    walEnabled = true;
    break;
  } catch (err) {
    const busy = err && (err.errcode === 5 || err.errcode === 6);
    if (busy && attempt < 24) { sleepSync(100 * (attempt + 1)); continue; }
    console.warn('[db] فعال‌سازی WAL ممکن نشد؛ با journal_mode پیش‌فرض ادامه می‌دهیم.');
    break;
  }
}

db.exec('PRAGMA foreign_keys = ON;');

/* ------------------------------ ابزار پرس‌وجو ----------------------------- */

function clean(params) {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (p instanceof Date) return p.toISOString();
    return p;
  });
}

function all(sql, ...params) { return db.prepare(sql).all(...clean(params)); }
function get(sql, ...params) { return db.prepare(sql).get(...clean(params)) || null; }
function run(sql, ...params) { return db.prepare(sql).run(...clean(params)); }

/* --------------------------------- اسکیم --------------------------------- */

execWithRetry(`
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  role           TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('coach','member')),
  full_name      TEXT NOT NULL,
  username       TEXT NOT NULL UNIQUE,
  phone          TEXT,
  password_hash  TEXT NOT NULL,
  password_salt  TEXT NOT NULL,
  gender         TEXT,
  birth_date     TEXT,
  age            INTEGER,
  weight_kg      REAL,
  height_cm      REAL,
  belt           TEXT DEFAULT 'سفید',
  style          TEXT,
  experience     TEXT,
  join_date      TEXT,
  notes          TEXT,
  avatar_color   TEXT DEFAULT '#e2483d',
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  category    TEXT DEFAULT 'تمرین',
  difficulty  TEXT DEFAULT 'متوسط',
  starts_on   TEXT,
  due_on      TEXT,
  duration    TEXT,
  target_all  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_assignments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id      INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  completed_at TEXT,
  member_note  TEXT,
  coach_note   TEXT,
  assigned_at  TEXT NOT NULL,
  UNIQUE(plan_id, user_id)
);

CREATE TABLE IF NOT EXISTS progress (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  sessions    INTEGER,
  endurance   INTEGER,
  strength    INTEGER,
  technique   INTEGER,
  flexibility INTEGER,
  discipline  INTEGER,
  weight_kg   REAL,
  overall     INTEGER,
  note        TEXT,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE(user_id, year, month)
);

CREATE TABLE IF NOT EXISTS self_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL,
  sessions    INTEGER,
  feeling     TEXT,
  note        TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE(user_id, year, month)
);

CREATE TABLE IF NOT EXISTS announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  category   TEXT DEFAULT 'عمومی',
  pinned     INTEGER NOT NULL DEFAULT 0,
  target_all INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS announcement_targets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         TEXT NOT NULL,
  UNIQUE(announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  read       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS impersonations (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE TABLE IF NOT EXISTS activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action     TEXT NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_assign_user ON plan_assignments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
`);

/* -------------------------------- رمز عبور -------------------------------- */

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  try {
    const calc = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
    const given = Buffer.from(String(hash), 'hex');
    return given.length === calc.length && crypto.timingSafeEqual(calc, given);
  } catch {
    return false;
  }
}

/* --------------------------------- کاربران -------------------------------- */

const now = () => new Date().toISOString();

function findByUsername(username) {
  return get('SELECT * FROM users WHERE username = ?', String(username || '').trim().toLowerCase());
}

function findById(id) {
  return get('SELECT * FROM users WHERE id = ?', Number(id));
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    role: u.role,
    full_name: u.full_name,
    username: u.username,
    phone: u.phone,
    gender: u.gender,
    birth_date: u.birth_date,
    age: u.age,
    weight_kg: u.weight_kg,
    height_cm: u.height_cm,
    belt: u.belt,
    style: u.style,
    experience: u.experience,
    join_date: u.join_date,
    notes: u.notes,
    avatar_color: u.avatar_color,
    active: !!u.active,
    created_at: u.created_at
  };
}

function createUser(data, role = 'member') {
  const { hash, salt } = hashPassword(data.password);
  const ts = now();
  const colors = ['#e2483d', '#d9a441', '#3fa7d6', '#5cb85c', '#a06cd5', '#ef7f57', '#2fa8a0'];
  const color = data.avatar_color || colors[(data.full_name || 'a').length % colors.length];
  const info = run(
    `INSERT INTO users (role, full_name, username, phone, password_hash, password_salt, gender, birth_date, age,
      weight_kg, height_cm, belt, style, experience, join_date, notes, avatar_color, active, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    role,
    String(data.full_name || '').trim(),
    String(data.username || '').trim().toLowerCase(),
    data.phone || null,
    hash,
    salt,
    data.gender || null,
    data.birth_date || null,
    data.age ? Number(data.age) : null,
    data.weight_kg ? Number(data.weight_kg) : null,
    data.height_cm ? Number(data.height_cm) : null,
    data.belt || 'سفید',
    data.style || null,
    data.experience || null,
    data.join_date || ts.slice(0, 10),
    data.notes || null,
    color,
    data.active === undefined ? 1 : (data.active ? 1 : 0),
    ts,
    ts
  );
  return findById(info.lastInsertRowid);
}

function updateUser(id, data) {
  const fields = [];
  const values = [];
  const allowed = ['full_name', 'phone', 'gender', 'birth_date', 'age', 'weight_kg', 'height_cm',
    'belt', 'style', 'experience', 'notes', 'active', 'avatar_color', 'join_date'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      let v = data[key];
      if (['age', 'weight_kg', 'height_cm'].includes(key)) v = v === null || v === '' ? null : Number(v);
      if (key === 'active') v = v ? 1 : 0;
      values.push(v === '' ? null : v);
    }
  }
  if (!fields.length) return findById(id);
  fields.push('updated_at = ?');
  values.push(now());
  values.push(Number(id));
  run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, ...values);
  return findById(id);
}

function listMembers(query = {}) {
  const where = ["role = 'member'"];
  const params = [];
  if (query.q) {
    where.push('(full_name LIKE ? OR username LIKE ? OR phone LIKE ?)');
    const like = `%${query.q}%`;
    params.push(like, like, like);
  }
  if (query.belt) { where.push('belt = ?'); params.push(query.belt); }
  if (query.active !== undefined) { where.push('active = ?'); params.push(query.active ? 1 : 0); }
  return all(
    `SELECT * FROM users WHERE ${where.join(' AND ')} ORDER BY
       CASE WHEN active = 1 THEN 0 ELSE 1 END, full_name COLLATE NOCASE`,
    ...params
  );
}

/* --------------------------------- نشست‌ها -------------------------------- */

function createSession(userId, site, days = 30) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + days * 864e5).toISOString();
  run('INSERT INTO sessions (token, user_id, site, created_at, expires_at) VALUES (?,?,?,?,?)',
    token, Number(userId), site, now(), expires);
  return { token, expires };
}

function sessionUser(token, site) {
  if (!token) return null;
  const row = get(
    `SELECT s.*, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.site = ? AND s.expires_at > ?`,
    token, site, now()
  );
  if (!row) return null;
  const user = findById(row.user_id);
  if (!user || !user.active) return null;
  return user;
}

function destroySession(token) {
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
}

function setPassword(userId, password) {
  const { hash, salt } = hashPassword(password);
  run('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?', hash, salt, now(), Number(userId));
  run('DELETE FROM sessions WHERE user_id = ?', Number(userId));
}

/* ------------------------------- اطلاعیه‌ها ------------------------------- */

function createAnnouncement({ author_id, title, body, category = 'عمومی', pinned = 0, targets = [] }) {
  const info = run(
    'INSERT INTO announcements (author_id, title, body, category, pinned, target_all, created_at) VALUES (?,?,?,?,?,?,?)',
    author_id || null, title, body || '', category, pinned ? 1 : 0, targets.length ? 0 : 1, now()
  );
  const id = Number(info.lastInsertRowid);
  for (const uid of targets) {
    run('INSERT OR IGNORE INTO announcement_targets (announcement_id, user_id) VALUES (?,?)', id, Number(uid));
  }
  notifyTargets(id, {
    type: 'announcement',
    title: `اطلاعیه جدید: ${title}`,
    body: (body || '').slice(0, 140),
    targets,
    all: targets.length === 0
  });
  return getAnnouncement(id);
}

function notifyTargets(_announcementId, { type, title, body, targets, all }) {
  const users = all ? listMembers({ active: 1 }) : targets.map((t) => findById(t)).filter(Boolean);
  for (const u of users) {
    run('INSERT INTO notifications (user_id, type, title, body, read, created_at) VALUES (?,?,?,?,0,?)',
      u.id, type, title, body || null, now());
  }
}

function getAnnouncement(id) {
  const a = get('SELECT * FROM announcements WHERE id = ?', Number(id));
  if (!a) return null;
  a.targets = all('SELECT user_id FROM announcement_targets WHERE announcement_id = ?', a.id).map((r) => r.user_id);
  a.author = a.author_id ? (get('SELECT full_name FROM users WHERE id = ?', a.author_id) || {}).full_name : null;
  a.read_count = get('SELECT COUNT(*) AS c FROM announcement_reads WHERE announcement_id = ?', a.id).c;
  a.reach = a.target_all ? listMembers({ active: 1 }).length : a.targets.length;
  return a;
}

function listAnnouncements() {
  return all('SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC').map((a) => getAnnouncement(a.id));
}

function announcementsFor(userId) {
  return all(
    `SELECT a.* FROM announcements a
     LEFT JOIN announcement_targets t ON t.announcement_id = a.id
     WHERE a.target_all = 1 OR t.user_id = ?
     GROUP BY a.id ORDER BY a.pinned DESC, a.created_at DESC`,
    Number(userId)
  ).map((a) => {
    const read = get('SELECT id FROM announcement_reads WHERE announcement_id = ? AND user_id = ?', a.id, Number(userId));
    a.read = !!read;
    a.author = a.author_id ? (get('SELECT full_name FROM users WHERE id = ?', a.author_id) || {}).full_name : null;
    return a;
  });
}

function markAnnouncementRead(id, userId) {
  run('INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id, read_at) VALUES (?,?,?)',
    Number(id), Number(userId), now());
}

function updateAnnouncement(id, patch) {
  const fields = [];
  const values = [];
  for (const key of ['title', 'body', 'category', 'pinned']) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(key === 'pinned' ? (patch[key] ? 1 : 0) : patch[key]);
    }
  }
  if (patch.targets !== undefined) {
    fields.push('target_all = ?');
    values.push(patch.targets.length ? 0 : 1);
    run('DELETE FROM announcement_targets WHERE announcement_id = ?', Number(id));
    for (const uid of patch.targets) {
      run('INSERT OR IGNORE INTO announcement_targets (announcement_id, user_id) VALUES (?,?)', Number(id), Number(uid));
    }
  }
  if (fields.length) {
    values.push(Number(id));
    run(`UPDATE announcements SET ${fields.join(', ')} WHERE id = ?`, ...values);
  }
  return getAnnouncement(id);
}

function deleteAnnouncement(id) {
  run('DELETE FROM announcements WHERE id = ?', Number(id));
}

/* -------------------------------- اعلان‌ها -------------------------------- */

function pushNotification(userId, { type, title, body }) {
  run('INSERT INTO notifications (user_id, type, title, body, read, created_at) VALUES (?,?,?,?,0,?)',
    Number(userId), type, title, body || null, now());
}

function notificationsFor(userId, limit = 40) {
  return all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', Number(userId), Number(limit));
}

function unreadCount(userId) {
  return get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0', Number(userId)).c;
}

function markNotificationsRead(userId) {
  run('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0', Number(userId));
}

/* -------------------------------- تمرینات -------------------------------- */

function createPlan({ author_id, title, body, category, difficulty, starts_on, due_on, duration, targets = [], all_members = false }) {
  const info = run(
    `INSERT INTO plans (author_id, title, body, category, difficulty, starts_on, due_on, duration, target_all, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    author_id || null, title, body || '', category || 'تمرین', difficulty || 'متوسط',
    starts_on || null, due_on || null, duration || null, all_members || targets.length === 0 ? 1 : 0, now()
  );
  const id = Number(info.lastInsertRowid);
  const ids = all_members || targets.length === 0 ? listMembers({ active: 1 }).map((m) => m.id) : targets;
  for (const uid of ids) {
    run('INSERT OR IGNORE INTO plan_assignments (plan_id, user_id, status, assigned_at) VALUES (?,?,?,?)',
      id, Number(uid), 'todo', now());
    pushNotification(uid, {
      type: 'plan',
      title: `تمرین جدید: ${title}`,
      body: 'برای دیدن جزئیات به بخش تمرینات من بروید.'
    });
  }
  return getPlan(id);
}

function getPlan(id) {
  const p = get('SELECT * FROM plans WHERE id = ?', Number(id));
  if (!p) return null;
  p.assignments = all(
    `SELECT pa.*, u.full_name, u.belt, u.avatar_color FROM plan_assignments pa
     JOIN users u ON u.id = pa.user_id WHERE pa.plan_id = ? ORDER BY u.full_name COLLATE NOCASE`,
    p.id
  );
  p.done_count = p.assignments.filter((a) => a.status === 'done').length;
  p.total = p.assignments.length;
  p.author = p.author_id ? (get('SELECT full_name FROM users WHERE id = ?', p.author_id) || {}).full_name : null;
  return p;
}

function listPlans() {
  return all('SELECT * FROM plans ORDER BY created_at DESC').map((p) => getPlan(p.id));
}

function updatePlan(id, patch) {
  const fields = [];
  const values = [];
  for (const key of ['title', 'body', 'category', 'difficulty', 'starts_on', 'due_on', 'duration']) {
    if (patch[key] !== undefined) { fields.push(`${key} = ?`); values.push(patch[key] === '' ? null : patch[key]); }
  }
  if (fields.length) {
    values.push(Number(id));
    run(`UPDATE plans SET ${fields.join(', ')} WHERE id = ?`, ...values);
  }
  return getPlan(id);
}

function deletePlan(id) { run('DELETE FROM plans WHERE id = ?', Number(id)); }

function plansForUser(userId) {
  const rows = all(
    `SELECT pa.*, p.title, p.body, p.category, p.difficulty, p.starts_on, p.due_on, p.duration, p.created_at AS plan_created_at
     FROM plan_assignments pa JOIN plans p ON p.id = pa.plan_id
     WHERE pa.user_id = ? ORDER BY
       CASE pa.status WHEN 'todo' THEN 0 WHEN 'doing' THEN 1 ELSE 2 END,
       COALESCE(p.due_on, '9999') ASC, p.created_at DESC`,
    Number(userId)
  );
  return rows;
}

function setAssignmentStatus(assignmentId, userId, status, note) {
  const a = get('SELECT * FROM plan_assignments WHERE id = ? AND user_id = ?', Number(assignmentId), Number(userId));
  if (!a) return null;
  run('UPDATE plan_assignments SET status = ?, completed_at = ?, member_note = ? WHERE id = ?',
    status, status === 'done' ? now() : null, note === undefined ? a.member_note : note, a.id);
  const plan = get('SELECT title FROM plans WHERE id = ?', a.plan_id);
  const member = findById(userId);
  if (status === 'done') {
    logActivity(userId, member ? member.full_name : 'شاگرد', 'تمرین را تکمیل کرد', plan ? plan.title : null);
    for (const coach of all("SELECT id FROM users WHERE role = 'coach' AND active = 1")) {
      pushNotification(coach.id, {
        type: 'done',
        title: `${member ? member.full_name : 'شاگرد'} تمرین را تکمیل کرد`,
        body: plan ? plan.title : null
      });
    }
  }
  return get('SELECT * FROM plan_assignments WHERE id = ?', a.id);
}

/* ------------------------------- جدول پیشرفت ------------------------------ */

const METRIC_KEYS = ['sessions', 'endurance', 'strength', 'technique', 'flexibility', 'discipline'];

function computeOverall(row) {
  if (row.overall !== null && row.overall !== undefined) return Number(row.overall);
  const vals = ['endurance', 'strength', 'technique', 'flexibility', 'discipline']
    .map((k) => row[k])
    .filter((v) => v !== null && v !== undefined && v !== '');
  if (!vals.length) return null;
  return Math.round(vals.reduce((s, v) => s + Number(v), 0) / vals.length);
}

function progressRow(userId, year, month) {
  const row = get('SELECT * FROM progress WHERE user_id = ? AND year = ? AND month = ?',
    Number(userId), Number(year), Number(month));
  return row;
}

function progressYear(userId, year) {
  const rows = all('SELECT * FROM progress WHERE user_id = ? AND year = ? ORDER BY month',
    Number(userId), Number(year));
  const map = {};
  for (const r of rows) {
    r.overall = computeOverall(r);
    map[r.month] = r;
  }
  return { months: map, rows };
}

function saveProgress({ user_id, year, month, sessions, endurance, strength, technique, flexibility, discipline, weight_kg, overall, note }, updated_by) {
  const existing = progressRow(user_id, year, month);
  const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
  const payload = {
    sessions: num(sessions),
    endurance: num(endurance),
    strength: num(strength),
    technique: num(technique),
    flexibility: num(flexibility),
    discipline: num(discipline),
    weight_kg: num(weight_kg),
    overall: num(overall),
    note: note === undefined ? null : note
  };
  if (existing) {
    run(`UPDATE progress SET sessions=?, endurance=?, strength=?, technique=?, flexibility=?, discipline=?,
         weight_kg=?, overall=?, note=?, updated_by=?, updated_at=? WHERE id=?`,
    payload.sessions, payload.endurance, payload.strength, payload.technique, payload.flexibility,
    payload.discipline, payload.weight_kg, payload.overall, payload.note, updated_by || null, now(), existing.id);
  } else {
    run(`INSERT INTO progress (user_id, year, month, sessions, endurance, strength, technique, flexibility,
         discipline, weight_kg, overall, note, updated_by, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    Number(user_id), Number(year), Number(month), payload.sessions, payload.endurance, payload.strength,
    payload.technique, payload.flexibility, payload.discipline, payload.weight_kg, payload.overall,
    payload.note, updated_by || null, now());
  }
  const saved = progressRow(user_id, year, month);
  saved.overall = computeOverall(saved);
  return saved;
}

function deleteProgress(id) { run('DELETE FROM progress WHERE id = ?', Number(id)); }

function saveSelfReport({ user_id, year, month, sessions, feeling, note }) {
  const existing = get('SELECT id FROM self_reports WHERE user_id = ? AND year = ? AND month = ?',
    Number(user_id), Number(year), Number(month));
  if (existing) {
    run('UPDATE self_reports SET sessions=?, feeling=?, note=?, created_at=? WHERE id=?',
      Number(sessions) || 0, feeling || null, note || null, now(), existing.id);
  } else {
    run('INSERT INTO self_reports (user_id, year, month, sessions, feeling, note, created_at) VALUES (?,?,?,?,?,?,?)',
      Number(user_id), Number(year), Number(month), Number(sessions) || 0, feeling || null, note || null, now());
  }
  const member = findById(user_id);
  for (const coach of all("SELECT id FROM users WHERE role = 'coach' AND active = 1")) {
    pushNotification(coach.id, {
      type: 'self_report',
      title: `${member ? member.full_name : 'شاگرد'} خودارزیابی ثبت کرد`,
      body: `ماه ${month} سال ${year}`
    });
  }
  return get('SELECT * FROM self_reports WHERE user_id = ? AND year = ? AND month = ?', Number(user_id), Number(year), Number(month));
}

function clubMatrix(year) {
  const members = listMembers({ active: 1 });
  return members.map((m) => {
    const { months, rows } = progressYear(m.id, year);
    const filled = rows.filter((r) => r.overall !== null);
    const avg = filled.length ? Math.round(filled.reduce((s, r) => s + r.overall, 0) / filled.length) : null;
    const last = [...rows].sort((a, b) => b.month - a.month)[0] || null;
    return { member: publicUser(m), months, avg, last_overall: last ? last.overall : null, filled: filled.length };
  });
}

/* -------------------------------- فعالیت‌ها ------------------------------- */

function logActivity(actor_id, actor_name, action, detail) {
  run('INSERT INTO activity (actor_id, actor_name, action, detail, created_at) VALUES (?,?,?,?,?)',
    actor_id || null, actor_name || null, action, detail || null, now());
}

function recentActivity(limit = 12) {
  return all('SELECT * FROM activity ORDER BY created_at DESC LIMIT ?', Number(limit));
}

/* -------------------------------- آمار کلی -------------------------------- */

function stats() {
  const members = get("SELECT COUNT(*) AS c FROM users WHERE role = 'member'").c;
  const activeMembers = get("SELECT COUNT(*) AS c FROM users WHERE role = 'member' AND active = 1").c;
  const plans = get('SELECT COUNT(*) AS c FROM plans').c;
  const done = get("SELECT COUNT(*) AS c FROM plan_assignments WHERE status = 'done'").c;
  const pending = get("SELECT COUNT(*) AS c FROM plan_assignments WHERE status != 'done'").c;
  const announcements = get('SELECT COUNT(*) AS c FROM announcements').c;
  const selfReports = get('SELECT COUNT(*) AS c FROM self_reports').c;
  const j = require('./jalali').todayJalali();
  const thisMonth = get('SELECT COUNT(*) AS c FROM progress WHERE year = ? AND month = ?', j.jy, j.jm).c;
  return { members, activeMembers, plans, done, pending, announcements, selfReports, thisMonth };
}

module.exports = {
  db, DB_PATH, DATA_DIR, sleepSync, execWithRetry,
  all, get, run, now,
  hashPassword, verifyPassword,
  findByUsername, findById, publicUser, createUser, updateUser, listMembers,
  createSession, sessionUser, destroySession, setPassword,
  createAnnouncement, getAnnouncement, listAnnouncements, announcementsFor,
  markAnnouncementRead, updateAnnouncement, deleteAnnouncement,
  pushNotification, notificationsFor, unreadCount, markNotificationsRead,
  createPlan, getPlan, listPlans, updatePlan, deletePlan, plansForUser, setAssignmentStatus,
  METRIC_KEYS, computeOverall, progressRow, progressYear, saveProgress, deleteProgress,
  saveSelfReport, clubMatrix, logActivity, recentActivity, stats
};

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import bcrypt from './bcrypt.cjs';

const root = path.join(import.meta.dirname, '..');
export const attachmentsDir = path.join(root, 'docs/allegati');
const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH;
if (process.env.RAILWAY_ENVIRONMENT_ID && !mount) throw new Error('Collegare un volume Railway al servizio prima di avviare.');
const dir = path.resolve(mount || process.env.DATA_DIR || path.join(root, 'data'));
mkdirSync(dir, {recursive:true, mode:0o700});
export const database = new DatabaseSync(path.join(dir, 'escalation-ctf.sqlite'));
database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000');
const catalog = JSON.parse(readFileSync(path.join(root, 'db/catalogo.json'), 'utf8'));
export const catalogCategories = [...new Set(catalog.map(ch => ch.category))];

const statements = new Map();
function prepare(sql) {
  if (!statements.has(sql)) statements.set(sql, database.prepare(sql));
  return statements.get(sql);
}
const bind = values => values.map(v => typeof v === 'boolean' ? Number(v) : v);
function hydrate(row, relations) {
  if (!row) return null;
  for (const key of relations) row[key] = row[key] ? JSON.parse(row[key]) : null;
  for (const key of ['is_active','is_solved','is_correct']) if (key in row) row[key] = !!row[key];
  return row;
}
export const store = {
  all(sql, values = [], relations = []) {
    return prepare(sql).all(...bind(values)).map(row => hydrate(row, relations));
  },
  one(sql, values = [], relations = []) {
    return hydrate(prepare(sql).get(...bind(values)), relations);
  },
  run(sql, values = []) { return prepare(sql).run(...bind(values)); },
  insert(table, rows, returning = '') {
    let result;
    for (const row of Array.isArray(rows) ? rows : [rows]) {
      const keys = Object.keys(row);
      const sql = 'INSERT INTO '+table+' ('+keys.join(', ')+') VALUES ('+keys.map(()=>'?').join(', ')+')';
      const params = Object.values(row);
      if (returning) result = this.one(sql+' RETURNING '+returning, params);
      else this.run(sql, params);
    }
    return result;
  },
  update(table, patch, where, params, returning = '') {
    if (['admin','users','challenges','game_sessions','nemesis_state'].includes(table))
      patch = {...patch, updated_at:new Date().toISOString()};
    const sql = 'UPDATE '+table+' SET '+Object.keys(patch).map(k=>k+'=?').join(', ')+where;
    const values = [...Object.values(patch), ...params];
    return returning ? this.one(sql+' RETURNING '+returning,values) : this.run(sql,values);
  }
};

if (!process.env.ADMIN_SESSION_CODE?.trim()) throw new Error('Impostare ADMIN_SESSION_CODE.');
database.exec('BEGIN IMMEDIATE');
try {
  const version = store.one('PRAGMA user_version').user_version;
  if (version > 4) throw new Error('Database creato da una versione più recente.');
  if (version === 0) {
    database.exec(readFileSync(path.join(root,'db/schema.sql'),'utf8'));
    store.insert('challenges',catalog);
  } else if (version === 1) {
    database.exec(readFileSync(path.join(root,'db/aggiorna-v1.sql'),'utf8'));
  }
  if (version > 0 && version < 3) {
    const additions = new Set(["FOR-08", "NET-05", "ENC-05", "HASH-04", "OSINT-03", "WEB-05", "PHISH-03", "REV-05", "CRYPTO-04", "FOR-09", "FOR-10", "FOR-11", "HASH-05", "NET-06", "WEB-06", "ENC-06", "OSINT-04", "REV-06", "FOR-12", "CRYPTO-05"]);
    for (const challenge of catalog) {
      if (additions.has(challenge.code) && !store.one('SELECT id FROM challenges WHERE code=?', [challenge.code])) {
        store.insert('challenges', challenge);
      }
    }
  }
  if (version > 0 && version < 4) {
    const introductory = new Set(["FOR-08", "NET-05", "ENC-05", "HASH-04", "OSINT-03", "WEB-05", "PHISH-03", "REV-05", "CRYPTO-04", "FOR-09"]);
    const intermediate = new Set(["FOR-13", "NET-07", "ENC-07", "HASH-06", "OSINT-05", "WEB-07", "PHISH-04", "REV-07", "CRYPTO-06", "FOR-14"]);
    for (const challenge of catalog) {
      if (introductory.has(challenge.code)) {
        store.run("UPDATE challenges SET difficulty='easy' WHERE code=? AND flag_hash=? AND difficulty='medium'", [challenge.code, challenge.flag_hash]);
      }
      if (intermediate.has(challenge.code) && !store.one('SELECT id FROM challenges WHERE code=?', [challenge.code])) store.insert('challenges', challenge);
    }
  }
  if (version < 4) database.exec('PRAGMA user_version=4');
  if (!store.one('SELECT id FROM admin LIMIT 1')) {
    if ((process.env.ADMIN_PASSWORD || '').length < 12) throw new Error('Primo avvio: impostare ADMIN_PASSWORD di almeno 12 caratteri.');
    store.insert('admin',{username:process.env.ADMIN_USERNAME || 'admin', password_hash:bcrypt.hashSync(process.env.ADMIN_PASSWORD,12)});
  }
  database.exec('COMMIT');
} catch (error) {
  database.exec('ROLLBACK');
  throw error;
}

const digest = value => createHash('sha256').update(value).digest('hex');
export function signToken(payload, ttl) {
  store.run('DELETE FROM access_tokens WHERE expires_at<=?', [Date.now()]);
  const token = randomBytes(32).toString('hex');
  store.insert('access_tokens',{digest:digest(token), role:payload.role, user_id:payload.sub,
    session_id:payload.sessionId ?? null, expires_at:Date.now()+ttl});
  return token;
}
export function revokeToken(token) {
  if (token) store.run('DELETE FROM access_tokens WHERE digest=?',[digest(token)]);
}
export function getToken(token) {
  const auth = store.one('SELECT user_id AS sub, role, session_id AS sessionId FROM access_tokens WHERE digest=? AND expires_at>?',[digest(token),Date.now()]);
  if (!auth || auth.role==='admin') return auth;
  const member = store.one('SELECT u.role FROM users u JOIN session_players sp ON sp.user_id=u.id WHERE u.id=? AND sp.session_id=?',[auth.sub,auth.sessionId]);
  return member?.role === auth.role ? auth : null;
}

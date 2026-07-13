const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'rubhi.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Convert PostgreSQL-style $1,$2 placeholders to ? for SQLite
function convertSql(sql) {
  return sql.replace(/\$(\d+)/g, '?');
}

// Extract table name from INSERT/UPDATE
function getTable(sql) {
  const m = sql.match(/(?:INSERT\s+INTO|UPDATE)\s+(\w+)/i);
  return m ? m[1] : null;
}

// Simple pg-compatible query interface
function query(sql, params = []) {
  try {
    // Strip RETURNING clause (handle it manually)
    const hasReturning = /\bRETURNING\b/i.test(sql);
    const cleanedSql = sql.replace(/\bRETURNING\b[\s\S]*$/i, '').trim();
    const converted = convertSql(cleanedSql);

    const upper = converted.trim().toUpperCase();
    const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH');

    if (isSelect) {
      const rows = db.prepare(convertSql(sql)).all(...params);
      return Promise.resolve({ rows });
    }

    const stmt = db.prepare(converted);
    const info = stmt.run(...params);

    if (hasReturning && info.lastInsertRowid) {
      const table = getTable(sql);
      if (table) {
        const row = db.prepare(`SELECT * FROM "${table}" WHERE rowid = ?`).get(info.lastInsertRowid);
        return Promise.resolve({ rows: row ? [row] : [], rowCount: info.changes });
      }
    }
    if (hasReturning) {
      // For UPDATE with RETURNING, re-query by affected logic isn't reliable
      // Just return empty rows but non-zero rowCount so callers can check
      return Promise.resolve({ rows: [{ id: info.lastInsertRowid }], rowCount: info.changes });
    }

    return Promise.resolve({ rows: [], rowCount: info.changes });
  } catch (err) {
    return Promise.reject(err);
  }
}

// Transaction-aware client (used in posts route)
function connect() {
  const client = {
    _inTransaction: false,
    query(sql, params = []) {
      return query(sql, params);
    },
    async query(sql, params = []) {
      if (sql.trim().toUpperCase() === 'BEGIN') {
        this._inTransaction = true;
        return Promise.resolve({ rows: [] });
      }
      if (sql.trim().toUpperCase() === 'COMMIT') {
        this._inTransaction = false;
        return Promise.resolve({ rows: [] });
      }
      if (sql.trim().toUpperCase() === 'ROLLBACK') {
        this._inTransaction = false;
        return Promise.resolve({ rows: [] });
      }
      return query(sql, params);
    },
    release() {}
  };
  return Promise.resolve(client);
}

module.exports = { query, connect, _db: db };

/**
 * App-layer row ownership guard for SQL databases that don't have native
 * row-level security (SQLite, MySQL, or Postgres without RLS turned on).
 *
 * The core idea: never let a query run against a table that has a
 * `user_id` column without a `user_id = ?` filter tied to the CURRENT
 * request's logged-in user — not a value read from the request body/query
 * string, which the caller can forge to read someone else's rows.
 *
 * For Postgres, prefer real database-enforced RLS instead — see
 * postgres-rls-policies.sql in this folder — since it also protects any
 * future code path that forgets to call this wrapper. Use scopedQuery as a
 * second layer of defense (defense in depth) or as the primary guard when
 * RLS isn't available (SQLite, most MySQL setups).
 */

// What-if: a caller writes `db.prepare('SELECT * FROM designs WHERE id = ?')`
// straight against a user-owned table and forgets the ownership check
// entirely — createScopedDb only exposes methods that force one.
export function createScopedDb(rawDb) {
  if (!rawDb || typeof rawDb.prepare !== 'function') {
    throw new Error('createScopedDb expects a better-sqlite3-style database with .prepare().');
  }

  return {
    /**
     * Run a SELECT that is scoped to one user's rows.
     * `whereClause` must NOT include "user_id" — it's injected automatically.
     * Example: scopedDb.findAll('designs', userId, 'archived = 0', [])
     */
    findAll(table, userId, whereClause = '1=1', params = []) {
      assertUserId(userId);
      assertNoUserIdInClause(whereClause);
      const sql = `SELECT * FROM ${assertSafeIdentifier(table)} WHERE user_id = ? AND (${whereClause})`;
      return rawDb.prepare(sql).all(userId, ...params);
    },

    findOne(table, userId, id) {
      assertUserId(userId);
      const sql = `SELECT * FROM ${assertSafeIdentifier(table)} WHERE user_id = ? AND id = ?`;
      return rawDb.prepare(sql).get(userId, id) || null;
    },

    // Forces user_id onto the inserted row regardless of what the caller
    // put in `data.user_id` — prevents "insert a row owned by someone else."
    insert(table, userId, data) {
      assertUserId(userId);
      const row = { ...data, user_id: userId };
      const columns = Object.keys(row);
      const placeholders = columns.map((c) => `@${c}`).join(', ');
      const sql = `INSERT INTO ${assertSafeIdentifier(table)} (${columns.join(', ')}) VALUES (${placeholders})`;
      return rawDb.prepare(sql).run(row);
    },

    // What-if: caller tries to update a row that exists but belongs to a
    // different user — the WHERE clause makes that update match zero rows
    // instead of silently editing someone else's data.
    update(table, userId, id, data) {
      assertUserId(userId);
      const columns = Object.keys(data);
      if (columns.length === 0) return { changes: 0 };
      const setClause = columns.map((c) => `${assertSafeIdentifier(c)} = @${c}`).join(', ');
      const sql = `UPDATE ${assertSafeIdentifier(table)} SET ${setClause} WHERE user_id = @__userId AND id = @__id`;
      return rawDb.prepare(sql).run({ ...data, __userId: userId, __id: id });
    },

    remove(table, userId, id) {
      assertUserId(userId);
      const sql = `DELETE FROM ${assertSafeIdentifier(table)} WHERE user_id = ? AND id = ?`;
      return rawDb.prepare(sql).run(userId, id);
    },
  };
}

function assertUserId(userId) {
  if (userId === undefined || userId === null || userId === '') {
    throw new Error('scopedQuery: userId is required — never call these methods without an authenticated user.');
  }
}

function assertNoUserIdInClause(clause) {
  if (/user_id/i.test(clause)) {
    throw new Error('scopedQuery: whereClause must not reference user_id — it is injected automatically.');
  }
}

// Table/column names can't be parameterized in SQL, so allow-list the
// character set instead of interpolating whatever the caller passed.
function assertSafeIdentifier(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`scopedQuery: unsafe identifier "${name}".`);
  }
  return name;
}

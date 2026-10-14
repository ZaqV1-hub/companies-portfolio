import session from 'express-session';

export class MySQLSessionStore extends session.Store {
  constructor(pool) {
    super();
    this.pool = pool;
    this.cleanupTimer = setInterval(() => {
      this.pool.execute('DELETE FROM sessions WHERE expires < ?', [Math.floor(Date.now() / 1000)]).catch((error) => console.error(`Session cleanup failed: ${error.message}`));
    }, 15 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  get(id, callback) {
    this.pool.execute('SELECT data, expires FROM sessions WHERE session_id=?', [id]).then(([rows]) => {
      if (!rows.length || rows[0].expires < Math.floor(Date.now() / 1000)) return callback(null, null);
      callback(null, JSON.parse(rows[0].data));
    }).catch(callback);
  }

  set(id, value, callback = () => {}) {
    const expires = value.cookie?.expires ? Math.floor(new Date(value.cookie.expires).getTime() / 1000) : Math.floor(Date.now() / 1000) + 28800;
    this.pool.execute('INSERT INTO sessions (session_id,expires,data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE expires=VALUES(expires),data=VALUES(data)',
      [id, expires, JSON.stringify(value)]).then(() => callback()).catch(callback);
  }

  touch(id, value, callback = () => {}) {
    const expires = value.cookie?.expires ? Math.floor(new Date(value.cookie.expires).getTime() / 1000) : Math.floor(Date.now() / 1000) + 28800;
    this.pool.execute('UPDATE sessions SET expires=? WHERE session_id=?', [expires, id]).then(() => callback()).catch(callback);
  }

  destroy(id, callback = () => {}) {
    this.pool.execute('DELETE FROM sessions WHERE session_id=?', [id]).then(() => callback()).catch(callback);
  }

  close() { clearInterval(this.cleanupTimer); }
}

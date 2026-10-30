import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createPool } from './connection.js';

const destination = process.argv[2];
if (!destination || path.extname(destination) !== '.gz') throw new Error('Expected a .gz backup destination');
const pool = createPool();
const db = await pool.getConnection();
try {
  const [[active]] = await db.query('SELECT DATABASE() AS name');
  if (active.name !== process.env.DB_NAME) throw new Error('Database does not match DB_NAME');
  const [tableRows] = await db.query('SHOW FULL TABLES WHERE Table_type = \'BASE TABLE\'');
  const names = tableRows.map((row) => Object.values(row)[0]);
  await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const tables = [];
  for (const name of names) {
    const [schema] = await db.query('SHOW CREATE TABLE ??', [name]);
    const [rows] = await db.query('SELECT * FROM ??', [name]);
    tables.push({ name, schema: schema[0]['Create Table'], rows });
  }
  await db.commit();
  const backup = { database:active.name, created_at:new Date().toISOString(), tables };
  await fs.writeFile(destination, gzipSync(JSON.stringify(backup)), { flag:'wx', mode:0o600 });
  console.log(`Database backup written: ${tables.length} tables`);
} catch (error) {
  await db.rollback().catch(() => {});
  throw error;
} finally {
  db.release();
  await pool.end();
}

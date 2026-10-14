import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './connection.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pool = createPool();
const connection = await pool.getConnection();

try {
  // Multi-valued JSON indexes require utf8mb4_0900_as_cs for string arrays;
  // the tables themselves keep the requested utf8mb4_unicode_ci collation.
  await connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_0900_as_cs');
  const [dbRows] = await connection.query('SELECT DATABASE() AS database_name, VERSION() AS version');
  const active = dbRows[0];
  if (active.database_name !== process.env.DB_NAME) throw new Error('Connected database does not match DB_NAME.');
  const [exists] = await connection.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [process.env.DB_NAME]);
  if (!exists.length) throw new Error(`Database ${process.env.DB_NAME} does not exist; migrations will not create it.`);
  console.log(`Database verified: ${active.database_name}; MySQL ${active.version}`);

  const migrationDir = path.join(here, 'migrations');
  const files = (await fs.readdir(migrationDir)).filter((name) => /^\d+_[\w-]+\.sql$/.test(name)).sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    const [rows] = await connection.execute('SELECT version FROM schema_migrations WHERE version = ?', [version]).catch(async (error) => {
      if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
      return [[], []];
    });
    if (rows.length) continue;
    const sql = await fs.readFile(path.join(migrationDir, file), 'utf8');
    for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean)) {
      await connection.query(statement);
    }
    await connection.execute('INSERT INTO schema_migrations (version, applied_at) VALUES (?, UTC_TIMESTAMP())', [version]);
    console.log(`Applied ${version}`);
  }
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}

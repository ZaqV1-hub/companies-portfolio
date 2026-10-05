import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { createPool, jsonColumn, mysqlDate } from './connection.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/seed');
const pool = createPool();
const order = ['organizations', 'projects', 'institutions', 'contacts', 'users', 'profile_versions', 'form_imports', 'relationships', 'interactions', 'consents', 'settings', 'email_outbox'];
const jsonFields = new Set(['description', 'segments', 'partnership_types', 'leadership', 'gallery', 'focal_point', 'summary', 'fields', 'reviewed_steps', 'investor_profile', 'sectors', 'deal_expectation', 'suggested', 'npia', 'apex_control', 'deadlines', 'goals', 'origins', 'apex_strategic_categories', 'holidays', 'data']);
const dateFields = new Set(['last_approved_at', 'last_updated_at', 'invited_at', 'date', 'launch_date', 'contact_request_at']);
const datetimeFields = new Set(['created_at', 'updated_at', 'submitted_at', 'reviewed_at', 'approved_at', 'email_verified_at', 'terms_accepted_at', 'privacy_accepted_at', 'accepted_at', 'validated_at', 'applied_at']);

function normalize(table, row) {
  const value = { ...row };
  if (table === 'users') {
    if (!value.password_hash && value.password) value.password_hash = bcrypt.hashSync(String(value.password), 12);
    delete value.password;
    if (!value.password_hash) value.password_hash = bcrypt.hashSync(`disabled-${value.id}`, 12);
    value.email_verified_at = value.email_verified_at || null;
    value.created_at = value.created_at || new Date().toISOString();
    value.is_demo = true;
    delete value.demo;
  }
  for (const key of Object.keys(value)) {
    if (jsonFields.has(key)) value[key] = jsonColumn(value[key]);
    else if (dateFields.has(key) || datetimeFields.has(key)) value[key] = mysqlDate(value[key]);
    else if (value[key] && typeof value[key] === 'object') value[key] = jsonColumn(value[key]);
  }
  return value;
}

try {
  const [dbRows] = await pool.query('SELECT DATABASE() AS database_name');
  if (dbRows[0].database_name !== process.env.DB_NAME) throw new Error('Connected database does not match DB_NAME.');
  const [schema] = await pool.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [process.env.DB_NAME]);
  if (!schema.length) throw new Error(`Database ${process.env.DB_NAME} does not exist; seed will not create it.`);
  const [migrations] = await pool.execute("SELECT version FROM schema_migrations WHERE version = '001_initial_schema'").catch(() => [[]]);
  if (!migrations.length) throw new Error('Run database migrations before seeding.');

  const reset = process.argv.includes('--reset-demo');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (reset) {
      for (const table of [...order].reverse()) await connection.query(`DELETE FROM \`${table}\``);
    }
    for (const table of order) {
      const json = JSON.parse(await fs.readFile(path.join(root, `${table}.json`), 'utf8'));
      for (const raw of json) {
        const row = normalize(table, raw);
        const columns = Object.keys(row);
        const values = columns.map((key) => row[key]);
        const updates = columns.filter((key) => key !== 'id').map((key) => `\`${key}\`=VALUES(\`${key}\`)`).join(', ');
        const sql = `INSERT INTO \`${table}\` (${columns.map((key) => `\`${key}\``).join(',')}) VALUES (${columns.map(() => '?').join(',')}) ON DUPLICATE KEY UPDATE ${updates || '`id`=VALUES(`id`)'}`;
        await connection.execute(sql, values);
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  console.log(`Seed completed for ${process.env.DB_NAME}; demo records retained.`);
} catch (error) {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

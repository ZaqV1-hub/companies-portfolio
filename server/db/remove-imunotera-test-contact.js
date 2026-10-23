import fs from 'node:fs/promises';
import path from 'node:path';
import { createPool } from './connection.js';

const id = 'r-b30a7798-8b6b-4a6b-b4cd-747229a63a32';
const pool = createPool();
const db = await pool.getConnection();
try {
  if (process.env.DB_NAME !== 'companiesportfolio_test') throw new Error('Wrong database');
  await db.beginTransaction();
  const [rows] = await db.execute(`SELECT r.*,c.name AS contact_name,c.email AS contact_email
    FROM relationships r JOIN contacts c ON c.id=r.contact_id WHERE r.id=? FOR UPDATE`, [id]);
  if (rows.length !== 1) throw new Error('Expected exactly one relationship');
  const record = rows[0];
  if (record.organization_id !== 'imunotera' || record.contact_name !== 'Isaque Viana'
      || record.origin !== 'Portfólio' || record.contact_request_at !== '2026-10-23'
      || record.created_at?.slice(0, 10) !== '2026-10-23') throw new Error('Relationship no longer matches the test request');
  const [interactions] = await db.execute('SELECT * FROM interactions WHERE relationship_id=? FOR UPDATE', [id]);
  if (interactions.length !== 1 || !interactions[0].auto || interactions[0].description !== 'Pedido de contato pela plataforma')
    throw new Error('Test request was subsequently edited');
  const [outbox] = await db.execute("SELECT * FROM email_outbox WHERE JSON_UNQUOTE(JSON_EXTRACT(data,'$.relationship_id'))=?", [id]);
  const backup = path.join('C:\\Sites\\AzureIIS\\backups', `companiesportfolio-test-contact-${id}.json`);
  await fs.writeFile(backup, JSON.stringify({ record, interactions, outbox }, null, 2), { flag: 'wx' });
  await db.execute("DELETE FROM email_outbox WHERE JSON_UNQUOTE(JSON_EXTRACT(data,'$.relationship_id'))=? AND sent=0", [id]);
  const [result] = await db.execute('DELETE FROM relationships WHERE id=?', [id]);
  if (result.affectedRows !== 1) throw new Error('Relationship was not removed');
  await db.commit();
  console.log(JSON.stringify({ removed_relationships: 1, removed_interactions: interactions.length, retained_investor_account: true, backup_created: true }));
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  db.release();
  await pool.end();
}

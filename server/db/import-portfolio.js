// Explicit, one-off portfolio reconciliation. Never seeds users or queues email.
// Call backup.js before --apply. Input and audit files stay outside the web root.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { createPool, jsonColumn, mysqlDate } from './connection.js';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('--'));
if (!input) throw new Error('Provide the reviewed portfolio JSON file.');
const payload = JSON.parse(await fs.readFile(input, 'utf8'));
const apply = args.includes('--apply');
const refresh = args.includes('--refresh-content');
if (payload.batch !== 'launch-20261106' || payload.organizations.length !== 32 || payload.projects.length !== 38)
  throw new Error('Unexpected reconciliation batch or counts.');
const orgIds = new Set(payload.organizations.map((org) => org.id));
const projectIds = new Set(payload.projects.map((project) => project.id));
if (orgIds.size !== 32 || projectIds.size !== 38 || payload.projects.some((p) => !orgIds.has(p.organization_id)))
  throw new Error('Duplicate or orphaned portfolio records.');
for (const project of payload.projects) {
  if (project.fields._source) throw new Error('Private source metadata must not enter public project fields.');
  if ((project.fields.pipeline || []).some((item) => !item?.name || !item.indication || Array.isArray(item)))
    throw new Error('Pipeline entries must have named object fields.');
  for (const item of [...(project.fields.rounds || []), ...(project.fields.raised || [])])
    if (!Number.isSafeInteger(item.amount_usd) || item.amount_usd < 0) throw new Error('Expected nonnegative whole USD values.');
}
const recipients = payload.organizations.map((o) => o.invitation_email).filter(Boolean);
if (new Set(recipients).size !== recipients.length || recipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
  throw new Error('Duplicate or invalid invitation recipients.');
if (payload.organizations.some((o) => o.public_state !== 'hidden' || o.last_approved_at || o.demo))
  throw new Error('Imported profiles must await validation outside the public directory.');

const pool = createPool();
const db = await pool.getConnection();
try {
  await db.beginTransaction();
  const [[database]] = await db.query('SELECT DATABASE() name');
  if (database.name !== 'companiesportfolio_test') throw new Error('Unexpected database.');
  const [existing] = await db.query('SELECT id,name,demo FROM organizations ORDER BY id FOR UPDATE');
  const existingIds = existing.map((o) => o.id).sort();
  if (JSON.stringify(existingIds) !== JSON.stringify((refresh ? [...orgIds] : payload.expectedExistingIds).slice().sort()))
    throw new Error('Organization list changed since reconciliation; inspect before applying.');
  const removal = existing.filter((o) => payload.remove.includes(o.id));
  if (removal.length !== (refresh ? 0 : 9) || removal.some((o) => !o.demo || orgIds.has(o.id)))
    throw new Error('Removal is limited to the nine reviewed demonstration companies.');
  const [recipientAccounts] = await db.query('SELECT id,email FROM users WHERE email_normalized IN (?)', [recipients]);
  if (recipientAccounts.length) throw new Error('Invitation recipient already owns an account; review before import.');
  const [beforeMail] = await db.query('SELECT COUNT(*) count FROM email_outbox');
  const counts = { companies:32,projects:38,removeCompanies:removal.map((o) => o.name),missingEmail:payload.organizations.filter((o) => !o.invitation_email).map((o) => o.name) };
  if (!apply) {
    await db.rollback();
    console.log(JSON.stringify({ dryRun:true,...counts }));
  } else {
    const affected = [...orgIds, ...payload.remove];
    const [outbox] = await db.query('SELECT id,data FROM email_outbox WHERE sent=0');
    let disabledEmails = 0;
    for (const item of outbox) {
      const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
      if (affected.includes(data?.organization_id)) {
        await db.execute('UPDATE email_outbox SET ready_to_send=0,last_error=? WHERE id=?', ['Superseded by portfolio reconciliation; no invitations authorised',item.id]);
        disabledEmails++;
      }
    }
    // Expire old test invitations and remove obsolete drafts/approval snapshots.
    await db.query('DELETE FROM company_invitations WHERE organization_id IN (?)',[affected]);
    await db.query('DELETE FROM profile_versions WHERE organization_id IN (?)',[affected]);
    await db.query('DELETE FROM form_imports WHERE organization_id IN (?)',[affected]);
    await db.query('DELETE FROM relationships WHERE organization_id IN (?)',[payload.remove]);
    await db.query('DELETE FROM users WHERE role=? AND organization_id IN (?)',['company_user',payload.remove]);
    await db.query('DELETE FROM organizations WHERE id IN (?)',[payload.remove]);
    const jsonFields = new Set(['description','segments','partnership_types','leadership','gallery','focal_point','custom_tags']);
    const dateFields = new Set(['created_at','last_approved_at','last_updated_at','invited_at']);
    const [columns] = await db.query('SHOW COLUMNS FROM organizations');
    const available = new Set(columns.map((c) => c.Field));
    for (const org of payload.organizations) {
      const keys = Object.keys(org).filter((key) => available.has(key));
      const values = keys.map((key) => jsonFields.has(key) ? jsonColumn(org[key]) : dateFields.has(key) ? mysqlDate(org[key]) : org[key]);
      await db.query('INSERT INTO organizations (??) VALUES (?) ON DUPLICATE KEY UPDATE '+keys.filter((key) => key !== 'id').map((key) => '`'+key+'`=VALUES(`'+key+'`)').join(','),[keys,values]);
    }
    for (const orgId of orgIds) {
      const keep = payload.projects.filter((p) => p.organization_id === orgId).map((p) => p.id);
      await db.query('DELETE FROM projects WHERE organization_id=? AND id NOT IN (?)',[orgId,keep]);
    }
    for (const p of payload.projects) await db.execute('INSERT INTO projects (id,organization_id,profile_type,sort_order,summary,fields,demo) VALUES (?,?,?,?,?,?,0) ON DUPLICATE KEY UPDATE profile_type=VALUES(profile_type),sort_order=VALUES(sort_order),summary=VALUES(summary),fields=VALUES(fields),demo=0',
      [p.id,p.organization_id,p.profile_type,p.sort_order,jsonColumn(p.summary),jsonColumn(p.fields)]);
    for (const source of payload.imports) await db.execute('INSERT INTO form_imports (id,organization_id,project_id,field,mode,previous_answer,source_column) VALUES (?,?,?,?,?,?,?)',
      [source.id,source.organization_id,source.project_id,source.field,source.mode,source.previous_answer,source.source_column]);
    const [[orgCheck]] = await db.query('SELECT COUNT(*) count,SUM(public_state<>?) online FROM organizations',['hidden']);
    const [[projectCheck]] = await db.query('SELECT COUNT(*) count FROM projects');
    const [[afterMail]] = await db.query('SELECT COUNT(*) count FROM email_outbox');
    if (orgCheck.count !== 32 || Number(orgCheck.online) !== 0 || projectCheck.count !== 38 || beforeMail[0].count !== afterMail.count)
      throw new Error('Post-import reconciliation failed.');
    await db.commit();
    console.log(JSON.stringify({ applied:true,...counts,sourceCells:payload.imports.length,disabledEmails,newEmails:0,sha256:crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex') }));
  }
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  db.release();
  await pool.end();
}

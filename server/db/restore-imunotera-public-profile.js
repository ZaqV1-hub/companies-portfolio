import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './connection.js';

const seedFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/seed');
const [organizationsSeed, projectsSeed] = await Promise.all([
  fs.readFile(path.join(seedFolder, 'organizations.json'), 'utf8').then(JSON.parse),
  fs.readFile(path.join(seedFolder, 'projects.json'), 'utf8').then(JSON.parse),
]);
const original = organizationsSeed.find((item) => item.id === 'imunotera');
const originalProjects = projectsSeed.filter((item) => item.organization_id === 'imunotera');
if (!original || originalProjects.length !== 1) throw new Error('Original profile is incomplete');
const fields = ['name','logo_url','cover_url','description','website','city','state','size','segments','partnership_types','leadership','gallery','focal_point'];
const jsonFields = new Set(['description','segments','partnership_types','leadership','gallery','focal_point']);
const pool = createPool();
const db = await pool.getConnection();
try {
  if (process.env.DB_NAME !== 'companiesportfolio_test') throw new Error('Wrong database');
  await db.beginTransaction();
  const [orgs] = await db.execute('SELECT * FROM organizations WHERE id=? FOR UPDATE', ['imunotera']);
  const [projects] = await db.execute('SELECT * FROM projects WHERE organization_id=? FOR UPDATE', ['imunotera']);
  const [versions] = await db.execute('SELECT id,kind,status,approved_at FROM profile_versions WHERE organization_id=?', ['imunotera']);
  if (orgs.length !== 1 || orgs[0].public_state !== 'published' || orgs[0].last_approved_at !== '2026-10-23'
      || projects.length !== 1 || projects[0].id !== originalProjects[0].id
      || versions.length !== 1 || versions[0].kind !== 'published' || versions[0].approved_at?.slice(0, 10) !== '2026-10-23')
    throw new Error('Publication changed since inspection');
  const backup = path.join('C:\\Sites\\AzureIIS\\backups', 'companiesportfolio-imunotera-before-restore-20261023.json');
  await fs.writeFile(backup, JSON.stringify({ organization: orgs[0], projects, versions }, null, 2), { flag: 'wx' });
  const columns = fields.map((key) => `\`${key}\`=?`).join(',');
  const values = fields.map((key) => jsonFields.has(key) ? JSON.stringify(original[key]) : original[key]);
  await db.execute(`UPDATE organizations SET ${columns},status=?,public_state=?,last_approved_at=?,last_updated_at=? WHERE id=?`,
    [...values, original.status, original.public_state, original.last_approved_at, original.last_updated_at, 'imunotera']);
  await db.execute('UPDATE projects SET profile_type=?,sort_order=?,summary=?,fields=? WHERE id=? AND organization_id=?',
    [originalProjects[0].profile_type, originalProjects[0].sort_order, JSON.stringify(originalProjects[0].summary),
      JSON.stringify(originalProjects[0].fields), originalProjects[0].id, 'imunotera']);
  await db.commit();
  console.log(JSON.stringify({ restored: 'imunotera', public_state: original.public_state, restored_approved_date: original.last_approved_at,
    restored_projects: 1, backup_created: true, approval_history_retained: true }));
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  db.release();
  await pool.end();
}

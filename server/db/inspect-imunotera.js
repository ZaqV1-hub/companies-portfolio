import { createPool } from './connection.js';

const pool = createPool();
try {
  if (process.env.DB_NAME !== 'companiesportfolio_test') throw new Error('Wrong database');
  const [orgs] = await pool.execute('SELECT id,public_state,last_approved_at,last_updated_at FROM organizations WHERE id=?', ['imunotera']);
  const [versions] = await pool.execute('SELECT id,kind,status,created_at,submitted_at,approved_at FROM profile_versions WHERE organization_id=? ORDER BY created_at', ['imunotera']);
  const [candidates] = await pool.execute(`SELECT r.id,r.origin,r.contact_request_at,r.created_at,c.name,c.email
    FROM relationships r JOIN contacts c ON c.id=r.contact_id
    WHERE r.organization_id='imunotera' AND (LOWER(c.name) LIKE '%isa%' OR LOWER(c.email) LIKE '%viana%')
    ORDER BY r.created_at DESC`);
  const mask = (email) => email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
  console.log(JSON.stringify({ organization:orgs[0],versions,candidates:candidates.map(({email,...rest}) => ({...rest,email:mask(email)})) }));
} finally { await pool.end(); }

// Review-only data import. Updates confirmed contacts and source-derived USD
// fields, preserving company drafts and never creating invitations or messages.
import fs from 'node:fs/promises';
import {createPool,jsonColumn} from './connection.js';
const file=process.argv.find((arg,index)=>index>1&&!arg.startsWith('--'));
if(!file)throw new Error('Provide the reviewed financial payload.');
const p=JSON.parse(await fs.readFile(file,'utf8'));
if(p.batch!=='financial-20261110'||p.contacts.length!==32||p.projectUpdates.length!==31)throw new Error('Unexpected review batch.');
const canonical=(x)=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
if(new Set(p.contacts.map(c=>c.email)).size!==32||p.contacts.some(c=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)))throw new Error('Invalid or duplicate recipient.');
for(const update of p.projectUpdates){
 for(const amount of [...(update.fields.rounds||[]),...(update.fields.raised||[])].map(x=>x.amount_usd))if(!Number.isSafeInteger(amount)||amount<0)throw new Error('USD amounts must be nonnegative whole numbers.');
}
const pool=createPool(),db=await pool.getConnection();
try{
 await db.beginTransaction();
 const [[database]]=await db.query('SELECT DATABASE() name');if(database.name!=='companiesportfolio_test')throw new Error('Wrong database.');
 const [orgs]=await db.query('SELECT id,name,invitation_email,focal_point FROM organizations ORDER BY id FOR UPDATE');
 if(!same(orgs.map(o=>o.id).sort(),p.expectedOrganizations))throw new Error('Organization list changed.');
 const [projects]=await db.query('SELECT id,fields FROM projects FOR UPDATE');
 for(const u of p.projectUpdates){const current=projects.find(q=>q.id===u.id);if(!current||!same(current.fields,u.before))throw new Error('Project changed during review: '+u.id);}
 for(const c of p.contacts){const current=orgs.find(o=>o.id===c.id);if(current.invitation_email!==c.previous_email||!same(current.focal_point,c.before_focal))throw new Error('Contact changed during review: '+c.id);}
 const [[beforeMail]]=await db.query('SELECT COUNT(*) count FROM email_outbox');
 const [[beforeInvite]]=await db.query('SELECT COUNT(*) count FROM company_invitations');
 const [[drafts]]=await db.query('SELECT COUNT(*) count FROM profile_versions');
 if(drafts.count)throw new Error('Company drafts exist; merge them explicitly instead of overwriting.');
 if(!process.argv.includes('--apply')){
  await db.rollback();console.log(JSON.stringify({dryRun:true,contacts:p.contacts.length,projects:p.projectUpdates.length,invitations:beforeInvite.count,newEmails:0}));
 }else{
  for(const c of p.contacts){
   const focal={...(c.before_focal||{}),name:c.responsible,email:c.email};
   await db.execute('UPDATE organizations SET invitation_email=?,focal_point=? WHERE id=?',[c.email,jsonColumn(focal),c.id]);
   await db.execute('INSERT INTO form_imports (id,organization_id,project_id,field,mode,previous_answer,source_column) VALUES (?,?,NULL,?,?,?,?) ON DUPLICATE KEY UPDATE previous_answer=VALUES(previous_answer)',
    ['contact20261110-'+c.id,c.id,'focal_point','prefilled',JSON.stringify({name:c.responsible,email:c.email}),c.source_cell]);
  }
  for(const u of p.projectUpdates)await db.execute('UPDATE projects SET fields=? WHERE id=?',[jsonColumn(u.fields),u.id]);
  for(const s of p.sources)await db.execute('INSERT INTO form_imports (id,organization_id,project_id,field,mode,previous_answer,source_column) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE previous_answer=VALUES(previous_answer)',[s.id,s.organization_id,s.project_id,s.field,s.mode,s.previous_answer,s.source_column]);
  const [[afterMail]]=await db.query('SELECT COUNT(*) count FROM email_outbox');const [[afterInvite]]=await db.query('SELECT COUNT(*) count FROM company_invitations');
  if(beforeMail.count!==afterMail.count||beforeInvite.count!==afterInvite.count)throw new Error('Unexpected message or invitation mutation.');
  await db.commit();console.log(JSON.stringify({applied:true,contacts:p.contacts.length,projects:p.projectUpdates.length,sourceRows:p.sources.length,newEmails:0,newInvitations:0}));
 }
}catch(e){await db.rollback();throw e;}finally{db.release();await pool.end();}

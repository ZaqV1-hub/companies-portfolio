import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import sharp from 'sharp';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import bcrypt from 'bcryptjs';
import { createPool, jsonColumn } from './db/connection.js';
import { MySQLSessionStore } from './db/mysql-session-store.js';
import { validateDraft } from '../src/lib/profileValidation.js';
import { businessDaysBetween } from '../src/lib/crm.js';

const pool = createPool();
const execFileAsync = promisify(execFile);
const app = express();
const port = Number(process.env.API_PORT || 4317);
const demoMode = process.env.DEMO_MODE === 'true';

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters.');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(session({
  name: 'cp.sid',
  secret: process.env.SESSION_SECRET,
  store: new MySQLSessionStore(pool),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: Number(process.env.SESSION_TTL_SECONDS || 28800) * 1000 },
}));
app.use('/api', (req,res,next) => {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method) || !req.get('origin')) return next();
  try { const expected=req.get('x-forwarded-host')||req.get('host');if (new URL(req.get('origin')).host.toLowerCase() !== String(expected).toLowerCase()) return res.status(403).json({ error:'origin_forbidden' }); }
  catch { return res.status(403).json({ error:'origin_forbidden' }); }
  next();
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false });

const PUBLIC_ORG_FIELDS = ['id', 'name', 'logo_url', 'cover_url', 'description', 'website', 'city', 'state', 'size', 'segments',
  'partnership_types', 'leadership', 'gallery', 'public_state', 'last_approved_at', 'is_featured'];

function publicOrg(row) {
  const result = {};
  for (const key of PUBLIC_ORG_FIELDS) result[key] = row[key] ?? null;
  return result;
}
function routeError(res, error) {
  console.error(error);
  res.status(500).json({ error: 'internal_error' });
}
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const user = await sessionUser(req);
      if (!user || !roles.includes(user.role)) return res.status(403).json({ error: 'forbidden' });
      req.user = user;
      next();
    } catch (error) { routeError(res, error); }
  };
}
function safeUser(row, orgName = null) {
  return { id: row.id, role: row.role, name: row.name, email: row.email, organization_id: row.organization_id || null,
    organization_name: orgName, email_verified: Boolean(row.email_verified_at) };
}
function localDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((item) => [item.type,item.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function completenessFor(contact, institution, relationship) {
  const fields = [contact.role,contact.linkedin,institution.investor_type,institution.niche,
    institution.ticket_min_musd != null || institution.ticket_max_musd != null ? 'x' : null,
    institution.interest_type,institution.sectors,institution.description_original || institution.description_pt,institution.website,relationship.origin,relationship.status];
  const names = ['role','linkedin','investor_type','niche','ticket','interest_type','sectors','description','website','origin','status'];
  const missing = names.filter((_,i) => fields[i] == null || fields[i] === '' || Array.isArray(fields[i]) && !fields[i].length);
  return { filled:names.length-missing.length,total:names.length,missing,pct:Math.round((names.length-missing.length)*100/names.length) };
}
function requestStateFor(relationship, interactions, holidays) {
  if (!relationship.contact_request_at || interactions.some((item) => !item.auto && String(item.date).slice(0,10) >= String(relationship.contact_request_at).slice(0,10))) return null;
  return { requested_at:relationship.contact_request_at,business_days:businessDaysBetween(String(relationship.contact_request_at).slice(0,10),localDate(),holidays || []) };
}
async function sessionUser(req) {
  if (!req.session.user?.id) return null;
  const [rows] = await pool.execute('SELECT u.*, o.name AS organization_name FROM users u LEFT JOIN organizations o ON o.id=u.organization_id WHERE u.id=?', [req.session.user.id]);
  return rows[0] || null;
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); } catch (error) { routeError(res, error); }
});

app.get('/api/public/organizations', async (_req, res) => {
  try {
    const [orgs] = await pool.query("SELECT * FROM organizations WHERE public_state IN ('published','provisional') ORDER BY is_featured DESC, name");
    if (!orgs.length) return res.json([]);
    const ids = orgs.map((org) => org.id);
    const [projects] = await pool.query(`SELECT id, organization_id, profile_type, sort_order, summary, fields FROM projects WHERE organization_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort_order`, ids);
    res.json(orgs.map((org) => ({ ...publicOrg(org), projects: projects.filter((project) => project.organization_id === org.id)
      .map(({ id, profile_type, summary, fields }) => ({ id, profile_type, summary, fields })) })));
  } catch (error) { routeError(res, error); }
});
app.get('/api/public/organizations/:id', async (req, res) => {
  try {
    const [orgs] = await pool.execute("SELECT * FROM organizations WHERE id=? AND public_state IN ('published','provisional')", [req.params.id]);
    if (!orgs.length) return res.status(404).json({ error: 'not_found' });
    const [projects] = await pool.execute('SELECT id, profile_type, sort_order, summary, fields FROM projects WHERE organization_id=? ORDER BY sort_order', [req.params.id]);
    res.json({ ...publicOrg(orgs[0]), projects: projects.map(({ id, profile_type, summary, fields }) => ({ id, profile_type, summary, fields })) });
  } catch (error) { routeError(res, error); }
});
app.get('/api/public/settings', async (_req, res) => {
  try { const [rows] = await pool.execute('SELECT launch_date FROM settings WHERE id=?', ['settings']); res.json({ launch_date: rows[0]?.launch_date || null }); }
  catch (error) { routeError(res, error); }
});

app.get('/api/me', async (req, res) => {
  try { const user = await sessionUser(req); if (!user) return res.status(401).json({ error: 'unauthenticated' }); res.json(safeUser(user, user.organization_name)); }
  catch (error) { routeError(res, error); }
});
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const [rows] = await pool.execute('SELECT u.*,o.name AS organization_name FROM users u LEFT JOIN organizations o ON o.id=u.organization_id WHERE u.email_normalized=?', [email]);
    const user = rows[0];
    if (!user || (req.body.role && user.role !== req.body.role) || !await bcrypt.compare(String(req.body.password || ''), user.password_hash)) return res.json({ ok: false, error: 'invalid_credentials' });
    if (user.role === 'investor' && !user.email_verified_at) return res.json({ ok: false, error: 'not_verified', user_id: user.id });
    await new Promise((resolve, reject) => req.session.regenerate((err) => err ? reject(err) : resolve()));
    req.session.user = { id: user.id, role: user.role };
    res.json({ ok: true, user: safeUser(user,user.organization_name) });
  } catch (error) { routeError(res, error); }
});
app.post('/api/auth/logout', (req, res) => req.session.destroy((error) => error ? routeError(res, error) : res.status(204).end()));

app.post('/api/investors', signupLimiter, async (req, res) => {
  const data = req.body || {};
  const required = ['name', 'institution', 'email', 'country', 'city', 'password'];
  const fields = required.filter((field) => !String(data[field] || '').trim());
  if (!data.accept_terms) fields.push('accept_terms');
  if (!data.accept_privacy) fields.push('accept_privacy');
  if (fields.length) return res.status(400).json({ ok: false, error: 'missing', fields });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !/^[A-Za-z]{2}$/.test(data.country) || String(data.password).length < 10) return res.status(400).json({ ok: false, error: 'invalid' });
  const id = `u-${crypto.randomUUID()}`;
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const email = String(data.email).trim();
    const [dupes] = await connection.execute('SELECT id FROM users WHERE email_normalized=?', [email.toLowerCase()]);
    if (dupes.length) { await connection.rollback(); return res.status(409).json({ ok: false, error: 'email_taken' }); }
    await connection.execute('INSERT INTO users (id,role,name,email,password_hash,lang,investor_profile,terms_accepted_at,privacy_accepted_at,verification_token_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())',
      [id, 'investor', String(data.name).trim(), email, await bcrypt.hash(String(data.password), 12), data.lang === 'pt' ? 'pt' : 'en', jsonColumn({ institution: data.institution, country: data.country.toUpperCase(), city: data.city, role: data.role || null, investor_type: data.investor_type || null, phone: data.phone || null, linkedin: data.linkedin || null }), new Date(), new Date(), tokenHash]);
    await connection.execute('INSERT INTO consents (id,user_id,terms_version,privacy_version,accepted_at) VALUES (?,?,?,?,UTC_TIMESTAMP())', [`c-${crypto.randomUUID()}`, id, '2026-10', '2026-10']);
    await connection.execute('INSERT INTO email_outbox (id,template,`to`,data,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP())', [`m-${crypto.randomUUID()}`, 'investor_verify_email', email, jsonColumn({ token })]);
    await connection.commit();
    res.status(201).json({ ok: true, user_id: id, ...(demoMode ? { verification_token: token } : {}) });
  } catch (error) { await connection.rollback(); if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ ok: false, error: 'email_taken' }); routeError(res, error); }
  finally { connection.release(); }
});
app.post('/api/investors/verify', async (req, res) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(String(req.body.token || '')).digest('hex');
    const [rows] = await pool.execute('SELECT * FROM users WHERE verification_token_hash=? AND role=?', [tokenHash, 'investor']);
    if (!rows.length) return res.status(400).json({ ok: false, error: 'invalid_token' });
    await pool.execute('UPDATE users SET email_verified_at=UTC_TIMESTAMP(), verification_token_hash=NULL WHERE id=?', [rows[0].id]);
    await new Promise((resolve,reject)=>req.session.regenerate((err)=>err?reject(err):resolve()));
    req.session.user = { id: rows[0].id, role: 'investor' };
    res.json({ ok: true, user: safeUser({ ...rows[0], email_verified_at: new Date() }) });
  } catch (error) { routeError(res, error); }
});
app.post('/api/investors/verify/resend', loginLimiter, async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT id,email FROM users WHERE email_normalized=? AND role='investor' AND email_verified_at IS NULL", [String(req.body.email || '').trim().toLowerCase()]);
    if (!rows.length) return res.json({ ok: true });
    const token = crypto.randomBytes(32).toString('base64url');
    await pool.execute('UPDATE users SET verification_token_hash=? WHERE id=?', [crypto.createHash('sha256').update(token).digest('hex'), rows[0].id]);
    await pool.execute('INSERT INTO email_outbox (id,template,`to`,data,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP())', [`m-${crypto.randomUUID()}`, 'investor_verify_email', rows[0].email, jsonColumn({ token })]);
    res.json({ ok: true, ...(demoMode ? { verification_token: token } : {}) });
  } catch (error) { routeError(res, error); }
});

const contactRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `${req.session.user?.id || req.ip}:${req.params.id}`,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.post('/api/organizations/:id/contact-requests', requireRole('investor'), contactRequestLimiter, async (req, res) => {
  const investor = req.user;
  if (!investor.email_verified_at) return res.status(403).json({ ok: false, error: 'not_verified' });
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [orgs] = await db.execute("SELECT id,focal_point FROM organizations WHERE id=? AND public_state IN ('published','provisional')", [req.params.id]);
    if (!orgs.length) { await db.rollback(); return res.status(404).json({ error: 'not_found' }); }
    const profile = typeof investor.investor_profile === 'string' ? JSON.parse(investor.investor_profile) : (investor.investor_profile || {});
    const [institutionRows] = await db.execute('SELECT id FROM institutions WHERE normalized_name=? LIMIT 1', [String(profile.institution || '').trim().toLowerCase()]);
    let institutionId = institutionRows[0]?.id;
    if (!institutionId) {
      institutionId = `i-${crypto.randomUUID()}`;
      await db.execute('INSERT INTO institutions (id,name,investor_type,created_at) VALUES (?,?,?,UTC_TIMESTAMP())', [institutionId, profile.institution, profile.investor_type || null]);
    }
    let contactId = investor.contact_id;
    if (!contactId) {
      const [contactRows] = await db.execute('SELECT id FROM contacts WHERE email_normalized=?', [investor.email.toLowerCase()]);
      contactId = contactRows[0]?.id || `c-${crypto.randomUUID()}`;
      if (!contactRows.length) await db.execute('INSERT INTO contacts (id,institution_id,name,email,country,city,role,linkedin,phone,created_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())',
        [contactId, institutionId, investor.name, investor.email, profile.country || 'US', profile.city || 'Unknown', profile.role || null, profile.linkedin || null, profile.phone || null]);
      await db.execute('UPDATE users SET contact_id=? WHERE id=?', [contactId, investor.id]);
    }
    const [existing] = await db.execute('SELECT id FROM relationships WHERE contact_id=? AND organization_id=?', [contactId, req.params.id]);
    if (existing.length) { await db.commit(); return res.json({ ok: true, relationship_id: existing[0].id, reused: true }); }
    const relationshipId = `r-${crypto.randomUUID()}`;
    await db.execute('INSERT INTO relationships (id,contact_id,organization_id,origin,status,classification,classification_state,contact_request_at,created_at) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP())',
      [relationshipId, contactId, req.params.id, 'Portfólio', 'in_progress', 'lead', 'validated', localDate()]);
    let projectId = req.body.project_id || null;
    if (projectId) { const [project] = await db.execute('SELECT id FROM projects WHERE id=? AND organization_id=?',[projectId,req.params.id]); if(!project.length) projectId=null; }
    await db.execute('INSERT INTO interactions (id,relationship_id,date,description,type,apex_product,event,project_id,auto,created_by,created_at) VALUES (?,?,?,?,?,?,NULL,?,1,?,UTC_TIMESTAMP())',
      [`it-${crypto.randomUUID()}`, relationshipId, localDate(), 'Pedido de contato pela plataforma', 'other', 'investment_portfolio', projectId, investor.id]);
    await db.execute('INSERT INTO email_outbox (id,template,`to`,data,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP())',
      [`m-${crypto.randomUUID()}`, 'contact_request_team', 'team', jsonColumn({ organization_id: req.params.id, relationship_id: relationshipId }),]);
    const focal = orgs[0].focal_point || {};
    const focalEmail = typeof focal === 'string' ? JSON.parse(focal).email : focal.email;
    await db.execute('INSERT INTO email_outbox (id,template,`to`,data,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP())',
      [`m-${crypto.randomUUID()}`, 'contact_request_company', focalEmail || 'company', jsonColumn({ organization_id: req.params.id, relationship_id: relationshipId })]);
    await db.commit();
    res.status(201).json({ ok: true, relationship_id: relationshipId, reused: false });
  } catch (error) { await db.rollback(); routeError(res, error); }
  finally { db.release(); }
});

app.get('/api/contacts', requireRole('company_user', 'team'), async (req, res) => {
  try {
    const company = req.user.role === 'company_user';
    const where = company ? 'WHERE r.organization_id=?' : '';
    const params = company ? [req.user.organization_id] : [];
    const [rows] = await pool.execute(`SELECT r.*, o.name AS organization_name, c.id AS c_id,c.name AS c_name,c.email AS c_email,c.country AS c_country,c.city AS c_city,c.role AS c_role,c.linkedin AS c_linkedin,c.phone AS c_phone, i.id AS i_id,i.name AS i_name,i.investor_type,i.niche, i.ticket_min_musd,i.ticket_max_musd,i.interest_type,i.sectors,i.description_original,i.description_pt,i.website, (SELECT COUNT(*) FROM interactions x WHERE x.relationship_id=r.id) AS interaction_count,(SELECT JSON_OBJECT('date',x.date,'description',x.description,'type',x.type,'apex_product',x.apex_product,'event',x.event) FROM interactions x WHERE x.relationship_id=r.id ORDER BY x.date DESC LIMIT 1) AS last_interaction FROM relationships r JOIN organizations o ON o.id=r.organization_id JOIN contacts c ON c.id=r.contact_id JOIN institutions i ON i.id=c.institution_id ${where} ORDER BY r.created_at DESC`, params);
    const ids = rows.map((row) => row.id);
    const [allInteractions] = ids.length ? await pool.query(`SELECT relationship_id,date,description,type,apex_product,event,auto FROM interactions WHERE relationship_id IN (${ids.map(() => '?').join(',')}) ORDER BY date DESC`,ids) : [[]];
    const [settings] = await pool.execute('SELECT deadlines,origins,holidays FROM settings WHERE id=?', ['settings']);
    const rowsOut = rows.map((row) => {
      const relationship = { ...row };
      for (const key of ['c_id','c_name','c_email','c_country','c_city','c_role','c_linkedin','c_phone','i_id','i_name','investor_type','niche','ticket_min_musd','ticket_max_musd','interest_type','sectors','description_original','description_pt','website']) delete relationship[key];
      if (company) delete relationship.apex_control;
      const contact = { id: row.c_id,name: row.c_name,email: row.c_email,country: row.c_country,city: row.c_city,role: row.c_role,linkedin: row.c_linkedin,phone: row.c_phone };
      const institution = { id: row.i_id,name: row.i_name,investor_type: row.investor_type,niche: row.niche,ticket_min_musd: row.ticket_min_musd,ticket_max_musd: row.ticket_max_musd,interest_type: row.interest_type,sectors: row.sectors,description_original: row.description_original,description_pt: row.description_pt,website: row.website };
      const interactions = allInteractions.filter((item) => item.relationship_id === row.id);
      return { relationship, organization_name: row.organization_name, contact, institution,
        last_interaction: interactions[0]?.date || null,interaction_count:interactions.length,events:Array.from(new Set(interactions.map((item) => item.event).filter(Boolean))),
        interaction_dates:interactions.map((item) => String(item.date).slice(0,10)),completeness:completenessFor(contact,institution,relationship),pending_request:requestStateFor(relationship,interactions,settings[0]?.holidays) };
    });
    res.json({ rows: rowsOut, deadlines: settings[0]?.deadlines || {}, origins: settings[0]?.origins || [] });
  } catch (error) { routeError(res, error); }
});

app.get('/api/contacts/:id', requireRole('company_user', 'team'), async (req, res, next) => {
  if (req.params.id === 'lookup') return next();
  try {
    const company = req.user.role === 'company_user';
    const [rows] = await pool.execute(`SELECT r.*,o.name AS organization_name,c.id AS c_id,c.name AS c_name,c.email AS c_email,c.country AS c_country,c.city AS c_city,c.role AS c_role,c.linkedin AS c_linkedin,c.phone AS c_phone,i.id AS i_id,i.name AS i_name,i.investor_type,i.niche,i.ticket_min_musd,i.ticket_max_musd,i.interest_type,i.sectors,i.description_original,i.description_pt,i.website,i.hq_country,i.hq_city,u.name AS owner_name FROM relationships r JOIN organizations o ON o.id=r.organization_id JOIN contacts c ON c.id=r.contact_id JOIN institutions i ON i.id=c.institution_id LEFT JOIN users u ON u.id=r.owner_user_id WHERE r.id=? ${company ? 'AND r.organization_id=?' : ''}`,
      company ? [req.params.id, req.user.organization_id] : [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    const row = rows[0];
    const [interactions] = await pool.execute('SELECT x.*,u.name AS created_by_name FROM interactions x LEFT JOIN users u ON u.id=x.created_by WHERE x.relationship_id=? ORDER BY x.date DESC,x.created_at DESC', [row.id]);
    const [settings] = await pool.execute('SELECT deadlines,origins,apex_strategic_categories,holidays FROM settings WHERE id=?', ['settings']);
    const relationship = { ...row };
    for (const key of ['c_id','c_name','c_email','c_country','c_city','c_role','c_linkedin','c_phone','i_id','i_name','investor_type','niche','ticket_min_musd','ticket_max_musd','interest_type','sectors','description_original','description_pt','website','hq_country','hq_city','owner_name']) delete relationship[key];
    if (company) delete relationship.apex_control;
    const contact = { id:row.c_id,name:row.c_name,email:row.c_email,country:row.c_country,city:row.c_city,role:row.c_role,linkedin:row.c_linkedin,phone:row.c_phone };
    const institution = { id:row.i_id,name:row.i_name,investor_type:row.investor_type,niche:row.niche,ticket_min_musd:row.ticket_min_musd,ticket_max_musd:row.ticket_max_musd,interest_type:row.interest_type,sectors:row.sectors,description_original:row.description_original,description_pt:row.description_pt,website:row.website,hq_country:row.hq_country,hq_city:row.hq_city };
    res.json({ relationship,organization_name:row.organization_name,owner_name:row.owner_name,contact,institution,interactions,
      completeness:completenessFor(contact,institution,relationship),pending_request:requestStateFor(relationship,interactions,settings[0]?.holidays),
      origins:settings[0]?.origins || [],deadlines:settings[0]?.deadlines || {},...(company ? {} : { apex_categories:settings[0]?.apex_strategic_categories || [] }) });
  } catch (error) { routeError(res, error); }
});
app.get('/api/contacts/lookup', requireRole('company_user', 'team'), async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    const [rows] = await pool.execute('SELECT c.*,i.id AS i_id,i.name AS i_name FROM contacts c JOIN institutions i ON i.id=c.institution_id WHERE c.email_normalized=?', [email]);
    if (!rows.length) return res.json(null);
    const row = rows[0];
    const [rels] = await pool.execute('SELECT id FROM relationships WHERE contact_id=? AND organization_id=?', [row.id, req.user.role === 'company_user' ? req.user.organization_id : (req.query.organization_id || 'program')]);
    res.json({ contact: { id: row.id,name: row.name,email: row.email,country: row.country,city: row.city,role: row.role,linkedin: row.linkedin,phone: row.phone }, institution: { id: row.i_id,name: row.i_name }, existing_relationship_id: rels[0]?.id || null });
  } catch (error) { routeError(res, error); }
});
app.get('/api/institutions', requireRole('company_user', 'team'), async (req, res) => {
  try { const term=String(req.query.q||'').trim();if(term.length<2)return res.json([]);const q = `%${term}%`; const [rows] = await pool.execute('SELECT id,name,investor_type,niche,ticket_min_musd,ticket_max_musd,interest_type,sectors,description_original,description_pt,website,hq_country,hq_city FROM institutions WHERE name LIKE ? ORDER BY name LIMIT 8', [q]); res.json(rows); }
  catch (error) { routeError(res, error); }
});

function validDateNotFuture(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && value <= localDate(); }
const interactionTypes = new Set(['in_person_meeting','virtual_meeting','email','material_sent','nda','proposal_term_sheet','other']);
const apexProducts = new Set(['promotion_event','promotion_webinar','facilitation_webinar','basic_investor_info','custom_intelligence','custom_business_agenda','investment_portfolio','investment_matchmaking','pitch_training']);
const relationshipStatuses = new Set(['in_progress','closed','deal']);
const dealTypes = new Set(['investment','licensing','co_development','other']);
function validUsdTree(value) {
  if (Array.isArray(value)) return value.every(validUsdTree);
  if (!value || typeof value !== 'object') return true;
  return Object.entries(value).every(([key,item]) => {
    if (/(?:amount_usd|min_usd|max_usd)$/.test(key) && item != null && item !== '') return Number.isInteger(item) && item >= 0;
    return validUsdTree(item);
  });
}
app.post('/api/contacts', requireRole('company_user','team'), async (req, res) => {
  const { contact = {}, institution = {}, relationship = {}, interaction = {} } = req.body || {};
  const fields = [];
  for (const key of ['name','email','country','city']) if (!String(contact[key] || '').trim()) fields.push(`contact.${key}`);
  if (!String(institution.name || '').trim()) fields.push('institution.name');
  if (!validDateNotFuture(interaction.date)) fields.push('interaction.date');
  if (!String(interaction.description || '').trim() || String(interaction.description).length > 500) fields.push('interaction.description');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || '')) fields.push('contact.email_invalid');
  if (!/^[A-Za-z]{2}$/.test(contact.country || '')) fields.push('contact.country');
  if (interaction.type && !interactionTypes.has(interaction.type)) fields.push('interaction.type');
  if (interaction.apex_product && !apexProducts.has(interaction.apex_product)) fields.push('interaction.apex_product');
  if (relationship.status && !relationshipStatuses.has(relationship.status)) fields.push('relationship.status');
  if (!validUsdTree(relationship.deal_expectation) || (relationship.deal_expectation?.type && !dealTypes.has(relationship.deal_expectation.type))) fields.push('relationship.deal_expectation');
  if (fields.length) return res.json({ ok:false,error:'invalid',fields });
  const organizationId = req.user.role === 'company_user' ? req.user.organization_id : (req.body.organization_id || 'program');
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    if (organizationId !== 'program') { const [organizations] = await db.execute('SELECT id FROM organizations WHERE id=?',[organizationId]); if(!organizations.length){await db.rollback();return res.json({ok:false,error:'invalid',fields:['organization_id']});} }
    const [settings] = await db.execute('SELECT origins FROM settings WHERE id=?',['settings']);
    const allowedOrigins = settings[0]?.origins || [];
    if ((relationship.origin && relationship.origin !== 'Portfólio' && !allowedOrigins.includes(relationship.origin)) || (interaction.event && !allowedOrigins.includes(interaction.event))) { await db.rollback(); return res.json({ok:false,error:'invalid',fields:['relationship.origin','interaction.event']}); }
    if (interaction.project_id) { const [project] = await db.execute('SELECT id FROM projects WHERE id=? AND organization_id=?',[interaction.project_id,organizationId]); if(!project.length){await db.rollback();return res.json({ok:false,error:'invalid',fields:['interaction.project_id']});} }
    const [contacts] = await db.execute('SELECT id,institution_id FROM contacts WHERE email_normalized=? FOR UPDATE', [String(contact.email).trim().toLowerCase()]);
    let institutionId = contacts[0]?.institution_id;
    if (!institutionId) {
      const [existingInstitutions] = await db.execute('SELECT id FROM institutions WHERE normalized_name=? LIMIT 1 FOR UPDATE', [String(institution.name).trim().toLowerCase()]);
      institutionId = existingInstitutions[0]?.id || `i-${crypto.randomUUID()}`;
      if (!existingInstitutions.length) await db.execute('INSERT INTO institutions (id,name,investor_type,niche,ticket_min_musd,ticket_max_musd,interest_type,sectors,description_original,description_pt,website,hq_country,hq_city,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())',
        [institutionId,institution.name,institution.investor_type || null,institution.niche || null,institution.ticket_min_musd ?? null,institution.ticket_max_musd ?? null,institution.interest_type || null,jsonColumn(institution.sectors || []),institution.description_original || null,institution.description_pt || null,institution.website || null,institution.hq_country || null,institution.hq_city || null]);
    }
    const fillInstitution = ['investor_type','niche','ticket_min_musd','ticket_max_musd','interest_type','sectors','description_original','description_pt','website','hq_country','hq_city']
      .filter((key) => institution[key] != null && institution[key] !== '' && !(Array.isArray(institution[key]) && !institution[key].length));
    for (const key of fillInstitution) {
      const [current] = await db.execute(`SELECT \`${key}\` AS value FROM institutions WHERE id=?`,[institutionId]);
      const empty = current[0]?.value == null || current[0]?.value === '' || (Array.isArray(current[0]?.value) && !current[0].value.length);
      if (empty) await db.execute(`UPDATE institutions SET \`${key}\`=? WHERE id=?`,[key==='sectors'?jsonColumn(institution[key]):institution[key],institutionId]);
    }
    let contactId = contacts[0]?.id;
    if (!contactId) {
      contactId = `c-${crypto.randomUUID()}`;
      await db.execute('INSERT INTO contacts (id,institution_id,name,email,country,city,role,linkedin,phone,created_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())',
        [contactId,institutionId,String(contact.name).trim(),String(contact.email).trim(),String(contact.country).toUpperCase(),String(contact.city).trim(),contact.role || null,contact.linkedin || null,contact.phone || null]);
    } else {
      for (const key of ['name','country','city','role','linkedin','phone']) if (contact[key] != null && contact[key] !== '') {
        const column=key;
        const [current]=await db.execute(`SELECT \`${column}\` AS value FROM contacts WHERE id=?`,[contactId]);
        if(current[0]?.value==null||current[0].value==='') await db.execute(`UPDATE contacts SET \`${column}\`=? WHERE id=?`,[key==='country'?String(contact[key]).toUpperCase():contact[key],contactId]);
      }
    }
    const [existingRel] = await db.execute('SELECT id FROM relationships WHERE contact_id=? AND organization_id=?', [contactId,organizationId]);
    if (existingRel.length) { await db.rollback(); return res.json({ ok:false,error:'already_exists',relationship_id:existingRel[0].id }); }
    const relationshipId = `r-${crypto.randomUUID()}`;
    const classification = 'lead';
    const [categoriesRows]=await db.execute('SELECT apex_strategic_categories FROM settings WHERE id=?',['settings']);
    const defaultCategory=categoriesRows[0]?.apex_strategic_categories?.[0]||null;
    await db.execute('INSERT INTO relationships (id,contact_id,organization_id,owner_user_id,origin,status,deal_expectation,classification,classification_state,apex_control,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())',
      [relationshipId,contactId,organizationId,req.user.id,relationship.origin || null,relationship.status || 'in_progress',jsonColumn(relationship.deal_expectation),classification,'validated',jsonColumn({dynamics_account:false,contact_registered:false,opportunity_inserted:false,opportunity_word:false,strategic_category:defaultCategory,notes:''})]);
    await db.execute('INSERT INTO interactions (id,relationship_id,date,description,type,apex_product,event,project_id,auto,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,0,?,UTC_TIMESTAMP())',
      [`it-${crypto.randomUUID()}`,relationshipId,interaction.date,String(interaction.description).trim(),interaction.type || null,interaction.apex_product || null,interaction.event || null,interaction.project_id || null,req.user.id]);
    await db.commit();
    res.status(201).json({ ok:true,relationship_id:relationshipId });
  } catch (error) { await db.rollback(); if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ ok:false,error:'already_exists' }); routeError(res,error); }
  finally { db.release(); }
});
app.post('/api/contacts/:id/interactions', requireRole('company_user','team'), async (req, res) => {
  const { date,description,type,apex_product,event,project_id } = req.body || {};
  if (!validDateNotFuture(date) || !String(description || '').trim() || String(description).length > 500) return res.json({ ok:false,error:'invalid' });
  try {
    if ((type && !interactionTypes.has(type)) || (apex_product && !apexProducts.has(apex_product))) return res.json({ok:false,error:'invalid'});
    const [rows] = await pool.execute(`SELECT id FROM relationships WHERE id=? ${req.user.role === 'company_user' ? 'AND organization_id=?' : ''}`,
      req.user.role === 'company_user' ? [req.params.id,req.user.organization_id] : [req.params.id]);
    if (!rows.length) return res.status(404).json({ error:'not_found' });
    const id = `it-${crypto.randomUUID()}`;
    await pool.execute('INSERT INTO interactions (id,relationship_id,date,description,type,apex_product,event,project_id,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())',
      [id,req.params.id,date,String(description).trim(),type || null,apex_product || null,event || null,project_id || null,req.user.id]);
    const [created]=await pool.execute('SELECT * FROM interactions WHERE id=?',[id]);res.json({ ok:true,interaction:created[0] });
  } catch (error) { routeError(res,error); }
});
app.patch('/api/contacts/:id', requireRole('company_user','team'), async (req,res) => {
  const db = await pool.getConnection();
  try {
    const company = req.user.role === 'company_user';
    const [rels] = await db.execute(`SELECT r.id,c.id AS contact_id,c.institution_id FROM relationships r JOIN contacts c ON c.id=r.contact_id WHERE r.id=? ${company ? 'AND r.organization_id=?' : ''}`,
      company ? [req.params.id,req.user.organization_id] : [req.params.id]);
    if (!rels.length) return res.status(404).json({ error:'not_found' });
    const { contact = {},institution = {},relationship = {} } = req.body || {};
    const allowedContact = ['name','country','city','role','linkedin','phone'];
    const allowedInstitution = ['name','investor_type','niche','ticket_min_musd','ticket_max_musd','interest_type','sectors','description_original','description_pt','website','hq_country','hq_city'];
    for (const key of ['name','country','city']) if (contact[key] !== undefined && !String(contact[key]).trim()) return res.json({ ok:false,error:'invalid',fields:[`contact.${key}`] });
    const cSet = allowedContact.filter((key) => contact[key] !== undefined);
    const iSet = allowedInstitution.filter((key) => institution[key] !== undefined && !(key === 'name' && !String(institution[key]).trim()));
    const rSet = ['origin','status','deal_expectation'].filter((key) => relationship[key] !== undefined);
    if (relationship.status && !relationshipStatuses.has(relationship.status)) { await db.rollback(); return res.json({ok:false,error:'invalid'}); }
    if (relationship.deal_expectation && (!validUsdTree(relationship.deal_expectation) || relationship.deal_expectation.type && !dealTypes.has(relationship.deal_expectation.type))) { await db.rollback(); return res.json({ok:false,error:'invalid'}); }
    await db.beginTransaction();
    if (cSet.length) await db.execute(`UPDATE contacts SET ${cSet.map((key) => `\`${key}\`=?`).join(',')} WHERE id=?`, [...cSet.map((key) => key === 'country' ? String(contact[key]).toUpperCase() : contact[key]),rels[0].contact_id]);
    if (iSet.length) await db.execute(`UPDATE institutions SET ${iSet.map((key) => `\`${key}\`=?`).join(',')} WHERE id=?`, [...iSet.map((key) => ['sectors'].includes(key) ? jsonColumn(institution[key]) : institution[key]),rels[0].institution_id]);
    if (rSet.length) await db.execute(`UPDATE relationships SET ${rSet.map((key) => `\`${key}\`=?`).join(',')} WHERE id=?`, [...rSet.map((key) => key === 'deal_expectation' ? jsonColumn(relationship[key]) : relationship[key]),req.params.id]);
    await db.commit();
    res.json(await (async () => { const [result] = await db.execute('SELECT * FROM relationships WHERE id=?',[req.params.id]); return { ok:true,relationship:result[0] }; })());
  } catch (error) { await db.rollback(); routeError(res,error); }
  finally { db.release(); }
});
app.post('/api/contacts/:id/classification-suggestions', requireRole('company_user','team'), async (req,res) => {
  const { value,justification } = req.body || {};
  if (!['nia','br'].includes(value) || String(justification || '').length > 300) return res.json({ ok:false,error:'invalid' });
  try {
    const [rows] = await pool.execute(`SELECT id,suggested FROM relationships WHERE id=? ${req.user.role === 'company_user' ? 'AND organization_id=?' : ''}`,
      req.user.role === 'company_user' ? [req.params.id,req.user.organization_id] : [req.params.id]);
    if (!rows.length) return res.status(404).json({ error:'not_found' });
    await pool.execute('UPDATE relationships SET suggested=? WHERE id=?',[jsonColumn({ value,justification:String(justification||'').trim(),at:new Date().toISOString(),by:req.user.id,state:'pending' }),req.params.id]);
    await emailEvent('classification_suggested','team',{ relationship_id:req.params.id });
    res.json({ ok:true });
  } catch (error) { routeError(res,error); }
});
app.post('/api/contacts/:id/npia', requireRole('company_user','team'), async (req,res) => {
  const data = req.body || {};
  if (!/^[a-h]$/.test(data.type || '') || !validDateNotFuture(data.date) || !Number.isInteger(data.amount_usd) || data.amount_usd < 0 || !String(data.description || '').trim() || String(data.description).length > 500 || typeof data.confidential !== 'boolean') return res.json({ ok:false,error:'invalid' });
  try {
    const [rows] = await pool.execute(`SELECT id FROM relationships WHERE id=? ${req.user.role === 'company_user' ? 'AND organization_id=?' : ''}`,
      req.user.role === 'company_user' ? [req.params.id,req.user.organization_id] : [req.params.id]);
    if (!rows.length) return res.status(404).json({ error:'not_found' });
    await pool.execute('UPDATE relationships SET npia=? WHERE id=?',[jsonColumn({ ...data,state:'pending',at:new Date().toISOString(),by:req.user.id }),req.params.id]);
    await emailEvent('npia_reported','team',{ relationship_id:req.params.id });
    res.json({ ok:true });
  } catch (error) { routeError(res,error); }
});
app.post('/api/team/contacts/:id/classification', requireRole('team'), async (req,res) => {
  if (!['lead','nia','npia','br','incomplete'].includes(req.body.value)) return res.status(400).json({ error:'invalid' });
  try { const [rows]=await pool.execute('SELECT suggested,organization_id FROM relationships WHERE id=?',[req.params.id]);if(!rows.length)return res.status(404).json({error:'not_found'});const suggestion=rows[0].suggested||{};await pool.execute('UPDATE relationships SET classification=?,classification_state=?,validated_at=UTC_TIMESTAMP(),validated_by=?,suggested=? WHERE id=?', [req.body.value,'validated',req.user.id,jsonColumn({...suggestion,state:suggestion.value===req.body.value?'validated':'adjusted',team_comment:req.body.comment||null,decided_at:new Date().toISOString()}),req.params.id]);await emailEvent('classification_validated','company',{ relationship_id:req.params.id,organization_id:rows[0].organization_id,value:req.body.value }); res.json({ ok:true }); }
  catch (error) { routeError(res,error); }
});
app.post('/api/team/contacts/:id/npia/decision', requireRole('team'), async (req,res) => {
  if(typeof req.body.accept!=='boolean') return res.status(400).json({error:'invalid'});
  try { const [rows] = await pool.execute('SELECT npia,classification,organization_id FROM relationships WHERE id=?',[req.params.id]); if (!rows.length) return res.status(404).json({ error:'not_found' }); const accepted=req.body.accept;const npia={...(rows[0].npia||{}),state:accepted?'validated':'rejected',validated_at:new Date().toISOString(),validated_by:req.user.id,team_comment:req.body.comment||null};if(accepted)await pool.execute('UPDATE relationships SET npia=?,classification=?,classification_state=?,validated_at=UTC_TIMESTAMP(),validated_by=? WHERE id=?',[jsonColumn(npia),'npia','validated',req.user.id,req.params.id]);else await pool.execute('UPDATE relationships SET npia=? WHERE id=?',[jsonColumn(npia),req.params.id]);await emailEvent('npia_validated','company',{ relationship_id:req.params.id,organization_id:rows[0].organization_id,accepted,comment:req.body.comment||null });res.json({ok:true}); }
  catch (error) { routeError(res,error); }
});
app.put('/api/team/contacts/:id/apex-control', requireRole('team'), async (req,res) => {
  const control=req.body||{};
  if(['dynamics_account','contact_registered','opportunity_inserted','opportunity_word'].some((key)=>control[key]!==undefined&&typeof control[key]!=='boolean')) return res.status(400).json({error:'invalid'});
  try { const [settings]=await pool.execute('SELECT apex_strategic_categories FROM settings WHERE id=?',['settings']);const categories=settings[0]?.apex_strategic_categories||[];if(control.strategic_category&&!categories.includes(control.strategic_category))return res.status(400).json({error:'invalid'});const [rows]=await pool.execute('SELECT apex_control FROM relationships WHERE id=?',[req.params.id]);if(!rows.length)return res.status(404).json({error:'not_found'});const merged={...(rows[0].apex_control||{}),...control};await pool.execute('UPDATE relationships SET apex_control=? WHERE id=?',[jsonColumn(merged),req.params.id]);res.json({ ok:true }); }
  catch (error) { routeError(res,error); }
});
app.get('/api/team/contact-owners', requireRole('team'), async (_req,res) => {
  try { const [rows] = await pool.query('SELECT id,name FROM organizations ORDER BY name'); res.json([{ id:'program',name:'Programa Abiquifi' },...rows]); }
  catch (error) { routeError(res,error); }
});
function editDistance(a,b) {
  const row = Array.from({ length:b.length+1 },(_,i) => i);
  for (let i=1;i<=a.length;i++) { let prev=row[0]; row[0]=i; for (let j=1;j<=b.length;j++) { const old=row[j]; row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1)); prev=old; } }
  return row[b.length];
}
const normName = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim().replace(/\s+/g,' ');
app.get('/api/team/duplicates', requireRole('team'), async (_req,res) => {
  try {
    const [contacts] = await pool.query('SELECT * FROM contacts ORDER BY name');
    const [institutions] = await pool.query('SELECT * FROM institutions ORDER BY name');
    const out=[];
    for(let i=0;i<contacts.length;i++) for(let j=i+1;j<contacts.length;j++) { const a=normName(contacts[i].name),b=normName(contacts[j].name); if(a&&b&&editDistance(a,b)<=2) out.push({kind:'contact',a:contacts[i],b:contacts[j]}); }
    for(let i=0;i<institutions.length;i++) for(let j=i+1;j<institutions.length;j++) { const a=normName(institutions[i].name),b=normName(institutions[j].name); if(a&&b&&(editDistance(a,b)<=2||a.startsWith(`${b} `)||b.startsWith(`${a} `))) out.push({kind:'institution',a:institutions[i],b:institutions[j]}); }
    res.json(out);
  } catch (error) { routeError(res,error); }
});
app.post('/api/team/merge/contacts', requireRole('team'), async (req,res) => {
  const keepId=req.body.keep_id,dropId=req.body.drop_id;
  if(!keepId||!dropId||keepId===dropId) return res.status(400).json({error:'invalid'});
  const db=await pool.getConnection();
  try {
    await db.beginTransaction();
    const [keep]=await db.execute('SELECT id FROM contacts WHERE id=? FOR UPDATE',[keepId]); const [drop]=await db.execute('SELECT id FROM contacts WHERE id=? FOR UPDATE',[dropId]);
    if(!keep.length||!drop.length){await db.rollback();return res.status(404).json({error:'not_found'});}
    const [rels]=await db.execute('SELECT id,organization_id FROM relationships WHERE contact_id=? FOR UPDATE',[dropId]);
    for(const rel of rels){const [twins]=await db.execute('SELECT id FROM relationships WHERE contact_id=? AND organization_id=?',[keepId,rel.organization_id]);if(twins.length){await db.execute('UPDATE interactions SET relationship_id=? WHERE relationship_id=?',[twins[0].id,rel.id]);await db.execute('DELETE FROM relationships WHERE id=?',[rel.id]);}else await db.execute('UPDATE relationships SET contact_id=? WHERE id=?',[keepId,rel.id]);}
    await db.execute('UPDATE users SET contact_id=? WHERE contact_id=?',[keepId,dropId]); await db.execute('DELETE FROM contacts WHERE id=?',[dropId]); await db.commit(); res.json({ok:true});
  } catch(error){await db.rollback();routeError(res,error);} finally{db.release();}
});
app.post('/api/team/merge/institutions', requireRole('team'), async (req,res) => {
  const { keep_id:keepId,drop_id:dropId }=req.body||{}; if(!keepId||!dropId||keepId===dropId)return res.status(400).json({error:'invalid'});
  const db=await pool.getConnection();try{await db.beginTransaction();const [keep]=await db.execute('SELECT id FROM institutions WHERE id=? FOR UPDATE',[keepId]);const [drop]=await db.execute('SELECT id FROM institutions WHERE id=? FOR UPDATE',[dropId]);if(!keep.length||!drop.length){await db.rollback();return res.status(404).json({error:'not_found'});}await db.execute('UPDATE contacts SET institution_id=? WHERE institution_id=?',[keepId,dropId]);await db.execute('DELETE FROM institutions WHERE id=?',[dropId]);await db.commit();res.json({ok:true});}catch(error){await db.rollback();routeError(res,error);}finally{db.release();}
});
app.get('/api/team/contacts/dashboard', requireRole('team'), async (req,res) => {
  try {
    const year=String(Number(req.query.year)||new Date().getFullYear());
    const [settingsRows]=await pool.execute('SELECT * FROM settings WHERE id=?',['settings']); const settings=settingsRows[0]||{};
    const [rels]=await pool.query('SELECT r.*,o.name AS organization_name,c.name AS contact_name,c.id AS c_id,c.role AS c_role,c.linkedin AS c_linkedin,i.investor_type,i.niche,i.ticket_min_musd,i.ticket_max_musd,i.interest_type,i.sectors,i.description_original,i.description_pt,i.website FROM relationships r LEFT JOIN organizations o ON o.id=r.organization_id JOIN contacts c ON c.id=r.contact_id JOIN institutions i ON i.id=c.institution_id');
    const [its]=await pool.query('SELECT * FROM interactions');
    const leads=rels.filter(r=>r.organization_id&&String(r.created_at||'').startsWith(year)&&!['br','incomplete'].includes(r.classification));
    const nias=rels.filter(r=>['nia','npia'].includes(r.classification)&&String(r.validated_at||'').startsWith(year));
    const npias=rels.filter(r=>r.npia?.state==='validated'&&String(r.npia.validated_at||'').startsWith(year));
    const meetings=its.filter(i=>String(i.date).startsWith(year)&&['in_person_meeting','virtual_meeting'].includes(i.type));
    const eventOrgs=new Set(its.filter(i=>String(i.date).startsWith(year)&&i.apex_product==='promotion_event').map(i=>rels.find(r=>r.id===i.relationship_id)?.organization_id).filter(id=>id&&id!=='program'));
    const queue=[]; for(const r of rels){if(r.suggested?.state==='pending')queue.push({kind:'classification',relationship_id:r.id,organization_name:r.organization_name,contact_name:r.contact_name,suggested:r.suggested,current:r.classification});if(r.npia?.state==='pending')queue.push({kind:'npia',relationship_id:r.id,organization_name:r.organization_name,contact_name:r.contact_name,npia:r.npia});}
    const by=new Map();
    for(const r of rels){const key=r.organization_id;let x=by.get(key);if(!x){x={organization_id:key,organization_name:r.organization_name||'Programa Abiquifi',records:0,completeness_sum:0,overdue:0,warning:0};by.set(key,x);}const contact={role:r.c_role,linkedin:r.c_linkedin};const inst={investor_type:r.investor_type,niche:r.niche,ticket_min_musd:r.ticket_min_musd,ticket_max_musd:r.ticket_max_musd,interest_type:r.interest_type,sectors:r.sectors,description_original:r.description_original,description_pt:r.description_pt,website:r.website};x.records++;x.completeness_sum+=completenessFor(contact,inst,r).pct;const pend=requestStateFor(r,its.filter(i=>i.relationship_id===r.id),settings.holidays);if(pend&&pend.business_days>(settings.deadlines?.contact_overdue_business_days||15))x.overdue++;else if(pend&&pend.business_days>=(settings.deadlines?.contact_warning_business_days||10))x.warning++;}
    const byCompany=[...by.values()].map(x=>({...x,avg_completeness:Math.round(x.completeness_sum/x.records)})).sort((a,b)=>b.overdue-a.overdue||a.avg_completeness-b.avg_completeness);
    res.json({year:Number(year),goals:settings.goals?.[year]||{lead:0,nia:0,npia:0},indicators:{lead:leads.length,nia:nias.length,npia:npias.length,meetings:meetings.length,event_companies:eventOrgs.size},queue:queue.sort((a,b)=>String((a.suggested||a.npia).at||'').localeCompare(String((b.suggested||b.npia).at||''))),by_company:byCompany,years:Object.keys(settings.goals||{})});
  } catch(error){routeError(res,error);}
});

const upload = multer({ storage:multer.memoryStorage(), limits:{ fileSize:20*1024*1024, files:1 } });
const uploadRoot = path.resolve(process.env.UPLOAD_ROOT || 'C:/CompaniesPortfolioData/uploads');
function numericSvgLength(value) { const match = String(value || '').match(/^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/i); return match ? Number(match[1]) : null; }
function sanitizeSvg(source) {
  const doc = new DOMParser({ onError: (_level, message) => { throw new Error(`invalid_svg:${message}`); } }).parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') throw new Error('invalid_svg');
  const blocked = new Set(['script','foreignobject','iframe','object','embed','audio','video','style','animate','animatemotion','animatetransform','set']);
  const visit = (node) => {
    for (let child = node.firstChild; child;) {
      const next = child.nextSibling;
      if (child.nodeType === 1) {
        if (blocked.has(child.nodeName.toLowerCase())) node.removeChild(child);
        else {
          for (let i = child.attributes.length - 1; i >= 0; i -= 1) {
            const attr = child.attributes.item(i); const name = attr.name.toLowerCase(); const value = attr.value.trim();
            if (name.startsWith('on') || name === 'style' || ((name === 'href' || name.endsWith(':href')) && value && !value.startsWith('#')) || /url\s*\(/i.test(value)) child.removeAttribute(attr.name);
          }
          visit(child);
        }
      }
      child = next;
    }
  };
  visit(root);
  const viewBox = String(root.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number);
  const width = numericSvgLength(root.getAttribute('width')) || (viewBox.length === 4 ? viewBox[2] : 0);
  const height = numericSvgLength(root.getAttribute('height')) || (viewBox.length === 4 ? viewBox[3] : 0);
  return { buffer:Buffer.from(new XMLSerializer().serializeToString(doc)), width, height };
}
app.post('/api/uploads', requireRole('company_user'), upload.single('image'), async (req,res) => {
  const file = req.file;
  const kind = req.query.kind;
  if (!file || !['logo','cover','gallery'].includes(kind)) return res.status(400).json({ error:'invalid' });
  const allowed = kind === 'logo' ? ['image/png','image/svg+xml'] : ['image/jpeg','image/png'];
  if (!allowed.includes(file.mimetype)) return res.status(415).json({ error:'image_type' });
  if (kind === 'cover' && file.size > 8*1024*1024) return res.status(413).json({ error:'image_too_big' });
  try {
    let bytes = file.buffer; let extension; let width; let height;
    if (file.mimetype === 'image/svg+xml') {
      const cleaned = sanitizeSvg(file.buffer.toString('utf8'));
      bytes = cleaned.buffer; width = cleaned.width; height = cleaned.height; extension = 'svg';
    } else {
      const metadata = await sharp(bytes, { limitInputPixels:50_000_000 }).metadata();
      if (!['png','jpeg'].includes(metadata.format)) return res.status(415).json({ error:'image_type' });
      width = metadata.width; height = metadata.height; extension = metadata.format === 'jpeg' ? 'jpg' : 'png';
    }
    if (!width || !height || Math.max(width,height) < (kind === 'gallery' || kind === 'cover' ? 1600 : 512)) return res.status(400).json({ error:'image_too_small' });
    await fs.mkdir(uploadRoot,{recursive:true});
    const filename = `${crypto.randomUUID()}.${extension}`;
    await fs.writeFile(path.join(uploadRoot,filename),bytes,{flag:'wx'});
    res.status(201).json({ url:`/uploads/${filename}` });
  } catch (error) { if (error.message?.startsWith('invalid_svg')) return res.status(400).json({ error:'invalid_svg' }); routeError(res,error); }
});

const profileOrgKeys = ['name','logo_url','cover_url','description','website','city','state','size','segments','partnership_types','leadership','gallery','focal_point'];
const profileSnapshot = (org, projects) => ({ organization: Object.fromEntries(profileOrgKeys.map((key) => [key, org[key] ?? null])),
  projects: projects.map((project) => ({ id: project.id, profile_type: project.profile_type, summary: project.summary, fields: project.fields })) });
const emailEvent = (template, to, data) => pool.execute('INSERT INTO email_outbox (id,template,`to`,data,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP())',
  [`m-${crypto.randomUUID()}`, template, to, jsonColumn(data)]);
const getOpenDraft = async (db, orgId) => {
  const [rows] = await db.execute("SELECT * FROM profile_versions WHERE organization_id=? AND kind='draft' AND status IN ('filling','in_review','returned') ORDER BY created_at LIMIT 1", [orgId]);
  return rows[0] || null;
};

app.get('/api/me/profile-form', requireRole('company_user'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const [orgRows] = await pool.execute('SELECT * FROM organizations WHERE id=?', [orgId]);
    if (!orgRows.length) return res.status(404).json({ error: 'not_found' });
    const org = orgRows[0];
    const firstValidation = !org.last_approved_at;
    const [projects] = await pool.execute('SELECT id,profile_type,sort_order,summary,fields FROM projects WHERE organization_id=? ORDER BY sort_order', [orgId]);
    const [imports] = firstValidation ? await pool.execute('SELECT project_id,field,mode,previous_answer FROM form_imports WHERE organization_id=?', [orgId]) : [[]];
    let draft = await getOpenDraft(pool, orgId);
    if (!draft) {
      const content = profileSnapshot(org, projects);
      for (const row of imports.filter((item) => item.mode === 'reference')) {
        const project = content.projects.find((item) => item.id === row.project_id);
        if (project?.fields) { delete project.fields[row.field]; if (row.field === 'raised') delete project.fields.raised_none; }
      }
      draft = { id: `pv-${crypto.randomUUID()}`, organization_id: orgId, kind: 'draft', status: 'filling', content, reviewed_steps: {}, created_at: new Date(), updated_at: new Date() };
      await pool.execute('INSERT INTO profile_versions (id,organization_id,kind,status,content,reviewed_steps,created_at,updated_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',
        [draft.id, orgId, draft.kind, draft.status, jsonColumn(content), jsonColumn({})]);
    }
    res.json({ organization: { id: org.id,name: org.name,status: org.status,public_state: org.public_state,last_approved_at: org.last_approved_at }, draft,
      imports: imports.map(({ project_id, field, mode, previous_answer }) => ({ project_id,field,mode,previous_answer })), firstValidation });
  } catch (error) { routeError(res, error); }
});

async function storeCompanyDraft(req, content, reviewedSteps, submitting = false) {
  const orgId = req.user.organization_id;
  const draft = await getOpenDraft(pool, orgId);
  if (!draft || draft.status === 'in_review') return { ok: false, error: 'locked' };
  let currentContent = draft.content;
  if (typeof currentContent === 'string') currentContent = JSON.parse(currentContent);
  const expected = currentContent.projects.map((project) => `${project.id}:${project.profile_type}`).join('|');
  const received = (content?.projects || []).map((project) => `${project.id}:${project.profile_type}`).join('|');
  if (expected !== received) return { ok: false, error: 'projects_changed' };
  if (!content?.organization || !Array.isArray(content.projects)) return { ok: false, error: 'invalid' };
  const check = submitting ? validateDraft(content, reviewedSteps) : { ok:true };
  const accepted = submitting && check.ok;
  const status = accepted ? 'in_review' : 'filling';
  await pool.execute('UPDATE profile_versions SET content=?,reviewed_steps=?,status=?,updated_at=UTC_TIMESTAMP(),submitted_at=IF(?=1,UTC_TIMESTAMP(),submitted_at),submitted_by=IF(?=1,?,submitted_by),review_comment=IF(?=1,NULL,review_comment) WHERE id=? AND organization_id=?',
    [jsonColumn(content), jsonColumn(reviewedSteps || {}), status, Number(accepted), Number(accepted), req.user.id, Number(accepted), draft.id, orgId]);
  if (!accepted) await pool.execute("UPDATE organizations SET status='filling' WHERE id=? AND status IN ('awaiting_validation','returned','published','provisional','offline')", [orgId]);
  if (submitting && !check.ok) return { ok:false,error:'invalid',check };
  const [updated] = await pool.execute('SELECT * FROM profile_versions WHERE id=?', [draft.id]);
  if (submitting) {
    await pool.execute('UPDATE organizations SET status=? WHERE id=?', ['in_review', orgId]);
    await emailEvent('profile_submitted', 'team', { organization_id: orgId });
  }
  return { ok: true, draft: updated[0] };
}
app.put('/api/me/profile-draft', requireRole('company_user'), async (req, res) => {
  try { res.json(await storeCompanyDraft(req, req.body.content, req.body.reviewed_steps)); } catch (error) { routeError(res, error); }
});
app.post('/api/me/profile-draft/submit', requireRole('company_user'), async (req, res) => {
  try { res.json(await storeCompanyDraft(req, req.body.content, req.body.reviewed_steps, true)); } catch (error) { routeError(res, error); }
});

app.get('/api/team/reviews', requireRole('team'), async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT v.id AS version_id,o.id AS organization_id,o.name AS organization_name,v.submitted_at,o.last_approved_at,o.public_state,v.content FROM profile_versions v JOIN organizations o ON o.id=v.organization_id WHERE v.kind='draft' AND v.status='in_review' ORDER BY v.submitted_at");
    res.json(rows.map((row) => ({ version_id: row.version_id,organization_id: row.organization_id,organization_name: row.organization_name,submitted_at: row.submitted_at,
      first_validation: !row.last_approved_at,public_state: row.public_state,projects: (typeof row.content === 'string' ? JSON.parse(row.content) : row.content).projects.length })));
  } catch (error) { routeError(res, error); }
});
app.get('/api/team/reviews/:id', requireRole('team'), async (req, res) => {
  try {
    const [versions] = await pool.execute('SELECT * FROM profile_versions WHERE id=?', [req.params.id]);
    if (!versions.length) return res.status(404).json({ error: 'not_found' });
    const draft = versions[0];
    const [orgs] = await pool.execute('SELECT * FROM organizations WHERE id=?', [draft.organization_id]);
    const org = orgs[0];
    const [projects] = await pool.execute('SELECT id,profile_type,sort_order,summary,fields FROM projects WHERE organization_id=? ORDER BY sort_order', [org.id]);
    const [imports] = await pool.execute("SELECT project_id,field,previous_answer FROM form_imports WHERE organization_id=? AND mode='reference'", [org.id]);
    res.json({ organization: { id:org.id,name:org.name,status:org.status,public_state:org.public_state,last_approved_at:org.last_approved_at }, draft,
      previous: org.public_state === 'hidden' && !org.last_approved_at ? null : profileSnapshot(org, projects), previousIsProvisional: org.public_state === 'provisional', imports });
  } catch (error) { routeError(res, error); }
});
app.put('/api/team/reviews/:id', requireRole('team'), async (req, res) => {
  try { const [result]=await pool.execute("UPDATE profile_versions SET content=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND kind='draft' AND status='in_review'", [jsonColumn(req.body.content), req.params.id]);if(!result.affectedRows)return res.status(404).json({error:'not_found'});const [rows] = await pool.execute('SELECT * FROM profile_versions WHERE id=?', [req.params.id]); res.json(rows[0]); }
  catch (error) { routeError(res, error); }
});
app.post('/api/team/reviews/:id/approve', requireRole('team'), async (req, res) => {
  const content = req.body.content;
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [versions] = await db.execute("SELECT * FROM profile_versions WHERE id=? AND kind='draft' AND status='in_review' FOR UPDATE", [req.params.id]);
    if (!versions.length) { await db.rollback(); return res.json({ ok: false, error: 'not_in_review' }); }
    const version = versions[0];
    const org = content?.organization || {};
    const organizationFields = ['name','logo_url','cover_url','description','website','city','state','size','segments','partnership_types','leadership','gallery','focal_point'];
    const updates = organizationFields.map((key) => `\`${key}\`=?`).join(',');
    const orgValues = organizationFields.map((key) => jsonColumn(org[key]));
    await db.execute(`UPDATE organizations SET ${updates},status='published',public_state='published',last_approved_at=?,last_updated_at=? WHERE id=?`, [...orgValues,localDate(),localDate(),version.organization_id]);
    const [projects] = await db.execute('SELECT id,profile_type FROM projects WHERE organization_id=?', [version.organization_id]);
    const submittedIds = (content.projects || []).map((project) => project.id);
    if (projects.length !== submittedIds.length || projects.some((project) => !submittedIds.includes(project.id))) throw new Error('projects_changed');
    for (const project of content.projects) await db.execute('UPDATE projects SET summary=?,fields=? WHERE id=? AND organization_id=?', [jsonColumn(project.summary), jsonColumn(project.fields), project.id, version.organization_id]);
    await db.execute("UPDATE profile_versions SET kind='published',status='published',content=?,reviewed_at=UTC_TIMESTAMP(),reviewed_by=?,approved_at=UTC_TIMESTAMP() WHERE id=?", [jsonColumn(content), req.user.id, version.id]);
    await db.execute('INSERT INTO email_outbox (id,template,`to`,data,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP())', [`m-${crypto.randomUUID()}`, 'profile_approved', 'company', jsonColumn({ organization_id: version.organization_id })]);
    await db.commit();
    res.json({ ok: true });
  } catch (error) { await db.rollback(); if (error.message === 'projects_changed') return res.status(400).json({ error: 'projects_changed' }); routeError(res, error); }
  finally { db.release(); }
});
app.post('/api/team/reviews/:id/return', requireRole('team'), async (req, res) => {
  const comment = String(req.body.comment || '').trim();
  if (!comment) return res.json({ ok: false, error: 'comment_required' });
  try {
    const [result] = await pool.execute("UPDATE profile_versions SET content=?,status='returned',review_comment=?,reviewed_at=UTC_TIMESTAMP(),reviewed_by=? WHERE id=? AND kind='draft' AND status='in_review'", [jsonColumn(req.body.content), comment, req.user.id, req.params.id]);
    if (!result.affectedRows) return res.json({ ok: false, error: 'not_in_review' });
    const [rows] = await pool.execute('SELECT organization_id FROM profile_versions WHERE id=?', [req.params.id]);
    await pool.execute("UPDATE organizations SET status='returned' WHERE id=?", [rows[0].organization_id]);
    await emailEvent('profile_returned', 'company', { organization_id: rows[0].organization_id, comment });
    res.json({ ok: true });
  } catch (error) { routeError(res, error); }
});
app.get('/api/team/organizations', requireRole('team'), async (_req, res) => {
  try {
    const [orgs] = await pool.query('SELECT id,name,status,public_state,last_approved_at,last_updated_at,focal_point,demo,is_featured FROM organizations ORDER BY name');
    const [projects] = await pool.query('SELECT organization_id,profile_type FROM projects');
    const [settings] = await pool.execute('SELECT deadlines FROM settings WHERE id=?', ['settings']);
    const outdatedDays = settings[0]?.deadlines?.outdated_profile_alert_days ?? 120;
    const today = new Date(`${localDate()}T12:00:00-03:00`).getTime();
    res.json(orgs.map((org) => {
      const elapsed = org.last_updated_at ? Math.floor((today - new Date(org.last_updated_at).getTime()) / 86400000) : null;
      return { ...org,days_since_update: elapsed,outdated: org.public_state === 'published' && elapsed !== null && elapsed >= outdatedDays,
        projects: projects.filter((project) => project.organization_id === org.id).map((project) => project.profile_type),demo: Boolean(org.demo) };
    }));
  } catch (error) { routeError(res, error); }
});
app.put('/api/team/organizations/:id/public-state', requireRole('team'), async (req, res) => {
  const state = req.body.public_state;
  if (!['published','provisional','hidden'].includes(state)) return res.status(400).json({ error: 'invalid' });
  try {
    const [current]=await pool.execute('SELECT last_approved_at FROM organizations WHERE id=?',[req.params.id]);
    if(!current.length)return res.status(404).json({error:'not_found'});
    if(state==='published'&&!current[0].last_approved_at)return res.status(400).json({error:'approval_required'});
    const status = state === 'hidden' ? 'offline' : state === 'provisional' ? 'provisional' : 'published';
    const [result] = await pool.execute('UPDATE organizations SET public_state=?,status=? WHERE id=?', [state, status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'not_found' });
    const [rows] = await pool.execute('SELECT * FROM organizations WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch (error) { routeError(res, error); }
});

app.get('/api/team/settings', requireRole('team'), async (_req, res) => {
  try { const [rows] = await pool.execute('SELECT * FROM settings WHERE id=?', ['settings']); res.json(rows[0] || null); } catch (error) { routeError(res, error); }
});
app.put('/api/team/settings', requireRole('team'), async (req, res) => {
  const patch = req.body || {};
  const required = ['launch_date','deadlines','goals','origins','apex_strategic_categories'];
  const deadlineKeys = ['provisional_profile_days','provisional_warning_days','validation_reminder_days','validation_reminder_repeat_days','quarterly_update_reminder_days','outdated_profile_alert_days','contact_warning_business_days','contact_overdue_business_days'];
  const fields = required.filter((key) => patch[key] === undefined);
  for(const key of deadlineKeys) if(patch.deadlines?.[key]===undefined) fields.push(`deadlines.${key}`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(patch.launch_date||''))) fields.push('launch_date');
  for (const [key, value] of Object.entries(patch.deadlines || {})) if (!(Array.isArray(value) ? value.every((n) => Number.isInteger(n) && n > 0) : Number.isInteger(value) && value > 0)) fields.push(`deadlines.${key}`);
  for (const [year, goal] of Object.entries(patch.goals || {})) for (const key of ['lead','nia','npia']) if (!Number.isInteger(goal[key]) || goal[key] < 0) fields.push(`goals.${year}.${key}`);
  if(!Array.isArray(patch.origins)) fields.push('origins');
  if(!Array.isArray(patch.apex_strategic_categories)) fields.push('apex_strategic_categories');
  if (fields.length) return res.json({ ok: false, fields });
  try {
    await pool.execute('UPDATE settings SET launch_date=?,deadlines=?,goals=?,origins=?,apex_strategic_categories=?,updated_at=UTC_TIMESTAMP() WHERE id=?',
      [patch.launch_date,jsonColumn(patch.deadlines),jsonColumn(patch.goals),jsonColumn(patch.origins),jsonColumn(patch.apex_strategic_categories),'settings']);
    res.json({ ok: true });
  } catch (error) { routeError(res, error); }
});

if (demoMode) {
  app.post('/api/demo/login-as', async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT u.*, o.name AS organization_name FROM users u LEFT JOIN organizations o ON o.id=u.organization_id WHERE u.id=? AND u.is_demo=1', [req.body.user_id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      await new Promise((resolve,reject)=>req.session.regenerate((err)=>err?reject(err):resolve()));
      req.session.user = { id: rows[0].id, role: rows[0].role };
      res.json({ ok: true, user: safeUser(rows[0], rows[0].organization_name) });
    } catch (error) { routeError(res, error); }
  });
  app.get('/api/demo/company-accounts', async (_req, res) => {
    try { const [rows] = await pool.query("SELECT u.id AS user_id, COALESCE(o.name,u.organization_id) AS organization_name FROM users u LEFT JOIN organizations o ON o.id=u.organization_id WHERE u.is_demo=1 AND u.role='company_user' ORDER BY organization_name"); res.json(rows); }
    catch (error) { routeError(res, error); }
  });
  app.post('/api/demo/reset', requireRole('team'), async (_req,res) => {
    try {
      const seedPath = new URL('./db/seed.js',import.meta.url);
      await execFileAsync(process.execPath,[fileURLToPath(seedPath),'--reset-demo'],{cwd:path.dirname(fileURLToPath(seedPath)),env:process.env,windowsHide:true});
      res.json({ok:true});
    } catch(error) { routeError(res,error); }
  });
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));
let httpServer;
async function start() {
  const [rows] = await pool.query('SELECT DATABASE() AS db,VERSION() AS version');
  if (rows[0]?.db !== process.env.DB_NAME) throw new Error('Database connection does not match configured DB_NAME.');
  if (!String(rows[0].version).startsWith('8.0.')) throw new Error('CompaniesPortfolio requires its configured MySQL 8 database.');
  const [migrations] = await pool.execute("SELECT version FROM schema_migrations WHERE version='001_initial_schema'");
  if (!migrations.length) throw new Error('Database schema is not initialized. Run npm run migrate and npm run seed.');
  httpServer=app.listen(port,'127.0.0.1',()=>console.log(`CompaniesPortfolio API listening on 127.0.0.1:${port}`));
}
start().catch(async(error)=>{console.error(`API startup failed: ${error.message}`);await pool.end();process.exitCode=1;});

for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>httpServer?.close(async()=>{await pool.end();process.exit(0);}));

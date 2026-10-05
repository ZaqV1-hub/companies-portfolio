// THE ONLY DATA GATEWAY OF THE APP.
// Every screen reads and writes through these functions. Today they run on mockStore
// (seed JSON + localStorage); the real version calls the HTTP API with the same
// inputs and outputs (see docs/HANDOFF_CODEX.md). All functions are async on purpose.
import * as store from './mockStore.js';
import { validateDraft } from '../lib/profileValidation.js';

export async function init() {
  await store.init();
}

/** Dev only: discards local changes and reloads data/seed. */
export async function resetDemoData() {
  await store.reset();
}

// ------------------------------------------------------------------ public profile data

// Fields of an organization that may reach public screens. Anything else (focal point,
// workflow status, internal dates) is internal. On the server this whitelist is mandatory
// (spec 1, 6.4: the focal point never appears, not even in API responses to investors).
const PUBLIC_ORG_FIELDS = ['id', 'name', 'logo_url', 'cover_url', 'description', 'website', 'city', 'state', 'size',
  'segments', 'partnership_types', 'leadership', 'gallery', 'public_state', 'last_approved_at', 'is_featured'];

function toPublicOrganization(org, projects) {
  const out = {};
  PUBLIC_ORG_FIELDS.forEach((k) => { out[k] = org[k] === undefined ? null : org[k]; });
  out.projects = projects
    .filter((p) => p.organization_id === org.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({ id: p.id, profile_type: p.profile_type, summary: p.summary, fields: p.fields }));
  return out;
}

function isPublic(org) {
  return org.public_state === 'published' || org.public_state === 'provisional';
}

/**
 * Directory: every organization visible to the public, with its projects.
 * @returns {Promise<PublicOrganization[]>}
 */
export async function listPublicOrganizations() {
  const projects = store.all('projects');
  return store.find('organizations', isPublic).map((o) => toPublicOrganization(o, projects));
}

/**
 * Public profile page. Returns null when the organization is not public.
 * @param {string} id organization id
 */
export async function getPublicOrganization(id) {
  const org = store.get('organizations', id);
  if (!org || !isPublic(org)) return null;
  return toPublicOrganization(org, store.all('projects'));
}

/** Program settings needed by public pages (launch date, deadlines). */
export async function getPublicSettings() {
  const s = store.get('settings', 'settings');
  return { launch_date: s.launch_date };
}

// ------------------------------------------------------------------ session (MOCK authentication)
// The real version uses server sessions / tokens. Passwords are never checked on the client.
const SESSION_KEY = 'cp.v2.session';

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (err) { return null; }
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, role: u.role, name: u.name, email: u.email, organization_id: u.organization_id || null,
    email_verified: !!u.email_verified_at };
}

/** @returns {Promise<User|null>} the logged-in user, without secrets. */
export async function getCurrentUser() {
  const s = readSession();
  return s ? publicUser(store.get('users', s.userId)) : null;
}

/**
 * Demo login. role: 'company_user' | 'team' | 'investor'.
 * @returns {Promise<{ok: boolean, user?: User, error?: string}>}
 */
export async function login(email, password, role) {
  const u = store.find('users', (x) => x.email.toLowerCase() === String(email).trim().toLowerCase() && (!role || x.role === role))[0];
  if (!u || u.password !== password) return { ok: false, error: 'invalid_credentials' };
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id }));
  return { ok: true, user: publicUser(u) };
}

/** Demo shortcut used by the login screens: log in as a given user id. */
export async function loginAs(userId) {
  const u = store.get('users', userId);
  if (!u) return { ok: false, error: 'not_found' };
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id }));
  return { ok: true, user: publicUser(u) };
}

export async function logout() {
  localStorage.removeItem(SESSION_KEY);
}

/** Company accounts available on the demo login screen. */
export async function listDemoCompanyAccounts() {
  const orgs = store.all('organizations');
  return store.find('users', (u) => u.role === 'company_user').map((u) => {
    const o = orgs.find((x) => x.id === u.organization_id);
    return { user_id: u.id, organization_name: o ? o.name : u.organization_id };
  }).sort((a, b) => a.organization_name.localeCompare(b.organization_name));
}

// ------------------------------------------------------------------ company area: profile form (spec 1, 4.2 and 5)
const EDITABLE_STATUSES = ['awaiting_validation', 'filling', 'returned', 'published', 'provisional', 'offline'];

function now() {
  return new Date().toISOString();
}

async function requireUser(role) {
  const u = await getCurrentUser();
  if (!u || u.role !== role) throw new Error('forbidden');
  return u;
}

function snapshotContent(org, projects) {
  const keys = ['name', 'logo_url', 'cover_url', 'description', 'website', 'city', 'state', 'size', 'segments',
    'partnership_types', 'leadership', 'gallery', 'focal_point'];
  const organization = {};
  keys.forEach((k) => { organization[k] = org[k] === undefined ? null : org[k]; });
  return {
    organization,
    projects: projects.filter((p) => p.organization_id === org.id).sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ id: p.id, profile_type: p.profile_type, summary: p.summary, fields: p.fields })),
  };
}

/** The organization's open draft (filling / in_review / returned), or null. */
function openDraft(orgId) {
  return store.find('profile_versions', (v) => v.organization_id === orgId && v.kind === 'draft'
    && ['filling', 'in_review', 'returned'].includes(v.status))[0] || null;
}

/**
 * Company form data for the logged-in company user. Creates the draft from the published (or provisional)
 * profile on first access. For organizations that were never approved, "reference only" fields start empty
 * and the previous Google Forms answer is shown next to them (spec 1, 5.2 and 7).
 * @returns {Promise<{organization, draft, imports, firstValidation: boolean}>}
 */
export async function getMyProfileForm() {
  const user = await requireUser('company_user');
  const org = store.get('organizations', user.organization_id);
  const firstValidation = !org.last_approved_at;
  const imports = firstValidation ? store.find('form_imports', (r) => r.organization_id === org.id) : [];
  let draft = openDraft(org.id);
  if (!draft) {
    const content = snapshotContent(org, store.all('projects'));
    imports.filter((r) => r.mode === 'reference').forEach((r) => {
      const p = content.projects.find((x) => x.id === r.project_id);
      if (!p) return;
      delete p.fields[r.field];
      if (r.field === 'raised') delete p.fields.raised_none;
    });
    draft = store.insert('profile_versions', {
      id: store.newId('pv'), organization_id: org.id, kind: 'draft', status: 'filling', content, reviewed_steps: {},
      created_at: now(), updated_at: now(), submitted_at: null, submitted_by: null, review_comment: null, reviewed_at: null, reviewed_by: null,
    });
  }
  return {
    organization: { id: org.id, name: org.name, status: org.status, public_state: org.public_state, last_approved_at: org.last_approved_at },
    draft,
    imports: imports.map((r) => ({ project_id: r.project_id, field: r.field, mode: r.mode, previous_answer: r.previous_answer })),
    firstValidation,
  };
}

/** Saves the draft ("Salvar rascunho"). Allowed while the draft is not under review. */
export async function saveMyProfileDraft(content, reviewedSteps) {
  const user = await requireUser('company_user');
  const org = store.get('organizations', user.organization_id);
  const draft = openDraft(org.id);
  if (!draft || draft.status === 'in_review') return { ok: false, error: 'locked' };
  // the company cannot add, remove or retype projects (spec 1, 4.6: the team creates projects)
  const projectIds = draft.content.projects.map((p) => p.id + ':' + p.profile_type).join();
  if (content.projects.map((p) => p.id + ':' + p.profile_type).join() !== projectIds) return { ok: false, error: 'projects_changed' };
  const saved = store.update('profile_versions', draft.id, { content, reviewed_steps: reviewedSteps, status: 'filling', updated_at: now() });
  if (EDITABLE_STATUSES.includes(org.status) && org.status !== 'filling') store.update('organizations', org.id, { status: 'filling' });
  return { ok: true, draft: saved };
}

/**
 * "Enviar para revisão": re-validates (required fields + every step reviewed), moves the draft to the
 * team's review queue and notifies the team. The published version stays online meanwhile (spec 1, 4.3).
 */
export async function submitMyProfileForReview(content, reviewedSteps) {
  const user = await requireUser('company_user');
  const saved = await saveMyProfileDraft(content, reviewedSteps);
  if (!saved.ok) return saved;
  const check = validateDraft(content, reviewedSteps);
  if (!check.ok) return { ok: false, error: 'invalid', check };
  const draft = store.update('profile_versions', saved.draft.id, { status: 'in_review', submitted_at: now(), submitted_by: user.id, review_comment: null });
  store.update('organizations', user.organization_id, { status: 'in_review' });
  queueEmail('profile_submitted', 'team', { organization_id: user.organization_id });
  return { ok: true, draft };
}

/** MOCK of the e-mails the server will send (docs/HANDOFF_CODEX.md lists them all). */
function queueEmail(template, to, data) {
  store.insert('email_outbox', { id: store.newId('mail'), template, to, data, created_at: now(), sent: false });
}

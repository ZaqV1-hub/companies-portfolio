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

// ------------------------------------------------------------------ team panel: profile review (spec 1, 4.3 and 4.4)

function todayDate() {
  return now().slice(0, 10);
}

/** Review queue: drafts sent for review, oldest submission first. */
export async function listReviewQueue() {
  await requireUser('team');
  const orgs = store.all('organizations');
  return store.find('profile_versions', (v) => v.kind === 'draft' && v.status === 'in_review')
    .sort((a, b) => (a.submitted_at || '').localeCompare(b.submitted_at || ''))
    .map((v) => {
      const o = orgs.find((x) => x.id === v.organization_id);
      return { version_id: v.id, organization_id: o.id, organization_name: o.name, submitted_at: v.submitted_at,
        first_validation: !o.last_approved_at, public_state: o.public_state, projects: v.content.projects.length };
    });
}

/**
 * Review screen data: the new version, the previous one (published or provisional profile; null for a
 * new company) and the Google Forms answers kept as reference.
 */
export async function getReview(versionId) {
  await requireUser('team');
  const draft = store.get('profile_versions', versionId);
  if (!draft) return null;
  const org = store.get('organizations', draft.organization_id);
  const previous = org.public_state === 'hidden' && !org.last_approved_at ? null : snapshotContent(org, store.all('projects'));
  const imports = store.find('form_imports', (r) => r.organization_id === org.id && r.mode === 'reference')
    .map((r) => ({ project_id: r.project_id, field: r.field, previous_answer: r.previous_answer }));
  return { organization: { id: org.id, name: org.name, status: org.status, public_state: org.public_state, last_approved_at: org.last_approved_at },
    draft, previous, previousIsProvisional: org.public_state === 'provisional', imports };
}

/** Team saves its English edits without deciding yet. */
export async function saveReviewEdits(versionId, content) {
  await requireUser('team');
  return store.update('profile_versions', versionId, { content, updated_at: now() });
}

/** "Aprovar": publishes the version and records "Atualizado em" (spec 1, 4.3). */
export async function approveReview(versionId, content) {
  const user = await requireUser('team');
  const draft = store.get('profile_versions', versionId);
  if (!draft || draft.status !== 'in_review') return { ok: false, error: 'not_in_review' };
  const day = todayDate();
  const o = content.organization;
  store.update('organizations', draft.organization_id, {
    name: o.name, logo_url: o.logo_url, cover_url: o.cover_url, description: o.description, website: o.website, city: o.city,
    state: o.state, size: o.size, segments: o.segments, partnership_types: o.partnership_types, leadership: o.leadership,
    gallery: o.gallery, focal_point: o.focal_point,
    status: 'published', public_state: 'published', last_approved_at: day, last_updated_at: day,
  });
  content.projects.forEach((p) => store.update('projects', p.id, { summary: p.summary, fields: p.fields }));
  const version = store.update('profile_versions', versionId, { kind: 'published', status: 'published', content,
    reviewed_at: now(), reviewed_by: user.id, approved_at: now() });
  queueEmail('profile_approved', 'company', { organization_id: draft.organization_id });
  return { ok: true, version };
}

/** "Devolver": requires a comment; the profile goes back to the company for editing. */
export async function returnReview(versionId, content, comment) {
  const user = await requireUser('team');
  if (!comment || !comment.trim()) return { ok: false, error: 'comment_required' };
  const draft = store.get('profile_versions', versionId);
  if (!draft || draft.status !== 'in_review') return { ok: false, error: 'not_in_review' };
  store.update('profile_versions', versionId, { content, status: 'returned', review_comment: comment.trim(), reviewed_at: now(), reviewed_by: user.id });
  store.update('organizations', draft.organization_id, { status: 'returned' });
  queueEmail('profile_returned', 'company', { organization_id: draft.organization_id, comment: comment.trim() });
  return { ok: true };
}

/** Organizations with their status for the team panel (spec 1, 4.4). Internal data included. */
export async function listOrganizationsForTeam() {
  await requireUser('team');
  const projects = store.all('projects');
  const settings = store.get('settings', 'settings');
  const today = new Date(todayDate());
  return store.all('organizations').map((o) => {
    const last = o.last_updated_at ? new Date(o.last_updated_at) : null;
    const days = last ? Math.floor((today - last) / 86400000) : null;
    return { id: o.id, name: o.name, status: o.status, public_state: o.public_state, last_approved_at: o.last_approved_at,
      last_updated_at: o.last_updated_at, days_since_update: days,
      outdated: o.public_state === 'published' && days != null && days >= settings.deadlines.outdated_profile_alert_days,
      projects: projects.filter((p) => p.organization_id === o.id).map((p) => p.profile_type),
      focal_point: o.focal_point, demo: !!o.demo, is_featured: o.is_featured };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** The team can switch a provisional / offline profile manually (spec 1, 4.4: "A equipe pode reativar manualmente"). */
export async function setOrganizationPublicState(orgId, publicState) {
  await requireUser('team');
  const patch = { public_state: publicState };
  if (publicState === 'hidden') patch.status = 'offline';
  if (publicState === 'provisional') patch.status = 'provisional';
  return store.update('organizations', orgId, patch);
}

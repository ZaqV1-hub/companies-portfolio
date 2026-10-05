// THE ONLY DATA GATEWAY OF THE APP.
// Every screen reads and writes through these functions. Today they run on mockStore
// (seed JSON + localStorage); the real version calls the HTTP API with the same
// inputs and outputs (see docs/HANDOFF_CODEX.md). All functions are async on purpose.
import * as store from './mockStore.js';
import { validateDraft } from '../lib/profileValidation.js';
import { businessDaysBetween, completeness } from '../lib/crm.js';

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
  const org = u.organization_id ? store.get('organizations', u.organization_id) : null;
  return { id: u.id, role: u.role, name: u.name, email: u.email, organization_id: u.organization_id || null,
    organization_name: org ? org.name : null, email_verified: !!u.email_verified_at };
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

// ------------------------------------------------------------------ investor sign-up and login (spec 2, 6.1) — MOCK auth

const TERMS_VERSION = '2026-10';

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

/**
 * Investor sign-up. Required: name, institution, email, country, city, password, accept_terms, accept_privacy.
 * Recommended: role, investor_type. Optional: phone, linkedin.
 * The account stays unverified until the e-mail link is opened (simulated: the token comes back here and
 * a message is written to email_outbox).
 * @returns {Promise<{ok: boolean, error?: string, fields?: string[], user_id?: string, verification_token?: string}>}
 */
export async function registerInvestor(data) {
  const required = ['name', 'institution', 'email', 'country', 'city', 'password'];
  const missing = required.filter((k) => !String(data[k] || '').trim());
  if (!data.accept_terms) missing.push('accept_terms');
  if (!data.accept_privacy) missing.push('accept_privacy');
  if (missing.length) return { ok: false, error: 'missing', fields: missing };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { ok: false, error: 'email', fields: ['email'] };
  const email = normEmail(data.email);
  if (store.find('users', (u) => normEmail(u.email) === email).length) return { ok: false, error: 'email_taken', fields: ['email'] };
  const token = store.newId('verify');
  const user = store.insert('users', {
    id: store.newId('u'), role: 'investor', name: data.name.trim(), email, password: data.password,
    organization_id: null, contact_id: null, email_verified_at: null, verification_token: token, lang: data.lang || 'en',
    investor_profile: {
      institution: data.institution.trim(), country: data.country, city: data.city.trim(), role: (data.role || '').trim() || null,
      investor_type: data.investor_type || null, phone: (data.phone || '').trim() || null, linkedin: (data.linkedin || '').trim() || null,
    },
    terms_accepted_at: now(), privacy_accepted_at: now(), created_at: now(),
  });
  store.insert('consents', { id: store.newId('cons'), user_id: user.id, terms_version: TERMS_VERSION, privacy_version: TERMS_VERSION, accepted_at: now() });
  queueEmail('investor_verify_email', user.email, { user_id: user.id, token });
  return { ok: true, user_id: user.id, verification_token: token };
}

/** Opens the (simulated) confirmation link: marks the e-mail as verified and logs the investor in. */
export async function verifyInvestorEmail(token) {
  const u = store.find('users', (x) => x.verification_token === token)[0];
  if (!u) return { ok: false, error: 'invalid_token' };
  store.update('users', u.id, { email_verified_at: now(), verification_token: null });
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id }));
  return { ok: true, user: publicUser(store.get('users', u.id)) };
}

/** Sends a new confirmation link (simulated). */
export async function resendVerification(userId) {
  const u = store.get('users', userId);
  if (!u || u.email_verified_at) return { ok: false };
  const token = store.newId('verify');
  store.update('users', u.id, { verification_token: token });
  queueEmail('investor_verify_email', u.email, { user_id: u.id, token });
  return { ok: true, verification_token: token };
}

/** Investor login; refuses accounts whose e-mail was not confirmed yet. */
export async function loginInvestor(email, password) {
  const u = store.find('users', (x) => x.role === 'investor' && normEmail(x.email) === normEmail(email))[0];
  if (!u || u.password !== password) return { ok: false, error: 'invalid_credentials' };
  if (!u.email_verified_at) return { ok: false, error: 'not_verified', user_id: u.id };
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id }));
  return { ok: true, user: publicUser(u) };
}

// ------------------------------------------------------------------ "Solicitar contato" (spec 2, 5.1)

/** Finds an institution by name (case/accent-insensitive) or creates it. */
function findOrCreateInstitution(name, extra) {
  const key = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const found = store.find('institutions', (i) => key(i.name) === key(name))[0];
  if (found) return found;
  return store.insert('institutions', {
    id: store.newId('in'), name: name.trim(), investor_type: extra.investor_type || null, niche: null, ticket_min_musd: null, ticket_max_musd: null,
    interest_type: null, sectors: [], description_original: null, description_pt: null, website: null,
    hq_country: extra.country || null, hq_city: extra.city || null, created_at: now(),
  });
}

/**
 * Investor clicks "Request contact" on a profile. Creates or reuses institution and contact (from the
 * sign-up data), creates the relationship (origin "Portfólio", classification Lead) and records the
 * first interaction "Pedido de contato pela plataforma". Notifies company and team; the 15 business-day
 * count starts (contact_request_at).
 * @returns {Promise<{ok: boolean, error?: string, relationship_id?: string, reused?: boolean}>}
 */
export async function requestContact(organizationId, projectId) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'investor') return { ok: false, error: 'login_required' };
  if (!user.email_verified) return { ok: false, error: 'not_verified' };
  const full = store.get('users', user.id);
  const prof = full.investor_profile || {};
  const institution = findOrCreateInstitution(prof.institution || full.name, prof);
  let contact = store.find('contacts', (c) => normEmail(c.email) === normEmail(full.email))[0];
  if (!contact) {
    contact = store.insert('contacts', {
      id: store.newId('ct'), institution_id: institution.id, name: full.name, email: normEmail(full.email), country: prof.country || null,
      city: prof.city || null, role: prof.role || null, linkedin: prof.linkedin || null, phone: prof.phone || null, created_at: now(),
    });
  }
  if (full.contact_id !== contact.id) store.update('users', full.id, { contact_id: contact.id });
  const day = todayDate();
  let rel = store.find('relationships', (r) => r.contact_id === contact.id && r.organization_id === organizationId)[0];
  const reused = !!rel;
  if (!rel) {
    rel = store.insert('relationships', {
      id: store.newId('rel'), contact_id: contact.id, organization_id: organizationId, owner_user_id: null, origin: 'Portfólio',
      status: 'in_progress', classification: 'lead', classification_state: 'validated', suggested: null, npia: null,
      deal_expectation: null, contact_request_at: day, validated_at: null, validated_by: null, created_at: now(),
      apex_control: { dynamics_account: false, contact_registered: false, opportunity_inserted: false, opportunity_word: false,
        strategic_category: 'Indústria da saúde (CNDI Missão 2)', notes: '' },
    });
  } else {
    store.update('relationships', rel.id, { contact_request_at: day });
  }
  store.insert('interactions', {
    id: store.newId('it'), relationship_id: rel.id, date: day, description: 'Pedido de contato pela plataforma', type: 'other',
    apex_product: 'investment_portfolio', event: null, project_id: projectId || null, auto: true, created_by: user.id, created_at: now(),
  });
  queueEmail('contact_request_company', 'company', { organization_id: organizationId, relationship_id: rel.id });
  queueEmail('contact_request_team', 'team', { organization_id: organizationId, relationship_id: rel.id });
  return { ok: true, relationship_id: rel.id, reused };
}

// ------------------------------------------------------------------ contacts registry (spec 2) — CONFIDENTIAL
// Rule enforced in every function below (and mandatory on the server, spec 2, section 10):
// a company only ever receives ITS OWN relationships and interactions; the team sees everything;
// investors see nothing. The Apex control block is team-only.

const PROGRAM_ORG = { id: 'program', name: 'Programa Abiquifi' };

async function crmUser() {
  const u = await getCurrentUser();
  if (!u || (u.role !== 'company_user' && u.role !== 'team')) throw new Error('forbidden');
  return u;
}

/** Relationships the user may see. */
function visibleRelationships(user) {
  return user.role === 'team' ? store.all('relationships') : store.find('relationships', (r) => r.organization_id === user.organization_id);
}

function canSee(user, rel) {
  return rel && (user.role === 'team' || rel.organization_id === user.organization_id);
}

function orgName(id) {
  if (id === PROGRAM_ORG.id) return PROGRAM_ORG.name;
  const o = store.get('organizations', id);
  return o ? o.name : id;
}

function stripForCompany(rel, user) {
  if (user.role === 'team') return rel;
  const { apex_control, ...rest } = rel; // eslint-disable-line no-unused-vars
  return rest;
}

/** Whether a platform contact request still waits for the company's next interaction. */
function requestState(rel, interactions, holidays) {
  if (!rel.contact_request_at) return null;
  const answered = interactions.some((i) => !i.auto && i.date >= rel.contact_request_at);
  if (answered) return null;
  return { requested_at: rel.contact_request_at, business_days: businessDaysBetween(rel.contact_request_at, todayDate(), holidays) };
}

function rowFor(rel, user, settings) {
  const contact = store.get('contacts', rel.contact_id) || {};
  const institution = store.get('institutions', contact.institution_id) || {};
  const interactions = store.find('interactions', (i) => i.relationship_id === rel.id).sort((a, b) => b.date.localeCompare(a.date));
  return {
    relationship: stripForCompany(rel, user),
    organization_name: orgName(rel.organization_id),
    contact: { id: contact.id, name: contact.name, email: contact.email, country: contact.country, city: contact.city, role: contact.role },
    institution: { id: institution.id, name: institution.name },
    last_interaction: interactions[0] ? interactions[0].date : null,
    interaction_count: interactions.length,
    events: Array.from(new Set(interactions.map((i) => i.event).filter(Boolean))),
    interaction_dates: interactions.map((i) => i.date),
    completeness: completeness(contact, institution, rel),
    pending_request: requestState(rel, interactions, settings.holidays),
  };
}

/**
 * Contacts list: the company's own relationships (company user) or the whole base (team).
 * @returns {Promise<{rows: object[], deadlines: object, origins: string[]}>}
 */
export async function listContactRows() {
  const user = await crmUser();
  const settings = store.get('settings', 'settings');
  return { rows: visibleRelationships(user).map((r) => rowFor(r, user, settings)), deadlines: settings.deadlines, origins: settings.origins };
}

/** Contact record (ficha do contato). Returns null when the user may not see it. */
export async function getContactRecord(relationshipId) {
  const user = await crmUser();
  const rel = store.get('relationships', relationshipId);
  if (!canSee(user, rel)) return null;
  const contact = store.get('contacts', rel.contact_id);
  const institution = store.get('institutions', contact.institution_id);
  const settings = store.get('settings', 'settings');
  const interactions = store.find('interactions', (i) => i.relationship_id === rel.id).sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || ''));
  const users = store.all('users');
  return {
    relationship: stripForCompany(rel, user),
    organization_name: orgName(rel.organization_id),
    owner_name: (users.find((u) => u.id === rel.owner_user_id) || {}).name || null,
    contact, institution,
    interactions: interactions.map((i) => ({ ...i, created_by_name: (users.find((u) => u.id === i.created_by) || {}).name || null })),
    completeness: completeness(contact, institution, rel),
    pending_request: requestState(rel, interactions, settings.holidays),
    origins: settings.origins,
    apex_categories: user.role === 'team' ? settings.apex_strategic_categories : undefined,
  };
}

/**
 * "Novo contato": typing an e-mail that already exists fills contact and institution (spec 2, 5.2).
 * Never returns relationships or interactions of other companies; only says whether the CURRENT
 * company already has a relationship with this person.
 */
export async function lookupContactByEmail(email, organizationId) {
  const user = await crmUser();
  const contact = store.find('contacts', (c) => normEmail(c.email) === normEmail(email))[0];
  if (!contact) return null;
  const orgId = user.role === 'team' ? organizationId : user.organization_id;
  const own = store.find('relationships', (r) => r.contact_id === contact.id && r.organization_id === orgId)[0];
  return { contact, institution: store.get('institutions', contact.institution_id), existing_relationship_id: own ? own.id : null };
}

/** Institution search for the "Nome da instituição" field (existing ones are reused). */
export async function searchInstitutions(query) {
  await crmUser();
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  return store.find('institutions', (i) => i.name.toLowerCase().includes(q)).slice(0, 8);
}

/** Companies the team can register contacts for, plus "Programa Abiquifi". */
export async function listContactOwners() {
  await requireUser('team');
  return [PROGRAM_ORG].concat(store.all('organizations').map((o) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name)));
}

const INSTITUTION_KEYS = ['name', 'investor_type', 'niche', 'ticket_min_musd', 'ticket_max_musd', 'interest_type', 'sectors', 'description_original', 'description_pt', 'website'];
const CONTACT_KEYS = ['name', 'email', 'country', 'city', 'role', 'linkedin', 'phone'];

function pickKeys(obj, keys) {
  const out = {};
  keys.forEach((k) => { if (obj && obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

function interactionProblems(it) {
  const errors = [];
  if (!it || !it.date) errors.push('interaction.date');
  else if (it.date > todayDate()) errors.push('interaction.date_future');
  if (!it || !String(it.description || '').trim()) errors.push('interaction.description');
  else if (it.description.length > 500) errors.push('interaction.description_long');
  return errors;
}

/**
 * Creates a contact record: contact + institution (reused when they exist) + relationship (Lead) + first interaction.
 * Only name, institution, e-mail, country, city and the interaction date/description are required (spec 2, 2 and 11).
 * @param {{organization_id?: string, contact: object, institution: object, relationship: object, interaction: object}} payload
 */
export async function createContactRecord(payload) {
  const user = await crmUser();
  const orgId = user.role === 'team' ? payload.organization_id : user.organization_id;
  const c = payload.contact || {};
  const ins = payload.institution || {};
  const errors = [];
  ['name', 'email', 'country', 'city'].forEach((k) => { if (!String(c[k] || '').trim()) errors.push('contact.' + k); });
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) errors.push('contact.email_invalid');
  if (!String(ins.name || '').trim()) errors.push('institution.name');
  if (!orgId) errors.push('organization');
  errors.push(...interactionProblems(payload.interaction));
  if (errors.length) return { ok: false, error: 'invalid', fields: errors };

  let contact = store.find('contacts', (x) => normEmail(x.email) === normEmail(c.email))[0];
  let institution = contact ? store.get('institutions', contact.institution_id) : findOrCreateInstitution(ins.name, { country: c.country, city: c.city });
  // fill blanks of an existing institution / contact (never overwrite what is there)
  const fillBlanks = (current, incoming) => Object.fromEntries(Object.entries(incoming).filter(([k, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)
    && (current[k] == null || current[k] === '' || (Array.isArray(current[k]) && !current[k].length))));
  institution = store.update('institutions', institution.id, fillBlanks(institution, pickKeys(ins, INSTITUTION_KEYS.filter((k) => k !== 'name'))));
  if (!contact) contact = store.insert('contacts', { id: store.newId('ct'), institution_id: institution.id, ...pickKeys(c, CONTACT_KEYS), email: normEmail(c.email), created_at: now() });
  else contact = store.update('contacts', contact.id, fillBlanks(contact, pickKeys(c, CONTACT_KEYS.filter((k) => k !== 'email'))));

  const existing = store.find('relationships', (r) => r.contact_id === contact.id && r.organization_id === orgId)[0];
  if (existing) return { ok: false, error: 'already_exists', relationship_id: existing.id };
  const r = payload.relationship || {};
  const rel = store.insert('relationships', {
    id: store.newId('rel'), contact_id: contact.id, organization_id: orgId, owner_user_id: user.id,
    origin: r.origin || null, status: r.status || 'in_progress', deal_expectation: r.deal_expectation || null,
    classification: 'lead', classification_state: 'validated', suggested: null, npia: null,
    contact_request_at: null, validated_at: null, validated_by: null, created_at: now(),
    apex_control: { dynamics_account: false, contact_registered: false, opportunity_inserted: false, opportunity_word: false,
      strategic_category: 'Indústria da saúde (CNDI Missão 2)', notes: '' },
  });
  const it = payload.interaction;
  store.insert('interactions', { id: store.newId('it'), relationship_id: rel.id, date: it.date, description: it.description.trim(), type: it.type || null,
    apex_product: it.apex_product || null, event: it.event || null, auto: false, created_by: user.id, created_at: now() });
  return { ok: true, relationship_id: rel.id };
}

/** "Nova interação" (spec 2, 5.3): date and description required; date cannot be in the future. */
export async function addInteraction(relationshipId, data) {
  const user = await crmUser();
  const rel = store.get('relationships', relationshipId);
  if (!canSee(user, rel)) return { ok: false, error: 'forbidden' };
  const errors = interactionProblems(data);
  if (errors.length) return { ok: false, error: 'invalid', fields: errors };
  const it = store.insert('interactions', { id: store.newId('it'), relationship_id: rel.id, date: data.date, description: data.description.trim(),
    type: data.type || null, apex_product: data.apex_product || null, event: data.event || null, auto: false, created_by: user.id, created_at: now() });
  return { ok: true, interaction: it };
}

/** Edits contact, institution and relationship data from the contact record (spec 2, 7.2 item 6). */
export async function updateContactRecord(relationshipId, { contact, institution, relationship }) {
  const user = await crmUser();
  const rel = store.get('relationships', relationshipId);
  if (!canSee(user, rel)) return { ok: false, error: 'forbidden' };
  if (contact) {
    const patch = pickKeys(contact, CONTACT_KEYS.filter((k) => k !== 'email'));
    ['name', 'country', 'city'].forEach((k) => { if (k in patch && !String(patch[k] || '').trim()) delete patch[k]; }); // required stay filled
    store.update('contacts', rel.contact_id, patch);
  }
  if (institution) {
    const c = store.get('contacts', rel.contact_id);
    const patch = pickKeys(institution, INSTITUTION_KEYS);
    if ('name' in patch && !String(patch.name || '').trim()) delete patch.name;
    store.update('institutions', c.institution_id, patch);
  }
  if (relationship) store.update('relationships', rel.id, pickKeys(relationship, ['origin', 'status', 'deal_expectation']));
  return { ok: true };
}

/** "Sugerir classificação": NIA or BR, optional justification ≤ 300 (spec 2, 5.4 and 6.4). */
export async function suggestClassification(relationshipId, value, justification) {
  const user = await crmUser();
  const rel = store.get('relationships', relationshipId);
  if (!canSee(user, rel)) return { ok: false, error: 'forbidden' };
  if (!['nia', 'br'].includes(value)) return { ok: false, error: 'invalid_value' };
  if ((justification || '').length > 300) return { ok: false, error: 'too_long' };
  store.update('relationships', rel.id, { suggested: { value, justification: (justification || '').trim(), at: now(), by: user.id, state: 'pending' } });
  queueEmail('classification_suggested', 'team', { relationship_id: rel.id, organization_id: rel.organization_id });
  return { ok: true };
}

/** "Informar anúncio" (NPIA): type a–h, date, amount in USD, description ≤ 500 and confidential flag, all required. */
export async function reportAnnouncement(relationshipId, data) {
  const user = await crmUser();
  const rel = store.get('relationships', relationshipId);
  if (!canSee(user, rel)) return { ok: false, error: 'forbidden' };
  const errors = [];
  if (!'abcdefgh'.includes(data.type || 'x') || !data.type) errors.push('type');
  if (!data.date) errors.push('date');
  if (!(Number.isInteger(data.amount_usd) && data.amount_usd >= 0)) errors.push('amount_usd');
  if (!String(data.description || '').trim() || data.description.length > 500) errors.push('description');
  if (typeof data.confidential !== 'boolean') errors.push('confidential');
  if (errors.length) return { ok: false, error: 'invalid', fields: errors };
  store.update('relationships', rel.id, { npia: { type: data.type, date: data.date, amount_usd: data.amount_usd, description: data.description.trim(),
    confidential: data.confidential, state: 'pending', at: now(), by: user.id } });
  queueEmail('npia_reported', 'team', { relationship_id: rel.id, organization_id: rel.organization_id });
  return { ok: true };
}

// ---------------------------------------------------------------- team only

/** Validates or adjusts a suggested classification (spec 2, 5.4). Only validated classifications count for goals. */
export async function validateClassification(relationshipId, finalValue, comment) {
  const user = await requireUser('team');
  const rel = store.get('relationships', relationshipId);
  const s = rel.suggested || {};
  store.update('relationships', rel.id, {
    classification: finalValue, classification_state: 'validated', validated_at: now(), validated_by: user.id,
    suggested: { ...s, state: s.value === finalValue ? 'validated' : 'adjusted', team_comment: comment || null, decided_at: now() },
  });
  queueEmail('classification_validated', 'company', { relationship_id: rel.id, organization_id: rel.organization_id, value: finalValue });
  return { ok: true };
}

/** Validates (→ NPIA) or rejects an announcement (spec 2, 5.5). */
export async function validateAnnouncement(relationshipId, accept, comment) {
  const user = await requireUser('team');
  const rel = store.get('relationships', relationshipId);
  const npia = { ...rel.npia, state: accept ? 'validated' : 'rejected', validated_at: now(), validated_by: user.id, team_comment: comment || null };
  const patch = { npia };
  if (accept) Object.assign(patch, { classification: 'npia', classification_state: 'validated', validated_at: now(), validated_by: user.id });
  store.update('relationships', rel.id, patch);
  queueEmail('npia_validated', 'company', { relationship_id: rel.id, organization_id: rel.organization_id, accepted: accept });
  return { ok: true };
}

/** "Controle Apex" (spec 2, 6.5) — team only. */
export async function updateApexControl(relationshipId, data) {
  await requireUser('team');
  const rel = store.get('relationships', relationshipId);
  store.update('relationships', rel.id, { apex_control: { ...rel.apex_control, ...pickKeys(data, ['dynamics_account', 'contact_registered',
    'opportunity_inserted', 'opportunity_word', 'strategic_category', 'notes']) } });
  return { ok: true };
}

function normName(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

/** Possible duplicates: same person with different e-mails, same institution with different names (spec 2, 5.6). */
export async function listDuplicateCandidates() {
  await requireUser('team');
  const out = [];
  const contacts = store.all('contacts');
  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const a = normName(contacts[i].name); const b = normName(contacts[j].name);
      if (a && b && editDistance(a, b) <= 2) out.push({ kind: 'contact', a: contacts[i], b: contacts[j] });
    }
  }
  const inst = store.all('institutions');
  for (let i = 0; i < inst.length; i++) {
    for (let j = i + 1; j < inst.length; j++) {
      const a = normName(inst[i].name); const b = normName(inst[j].name);
      if (a && b && (editDistance(a, b) <= 2 || a.startsWith(b + ' ') || b.startsWith(a + ' '))) out.push({ kind: 'institution', a: inst[i], b: inst[j] });
    }
  }
  return out;
}

/** Merges contact `dropId` into `keepId` (relationships and interactions move; duplicate relationships are combined). */
export async function mergeContacts(keepId, dropId) {
  await requireUser('team');
  store.find('relationships', (r) => r.contact_id === dropId).forEach((r) => {
    const twin = store.find('relationships', (x) => x.contact_id === keepId && x.organization_id === r.organization_id)[0];
    if (twin) {
      store.find('interactions', (i) => i.relationship_id === r.id).forEach((i) => store.update('interactions', i.id, { relationship_id: twin.id }));
      store.remove('relationships', r.id);
    } else {
      store.update('relationships', r.id, { contact_id: keepId });
    }
  });
  store.find('users', (u) => u.contact_id === dropId).forEach((u) => store.update('users', u.id, { contact_id: keepId }));
  store.remove('contacts', dropId);
  return { ok: true };
}

/** Merges institution `dropId` into `keepId`. */
export async function mergeInstitutions(keepId, dropId) {
  await requireUser('team');
  store.find('contacts', (c) => c.institution_id === dropId).forEach((c) => store.update('contacts', c.id, { institution_id: keepId }));
  store.remove('institutions', dropId);
  return { ok: true };
}

/**
 * Team dashboard (spec 2, 7.3): validated Lead/NIA/NPIA per year vs. goals, follow-up indicators,
 * validation queue and pending items per company.
 */
export async function getCrmDashboard(year) {
  await requireUser('team');
  const settings = store.get('settings', 'settings');
  const y = String(year);
  const rels = store.all('relationships');
  const its = store.all('interactions');
  const counting = (r) => r.organization_id !== undefined;
  const leads = rels.filter((r) => counting(r) && (r.created_at || '').startsWith(y) && !['br', 'incomplete'].includes(r.classification));
  const nias = rels.filter((r) => ['nia', 'npia'].includes(r.classification) && (r.validated_at || '').startsWith(y));
  const npias = rels.filter((r) => r.npia && r.npia.state === 'validated' && (r.npia.validated_at || '').startsWith(y));
  const meetings = its.filter((i) => i.date.startsWith(y) && ['in_person_meeting', 'virtual_meeting'].includes(i.type));
  const eventOrgs = new Set(its.filter((i) => i.date.startsWith(y) && i.apex_product === 'promotion_event')
    .map((i) => (rels.find((r) => r.id === i.relationship_id) || {}).organization_id).filter((id) => id && id !== 'program'));
  const queue = [];
  rels.forEach((r) => {
    if (r.suggested && r.suggested.state === 'pending') queue.push({ kind: 'classification', relationship_id: r.id, organization_name: orgName(r.organization_id), contact_name: (store.get('contacts', r.contact_id) || {}).name, suggested: r.suggested, current: r.classification });
    if (r.npia && r.npia.state === 'pending') queue.push({ kind: 'npia', relationship_id: r.id, organization_name: orgName(r.organization_id), contact_name: (store.get('contacts', r.contact_id) || {}).name, npia: r.npia });
  });
  const byCompany = {};
  rels.forEach((r) => {
    const contact = store.get('contacts', r.contact_id) || {};
    const inst = store.get('institutions', contact.institution_id) || {};
    const st = requestState(r, its.filter((i) => i.relationship_id === r.id), settings.holidays);
    const k = r.organization_id;
    byCompany[k] = byCompany[k] || { organization_id: k, organization_name: orgName(k), records: 0, completeness_sum: 0, overdue: 0, warning: 0 };
    byCompany[k].records += 1;
    byCompany[k].completeness_sum += completeness(contact, inst, r).pct;
    if (st && st.business_days > settings.deadlines.contact_overdue_business_days) byCompany[k].overdue += 1;
    else if (st && st.business_days >= settings.deadlines.contact_warning_business_days) byCompany[k].warning += 1;
  });
  return {
    year: Number(year),
    goals: (settings.goals || {})[y] || { lead: 0, nia: 0, npia: 0 },
    indicators: { lead: leads.length, nia: nias.length, npia: npias.length, meetings: meetings.length, event_companies: eventOrgs.size },
    queue: queue.sort((a, b) => ((a.suggested || a.npia).at || '').localeCompare((b.suggested || b.npia).at || '')),
    by_company: Object.values(byCompany).map((c) => ({ ...c, avg_completeness: Math.round(c.completeness_sum / c.records) }))
      .sort((a, b) => b.overdue - a.overdue || a.avg_completeness - b.avg_completeness),
    years: Object.keys(settings.goals || {}),
  };
}

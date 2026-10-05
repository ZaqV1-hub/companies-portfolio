// THE ONLY DATA GATEWAY OF THE APP.
// Every screen reads and writes through these functions. Today they run on mockStore
// (seed JSON + localStorage); the real version calls the HTTP API with the same
// inputs and outputs (see docs/HANDOFF_CODEX.md). All functions are async on purpose.
import * as store from './mockStore.js';

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

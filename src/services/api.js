// The single data gateway for the UI. Signatures and response shapes follow
// docs/HANDOFF_CODEX.md; state and authorization live on the API server.
async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined;
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.error || `http_${response.status}`);
    error.status = response.status;
    error.data = result;
    throw error;
  }
  return result;
}

export async function uploadImage(file, kind) {
  const form = new FormData();
  form.append('image', file);
  const response = await fetch(`/api/uploads?kind=${encodeURIComponent(kind)}`, { method:'POST',credentials:'same-origin',body:form });
  const result = await response.json().catch(() => null);
  if (!response.ok) { const error = new Error(result?.error || `http_${response.status}`); error.status=response.status; error.data=result; throw error; }
  return result.url;
}

const q = (value) => encodeURIComponent(value ?? '');
const put = (path, body) => request(path, { method: 'PUT', body });
const post = (path, body) => request(path, { method: 'POST', body });

export async function init() { await request('/health'); }
export async function resetDemoData() { return post('/demo/reset'); }
export async function listPublicOrganizations() { return request('/public/organizations'); }
export async function getPublicOrganization(id) { try { return await request(`/public/organizations/${q(id)}`); } catch (error) { if (error.status === 404) return null; throw error; } }
export async function getPublicSettings() { return request('/public/settings'); }

export async function getCurrentUser() { try { return await request('/me'); } catch (error) { if (error.status === 401) return null; throw error; } }
export async function login(email, password, role) { return post('/auth/login', { email, password, role }); }
export async function loginAs(userId) { return post('/demo/login-as', { user_id: userId }); }
export async function logout() { return post('/auth/logout'); }
export async function listDemoCompanyAccounts() { return request('/demo/company-accounts'); }

export async function getMyProfileForm() { return request('/me/profile-form'); }
export async function saveMyProfileDraft(content, reviewedSteps) { return put('/me/profile-draft', { content, reviewed_steps: reviewedSteps }); }
export async function submitMyProfileForReview(content, reviewedSteps) { return post('/me/profile-draft/submit', { content, reviewed_steps: reviewedSteps }); }

export async function listReviewQueue() { return request('/team/reviews'); }
export async function getReview(versionId) { try { return await request(`/team/reviews/${q(versionId)}`); } catch (error) { if (error.status === 404) return null; throw error; } }
export async function saveReviewEdits(versionId, content) { return put(`/team/reviews/${q(versionId)}`, { content }); }
export async function approveReview(versionId, content) { return post(`/team/reviews/${q(versionId)}/approve`, { content }); }
export async function returnReview(versionId, content, comment) { return post(`/team/reviews/${q(versionId)}/return`, { content, comment }); }
export async function listOrganizationsForTeam() { return request('/team/organizations'); }
export async function setOrganizationPublicState(orgId, publicState) { return put(`/team/organizations/${q(orgId)}/public-state`, { public_state: publicState }); }

export async function registerInvestor(data) { return post('/investors', data); }
export async function verifyInvestorEmail(token) { return post('/investors/verify', { token }); }
export async function resendVerification(email) { return post('/investors/verify/resend', { email }); }
export async function loginInvestor(email, password) { return login(email, password, 'investor'); }
export async function requestContact(organizationId, projectId) { return post(`/organizations/${q(organizationId)}/contact-requests`, { project_id: projectId }); }

export async function listContactRows() { return request('/contacts'); }
export async function getContactRecord(relationshipId) { try { return await request(`/contacts/${q(relationshipId)}`); } catch (error) { if (error.status === 404) return null; throw error; } }
export async function lookupContactByEmail(email, organizationId) { return request(`/contacts/lookup?email=${q(email)}&organization_id=${q(organizationId)}`); }
export async function searchInstitutions(query) { return request(`/institutions?q=${q(query)}`); }
export async function listContactOwners() { return request('/team/contact-owners'); }
export async function createContactRecord(payload) { return post('/contacts', payload); }
export async function addInteraction(relationshipId, data) { return post(`/contacts/${q(relationshipId)}/interactions`, data); }
export async function updateContactRecord(relationshipId, { contact, institution, relationship }) { return request(`/contacts/${q(relationshipId)}`, { method: 'PATCH', body: { contact, institution, relationship } }); }
export async function suggestClassification(relationshipId, value, justification) { return post(`/contacts/${q(relationshipId)}/classification-suggestions`, { value, justification }); }
export async function reportAnnouncement(relationshipId, data) { return post(`/contacts/${q(relationshipId)}/npia`, data); }
export async function validateClassification(relationshipId, finalValue, comment) { return post(`/team/contacts/${q(relationshipId)}/classification`, { value: finalValue, comment }); }
export async function validateAnnouncement(relationshipId, accept, comment) { return post(`/team/contacts/${q(relationshipId)}/npia/decision`, { accept, comment }); }
export async function updateApexControl(relationshipId, data) { return put(`/team/contacts/${q(relationshipId)}/apex-control`, data); }
export async function listDuplicateCandidates() { return request('/team/duplicates'); }
export async function mergeContacts(keepId, dropId) { return post('/team/merge/contacts', { keep_id: keepId, drop_id: dropId }); }
export async function mergeInstitutions(keepId, dropId) { return post('/team/merge/institutions', { keep_id: keepId, drop_id: dropId }); }
export async function getCrmDashboard(year) { return request(`/team/contacts/dashboard?year=${q(year)}`); }
export async function getSettings() { return request('/team/settings'); }
export async function updateSettings(patch) { return put('/team/settings', patch); }

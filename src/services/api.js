// The single data gateway for the UI. Signatures and response shapes follow
// docs/HANDOFF_CODEX.md; state and authorization live on the API server.
async function request(path, { method = 'GET', body } = {}) {
  let response;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      response = await fetch(`/api${path}`, {
        method,
        credentials: 'same-origin',
        cache: method === 'GET' ? 'no-store' : 'default',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      if (method !== 'GET' || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    if (method === 'GET' && [502, 503, 504].includes(response.status) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    break;
  }
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
export async function listPublicOrganizations() { return request('/public/organizations'); }
export async function getPublicOrganization(id) { try { return await request(`/public/organizations/${q(id)}`); } catch (error) { if (error.status === 404) return null; throw error; } }
export async function getPublicSettings() { return request('/public/settings'); }
export async function listPublicDocuments() { return request('/public/documents'); }

export async function getCurrentUser() { try { return await request(`/me?fresh=${Date.now()}`); } catch (error) { if (error.status === 401) return null; throw error; } }
export async function login(email, password, role) { return post('/auth/login', { email, password, role }); }
export async function logout() { return post('/auth/logout'); }

export async function getMyProfileForm() { return request('/me/profile-form'); }
export async function saveMyProfileDraft(content, reviewedSteps) { return put('/me/profile-draft', { content, reviewed_steps: reviewedSteps }); }
export async function submitMyProfileForReview(content, reviewedSteps) { return post('/me/profile-draft/submit', { content, reviewed_steps: reviewedSteps }); }
export async function acceptInitialProfile(content) { return post('/me/profile-draft/accept-initial', { content }); }

export async function listReviewQueue() { return request('/team/reviews'); }
export async function getReview(versionId) { try { return await request(`/team/reviews/${q(versionId)}`); } catch (error) { if (error.status === 404) return null; throw error; } }
export async function saveReviewEdits(versionId, content) { return put(`/team/reviews/${q(versionId)}`, { content }); }
export async function approveReview(versionId, content) { return post(`/team/reviews/${q(versionId)}/approve`, { content }); }
export async function returnReview(versionId, content, comment) { return post(`/team/reviews/${q(versionId)}/return`, { content, comment }); }
export async function listOrganizationsForTeam() { return request('/team/organizations'); }
export async function setOrganizationPublicState(orgId, publicState) { return put(`/team/organizations/${q(orgId)}/public-state`, { public_state: publicState }); }
export async function createOrganization(name,email) { return post('/team/organizations', { name,email }); }
export async function updateOrganizationEmail(id,email) { return request(`/team/organizations/${q(id)}/contact`, { method:'PATCH',body:{ email } }); }
export async function inviteOrganization(id,lang) { return post(`/team/organizations/${q(id)}/invite`, { lang }); }
export async function getTeamOrganizationForm(id) { return request(`/team/organizations/${q(id)}/profile-form`); }
export async function saveTeamOrganizationForm(id,content) { return put(`/team/organizations/${q(id)}/profile-form`, { content }); }
export async function saveTeamOrganizationFormAndInvite(id,content,lang) { return post(`/team/organizations/${q(id)}/profile-form/send-invite`, { content,lang }); }
export async function getCompanyInvitation(token) { return request(`/company/invitation?token=${q(token)}`); }
export async function acceptCompanyInvitation(data) { return post('/company/invitation/accept', data); }

export async function registerInvestor(data) { return post('/investors', data); }
export async function getInvestorBrowseStatus() { return request(`/investors/browse?fresh=${Date.now()}`); }
export async function startInvestorBrowse(data) { return post('/investors/browse', data); }
export async function startInvestorEmail(data) { return post('/investors/email/start', data); }
export async function confirmInvestorEmail(token) { return post('/investors/email/confirm', { token }); }
export async function investorEmailStatus() { return request('/investors/email/status'); }
export async function verifyInvestorEmail(token) { return post('/investors/verify', { token }); }
export async function resendVerification(email) { return post('/investors/verify/resend', { email }); }
export async function loginInvestor(email, password) { return login(email, password, 'investor'); }
export async function requestPasswordReset(email) { return post('/auth/password-reset/request', { email }); }
export async function confirmPasswordReset(token, password) { return post('/auth/password-reset/confirm', { token,password }); }
export async function requestContact(organizationId, projectId) { return post(`/organizations/${q(organizationId)}/contact-requests`, { project_id: projectId }); }
export async function getInvestorAccount() { return request('/investors/me'); }
export async function updateInvestorAccount(data) { return request('/investors/me', { method:'PATCH', body:data }); }
export async function addInvestorFavorite(organizationId) { return post(`/investors/favorites/${q(organizationId)}`, {}); }
export async function removeInvestorFavorite(organizationId) { return request(`/investors/favorites/${q(organizationId)}`, { method:'DELETE' }); }

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
export async function listTeamDocuments() { return request('/team/documents'); }
export async function uploadDocument(file, titlePt, titleEn) {
  const form = new FormData();
  form.append('file', file); form.append('title_pt', titlePt); form.append('title_en', titleEn);
  const response = await fetch('/api/team/documents', { method:'POST', credentials:'same-origin', body:form });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `http_${response.status}`);
  return result;
}
export async function updateDocument(id, data) { return request(`/team/documents/${q(id)}`, { method:'PATCH', body:data }); }
export async function deleteDocument(id) { return request(`/team/documents/${q(id)}`, { method:'DELETE' }); }

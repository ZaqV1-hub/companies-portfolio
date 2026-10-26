import { html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js';
import { useI18n } from '../../lib/i18n.js';
import { navigate } from '../../lib/router.js';
import { draftToPublic } from '../../lib/draftPreview.js';
import { validateDraft } from '../../lib/profileValidation.js';
import { getCompanyPreview, clearCompanyPreview } from '../../lib/companyPreviewState.js';
import { ProfileView } from '../../components/profile/ProfileView.js?v=20261026-profile-layout2';

export function CompanyPreviewPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.getMyProfileForm().then(setData).catch(() => setMessage(t('form.preview_load_error'))); }, []);
  if (!data) return html`<div class="section">${message || t('common.loading')}</div>`;
  const snapshot = getCompanyPreview();
  const content = snapshot?.content || data.draft.content;
  const reviewed = snapshot?.reviewed || data.draft.reviewed_steps || {};
  const unsaved = Boolean(snapshot && JSON.stringify(snapshot.content) !== JSON.stringify(data.draft.content));
  const pending = unsaved || data.organization.status === 'filling' || data.draft.status === 'returned';
  const locked = data.draft.status === 'in_review';
  const check = validateDraft(content, reviewed);
  const org = draftToPublic(data.organization, content);
  const backToEdit = () => navigate('/company/profile');
  const submit = async () => {
    if (!check.ok) { setMessage(t('form.preview_incomplete')); return; }
    setBusy(true); setMessage('');
    try {
      const result = await api.submitMyProfileForReview(content, reviewed);
      if (!result.ok) throw new Error('submit_failed');
      clearCompanyPreview();
      navigate('/company/profile?step=preview');
    } catch { setMessage(t('form.preview_submit_error')); setBusy(false); }
  };
  return html`<div class="company-preview-page">
    <div class="company-preview-toolbar">
      <div><strong>${t('form.preview_company_title')}</strong><span>${t('form.preview_company_note')}</span></div>
      <button type="button" class="btn btn-outline" onClick=${backToEdit}>${t('form.preview_back_edit')}</button>
    </div>
    <${ProfileView} org=${org} projectId=${projectId || org.projects[0]?.id} onSelectProject=${setProjectId}
      onRequestContact=${() => {}} preview=${true} />
    ${(pending || message) && html`<div class="company-preview-actions" role="status">
      <div><strong>${unsaved ? t('form.preview_unsaved') : t('form.preview_pending')}</strong>
        ${message && html`<small>${message}</small>`}
        ${!check.ok && html`<small>${t('form.preview_incomplete')}</small>`}</div>
      <div class="company-preview-buttons"><button type="button" class="btn btn-outline" onClick=${backToEdit}>${t('form.preview_back_edit')}</button>
        ${!locked && html`<button type="button" class="btn btn-lime" disabled=${busy || !check.ok} onClick=${submit}>${t('form.submit')}</button>`}</div>
    </div>`}
  </div>`;
}

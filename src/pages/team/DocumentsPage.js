import { html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js?v=20261014-documents1';
import { useI18n } from '../../lib/i18n.js';

function DocumentRow({ document, onChanged }) {
  const { t } = useI18n();
  const [titlePt,setTitlePt] = useState(document.title_pt);
  const [titleEn,setTitleEn] = useState(document.title_en);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const save = async (published) => {
    setBusy(true); setError('');
    try { await api.updateDocument(document.id,{title_pt:titlePt,title_en:titleEn,published}); await onChanged(); }
    catch { setError(t('documents.error')); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(t('documents.confirm_delete'))) return;
    setBusy(true); setError('');
    try { await api.deleteDocument(document.id); await onChanged(); }
    catch { setError(t('documents.error')); setBusy(false); }
  };
  return html`<article class="team-document">
    <div class="team-document-head"><strong>${document.original_name}</strong><span class=${document.published ? 'status-pill s-published' : 'status-pill s-awaiting_validation'}>${t(document.published ? 'documents.published' : 'documents.draft')}</span></div>
    <div class="crm-grid">
      <label class="crm-field"><span class="field-label">${t('documents.title_pt')}</span><input class="input input-sm" maxlength="160" value=${titlePt} onInput=${(e)=>setTitlePt(e.target.value)} /></label>
      <label class="crm-field"><span class="field-label">${t('documents.title_en')}</span><input class="input input-sm" maxlength="160" value=${titleEn} onInput=${(e)=>setTitleEn(e.target.value)} /></label>
    </div>
    ${error && html`<p class="field-error" role="alert">${error}</p>`}
    <div class="document-actions">
      <a class="btn btn-outline" href=${`/api/team/documents/${document.id}/file`} target="_blank" rel="noopener">${t('documents.view')}</a>
      <button class="btn btn-outline" type="button" disabled=${busy || !titlePt.trim() || !titleEn.trim()} onClick=${()=>save(document.published)}>${t('documents.save')}</button>
      <button class="btn btn-lime" type="button" disabled=${busy || !titlePt.trim() || !titleEn.trim()} onClick=${()=>save(!document.published)}>${t(document.published ? 'documents.unpublish' : 'documents.publish')}</button>
      <button class="btn-link" type="button" disabled=${busy} onClick=${remove}>${t('documents.delete')}</button>
    </div>
  </article>`;
}

export function DocumentsPage() {
  const { t } = useI18n();
  const [documents,setDocuments] = useState(null);
  const [titlePt,setTitlePt] = useState('');
  const [titleEn,setTitleEn] = useState('');
  const [file,setFile] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const load = async () => setDocuments(await api.listTeamDocuments());
  useEffect(() => { load().catch(()=>setError(t('documents.error'))); }, []);
  const upload = async (event) => {
    event.preventDefault();
    if (!file || !titlePt.trim() || !titleEn.trim()) return;
    setBusy(true); setError('');
    try { await api.uploadDocument(file,titlePt.trim(),titleEn.trim()); setTitlePt(''); setTitleEn(''); setFile(null); event.target.reset(); await load(); }
    catch { setError(t('documents.error')); }
    finally { setBusy(false); }
  };
  return html`<div class="crm-page settings">
    <div class="crm-sticky"><div><h1 class="page-title">${t('documents.manage_title')}</h1><p class="page-subtitle">${t('documents.manage_intro')}</p></div></div>
    <section class="form-card crm-block">
      <h2 class="block-title">${t('documents.add')}</h2>
      <form onSubmit=${upload} class="document-upload">
        <div class="crm-grid">
          <label class="crm-field"><span class="field-label">${t('documents.title_pt')}</span><input class="input input-sm" required maxlength="160" value=${titlePt} onInput=${(e)=>setTitlePt(e.target.value)} /></label>
          <label class="crm-field"><span class="field-label">${t('documents.title_en')}</span><input class="input input-sm" required maxlength="160" value=${titleEn} onInput=${(e)=>setTitleEn(e.target.value)} /></label>
        </div>
        <label class="crm-field"><span class="field-label">${t('documents.file')}</span><input class="input input-sm" type="file" accept="application/pdf,.pdf" required onChange=${(e)=>setFile(e.target.files[0]||null)} /></label>
        <p class="form-help">${t('documents.limit')}</p>
        ${error && html`<p class="field-error" role="alert">${error}</p>`}
        <button class="btn btn-lime btn-lg" type="submit" disabled=${busy}>${t('documents.upload')}</button>
      </form>
    </section>
    <section class="form-card crm-block"><h2 class="block-title">${t('documents.list')}</h2>
      ${documents === null ? html`<p>${t('common.loading')}</p>` : documents.length ? documents.map((document)=>html`<${DocumentRow} key=${document.id} document=${document} onChanged=${load} />`) : html`<p class="section-note">${t('documents.empty_admin')}</p>`}
    </section>
  </div>`;
}

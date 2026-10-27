// Team panel · review queue and review screen (spec 1, 4.3).
import { cx, html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js?v=20261026-tags-feedback1';
import { LangProvider, useI18n } from '../../lib/i18n.js';
import { formatDate } from '../../lib/format.js';
import { href, navigate } from '../../lib/router.js';
import { IMAGE_FIELDS, LEADERSHIP_FIELD, ORG_FIELDS, projectFields, readField } from '../../lib/formSchema.js';
import { collectTexts, displayLines, sameValue } from '../../lib/fieldDisplay.js';
import { draftToPublic } from '../../lib/draftPreview.js';
import { ProfileView } from '../../components/profile/ProfileView.js?v=20261026-tags-feedback1';
import { InviteLanguageModal } from '../../components/InviteLanguageModal.js';

export function ReviewQueuePage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState(null);
  useEffect(() => { api.listReviewQueue().then(setRows); }, []);
  if (!rows) return html`<div>${t('common.loading')}</div>`;
  const cols = { gridTemplateColumns:'minmax(190px,2fr) minmax(160px,1.4fr) minmax(120px,1fr) minmax(90px,.8fr) 130px' };
  return html`<div class="team-list-page">
    <div class="team-list-head"><div><h1 class="page-title">${t('review.queue_title')}</h1>
      <div class="page-subtitle">${t('review.queue_subtitle')}</div></div>
      <span class="team-count">${rows.length} ${lang === 'pt' ? 'aguardando' : 'pending'}</span></div>
    <div class="table-card team-table">
      <div class="trow thead" style=${cols}>
        <div>${t('review.col_org')}</div><div>${t('review.col_type')}</div><div>${t('review.col_submitted')}</div><div>${t('review.col_online')}</div><div></div>
      </div>
      ${rows.length === 0 && html`<div class="team-empty"><div class="team-empty-mark">✓</div><strong>${t('review.queue_empty')}</strong><p>${lang === 'pt' ? 'As próximas alterações enviadas pelas empresas aparecerão aqui.' : 'New changes submitted by companies will appear here.'}</p></div>`}
      ${rows.map((r) => html`<div class="trow" key=${r.version_id} style=${cols}>
        <div data-label=${t('review.col_org')}><strong>${r.organization_name}</strong></div>
        <div data-label=${t('review.col_type')}><span class="validation-kind">${r.first_validation ? t('review.first_validation') : t('review.update')}</span></div>
        <div data-label=${t('review.col_submitted')}>${formatDate(r.submitted_at, lang)}</div>
        <div data-label=${t('review.col_online')}><span class=${'air-state ' + (r.public_state === 'hidden' ? 'off' : 'on')}>${r.public_state === 'hidden' ? t('review.online_hidden') : t('review.online_published')}</span></div>
        <div><a class="btn btn-lime" href=${href('/team/review/' + r.version_id)}>${t('review.open')}</a></div>
      </div>`)}
    </div>
  </div>`;
}

function CompareRow({ field, before, after, i18n, reference, onlyChanges, isNew }) {
  const changed = !isNew && !sameValue(before, after);
  if (onlyChanges && !changed && !isNew) return null;
  const prev = displayLines(field, before, i18n);
  const next = displayLines(field, after, i18n);
  const extraEnglish = (value) => field.type === 'text' ? [] : collectTexts(value).filter((entry) => entry.en)
    .map((entry) => `EN${entry.path.length ? ' ' + entry.path.map((part) => typeof part === 'number' ? part + 1 : part).join(' · ') : ''}: ${entry.en}`);
  return html`<div class=${cx('cmp-row', changed && 'changed')}>
    <div class="cmp-label">${i18n.t('fields.' + field.key + '.label')}${field.internal && html` 🔒`}
      ${changed && html`<span class="changed-chip">${i18n.t('review.changed')}</span>`}</div>
    <div class="cmp-col">
      ${prev.length ? prev.map((l, i) => html`<div key=${i} class="cmp-line">${l}</div>`) : html`<div class="cmp-empty">—</div>`}
      ${field.type === 'image' && before && html`<div class="image-preview" style=${{ backgroundImage: "url('" + before + "')" }}></div>`}
      ${field.type === 'gallery' && (before || []).map((item, i) => html`<div class="image-preview" key=${i} style=${{ backgroundImage: "url('" + item.url + "')" }}></div>`)}
      ${extraEnglish(before).map((line, i) => html`<div class="cmp-line cmp-english" key=${'en' + i}>${line}</div>`)}
      ${reference && html`<div class="previous-answer">${i18n.t('review.forms_answer')}: ${reference}</div>`}
    </div>
    <div class="cmp-col">
      ${next.length ? next.map((l, i) => html`<div key=${i} class="cmp-line">${l}</div>`) : html`<div class="cmp-empty">—</div>`}
      ${extraEnglish(after).map((line, i) => html`<div class="cmp-line cmp-english" key=${'en' + i}>${line}</div>`)}
      ${field.type === 'image' && after && html`<div class="image-preview" style=${{ backgroundImage: "url('" + after + "')" }}></div>`}
      ${field.type === 'gallery' && (after || []).map((item, i) => html`<div class="image-preview" key=${i} style=${{ backgroundImage: "url('" + item.url + "')" }}></div>`)}
    </div>
  </div>`;
}

export function ReviewPage({ versionId }) {
  const i18n = useI18n();
  const { t, lang } = i18n;
  const [data, setData] = useState(null);
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [tab, setTab] = useState('compare');
  const [previewLang, setPreviewLang] = useState('en');
  const [returning, setReturning] = useState(false);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => { api.getReview(versionId).then(setData); }, [versionId]);
  if (!data) return html`<div>${t('common.loading')}</div>`;

  const content = data.draft.content;
  const isNew = !data.previous;
  const prevContent = data.previous || { organization: {}, projects: [] };
  const refFor = (projectId, key) => (data.imports.find((r) => (r.project_id || null) === (projectId || null) && r.field === key) || {}).previous_answer;
  const editable = data.draft.status === 'in_review';

  const orgRows = (fields) => fields.map((f) => html`<${CompareRow} key=${f.key} field=${f} i18n=${i18n} onlyChanges=${onlyChanges} isNew=${isNew}
    before=${readField(prevContent.organization, f)} after=${readField(content.organization, f)} reference=${refFor(null, f.key)} />`);

  const sections = [
    html`<section class="cmp-section" key="org"><h2 class="block-title">${t('form.step_organization')}</h2>${orgRows(ORG_FIELDS)}</section>`,
    ...content.projects.map((p, idx) => {
      const prevP = (prevContent.projects || []).find((x) => x.id === p.id) || { fields: {} };
      const before = { ...prevP.fields, summary: prevP.summary };
      const after = { ...p.fields, summary: p.summary };
      return html`<section class="cmp-section" key=${p.id}>
        <h2 class="block-title">${t('form.step_project')} ${content.projects.length > 1 ? idx + 1 : ''} · ${t('profile_type.' + p.profile_type)}</h2>
        ${projectFields(p, content.projects.length).map((f) => html`<${CompareRow} key=${f.key} field=${f} i18n=${i18n} onlyChanges=${onlyChanges} isNew=${isNew}
          before=${readField(before, f)} after=${readField(after, f)} reference=${refFor(p.id, f.key)} />`)}
      </section>`;
    }),
    html`<section class="cmp-section" key="lead"><h2 class="block-title">${t('form.step_leadership')}</h2>${orgRows([LEADERSHIP_FIELD])}</section>`,
    html`<section class="cmp-section" key="img"><h2 class="block-title">${t('form.step_images')}</h2>${orgRows(IMAGE_FIELDS)}</section>`,
  ];

  const approve = async () => {
    const res = await api.approveReview(versionId, content);
    if (res.ok) navigate('/team/review');
  };
  const doReturn = async () => {
    const res = await api.returnReview(versionId, content, comment);
    if (res.ok) navigate('/team/review'); else setMessage(t('review.comment_required'));
  };

  return html`<div class="review-page">
    <a class="btn-link" href=${href('/team/review')}>← ${t('review.queue_title')}</a>
    <div class="form-top" style=${{ marginTop: '10px' }}>
      <div>
        <h1 class="page-title">${data.organization.name}</h1>
        <div class="page-subtitle">${isNew ? t('review.first_validation') : t('review.update')} · ${t('review.col_submitted')}: ${formatDate(data.draft.submitted_at, lang)}
          · ${data.organization.public_state === 'hidden' ? t('review.online_hidden') : t('review.online_published')}</div>
      </div>
      ${editable && html`<div class="review-actions">
        <button type="button" class="btn btn-navy-outline btn-lg" onClick=${() => setReturning(true)}>${t('review.return')}</button>
        <button type="button" class="btn btn-lime btn-lg" onClick=${approve}>${t('review.approve')}</button>
      </div>`}
    </div>
    ${message && html`<div class="notice">${message}</div>`}
    ${returning && html`<div class="return-box">
      <label class="form-label" for="return-comment">${t('review.return_comment')} (${lang === 'pt' ? 'opcional' : 'optional'})</label>
      <textarea id="return-comment" class="input input-sm" rows="3" value=${comment} onInput=${(e) => setComment(e.target.value)}></textarea>
      <div class="review-actions">
        <button type="button" class="btn btn-outline" onClick=${() => setReturning(false)}>${t('review.cancel')}</button>
        <button type="button" class="btn btn-lime" onClick=${doReturn}>${t('review.confirm_return')}</button>
      </div>
    </div>`}
    <div class="notice">${t('review.online_note')}</div>
    <div class="tabs">
      <button type="button" class=${cx('tab', tab === 'compare' && 'on')} onClick=${() => setTab('compare')}>${t('review.tab_compare')}</button>
      <button type="button" class=${cx('tab', tab === 'preview' && 'on')} onClick=${() => setTab('preview')}>${t('review.tab_preview')}</button>
      ${tab === 'compare' && !isNew && html`<label class="check-line" style=${{ margin: '0 0 0 auto' }}>
        <input type="checkbox" checked=${onlyChanges} onChange=${(e) => setOnlyChanges(e.target.checked)} /> ${t('review.only_changes')}</label>`}
      ${tab === 'preview' && html`<div class="lang-switch" style=${{ marginLeft: 'auto' }}>${['en', 'pt'].map((l) => html`<button key=${l} type="button" aria-pressed=${previewLang === l} onClick=${() => setPreviewLang(l)}>${l.toUpperCase()}</button>`)}</div>`}
    </div>
    ${tab === 'compare'
      ? html`<div class="cmp">
          <div class="cmp-row cmp-head"><div></div><div>${isNew ? t('review.previous_forms') : data.previousIsProvisional ? t('review.previous_provisional') : t('review.previous')}</div><div>${t('review.new')}</div></div>
          ${sections}
        </div>`
      : html`<div class="preview-frame"><${LangProvider} key=${previewLang} forced=${previewLang}>
          <${PreviewOne} org=${draftToPublic(data.organization, content)} />
        <//></div>`}
  </div>`;
}

function PreviewOne({ org }) {
  const [pid, setPid] = useState(org.projects[0].id);
  return html`<${ProfileView} org=${org} projectId=${pid} onSelectProject=${setPid} onRequestContact=${() => {}} />`;
}

// ------------------------------------------------------------------ organizations and their status (spec 1, 4.4)
const STATUSES = ['awaiting_validation', 'filling', 'in_review', 'returned', 'published', 'provisional', 'offline'];

export function OrganizationsPage() {
  const i18n = useI18n();
  const { t, lang } = i18n;
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [editingEmail, setEditingEmail] = useState(null);
  const [emailValue, setEmailValue] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteTarget, setInviteTarget] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [tagTarget, setTagTarget] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagBusy, setTagBusy] = useState(false);
  const load = () => { setLoadError(false); return Promise.all([api.listOrganizationsForTeam(),api.listProfileTags()]).then(([organizations,tags]) => { setRows(organizations);setCatalog(tags); }).catch(() => setLoadError(true)); };
  useEffect(() => { load(); }, []);
  if (loadError) return html`<div class="empty-state"><strong>${t('orgs.load_error')}</strong><button type="button" class="btn btn-lime" onClick=${load}>${t('orgs.retry')}</button></div>`;
  if (!rows) return html`<div>${t('common.loading')}</div>`;
  const list = rows.filter((r) => (!status || r.status === status) && (!q || r.name.toLowerCase().includes(q.toLowerCase())));
  const cols = { gridTemplateColumns: 'minmax(230px,2fr) minmax(145px,1fr) minmax(120px,.9fr) minmax(100px,.8fr) minmax(240px,1.8fr)' };
  const toggleOnline = async (r) => {
    if (r.public_state === 'hidden' && !r.last_approved_at) return;
    const next = r.public_state === 'hidden' ? 'published' : 'hidden';
    await api.setOrganizationPublicState(r.id, next);
    load();
  };
  const create = async (event) => {
    event.preventDefault(); setNotice('');
    try { const org = await api.createOrganization(newName,newEmail); navigate('/team/orgs/' + org.id); }
    catch { setNotice(lang === 'pt' ? 'Confira o nome e o e-mail da empresa.' : 'Check the company name and email.'); }
  };
  const saveEmail = async (r) => {
    try { await api.updateOrganizationEmail(r.id,emailValue); setEditingEmail(null); await load(); setNotice(lang === 'pt' ? 'E-mail atualizado.' : 'Email updated.'); }
    catch { setNotice(lang === 'pt' ? 'Não foi possível salvar o e-mail.' : 'Could not save the email.'); }
  };
  const invite = async (r,language) => {
    setInviteBusy(true); setInviteError('');
    try { const result = await api.inviteOrganization(r.id,language); setNotice(lang === 'pt' ? `Convite preparado para ${result.email}.` : `Invitation queued for ${result.email}.`); setInviteTarget(null); await load(); }
    catch (error) { setInviteError(error.message === 'email_has_account' ? (lang === 'pt' ? 'Este e-mail já tem acesso. Use a recuperação de senha.' : 'This email already has access. Use password reset.') : (lang === 'pt' ? 'Não foi possível enviar o convite.' : 'Could not send the invitation.')); }
    finally { setInviteBusy(false); }
  };
  const createTag = async (event) => {
    event.preventDefault();
    try { await api.createProfileTag(newTag);setNewTag('');await load();setNotice(lang === 'pt' ? 'Tag criada. Agora você pode atribuí-la às empresas.' : 'Tag created. You can now assign it to companies.'); }
    catch (error) { setNotice(error.message === 'duplicate_tag' ? (lang === 'pt' ? 'Essa tag já existe.' : 'This tag already exists.') : (lang === 'pt' ? 'Não foi possível criar a tag.' : 'Could not create the tag.')); }
  };
  const saveTags = async () => {
    setTagBusy(true);
    try { await api.setOrganizationTags(tagTarget.id,selectedTags);setTagTarget(null);await load();setNotice(lang === 'pt' ? 'Tags da empresa atualizadas.' : 'Company tags updated.'); }
    catch { setNotice(lang === 'pt' ? 'Não foi possível salvar as tags.' : 'Could not save the tags.'); }
    finally { setTagBusy(false); }
  };
  return html`<div class="team-list-page">
    <div class="team-list-head"><div><h1 class="page-title">${t('orgs.title')}</h1>
      <div class="page-subtitle">${t('orgs.subtitle')}</div></div>
      <button type="button" class="btn btn-lime btn-lg" onClick=${() => setCreating(!creating)}>${lang === 'pt' ? '+ Criar organização' : '+ Create organization'}</button></div>
    ${creating && html`<form class="table-card" style=${{ padding:'20px',marginTop:'16px' }} onSubmit=${create}>
      <div style=${{ display:'flex',gap:'12px',flexWrap:'wrap',alignItems:'end' }}>
        <label class="form-label">${lang === 'pt' ? 'Nome da empresa' : 'Company name'}<input class="input input-sm" required maxLength="80" value=${newName} onInput=${(e) => setNewName(e.target.value)} /></label>
        <label class="form-label">${lang === 'pt' ? 'E-mail que receberá o convite' : 'Email that will receive the invitation'}<input class="input input-sm" type="email" required value=${newEmail} onInput=${(e) => setNewEmail(e.target.value)} /></label>
        <button class="btn btn-lime" type="submit">${lang === 'pt' ? 'Criar e preencher perfil' : 'Create and fill profile'}</button>
      </div></form>`}
    ${notice && html`<div class="notice" role="status">${notice}</div>`}
    <section class="table-card team-tag-manager" aria-labelledby="team-tags-title">
      <div><h2 id="team-tags-title" class="block-title">${lang === 'pt' ? 'Tags do portfólio' : 'Portfolio tags'}</h2>
        <p class="page-subtitle">${lang === 'pt' ? 'Crie tags próprias da Abiquifi e escolha em quais empresas elas aparecem.' : 'Create custom tags and choose which companies display them.'}</p></div>
      <form class="team-tag-create" onSubmit=${createTag}><input class="input input-sm" aria-label=${lang === 'pt' ? 'Texto da nova tag' : 'New tag text'} placeholder=${lang === 'pt' ? 'Escreva uma nova tag' : 'Type a new tag'} maxLength="80" required value=${newTag} onInput=${(e) => setNewTag(e.target.value)} /><button class="btn btn-lime" type="submit">${lang === 'pt' ? 'Criar tag' : 'Create tag'}</button></form>
      <div class="team-tag-list">${catalog.length ? catalog.map((tag) => html`<span class="tag" key=${tag}>${tag}</span>`) : html`<span class="cell-sub">${lang === 'pt' ? 'Nenhuma tag criada ainda.' : 'No tags created yet.'}</span>`}</div>
    </section>
    <div class="table-card team-table">
      <div class="table-tools"><input class="input input-sm" type="search" placeholder=${t('orgs.search')} value=${q} onInput=${(e) => setQ(e.target.value)} />
        <select class="input input-sm" value=${status} onChange=${(e) => setStatus(e.target.value)}><option value="">${lang === 'pt' ? 'Todos os status' : 'All statuses'}</option>${STATUSES.map((s) => html`<option value=${s}>${i18n.label('org_status',s)}</option>`)}</select></div>
      <div class="trow thead" style=${cols}><div>${t('review.col_org')}</div><div>${t('orgs.col_status')}</div><div>${t('orgs.col_updated')}</div><div>${t('review.col_online')}</div><div></div></div>
      ${list.map((r) => html`<div class="trow" key=${r.id} style=${cols}>
        <div data-label=${t('review.col_org')}><strong>${r.name}</strong>${r.demo && html` <span class="pill">demo</span>`}
          <div class="cell-sub">${r.focal_point?.name || ''}</div>
          ${Boolean(r.custom_tags?.length) && html`<div class="team-org-tags">${r.custom_tags.map((tag) => html`<span class="tag" key=${tag}>${tag}</span>`)}</div>`}
          ${editingEmail === r.id ? html`<div style=${{ display:'flex',gap:'6px',marginTop:'8px' }}><input class="input input-sm" type="email" aria-label=${lang === 'pt' ? 'E-mail do convite' : 'Invitation email'} value=${emailValue} onInput=${(e) => setEmailValue(e.target.value)} /><button type="button" class="btn btn-outline" onClick=${() => saveEmail(r)}>${lang === 'pt' ? 'Salvar' : 'Save'}</button></div>` : html`<div class="cell-sub">${lang === 'pt' ? 'Convite: ' : 'Invitation: '}${r.invitation_email || '—'} <button type="button" class="btn-link" onClick=${() => { setEditingEmail(r.id);setEmailValue(r.invitation_email || ''); }}>${lang === 'pt' ? 'Editar e-mail' : 'Edit email'}</button></div>`}</div>
        <div data-label=${t('orgs.col_status')}><span class=${'status-pill s-' + r.status}>${r.status === 'provisional' ? (lang === 'pt' ? 'Aguardando validação' : 'Awaiting validation') : i18n.label('org_status', r.status)}</span></div>
        <div data-label=${t('orgs.col_updated')}>${r.last_updated_at ? formatDate(r.last_updated_at, lang) : '—'}
          ${r.outdated && html`<div class="cell-alert">${t('orgs.outdated', { n: r.days_since_update })}</div>`}</div>
        <div data-label=${t('review.col_online')}><span class=${'air-state ' + (r.public_state === 'hidden' ? 'off' : 'on')}>${r.public_state === 'hidden' ? t('review.online_hidden') : t('review.online_published')}</span></div>
        <div style=${{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <a class="btn btn-outline" href=${href('/team/orgs/' + r.id)}>${lang === 'pt' ? 'Editar perfil' : 'Edit profile'}</a>
          <button type="button" class="btn btn-outline" onClick=${() => { setTagTarget(r);setSelectedTags(r.custom_tags || []); }}>${lang === 'pt' ? 'Gerenciar tags' : 'Manage tags'}</button>
          <button type="button" class="btn btn-outline" onClick=${() => { setInviteError(''); setInviteTarget(r); }}>${lang === 'pt' ? 'Enviar convite' : 'Send invitation'}</button>
          ${r.public_state !== 'hidden' && html`<a class="btn btn-outline" href=${href('/org/' + r.id)} target="_blank">↗</a>`}
          <button type="button" class="btn btn-outline" disabled=${r.public_state === 'hidden' && !r.last_approved_at} title=${r.public_state === 'hidden' && !r.last_approved_at ? (lang === 'pt' ? 'A empresa precisa validar o perfil antes da publicação.' : 'The company must validate the profile before publication.') : ''} onClick=${() => toggleOnline(r)}>${r.public_state === 'hidden' ? (lang === 'pt' ? 'Colocar no ar' : 'Publish') : t('orgs.take_offline')}</button>
        </div>
      </div>`)}
    </div>
    ${inviteTarget && html`<${InviteLanguageModal} email=${inviteTarget.invitation_email} busy=${inviteBusy} error=${inviteError} onClose=${() => { setInviteTarget(null); setInviteError(''); }} onConfirm=${(language) => invite(inviteTarget,language)} />`}
    ${tagTarget && html`<div class="modal-backdrop invite-modal-backdrop" onClick=${(event) => { if (event.target === event.currentTarget && !tagBusy) setTagTarget(null); }}>
      <section class="modal invite-modal" role="dialog" aria-modal="true" aria-labelledby="tag-assignment-title">
        <button type="button" class="modal-close" aria-label=${lang === 'pt' ? 'Fechar' : 'Close'} disabled=${tagBusy} onClick=${() => setTagTarget(null)}>×</button>
        <div class="kicker">${lang === 'pt' ? 'ORGANIZAÇÕES' : 'ORGANIZATIONS'}</div>
        <h2 class="form-title" id="tag-assignment-title">${lang === 'pt' ? 'Tags de ' : 'Tags for '}${tagTarget.name}</h2>
        <p class="form-subtitle">${lang === 'pt' ? 'As tags selecionadas aparecem no perfil público da empresa.' : 'Selected tags appear on the public company profile.'}</p>
        <div class="tag-checklist">${catalog.length ? catalog.map((tag) => html`<label class="tag-check" key=${tag}><input type="checkbox" checked=${selectedTags.includes(tag)} disabled=${tagBusy} onChange=${(e) => setSelectedTags(e.target.checked ? [...selectedTags,tag] : selectedTags.filter((item) => item !== tag))} /><span>${tag}</span></label>`) : html`<p>${lang === 'pt' ? 'Crie uma tag antes de atribuí-la.' : 'Create a tag before assigning it.'}</p>`}</div>
        <div class="invite-modal-actions"><button type="button" class="btn btn-outline" disabled=${tagBusy} onClick=${() => setTagTarget(null)}>${lang === 'pt' ? 'Cancelar' : 'Cancel'}</button><button type="button" class="btn btn-lime" disabled=${tagBusy} onClick=${saveTags}>${lang === 'pt' ? 'Salvar tags' : 'Save tags'}</button></div>
      </section></div>`}
  </div>`;
}

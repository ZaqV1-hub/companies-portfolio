// Team panel · review queue and review screen (spec 1, 4.3).
import { cx, html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js';
import { LangProvider, useI18n } from '../../lib/i18n.js';
import { formatDate } from '../../lib/format.js';
import { href, navigate } from '../../lib/router.js';
import { IMAGE_FIELDS, LEADERSHIP_FIELD, ORG_FIELDS, projectFields, readField, writeField } from '../../lib/formSchema.js';
import { collectTexts, displayLines, sameValue, setEnglish } from '../../lib/fieldDisplay.js';
import { draftToPublic } from '../../lib/draftPreview.js';
import { ProfileView } from '../../components/profile/ProfileView.js';

export function ReviewQueuePage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState(null);
  useEffect(() => { api.listReviewQueue().then(setRows); }, []);
  if (!rows) return html`<div>${t('common.loading')}</div>`;
  return html`<div>
    <h1 class="page-title">${t('review.queue_title')}</h1>
    <div class="page-subtitle" style=${{ marginBottom: '22px' }}>${t('review.queue_subtitle')}</div>
    <div class="table-card">
      <div class="trow thead" style=${{ gridTemplateColumns: '2fr 1.2fr 1fr 1fr 120px' }}>
        <div>${t('review.col_org')}</div><div>${t('review.col_type')}</div><div>${t('review.col_submitted')}</div><div>${t('review.col_online')}</div><div></div>
      </div>
      ${rows.length === 0 && html`<div class="empty-row">${t('review.queue_empty')}</div>`}
      ${rows.map((r) => html`<div class="trow" key=${r.version_id} style=${{ gridTemplateColumns: '2fr 1.2fr 1fr 1fr 120px' }}>
        <div><strong>${r.organization_name}</strong><div class="cell-sub">${t('common.projects_count', { n: r.projects })}</div></div>
        <div>${r.first_validation ? t('review.first_validation') : t('review.update')}</div>
        <div>${formatDate(r.submitted_at, lang)}</div>
        <div>${t('review.online_' + r.public_state)}</div>
        <div><a class="btn btn-lime" href=${href('/team/review/' + r.version_id)}>${t('review.open')}</a></div>
      </div>`)}
    </div>
  </div>`;
}

function TextEditors({ value, onChange, i18n }) {
  const texts = collectTexts(value);
  if (!texts.length) return null;
  return html`<div class="en-editors">
    <div class="en-title">${i18n.t('review.english_version')}</div>
    ${texts.map((x) => html`<div class="en-row" key=${x.path.join('.')}>
      <div class="en-pt">PT: ${x.pt || '—'}</div>
      <textarea class=${cx('input input-sm', !x.en && x.pt && 'missing')} rows=${x.pt.length > 120 ? 3 : 1} value=${x.en}
        placeholder=${i18n.t('review.en_placeholder')} onInput=${(e) => onChange(setEnglish(value, x.path, e.target.value))}></textarea>
    </div>`)}
  </div>`;
}

function CompareRow({ field, before, after, onChange, i18n, reference, onlyChanges, isNew }) {
  const changed = !isNew && !sameValue(before, after);
  if (onlyChanges && !changed && !isNew) return null;
  const prev = displayLines(field, before, i18n);
  const next = displayLines(field, after, i18n);
  return html`<div class=${cx('cmp-row', changed && 'changed')}>
    <div class="cmp-label">${i18n.t('fields.' + field.key + '.label')}${field.internal && html` 🔒`}
      ${changed && html`<span class="changed-chip">${i18n.t('review.changed')}</span>`}</div>
    <div class="cmp-col">
      ${prev.length ? prev.map((l, i) => html`<div key=${i} class="cmp-line">${l}</div>`) : html`<div class="cmp-empty">—</div>`}
      ${reference && html`<div class="previous-answer">${i18n.t('review.forms_answer')}: ${reference}</div>`}
    </div>
    <div class="cmp-col">
      ${next.length ? next.map((l, i) => html`<div key=${i} class="cmp-line">${l}</div>`) : html`<div class="cmp-empty">—</div>`}
      ${field.type === 'image' && after && html`<div class="image-preview" style=${{ backgroundImage: "url('" + after + "')" }}></div>`}
      <${TextEditors} value=${after} onChange=${onChange} i18n=${i18n} />
    </div>
  </div>`;
}

export function ReviewPage({ versionId }) {
  const i18n = useI18n();
  const { t, lang } = i18n;
  const [data, setData] = useState(null);
  const [content, setContent] = useState(null);
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [tab, setTab] = useState('compare');
  const [previewLang, setPreviewLang] = useState('en');
  const [returning, setReturning] = useState(false);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => { api.getReview(versionId).then((d) => { setData(d); setContent(d && d.draft.content); }); }, [versionId]);
  if (!data) return html`<div>${t('common.loading')}</div>`;

  const isNew = !data.previous;
  const prevContent = data.previous || { organization: {}, projects: [] };
  const refFor = (projectId, key) => (data.imports.find((r) => (r.project_id || null) === (projectId || null) && r.field === key) || {}).previous_answer;
  const editable = data.draft.status === 'in_review';

  const orgRows = (fields) => fields.map((f) => html`<${CompareRow} key=${f.key} field=${f} i18n=${i18n} onlyChanges=${onlyChanges} isNew=${isNew}
    before=${readField(prevContent.organization, f)} after=${readField(content.organization, f)} reference=${refFor(null, f.key)}
    onChange=${(v) => setContent({ ...content, organization: writeField(content.organization, f, v) })} />`);

  const sections = [
    html`<section class="cmp-section" key="org"><h2 class="block-title">${t('form.step_organization')}</h2>${orgRows(ORG_FIELDS)}</section>`,
    ...content.projects.map((p, idx) => {
      const prevP = (prevContent.projects || []).find((x) => x.id === p.id) || { fields: {} };
      const before = { ...prevP.fields, summary: prevP.summary };
      const after = { ...p.fields, summary: p.summary };
      return html`<section class="cmp-section" key=${p.id}>
        <h2 class="block-title">${t('form.step_project')} ${content.projects.length > 1 ? idx + 1 : ''} · ${t('profile_type.' + p.profile_type)}</h2>
        ${projectFields(p, content.projects.length).map((f) => html`<${CompareRow} key=${f.key} field=${f} i18n=${i18n} onlyChanges=${onlyChanges} isNew=${isNew}
          before=${readField(before, f)} after=${readField(after, f)} reference=${refFor(p.id, f.key)}
          onChange=${(v) => setContent({ ...content, projects: content.projects.map((x) => {
            if (x.id !== p.id) return x;
            return f.key === 'summary' ? { ...x, summary: v } : { ...x, fields: writeField(x.fields, f, v) };
          }) })} />`)}
      </section>`;
    }),
    html`<section class="cmp-section" key="lead"><h2 class="block-title">${t('form.step_leadership')}</h2>${orgRows([LEADERSHIP_FIELD])}</section>`,
    html`<section class="cmp-section" key="img"><h2 class="block-title">${t('form.step_images')}</h2>${orgRows(IMAGE_FIELDS)}</section>`,
  ];

  const save = async () => { await api.saveReviewEdits(versionId, content); setMessage(t('review.saved')); };
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
          · ${t('review.online_' + data.organization.public_state)}</div>
      </div>
      ${editable && html`<div class="review-actions">
        <button type="button" class="btn btn-outline btn-lg" onClick=${save}>${t('review.save')}</button>
        <button type="button" class="btn btn-navy-outline btn-lg" onClick=${() => setReturning(true)}>${t('review.return')}</button>
        <button type="button" class="btn btn-lime btn-lg" onClick=${approve}>${t('review.approve')}</button>
      </div>`}
    </div>
    ${message && html`<div class="notice">${message}</div>`}
    ${returning && html`<div class="return-box">
      <label class="form-label" for="return-comment">${t('review.return_comment')} *</label>
      <textarea id="return-comment" class="input input-sm" rows="3" value=${comment} onInput=${(e) => setComment(e.target.value)}></textarea>
      <div class="review-actions">
        <button type="button" class="btn btn-outline" onClick=${() => setReturning(false)}>${t('review.cancel')}</button>
        <button type="button" class="btn btn-lime" disabled=${!comment.trim()} onClick=${doReturn}>${t('review.confirm_return')}</button>
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
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const load = () => api.listOrganizationsForTeam().then(setRows);
  useEffect(() => { load(); }, []);
  if (!rows) return html`<div>${t('common.loading')}</div>`;
  const counts = Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]));
  const list = rows.filter((r) => (!status || r.status === status) && (!q || r.name.toLowerCase().includes(q.toLowerCase())));
  const cols = { gridTemplateColumns: '2fr 1fr 1.2fr 1fr 1fr 150px' };
  const toggleOnline = async (r) => {
    const next = r.public_state === 'hidden' ? (r.last_approved_at ? 'published' : 'provisional') : 'hidden';
    await api.setOrganizationPublicState(r.id, next);
    load();
  };
  return html`<div>
    <h1 class="page-title">${t('orgs.title')}</h1>
    <div class="page-subtitle" style=${{ marginBottom: '22px' }}>${t('orgs.subtitle')}</div>
    <div class="stat-grid">${STATUSES.map((s) => html`<button key=${s} type="button" class=${cx('stat-card', status === s && 'on')} onClick=${() => setStatus(status === s ? '' : s)}>
      <div class="stat-value">${counts[s]}</div><div class="stat-label">${i18n.label('org_status', s)}</div></button>`)}
    </div>
    <div class="table-card">
      <div class="table-tools"><input class="input input-sm" type="search" placeholder=${t('orgs.search')} value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
      <div class="trow thead" style=${cols}><div>${t('review.col_org')}</div><div>${t('orgs.col_profiles')}</div><div>${t('orgs.col_status')}</div><div>${t('orgs.col_approved')}</div><div>${t('orgs.col_updated')}</div><div></div></div>
      ${list.map((r) => html`<div class="trow" key=${r.id} style=${cols}>
        <div><strong>${r.name}</strong>${r.demo && html` <span class="pill">demo</span>`}
          <div class="cell-sub">🔒 ${r.focal_point ? r.focal_point.name + ' · ' + r.focal_point.email : ''}</div></div>
        <div>${r.projects.join(', ')}</div>
        <div><span class=${'status-pill s-' + r.status}>${i18n.label('org_status', r.status)}</span>
          <div class="cell-sub">${t('review.online_' + r.public_state)}</div></div>
        <div>${r.last_approved_at ? formatDate(r.last_approved_at, lang) : '—'}</div>
        <div>${r.last_updated_at ? formatDate(r.last_updated_at, lang) : '—'}
          ${r.outdated && html`<div class="cell-alert">${t('orgs.outdated', { n: r.days_since_update })}</div>`}</div>
        <div style=${{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          ${r.public_state !== 'hidden' && html`<a class="btn btn-outline" href=${'#/org/' + r.id} target="_blank">↗</a>`}
          <button type="button" class="btn btn-outline" onClick=${() => toggleOnline(r)}>${r.public_state === 'hidden' ? t('orgs.reactivate') : t('orgs.take_offline')}</button>
        </div>
      </div>`)}
    </div>
  </div>`;
}

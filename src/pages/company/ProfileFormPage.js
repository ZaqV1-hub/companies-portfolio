// Company area · step-by-step profile form (spec 1, sections 4.2 and 5).
// Steps: Organization → one per project → Leadership → Images → Preview & submit.
import { cx, html, useEffect, useMemo, useState } from '../../lib/html.js';
import * as api from '../../services/api.js';
import { LangProvider, useI18n } from '../../lib/i18n.js';
import { formatDate } from '../../lib/format.js';
import { IMAGE_FIELDS, LEADERSHIP_FIELD, ORG_FIELDS, formSteps, projectFields, readField, writeField } from '../../lib/formSchema.js';
import { fieldProblems, validateDraft } from '../../lib/profileValidation.js';
import { draftToPublic } from '../../lib/draftPreview.js';
import { subtitle } from '../../lib/profileModel.js';
import { FieldInput } from '../../components/form/inputs.js';
import { ProfileView } from '../../components/profile/ProfileView.js';

function problemText(i18n, p) {
  return i18n.t('form.errors.' + p.code, p);
}

function Field({ field, value, onChange, i18n, disabled, mark, showErrors, stepId }) {
  const domId = 'f-' + stepId.replace(':', '-') + '-' + field.key;
  const problems = showErrors ? fieldProblems(field, value) : [];
  return html`<div class=${cx('form-field', field.group && 'grouped', problems.length && 'has-error')} id=${domId}>
    <div class="form-field-head">
      <label class="form-label" for=${domId + '-input'}>${i18n.t('fields.' + field.key + '.label')}${field.req && html`<span class="req" aria-label="required"> *</span>`}</label>
      ${mark && mark.mode === 'prefilled' && html`<span class="import-badge">${i18n.t('form.imported')}</span>`}
      ${field.internal && html`<span class="internal-badge">🔒</span>`}
    </div>
    <div class="form-help">${i18n.t('fields.' + field.key + '.help')}</div>
    <div class="form-control-row">
      <div class="form-control"><${FieldInput} field=${field} value=${value} onChange=${onChange} i18n=${i18n} disabled=${disabled} id=${domId + '-input'} /></div>
      ${mark && mark.mode === 'reference' && mark.previous_answer && html`<div class="previous-answer">${i18n.t('form.previous_answer', { answer: mark.previous_answer })}</div>`}
    </div>
    ${problems.map((p, i) => html`<div class="field-error" key=${i}>${problemText(i18n, p)}</div>`)}
  </div>`;
}

function stepTitle(step, content, i18n) {
  if (step.kind === 'project') {
    const p = content.projects.find((x) => x.id === step.projectId);
    const n = content.projects.indexOf(p) + 1;
    return i18n.t('form.step_project') + (content.projects.length > 1 ? ' ' + n : '') + ' · ' + i18n.t('profile_type_short.' + p.profile_type);
  }
  return i18n.t('form.step_' + step.kind);
}

/** Preview in both languages: renders ProfileView inside a nested language provider. */
function Preview({ orgMeta, content }) {
  const i18n = useI18n();
  const [lang, setLang] = useState('en');
  const org = draftToPublic(orgMeta, content, { publicState: 'published', approvedAt: null });
  return html`<div>
    <p class="form-help">${i18n.t('form.preview_intro')}</p>
    <div class="preview-bar">
      <span class="form-label">${i18n.t('form.preview_lang')}</span>
      <div class="lang-switch">${['en', 'pt'].map((l) => html`<button key=${l} type="button" aria-pressed=${lang === l} onClick=${() => setLang(l)}>${l.toUpperCase()}</button>`)}</div>
      ${lang === 'en' && html`<span class="form-help">${i18n.t('form.preview_en_note')}</span>`}
    </div>
    <div class="preview-frame">
      <${LangProvider} key=${lang} forced=${lang}>
        <${PreviewBody} org=${org} />
      <//>
    </div>
  </div>`;
}

function PreviewBody({ org }) {
  const [pid, setPid] = useState(org.projects[0] && org.projects[0].id);
  return html`<${ProfileView} org=${org} projectId=${pid} onSelectProject=${setPid} onRequestContact=${() => {}} />`;
}

export function ProfileFormPage({ stepParam, onNavigateStep }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [data, setData] = useState(null);
  const [content, setContent] = useState(null);
  const [reviewed, setReviewed] = useState({});
  const [toast, setToast] = useState(null);
  const [showErrors, setShowErrors] = useState(false);

  const load = () => api.getMyProfileForm().then((d) => { setData(d); setContent(d.draft.content); setReviewed(d.draft.reviewed_steps || {}); });
  useEffect(() => { load(); }, []);

  const steps = useMemo(() => (content ? formSteps(content) : []), [content]);
  if (!data || !content) return html`<div>${t('common.loading')}</div>`;

  const locked = data.draft.status === 'in_review';
  const stepIndex = Math.max(0, steps.findIndex((s) => s.id === stepParam));
  const step = steps[stepIndex];
  const check = validateDraft(content, reviewed);
  const markFor = (projectId, key) => data.imports.find((r) => (r.project_id || null) === (projectId || null) && r.field === key);
  const goStep = (i) => {
    if (!locked) api.saveMyProfileDraft(content, reviewed); // autosave when changing step
    onNavigateStep(steps[i].id);
    window.scrollTo(0, 0);
  };

  const setReviewedStep = (id, value) => setReviewed({ ...reviewed, [id]: value });
  const updateOrg = (field, value) => setContent({ ...content, organization: writeField(content.organization, field, value) });
  const updateProject = (pid, field, value) => setContent({
    ...content,
    projects: content.projects.map((p) => {
      if (p.id !== pid) return p;
      if (field.key === 'summary') return { ...p, summary: value };
      return { ...p, fields: writeField(p.fields, field, value) };
    }),
  });

  const save = async () => {
    const res = await api.saveMyProfileDraft(content, reviewed);
    setToast(res.ok ? t('form.saved') : res.error);
    setTimeout(() => setToast(null), 2500);
    if (res.ok) setData({ ...data, draft: res.draft, organization: { ...data.organization, status: 'filling' } });
  };
  const submit = async () => {
    setShowErrors(true);
    const res = await api.submitMyProfileForReview(content, reviewed);
    if (res.ok) { await load(); setToast(t('form.submitted')); }
  };

  const renderFields = (fields, container, onChange, projectId) => fields.map((f) => html`<${Field} key=${f.key} field=${f} stepId=${step.id}
    value=${readField(container, f)} onChange=${(v) => onChange(f, v)} i18n=${i18n} disabled=${locked}
    mark=${data.firstValidation ? markFor(projectId, f.key) : null} showErrors=${showErrors} />`);

  let body;
  if (step.kind === 'organization') {
    body = renderFields(ORG_FIELDS, content.organization, updateOrg, null);
  } else if (step.kind === 'project') {
    const p = content.projects.find((x) => x.id === step.projectId);
    body = html`<div class="project-step-head">
        <span class="hero-chip">${t('profile_type.' + p.profile_type)}</span>
        <span class="form-help">${subtitle(p, i18n)}</span>
      </div>
      ${renderFields(projectFields(p, content.projects.length), { ...p.fields, summary: p.summary }, (f, v) => updateProject(p.id, f, v), p.id)}`;
  } else if (step.kind === 'leadership') {
    body = renderFields([LEADERSHIP_FIELD], content.organization, updateOrg, null);
  } else if (step.kind === 'images') {
    body = renderFields(IMAGE_FIELDS, content.organization, updateOrg, null);
  } else {
    const stepById = Object.fromEntries(steps.map((s) => [s.id, s]));
    body = html`<${Preview} orgMeta=${data.organization} content=${content} />
      <div class="submit-box">
        ${!check.ok && !locked && html`<div class="submit-blockers" role="alert">
          <strong>${t('form.submit_blocked')}</strong>
          <ul>
            ${check.unreviewed.map((id) => html`<li key=${'u' + id}><a href="#" onClick=${(e) => { e.preventDefault(); goStep(steps.indexOf(stepById[id])); }}>${t('form.unreviewed_step', { step: stepTitle(stepById[id], content, i18n) })}</a></li>`)}
            ${check.problems.map((p, i) => html`<li key=${i}><a href="#" onClick=${(e) => { e.preventDefault(); setShowErrors(true); goStep(steps.indexOf(stepById[p.stepId])); setTimeout(() => { const el = document.getElementById('f-' + p.stepId.replace(':', '-') + '-' + p.field); if (el) el.scrollIntoView({ block: 'center' }); }, 80); }}>
              ${stepTitle(stepById[p.stepId], content, i18n)} › ${t('fields.' + p.field + '.label')}: ${problemText(i18n, p)}</a></li>`)}
          </ul>
        </div>`}
        <button type="button" class="btn btn-lime btn-xl" disabled=${!check.ok || locked} onClick=${submit}>${t('form.submit')}</button>
      </div>`;
  }

  const org = data.organization;
  const status = data.draft.status === 'in_review' ? 'in_review' : org.status;
  return html`<div class="form-page">
    <div class="form-top">
      <div>
        <h1 class="page-title">${org.name}</h1>
        <div class="page-subtitle">
          ${t('form.status')}: <span class=${'status-pill s-' + status}>${i18n.label('org_status', status)}</span>
          ${org.public_state !== 'hidden' && html` · <a href=${'#/org/' + org.id} target="_blank">${t('form.view_public')} ↗</a>`}
          ${org.public_state === 'provisional' && html` · ${t('form.updating_public')}`}
        </div>
      </div>
      ${!locked && html`<button type="button" class="btn btn-outline btn-lg" onClick=${save}>${t('form.save_draft')}</button>`}
    </div>
    ${locked && html`<div class="notice">${t('form.locked_review')}</div>`}
    ${data.draft.status === 'returned' && data.draft.review_comment && html`<div class="notice warn"><strong>${t('form.returned')}</strong> ${data.draft.review_comment}
      ${data.draft.reviewed_at && html`<small> (${formatDate(data.draft.reviewed_at, i18n.lang)})</small>`}</div>`}
    ${toast && html`<div class="toast" role="status">${toast}</div>`}

    <div class="progress" aria-label=${t('form.progress', { n: stepIndex + 1, total: steps.length })}>
      <div class="progress-bar"><span style=${{ width: Math.round(((stepIndex + 1) / steps.length) * 100) + '%' }}></span></div>
      <ol class="progress-steps">${steps.map((s, i) => html`<li key=${s.id}>
        <button type="button" class=${cx(i === stepIndex && 'on', reviewed[s.id] && 'done')} onClick=${() => goStep(i)}>
          <span class="step-n">${reviewed[s.id] ? '✓' : i + 1}</span>${stepTitle(s, content, i18n)}
        </button></li>`)}
      </ol>
    </div>

    <section class="form-card">
      <div class="form-card-head">
        <h2 class="block-title">${stepTitle(step, content, i18n)}</h2>
        <span class="form-help">${t('form.progress', { n: stepIndex + 1, total: steps.length })} · ${t('form.required_hint')}</span>
      </div>
      ${step.kind !== 'preview' && step.kind !== 'images' && html`<p class="form-help lang-note">${t('form.en_reviewed_by_team')}</p>`}
      ${body}
      ${step.kind !== 'preview' && html`<label class="reviewed-check">
        <input type="checkbox" checked=${!!reviewed[step.id]} disabled=${locked} onChange=${(e) => setReviewedStep(step.id, e.target.checked)} />
        ${t('form.reviewed_step')}
      </label>`}
      <div class="form-nav">
        ${stepIndex > 0 ? html`<button type="button" class="btn btn-outline" onClick=${() => goStep(stepIndex - 1)}>${t('form.prev')}</button>` : html`<span></span>`}
        ${stepIndex < steps.length - 1 && html`<button type="button" class="btn btn-lime btn-lg" onClick=${() => goStep(stepIndex + 1)}>${t('form.next')}</button>`}
      </div>
    </section>
  </div>`;
}

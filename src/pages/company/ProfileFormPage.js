// Company area · step-by-step profile form (spec 1, sections 4.2 and 5).
// Steps: Organization → one per project → Leadership → Images → Preview & submit.
import { cx, html, useEffect, useMemo, useState } from '../../lib/html.js';
import * as api from '../../services/api.js?v=20261026-invite-language1';
import { LangProvider, useI18n } from '../../lib/i18n.js';
import { formatDate } from '../../lib/format.js';
import { navigate } from '../../lib/router.js';
import { getCompanyPreview, setCompanyPreview, clearCompanyPreview } from '../../lib/companyPreviewState.js';
import { IMAGE_FIELDS, LEADERSHIP_FIELD, ORG_FIELDS, formSteps, projectFields, readField, writeField } from '../../lib/formSchema.js?v=20261026-profile-layout2';
import { fieldProblems, validateDraft } from '../../lib/profileValidation.js?v=20261026-profile-layout2';
import { draftToPublic } from '../../lib/draftPreview.js';
import { subtitle } from '../../lib/profileModel.js';
import { FieldInput } from '../../components/form/inputs.js?v=20261026-image-upload1';
import { InviteLanguageModal } from '../../components/InviteLanguageModal.js';
import { ProfileView } from '../../components/profile/ProfileView.js?v=20261026-profile-layout3';

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

export function ProfileFormPage({ stepParam, onNavigateStep, teamOrgId }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [data, setData] = useState(null);
  const [content, setContent] = useState(null);
  const [reviewed, setReviewed] = useState({});
  const [toast, setToast] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteNotice, setInviteNotice] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = () => (teamOrgId ? api.getTeamOrganizationForm(teamOrgId) : api.getMyProfileForm()).then((d) => {
    const preview = teamOrgId ? null : getCompanyPreview();
    setData(d); setContent(preview?.content || d.draft.content); setReviewed(preview?.reviewed || d.draft.reviewed_steps || {});
  });
  useEffect(() => { load(); }, []);

  const steps = useMemo(() => (content ? formSteps(content) : []), [content]);
  if (!data || !content) return html`<div>${t('common.loading')}</div>`;

  const locked = data.draft.status === 'in_review';
  const unchangedInitial = !teamOrgId && data.firstValidation && JSON.stringify(content) === JSON.stringify(data.initialContent);
  const saveDraft = () => teamOrgId ? api.saveTeamOrganizationForm(teamOrgId, content) : api.saveMyProfileDraft(content, reviewed);
  const stepIndex = Math.max(0, steps.findIndex((s) => s.id === stepParam));
  const step = steps[stepIndex];
  const check = validateDraft(content, reviewed);
  const markFor = (projectId, key) => data.imports.find((r) => (r.project_id || null) === (projectId || null) && r.field === key);
  const goStep = (i) => {
    if (!locked) saveDraft();
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
    const res = await saveDraft();
    setToast(res.ok ? t('form.saved') : res.error);
    setTimeout(() => setToast(null), 2500);
    if (res.ok) { clearCompanyPreview(); if (teamOrgId) await load(); else setData({ ...data, draft: res.draft, organization: { ...data.organization, status: 'filling' } }); }
  };
  const saveAndInvite = async (language) => {
    if (!teamOrgId || inviteBusy) return;
    setInviteBusy(true); setInviteNotice(null);
    try {
      const result = await api.saveTeamOrganizationFormAndInvite(teamOrgId, content, language);
      await load();
      setInviteOpen(false);
      setInviteNotice({ ok:true, text:i18n.lang === 'pt' ? `Rascunho salvo. Convite preparado para ${result.email}.` : `Draft saved. Invitation queued for ${result.email}.` });
    } catch (error) {
      const messages = i18n.lang === 'pt' ? {
        email_unavailable:'O envio de e-mail está indisponível no momento. O rascunho não foi salvo; tente novamente.',
        invalid_email:'Configure um e-mail válido para o convite em Organizações.',
        email_has_account:'Este e-mail já tem uma conta. A empresa pode entrar com a senha ou recuperá-la.',
        in_review:'Este perfil já está em revisão.',
        published_profile:'Este perfil já foi publicado.',
      } : {
        email_unavailable:'Email delivery is unavailable right now. The draft was not saved; try again.',
        invalid_email:'Set a valid invitation email in Organizations.',
        email_has_account:'This email already has an account. The company can sign in or reset its password.',
        in_review:'This profile is already under review.',
        published_profile:'This profile has already been published.',
      };
      setInviteNotice({ ok:false,text:messages[error.message] || (i18n.lang === 'pt' ? 'Não foi possível salvar e preparar o convite. Tente novamente.' : 'Could not save and prepare the invitation. Try again.') });
    } finally { setInviteBusy(false); }
  };
  const openPreview = () => {
    setCompanyPreview(content, reviewed);
    navigate('/company/preview');
  };
  const submit = async () => {
    setShowErrors(true);
    const res = await api.submitMyProfileForReview(content, reviewed);
    if (res.ok) { clearCompanyPreview(); await load(); setToast(t('form.submitted')); }
  };
  const acceptInitial = async () => {
    const res = await api.acceptInitialProfile();
    if (res.ok) { clearCompanyPreview(); await load(); setToast(i18n.lang === 'pt' ? 'Perfil aceito e publicado.' : 'Profile accepted and published.'); }
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
        ${unchangedInitial && !locked && html`<div class="notice">${i18n.lang === 'pt' ? 'Os dados iniciais estão prontos para sua aprovação. Se você não alterar nada, pode publicar diretamente.' : 'The initial profile is ready for your approval. You can publish it directly without changes.'}</div>
          <button type="button" class="btn btn-lime btn-xl" onClick=${acceptInitial}>${i18n.lang === 'pt' ? 'Aceitar e publicar' : 'Accept and publish'}</button>`}
        ${!teamOrgId && !unchangedInitial && !check.ok && !locked && html`<div class="submit-blockers" role="alert">
          <strong>${t('form.submit_blocked')}</strong>
          <ul>
            ${check.unreviewed.map((id) => html`<li key=${'u' + id}><a href="#" onClick=${(e) => { e.preventDefault(); goStep(steps.indexOf(stepById[id])); }}>${t('form.unreviewed_step', { step: stepTitle(stepById[id], content, i18n) })}</a></li>`)}
            ${check.problems.map((p, i) => html`<li key=${i}><a href="#" onClick=${(e) => { e.preventDefault(); setShowErrors(true); goStep(steps.indexOf(stepById[p.stepId])); setTimeout(() => { const el = document.getElementById('f-' + p.stepId.replace(':', '-') + '-' + p.field); if (el) el.scrollIntoView({ block: 'center' }); }, 80); }}>
              ${stepTitle(stepById[p.stepId], content, i18n)} › ${t('fields.' + p.field + '.label')}: ${problemText(i18n, p)}</a></li>`)}
          </ul>
        </div>`}
        ${!teamOrgId && !unchangedInitial && html`<button type="button" class="btn btn-lime btn-xl" disabled=${!check.ok || locked} onClick=${submit}>${t('form.submit')}</button>`}
        ${teamOrgId && !locked && html`<button type="button" class="btn btn-lime btn-xl" disabled=${inviteBusy || !data.organization.invitation_email} onClick=${() => { setInviteNotice(null); setInviteOpen(true); }}>${i18n.lang === 'pt' ? 'Salvar e enviar convite' : 'Save and send invitation'}</button>`}
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
          ${!teamOrgId && html` · <button type="button" class="btn-link" onClick=${openPreview}>${t('form.view_public')} ↗</button>`}
          ${org.public_state === 'provisional' && html` · ${t('form.updating_public')}`}
        </div>
      </div>
      ${!locked && (teamOrgId ? html`<div class="team-draft-actions"><div class="team-draft-recipient">${i18n.lang === 'pt' ? 'Convite para' : 'Invitation to'} <strong>${data.organization.invitation_email || '—'}</strong></div><div class="review-actions"><button type="button" class="btn btn-outline btn-lg" disabled=${inviteBusy} onClick=${save}>${i18n.lang === 'pt' ? 'Salvar sem enviar' : 'Save without sending'}</button><button type="button" class="btn btn-lime btn-lg" disabled=${inviteBusy || !data.organization.invitation_email} onClick=${() => { setInviteNotice(null); setInviteOpen(true); }}>${i18n.lang === 'pt' ? 'Salvar e enviar convite' : 'Save and send invitation'}</button></div></div>` : html`<button type="button" class="btn btn-outline btn-lg" onClick=${save}>${t('form.save_draft')}</button>`)}
    </div>
    ${locked && html`<div class="notice">${t('form.locked_review')}</div>`}
    ${data.draft.status === 'returned' && data.draft.review_comment && html`<div class="notice warn"><strong>${t('form.returned')}</strong> ${data.draft.review_comment}
      ${data.draft.reviewed_at && html`<small> (${formatDate(data.draft.reviewed_at, i18n.lang)})</small>`}</div>`}
    ${toast && html`<div class="toast" role="status">${toast}</div>`}
    ${inviteNotice && html`<div class=${inviteNotice.ok ? 'notice' : 'notice warn'} role=${inviteNotice.ok ? 'status' : 'alert'}>${inviteNotice.text}</div>`}
    ${inviteOpen && html`<${InviteLanguageModal} email=${data.organization.invitation_email} busy=${inviteBusy} error=${inviteNotice && !inviteNotice.ok ? inviteNotice.text : null} onClose=${() => { setInviteOpen(false); setInviteNotice(null); }} onConfirm=${saveAndInvite} />`}

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
      ${step.kind === 'project' && html`<p class="notice currency-note">${t('form.currency_note')}</p>`}
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

// Company area · step-by-step profile form (spec 1, sections 4.2 and 5).
// Steps: Organization → one per project → Leadership → Images → Preview & submit.
import { cx, html, useEffect, useMemo, useRef, useState } from '../../lib/html.js';
import * as api from '../../services/api.js?v=20261116-company-profile1';
import { LangProvider, useI18n } from '../../lib/i18n.js';
import { formatDate } from '../../lib/format.js';
import { href, navigate } from '../../lib/router.js';
import { getCompanyPreview, setCompanyPreview, clearCompanyPreview } from '../../lib/companyPreviewState.js';
import { IMAGE_FIELDS, LEADERSHIP_FIELD, ORG_FIELDS, formSteps, projectFields, readField, writeField } from '../../lib/formSchema.js?v=20261117-about1';
import { fieldProblems, validateDraft } from '../../lib/profileValidation.js?v=20261117-about1';
import { draftToPublic } from '../../lib/draftPreview.js?v=20261117-about1';
import { subtitle } from '../../lib/profileModel.js?v=20261117-about1';
import { FieldInput, ProfileEditorFields } from '../../components/form/inputs.js?v=202611-profile-editor1';
import { EditorDialog } from '../../components/form/EditorDialog.js';
import { InviteLanguageModal } from '../../components/InviteLanguageModal.js';
import { ProfileView } from '../../components/profile/ProfileView.js?v=20261117-about1';

function problemText(i18n, p) {
  return (p.part ? i18n.t('form.'+p.part)+': ' : '') + i18n.t('form.errors.' + p.code, p);
}

function Field({ field, value, onChange, i18n, disabled, mark, showErrors, stepId }) {
  const domId = 'f-' + stepId.replace(':', '-') + '-' + field.key;
  const problems = showErrors ? fieldProblems(field, value) : [];
  return html`<div class=${cx('form-field', field.group && 'grouped', problems.length && 'has-error')} id=${domId}>
    <div class="form-field-head">
      <label class="form-label" for=${domId + '-input' + (field.type==='focal' ? '-name' : '')}>${i18n.t('fields.' + field.key + '.label')}${field.req && html`<span class="req" aria-label="required"> *</span>`}</label>
      ${mark && mark.mode === 'prefilled' && html`<span class="import-badge">${i18n.t('form.imported')}</span>`}
      ${field.internal && html`<span class="internal-badge">🔒</span>`}
    </div>
    <div class="form-help">${i18n.t('fields.' + field.key + '.help')}</div>
    <div class="form-control-row">
      <div class="form-control"><${FieldInput} field=${field} value=${value} onChange=${onChange} i18n=${i18n} disabled=${disabled} showErrors=${showErrors} id=${domId + '-input'} /></div>
      ${mark && mark.mode === 'reference' && mark.previous_answer && html`<div class="previous-answer">${i18n.t('form.previous_answer', { answer: mark.previous_answer })}</div>`}
    </div>
    ${field.type !== 'focal' && problems.map((p, i) => html`<div class="field-error" key=${i}>${problemText(i18n, p)}</div>`)}
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

const organizationGroups = {
  identity:['name','logo_url','about_short','description','website'],
  location:['place','size'],
  activity:['segments','partnership_types'],
  focal:['focal_point'],
};
const projectGroups = {
  product:['segment','trl','regulatory_phase','lead_product_name','lead_product_moa','product_image_url','platform_type','maturity','platform_description'],
  research:['pipeline','patents_filed','patents_granted','fto','milestones'],
  finance:['rounds','use_of_funds','raised','revenue','investment_types','investment_range','investment_description'],
  market:['gtm_models','gtm_text','target_markets','exports','export_markets','export_markets_text','markets_served','markets_text','market_share'],
};

function sectionsFor(fields, groups, fallback) {
  const remaining = new Set(fields);
  const sections = Object.entries(groups).map(([key, keys]) => {
    const matched = fields.filter((field) => keys.includes(field.key));
    matched.forEach((field) => remaining.delete(field));
    return { key, fields:matched };
  }).filter(({ fields }) => fields.length);
  if (remaining.size) sections.unshift({ key:fallback, fields:[...remaining] });
  return sections;
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
  const [loadError, setLoadError] = useState(false);
  const [content, setContent] = useState(null);
  const [reviewed, setReviewed] = useState({});
  const [toast, setToast] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [blockedStep, setBlockedStep] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteNotice, setInviteNotice] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptError, setAcceptError] = useState('');
  const [sideBySide, setSideBySide] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const saveInProgress = useRef(false);
  const pendingFocus = useRef(null);

  const load = async () => {
    setLoadError(false);
    try {
      const d = await (teamOrgId ? api.getTeamOrganizationForm(teamOrgId) : api.getMyProfileForm());
      const preview = teamOrgId ? null : getCompanyPreview();
      const draftContent = preview?.content || d.draft.content;
      const organization = draftContent.organization;
      const contentWithAbout = Object.hasOwn(organization, 'about_short') ? draftContent
        : { ...draftContent, organization: { ...organization, about_short: d.draft.content.organization.about_short ?? null } };
      setSavedSnapshot(JSON.stringify([d.draft.content,d.draft.reviewed_steps || {}]));
      setData(d); setContent(contentWithAbout); setReviewed(preview?.reviewed || d.draft.reviewed_steps || {});
    } catch {
      setLoadError(true);
    }
  };
  useEffect(() => { load(); }, []);

  const steps = useMemo(() => (content ? formSteps(content) : []), [content]);
  const snapshot = content && JSON.stringify([content,reviewed]);
  const dirty = !!snapshot && snapshot !== savedSnapshot;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!pendingFocus.current) return;
    const problem = pendingFocus.current;
    pendingFocus.current = null;
    focusProblem(problem);
  }, [stepParam]);
  if (loadError && !content) return html`<div class="empty-state" role="alert"><strong>${t('form.load_error')}</strong><button type="button" class="btn btn-lime" onClick=${load}>${t('orgs.retry')}</button></div>`;
  if (!data || !content) return html`<div>${t('common.loading')}</div>`;

  const locked = ['in_review','rejected'].includes(data.draft.status);
  const busy = saving || inviteBusy || acceptBusy || submitting;
  const unchangedInitial = !teamOrgId && data.firstValidation && JSON.stringify(content) === JSON.stringify(data.initialContent);
  const saveDraft = () => teamOrgId ? api.saveTeamOrganizationForm(teamOrgId, content) : api.saveMyProfileDraft(content, reviewed);
  const stepIndex = Math.max(0, steps.findIndex((s) => s.id === stepParam));
  const step = steps[stepIndex];
  const check = validateDraft(content, reviewed);
  const stepProblems = check.problems.filter((p)=>p.stepId===step.id);
  const completed = (s) => s.kind !== 'preview' && !!reviewed[s.id] && !check.problems.some((p)=>p.stepId===s.id);
  const focusProblem = (problem) => {
    const base = 'f-' + problem.stepId.replace(':','-') + '-' + problem.field;
    const container = document.getElementById(base);
    const preferred = document.getElementById(base+'-input'+(problem.part ? '-'+problem.part : ''));
    const controls = container?.querySelectorAll('input:not([type=file]):not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])');
    const input = preferred?.getClientRects().length ? preferred : Array.from(controls || []).find((control) => control.getClientRects().length);
    (container || input)?.scrollIntoView({block:'center',behavior:'smooth'});
    input?.focus({preventScroll:true});
  };
  const markFor = (projectId, key) => data.imports.find((r) => (r.project_id || null) === (projectId || null) && r.field === key);
  const goStep = async (i, problem) => {
    if (busy) return;
    if (!locked && !teamOrgId && dirty && i !== stepIndex && !await save(false)) return;
    if (problem) {
      setShowErrors(true);
      if (i === stepIndex) { focusProblem(problem); return; }
      pendingFocus.current = problem;
    }
    setBlockedStep(null);
    onNavigateStep(steps[i].id);
    window.scrollTo(0, 0);
  };

  const setReviewedStep = (id, value) => {
    const firstProblem = check.problems.find((p)=>p.stepId===id);
    if (value && firstProblem) {
      setReviewed({...reviewed,[id]:false}); setShowErrors(true); setBlockedStep(id);
      setTimeout(()=>focusProblem(firstProblem),0);
      return;
    }
    setReviewed({ ...reviewed, [id]: value });
    setBlockedStep(null);
  };
  const updateOrg = (field, value) => setContent((current) => ({ ...current, organization: writeField(current.organization, field, value) }));
  const updateProject = (pid, field, value) => setContent((current) => ({
    ...current,
    projects: current.projects.map((p) => {
      if (p.id !== pid) return p;
      if (field.key === 'summary') return { ...p, summary: value };
      return { ...p, fields: writeField(p.fields, field, value) };
    }),
  }));

  const save = async (showToast = true) => {
    if (saveInProgress.current || locked) return false;
    saveInProgress.current = true;
    setSaving(true); setSaveError(false);
    try {
      const res = await saveDraft();
      if (!res.ok) throw new Error(res.error);
      clearCompanyPreview();
      setSavedSnapshot(snapshot); setSavedAt(new Date());
      if (!teamOrgId) setData({ ...data, draft: res.draft, organization: { ...data.organization, status: 'filling' } });
      if (showToast) {
        setToast(t('form.saved'));
        setTimeout(() => setToast(null), 2500);
      }
      return true;
    } catch {
      setSaveError(true);
      return false;
    } finally { saveInProgress.current = false; setSaving(false); }
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
    setSubmitting(true); setSubmitError(false);
    try {
      const res = await api.submitMyProfileForReview(content, reviewed);
      if (!res.ok) throw new Error(res.error);
      clearCompanyPreview(); await load(); setSubmitOpen(false);
      setToast(t('form.editor_submitted'));
      setTimeout(() => setToast(null), 3000);
    } catch { setSubmitError(true); }
    finally { setSubmitting(false); }
  };
  const acceptInitial = async () => {
    if (acceptBusy) return;
    setAcceptBusy(true); setAcceptError('');
    try {
      const res = await api.acceptInitialProfile(content);
      if (!res.ok) throw new Error(res.error || 'publish_failed');
      clearCompanyPreview();
      setToast(i18n.lang === 'pt' ? 'Perfil aceito e publicado.' : 'Profile accepted and published.');
      await load().catch(() => setToast(i18n.lang === 'pt' ? 'Perfil publicado. Recarregue a página para ver a atualização.' : 'Profile published. Reload the page to see the update.'));
    } catch (error) {
      setAcceptError(error.message === 'changes_require_review'
        ? (i18n.lang === 'pt' ? 'Este perfil tem alterações salvas. Revise os dados e envie para revisão.' : 'This profile has saved changes. Review the information and submit it for review.')
        : (i18n.lang === 'pt' ? 'Não foi possível publicar agora. Tente novamente.' : 'Could not publish now. Please try again.'));
    } finally { setAcceptBusy(false); }
  };

  const renderFields = (fields, container, onChange, projectId) => fields.map((f) => html`<${Field} key=${f.key} field=${f} stepId=${step.id}
    value=${readField(container, f)} onChange=${(v) => onChange(f, v)} i18n=${i18n} disabled=${locked || busy}
    mark=${data.firstValidation ? markFor(projectId, f.key) : null} showErrors=${showErrors} />`);

  let body;
  let sections = [];
  const renderSections = (container,onChange,projectId) => sections.map(({key,fields}) => html`<section class="profile-editor-section" id=${'editor-section-'+key} key=${key}>
    <h3>${t('form.editor_group_'+key)}</h3>${renderFields(fields,container,onChange,projectId)}
  </section>`);
  if (step.kind === 'organization') {
    sections = sectionsFor(ORG_FIELDS,organizationGroups,'details');
    body = renderSections(content.organization,updateOrg,null);
  } else if (step.kind === 'project') {
    const p = content.projects.find((x) => x.id === step.projectId);
    sections = sectionsFor(projectFields(p,content.projects.length),projectGroups,'details');
    body = html`<div class="project-step-head">
        <span class="hero-chip">${t('profile_type.' + p.profile_type)}</span>
        <span class="form-help">${subtitle(p, i18n)}</span>
      </div>
      ${renderSections({ ...p.fields, summary:p.summary }, (f,v) => updateProject(p.id,f,v), p.id)}`;
  } else if (step.kind === 'leadership') {
    body = renderFields([LEADERSHIP_FIELD], content.organization, updateOrg, null);
  } else if (step.kind === 'images') {
    body = renderFields(IMAGE_FIELDS, content.organization, updateOrg, null);
  } else {
    const stepById = Object.fromEntries(steps.map((s) => [s.id, s]));
    body = html`<${Preview} orgMeta=${data.organization} content=${content} />
      <div class="submit-box">
        ${!teamOrgId && data.organization.intake_mode !== 'legacy' && html`<div class="notice">${i18n.lang === 'pt' ? 'Antes de enviar: sua inscrição será analisada pela Abiquifi. O perfil só aparecerá no portfólio após aprovação.' : 'Before submitting: Abiquifi will review your application. The profile will only appear in the portfolio after approval.'}</div>`}
        ${unchangedInitial && !locked && html`<div class="notice">${i18n.lang === 'pt' ? 'Os dados iniciais estão prontos para sua aprovação. Se você não alterar nada, pode publicar diretamente.' : 'The initial profile is ready for your approval. You can publish it directly without changes.'}</div>
          <button type="button" class="btn btn-lime btn-xl" disabled=${acceptBusy} onClick=${acceptInitial}>${acceptBusy ? (i18n.lang === 'pt' ? 'Publicando...' : 'Publishing...') : (i18n.lang === 'pt' ? 'Aceitar e publicar' : 'Accept and publish')}</button>
          ${acceptError && html`<div class="form-error" role="alert">${acceptError}</div>`}`}
        ${!teamOrgId && !unchangedInitial && !check.ok && !locked && html`<div class="submit-blockers" role="alert">
          <strong>${t('form.submit_blocked')}</strong>
          <ul>
            ${check.unreviewed.map((id) => html`<li key=${'u' + id}><a href="#" onClick=${(e) => { e.preventDefault(); goStep(steps.indexOf(stepById[id])); }}>${t('form.unreviewed_step', { step: stepTitle(stepById[id], content, i18n) })}</a></li>`)}
            ${check.problems.map((p, i) => html`<li key=${i}><a href="#" onClick=${(e) => { e.preventDefault(); setShowErrors(true); goStep(steps.indexOf(stepById[p.stepId])); setTimeout(() => { const el = document.getElementById('f-' + p.stepId.replace(':', '-') + '-' + p.field); if (el) el.scrollIntoView({ block: 'center' }); }, 80); }}>
              ${stepTitle(stepById[p.stepId], content, i18n)} › ${t('fields.' + p.field + '.label')}: ${problemText(i18n, p)}</a></li>`)}
          </ul>
        </div>`}
        ${!teamOrgId && !unchangedInitial && html`<button type="button" class="btn btn-lime btn-xl" disabled=${!check.ok || locked || busy} onClick=${() => { setSubmitError(false); setSubmitOpen(true); }}>${t('form.submit')}</button>`}
      </div>`;
  }

  const org = data.organization;
  const underReview = data.draft.status === 'in_review' && (!teamOrgId || org.review_version_id);
  const status = underReview ? 'in_review' : org.status;
  const requiredFields = [
    ...ORG_FIELDS.filter((field) => field.req).map((field) => 'organization/'+field.key),
    ...content.projects.flatMap((project) => projectFields(project,content.projects.length)
      .filter((field) => field.req).map((field) => 'project:'+project.id+'/'+field.key)),
  ];
  const problemFields = new Set(check.problems.map((p) => p.stepId+'/'+p.field));
  const percent = Math.round(requiredFields.filter((field) => !problemFields.has(field)).length / requiredFields.length * 100);
  const progressProblems = step.kind === 'preview' ? check.problems : stepProblems;
  const saveLabel = saving ? t('form.editor_saving') : dirty ? t('form.editor_unsaved') :
    savedAt ? t('form.editor_saved_at',{time:new Intl.DateTimeFormat(i18n.lang,{hour:'2-digit',minute:'2-digit'}).format(savedAt)}) : t('form.editor_synced');
  return html`<div class="form-page profile-editor">
    <header class="profile-editor-heading">
    <div class="form-top">
      <div>
        <div class="profile-editor-title"><h1 class="page-title">${content.organization.name || org.name}</h1>
          <span class=${'status-pill s-' + status}>${i18n.label('org_status', status)}</span>
        </div>
        ${!locked && html`<div class=${cx('profile-editor-save-status',dirty && 'unsaved')} role="status">${saveLabel}</div>`}
      </div>
      <div class="profile-editor-header-actions">
        <button type="button" class="btn btn-outline" disabled=${busy} onClick=${teamOrgId ? () => goStep(steps.length-1) : openPreview}>${t(teamOrgId ? 'form.editor_preview' : 'form.view_public')}</button>
        ${teamOrgId && org.review_version_id && html`<a class="btn btn-outline" href=${href('/team/review/'+org.review_version_id)}>${t('form.editor_open_review')}</a>`}
        ${!locked && html`<button type="button" class="btn profile-editor-save" disabled=${busy || (!dirty && !saveError)} onClick=${() => save()}>${t('form.save_draft')}</button>`}
        ${teamOrgId && !locked && html`<button type="button" class="btn btn-lime" disabled=${busy || !org.invitation_email} onClick=${() => { setInviteNotice(null); setInviteOpen(true); }}>${t('form.editor_save_invite')}</button>`}
      </div>
    </div>
    <nav class="progress" aria-label=${t('form.progress', { n: stepIndex + 1, total: steps.length })}>
      <ol class="progress-steps">${steps.map((s, i) => html`<li key=${s.id}>
        <button type="button" class=${cx(i === stepIndex && 'on', completed(s) && 'done')} aria-current=${i === stepIndex ? 'step' : undefined} disabled=${busy} onClick=${() => goStep(i)}>
          <span class="step-n" aria-hidden="true">${completed(s) ? '✓' : i + 1}</span><span>${stepTitle(s, content, i18n)}</span>
        </button></li>`)}
      </ol>
    </nav>
    </header>
    <div class="profile-editor-grid">
    <button type="button" class="btn btn-outline profile-editor-rail-toggle" aria-expanded=${railOpen}
      aria-controls="profile-editor-rail" onClick=${() => setRailOpen(!railOpen)}>${t('form.editor_progress')} · ${percent}%</button>
    <div class="profile-editor-main">
    ${underReview && html`<div class="notice">${t('form.locked_review')}</div>`}
    ${data.draft.status === 'rejected' && html`<div class="notice warn" role="status"><strong>${i18n.lang === 'pt' ? 'Inscrição recusada pela Abiquifi.' : 'Application rejected by Abiquifi.'}</strong> ${data.draft.review_comment}</div>`}
    ${data.draft.status === 'returned' && data.draft.review_comment && html`<div class="notice warn"><strong>${t('form.returned')}</strong> ${data.draft.review_comment}
      ${data.draft.reviewed_at && html`<small> (${formatDate(data.draft.reviewed_at, i18n.lang)})</small>`}</div>`}
    ${toast && html`<div class="toast" role="status">${toast}</div>`}
    ${saveError && html`<div class="notice warn" role="alert">${t('form.editor_save_error')}</div>`}
    ${inviteNotice && html`<div class=${inviteNotice.ok ? 'notice' : 'notice warn'} role=${inviteNotice.ok ? 'status' : 'alert'}>${inviteNotice.text}</div>`}
    ${inviteOpen && html`<${InviteLanguageModal} email=${data.organization.invitation_email} busy=${inviteBusy} error=${inviteNotice && !inviteNotice.ok ? inviteNotice.text : null} onClose=${() => { setInviteOpen(false); setInviteNotice(null); }} onConfirm=${saveAndInvite} />`}

    ${submitOpen && html`<${EditorDialog} title=${t('form.editor_confirm_submit')} action=${t('form.submit')} busy=${submitting}
      onConfirm=${submit} onClose=${() => setSubmitOpen(false)}>
      <p>${t('form.editor_submit_prompt')}</p>
      ${submitError && html`<div class="notice warn" role="alert">${t('form.preview_submit_error')}</div>`}
    <//>`}
    <section class="form-card">
      <div class="form-card-head">
        <h2 class="block-title">${stepTitle(step, content, i18n)}</h2>
        <span class="form-help">${t('form.progress', { n: stepIndex + 1, total: steps.length })} · ${t('form.required_hint')}</span>
      </div>
      ${step.kind !== 'preview' && step.kind !== 'images' && html`<p class="form-help lang-note">${t('form.en_reviewed_by_team')}</p>`}
      ${step.kind === 'project' && html`<p class="notice currency-note">${t('form.currency_note')}</p>`}
      ${blockedStep===step.id && (stepProblems.length || !reviewed[step.id]) && html`<div class="submit-blockers" id="current-step-problems" role="alert">
        <strong>${i18n.lang==='pt' ? 'Antes de continuar, revise esta etapa:' : 'Before continuing, review this step:'}</strong>
        <ul>${stepProblems.map((p,index)=>html`<li key=${index}><button type="button" class="btn-link step-problem-link" onClick=${()=>focusProblem(p)}>${t('fields.'+p.field+'.label')}: ${problemText(i18n,p)}</button></li>`)}
          ${!stepProblems.length && !reviewed[step.id] && html`<li>${t('form.unreviewed_step',{step:stepTitle(step,content,i18n)})}</li>`}</ul>
      </div>`}
      <${ProfileEditorFields.Provider} value=${{sideBySide}}>${body}<//>
      ${step.kind !== 'preview' && html`<label class="reviewed-check">
        <input type="checkbox" checked=${completed(step)} disabled=${locked || busy} onChange=${(e) => setReviewedStep(step.id, e.target.checked)} />
        ${t('form.reviewed_step')}
      </label>`}
      <div class="form-nav">
        ${stepIndex > 0 ? html`<button type="button" class="btn btn-outline" disabled=${busy} onClick=${() => goStep(stepIndex - 1)}>${t('form.prev')}</button>` : html`<span></span>`}
        ${stepIndex < steps.length - 1 && html`<button type="button" class="btn btn-lime btn-lg" disabled=${busy || (!locked && !teamOrgId && !unchangedInitial && !completed(step))} onClick=${() => goStep(stepIndex + 1)}>${t('form.next')}</button>`}
      </div>
    </section>
    </div>
    <aside class=${cx('profile-editor-rail',railOpen && 'mobile-open')} id="profile-editor-rail">
      <div class="profile-editor-rail-card">
        <h2>${t('form.editor_progress')}</h2>
        <div class="profile-editor-meter"><progress value=${percent} max="100" aria-label=${t('form.editor_progress')}></progress><strong>${percent}%</strong></div>
        ${progressProblems.length && !locked ? html`<h3>${t('form.editor_missing')}</h3><ul>
          ${[...new Map(progressProblems.map((p) => [p.stepId+'/'+p.field,p])).values()].map((p) => html`<li key=${p.stepId+'/'+p.field}><button type="button" class="btn-link" disabled=${busy}
            onClick=${() => goStep(steps.findIndex((s) => s.id === p.stepId),p)}>${t('fields.'+p.field+'.label')}</button></li>`)}
        </ul>` : !locked && step.kind !== 'preview' && html`<p>${t(completed(step) ? 'form.editor_step_done' : 'form.editor_step_ready')}</p>`}
      </div>
      ${sections.length > 1 && html`<nav class="profile-editor-rail-card" aria-label=${t('form.editor_this_step')}>
        <h2>${t('form.editor_this_step')}</h2>
        <ul>${sections.map(({key}) => html`<li key=${key}><a class="btn-link" href=${'#editor-section-'+key} onClick=${(event) => { event.preventDefault(); document.getElementById('editor-section-'+key)?.scrollIntoView({block:'start'}); }}>${t('form.editor_group_'+key)}</a></li>`)}</ul>
      </nav>`}
      ${['organization','project'].includes(step.kind) && html`<div class="profile-editor-rail-card">
        <label class="profile-editor-language-toggle"><input type="checkbox" checked=${sideBySide} onChange=${(event) => setSideBySide(event.target.checked)} />${t('form.editor_side_by_side')}</label>
      </div>`}
      ${!teamOrgId && !unchangedInitial && !locked && html`<div class="profile-editor-rail-card"><h2>${t('form.editor_review_title')}</h2><p>${t('form.editor_review_help')}</p></div>`}
      ${teamOrgId && !locked && org.invitation_email && html`<div class="profile-editor-rail-card"><h2>${t('form.editor_invite_to')}</h2><p>${org.invitation_email}</p></div>`}
    </aside>
    </div>
  </div>`;
}

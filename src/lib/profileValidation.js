// Validation of a profile draft (spec 1, 5.2 and 5.6). Runs in the browser for instant feedback and
// MUST run again on the server before accepting "Enviar para revisão" (see docs/HANDOFF_CODEX.md).
import { IMAGE_FIELDS, LEADERSHIP_FIELD, ORG_FIELDS, formSteps, projectFields, readField } from './formSchema.js';

export const USD_MESSAGE_KEY = 'form.usd_error'; // "Informe o valor em dólares americanos, apenas números"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i;
const PHONE_RE = /^\+\d{1,3}[\s\d().-]{6,}$/; // international format with country code (DDI)

function blank(v) {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function textPt(v) {
  return v && typeof v === 'object' ? (v.pt || '') : (v || '');
}

const isWholeUSD = (n) => n == null || n === '' || (Number.isInteger(n) && n >= 0);

/** Problems of one field: [{code, ...}] (empty = valid). `code` maps to i18n "form.errors.<code>". */
export function fieldProblems(field, value) {
  const out = [];
  const t = field.type;
  const req = field.req;
  switch (t) {
    case 'text':
      if (req && blank(textPt(value))) out.push({ code: 'required' });
      if (field.max && textPt(value).length > field.max) out.push({ code: 'too_long', max: field.max });
      break;
    case 'plain':
      if (req && blank(value)) out.push({ code: 'required' });
      if (field.max && (value || '').length > field.max) out.push({ code: 'too_long', max: field.max });
      break;
    case 'url':
      if (req && blank(value)) out.push({ code: 'required' });
      else if (!blank(value) && !URL_RE.test(value)) out.push({ code: 'url' });
      break;
    case 'select': case 'trl': case 'image':
      if (req && blank(value)) out.push({ code: 'required' });
      break;
    case 'multi': case 'text_list': case 'plain_list':
      if (req && blank((value || []).filter((x) => !blank(textPt(x))))) out.push({ code: 'required' });
      break;
    case 'place':
      if (req && (blank(value.city) || blank(value.state))) out.push({ code: 'required' });
      break;
    case 'focal': {
      const v = value || {};
      if (req && (blank(v.name) || blank(v.role) || blank(v.email) || blank(v.phone))) out.push({ code: 'required' });
      if (!blank(v.email) && !EMAIL_RE.test(v.email)) out.push({ code: 'email' });
      if (!blank(v.phone) && !PHONE_RE.test(v.phone)) out.push({ code: 'phone' });
      break;
    }
    case 'percent':
      if (value != null && value !== '' && !(Number.isInteger(value) && value >= 0 && value <= 100)) out.push({ code: 'percent' });
      break;
    case 'usd_range': {
      const v = value || {};
      if (!isWholeUSD(v.min) || !isWholeUSD(v.max)) out.push({ code: 'usd' });
      else if (v.min && v.max && v.min > v.max) out.push({ code: 'range' });
      break;
    }
    case 'pipeline': case 'portfolio': case 'interests': case 'milestones': {
      const items = value || [];
      if (req && items.length < (field.min || 1)) out.push({ code: 'min_items', min: field.min || 1 });
      items.forEach((it, i) => {
        const a = t === 'pipeline' ? it.name : t === 'portfolio' ? textPt(it.category) : t === 'interests' ? textPt(it.area) : it.period && it.period.year;
        const b = t === 'pipeline' ? textPt(it.indication) : t === 'milestones' ? textPt(it.description) : textPt(it.description);
        if (blank(a) || blank(b)) out.push({ code: 'item_incomplete', item: i + 1 });
        const limit = t === 'milestones' ? 150 : 200;
        if (t !== 'pipeline' && textPt(it.description).length > limit) out.push({ code: 'too_long', max: limit, item: i + 1 });
      });
      break;
    }
    case 'rounds': {
      const items = value || [];
      if (req && items.length < (field.min || 1)) out.push({ code: 'min_items', min: field.min || 1 });
      items.forEach((r, i) => {
        if (blank(r.stage) || !r.period || !r.period.year || r.amount_usd == null || r.amount_usd === '') out.push({ code: 'item_incomplete', item: i + 1 });
        if (!isWholeUSD(r.amount_usd)) out.push({ code: 'usd', item: i + 1 });
        if (textPt(r.purpose).length > 100) out.push({ code: 'too_long', max: 100, item: i + 1 });
      });
      break;
    }
    case 'raised': {
      const v = value || { items: [] };
      if (req && !v.none && v.items.length === 0) out.push({ code: 'raised_required' });
      v.items.forEach((r, i) => {
        if (blank(r.source) || r.amount_usd == null || r.amount_usd === '') out.push({ code: 'item_incomplete', item: i + 1 });
        if (!isWholeUSD(r.amount_usd)) out.push({ code: 'usd', item: i + 1 });
      });
      break;
    }
    case 'revenue': {
      const v = value || {};
      if (!v.pre_revenue && (v.amount_usd != null && v.amount_usd !== '')) {
        if (!isWholeUSD(v.amount_usd)) out.push({ code: 'usd' });
        if (!v.year) out.push({ code: 'year_required' });
      }
      break;
    }
    case 'leaders':
      (value || []).forEach((p, i) => { if (blank(p.name) || blank(textPt(p.role))) out.push({ code: 'item_incomplete', item: i + 1 }); });
      if ((value || []).length > 4) out.push({ code: 'max_items', max: 4 });
      break;
    case 'gallery':
      (value || []).forEach((g, i) => { if (blank(textPt(g.caption))) out.push({ code: 'caption_required', item: i + 1 }); });
      if ((value || []).length > 6) out.push({ code: 'max_items', max: 6 });
      break;
    default:
      break;
  }
  return out;
}

/**
 * Full check before "Enviar para revisão".
 * @returns {{problems: {stepId, field, code, ...}[], unreviewed: string[], ok: boolean}}
 */
export function validateDraft(content, reviewedSteps) {
  const problems = [];
  const org = content.organization;
  ORG_FIELDS.forEach((f) => fieldProblems(f, readField(org, f)).forEach((p) => problems.push({ stepId: 'organization', field: f.key, ...p })));
  content.projects.forEach((proj) => {
    const container = { ...proj.fields, summary: proj.summary };
    projectFields(proj, content.projects.length).forEach((f) => fieldProblems(f, readField(container, f))
      .forEach((p) => problems.push({ stepId: 'project:' + proj.id, field: f.key, ...p })));
  });
  fieldProblems(LEADERSHIP_FIELD, org.leadership).forEach((p) => problems.push({ stepId: 'leadership', field: 'leadership', ...p }));
  IMAGE_FIELDS.forEach((f) => fieldProblems(f, org[f.key]).forEach((p) => problems.push({ stepId: 'images', field: f.key, ...p })));
  const unreviewed = formSteps(content).filter((s) => s.kind !== 'preview' && !(reviewedSteps || {})[s.id]).map((s) => s.id);
  return { problems, unreviewed, ok: problems.length === 0 && unreviewed.length === 0 };
}

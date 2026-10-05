// Display rules shared by the public profile, the directory cards and the form preview (spec 1, 6.1–6.4).
import { formatUSD, formatUSDRange, periodEnd, periodValue } from './format.js';

export const PROFILE_TYPES = ['A', 'B', 'C', 'D', 'E', 'F'];
export const REGULATORY_PHASES = ['preclinical', 'phase_1', 'phase_2', 'phase_3', 'registered'];
export const MATURITY_STEPS = ['pre_operational', 'partially_operational', 'fully_operational'];

/** True when a value has something to show (spec 1, 6.4: empty optional fields never appear). */
export function present(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return true;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.some(present);
  if (typeof v === 'object') {
    if ('pt' in v || 'en' in v) return present(v.pt) || present(v.en);
    return Object.keys(v).some((k) => present(v[k]));
  }
  return false;
}

/** Label list of closed-list values: labels(i18n, 'markets', ['brazil', 'europe']) → ['Brazil', 'Europe']. */
export function labels(i18n, list, values) {
  return (values || []).map((v) => i18n.label(list, v));
}

/** The enum key used for certifications / services / … of each profile (labels live in i18n enum.*). */
export const LIST_OF = {
  servicesC: 'c_services', servicesD: 'd_services',
  investmentC: 'c_investment_types', investmentD: 'd_investment_types',
  partnershipE: 'e_partnership_models', partnershipF: 'f_partnership_models',
};

/** Subtitle under the name (spec 1, 6.1 and 6.3). */
export function subtitle(project, i18n) {
  const f = project.fields;
  switch (project.profile_type) {
    case 'A': return i18n.tx(f.segment);
    case 'B': return i18n.tx(f.platform_type);
    case 'C': return labels(i18n, 'c_services', f.services).join(' · ');
    case 'D': return labels(i18n, 'd_services', f.services).join(' · ');
    case 'E': return i18n.tx(f.institution_type);
    case 'F': return (f.products || []).map((p) => i18n.tx(p)).join(' · ') || i18n.tx(f.products_text);
    default: return '';
  }
}

/**
 * Stage for profiles A (5 regulatory phases + TRL) and B (3 maturity steps). C–F: null (no stage bar).
 * @returns {{steps: string[], list: string, index: number, trl?: number} | null}
 */
export function stage(project) {
  const f = project.fields;
  if (project.profile_type === 'A' && f.regulatory_phase) {
    return { steps: REGULATORY_PHASES, list: 'regulatory_phase', index: REGULATORY_PHASES.indexOf(f.regulatory_phase), trl: f.trl };
  }
  if (project.profile_type === 'B' && f.maturity) {
    return { steps: MATURITY_STEPS, list: 'maturity', index: MATURITY_STEPS.indexOf(f.maturity) };
  }
  return null;
}

export function sumRaised(raised) {
  return (raised || []).reduce((total, r) => total + (Number(r.amount_usd) || 0), 0);
}

export function sortedMilestones(milestones) {
  return (milestones || []).slice().sort((a, b) => periodValue(a.period) - periodValue(b.period));
}

/** Prototype timeline status: period over → completed, starts within ~10 months → in progress, later → upcoming. */
export function milestoneStatus(period, today = new Date()) {
  const now = today.getFullYear() * 12 + today.getMonth();
  if (periodEnd(period) < now) return 'completed';
  if (periodValue(period) < now + 10) return 'in_progress';
  return 'upcoming';
}

/** Short "What we're looking for" summary used on directory cards (spec 1, 6.1). */
export function lookingForSummary(project, i18n) {
  const f = project.fields;
  const lang = i18n.lang;
  if (f.rounds && f.rounds.length) {
    const r = f.rounds[0];
    return i18n.label('round_stage', r.stage) + ' · ' + formatUSD(r.amount_usd, lang);
  }
  if (f.investment_range && present(f.investment_range)) return formatUSDRange(f.investment_range, lang);
  const list = f.investment_types ? labels(i18n, project.profile_type === 'C' ? 'c_investment_types' : 'd_investment_types', f.investment_types)
    : f.partnership_models ? labels(i18n, project.profile_type === 'E' ? 'e_partnership_models' : 'f_partnership_models', f.partnership_models)
      : [];
  return list.join(' · ');
}

/** Plain-text haystack for the directory search, in both languages. */
export function searchText(org) {
  const parts = [org.name];
  const add = (v) => {
    if (!v) return;
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(add);
    else if (typeof v === 'object') Object.keys(v).forEach((k) => add(v[k]));
  };
  add(org.description);
  org.projects.forEach((p) => { add(p.summary); add(p.fields); });
  return parts.join(' ').toLowerCase();
}

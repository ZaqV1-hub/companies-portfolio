// Company profile form definition (spec 1, section 5): fields, types, limits and required flags,
// in the order of tables 5.3, 5.4 and 5.5. Labels and help texts live in i18n under "fields.*".
// The same rules must be enforced by the server (see src/lib/profileValidation.js and docs/SCHEMA.md).
//
// Field types:
//   text      translatable free text {pt, en}; the company fills pt (max = character limit)
//   plain     single-language text (names, codes)
//   url, email, phone
//   select    one value of `list` (enum key in i18n "enum.<list>")
//   multi     several values of `list`
//   trl       1–9
//   int, percent   whole numbers (percent 0–100)
//   usd       whole number in USD (spec 1, 5.2)
//   usd_range {min, max} in USD
//   place     {city, state}
//   focal     focal point {name, role, email, phone} — internal, never public
//   image     logo / cover
//   gallery   up to 6 images with required caption
//   leaders   up to 4 people
//   pipeline, milestones, rounds, raised, revenue, exports_c, exports_pct, clients, market_share,
//   portfolio, interests, text_list, plain_list  — structured lists (see components/form/inputs.js)

export const MARKETS = 'markets';

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export const ORG_FIELDS = [
  { key: 'name', type: 'plain', max: 80, req: true },
  { key: 'logo_url', type: 'image', kind: 'logo', req: true },
  { key: 'description', type: 'text', max: 600, req: true },
  { key: 'website', type: 'url', req: true },
  { key: 'place', type: 'place', req: true },
  { key: 'size', type: 'select', list: 'size', req: true },
  { key: 'segments', type: 'multi', list: 'segments', req: true },
  { key: 'partnership_types', type: 'multi', list: 'partnership_types', req: true },
  { key: 'focal_point', type: 'focal', req: true, internal: true },
];

const A = [
  { key: 'segment', type: 'text', max: 100, req: true },
  { key: 'trl', type: 'trl', req: true },
  { key: 'regulatory_phase', type: 'select', list: 'regulatory_phase', req: true },
  { key: 'lead_product_name', type: 'plain', max: 80, req: true },
  { key: 'lead_product_moa', type: 'text', max: 400, req: true },
  { key: 'pipeline', type: 'pipeline', req: false },
  { key: 'patents_filed', type: 'text', max: 300, req: false },
  { key: 'patents_granted', type: 'text', max: 300, req: false },
  { key: 'fto', type: 'select', list: 'fto', req: false },
  { key: 'milestones', type: 'milestones', req: true, min: 1 },
  { key: 'rounds', type: 'rounds', req: true, min: 1 },
  { key: 'use_of_funds', type: 'text', max: 300, req: true },
  { key: 'raised', type: 'raised', req: true },
  { key: 'revenue', type: 'revenue', allowPre: true, req: false },
  { key: 'gtm_models', type: 'multi', list: 'gtm_models', req: true },
  { key: 'gtm_text', type: 'text', max: 200, req: false, group: 'gtm_models' },
  { key: 'target_markets', type: 'multi', list: MARKETS, req: true },
];

const B = [
  { key: 'platform_type', type: 'text', max: 100, req: true },
  { key: 'maturity', type: 'select', list: 'maturity', req: true },
  { key: 'platform_description', type: 'text', max: 800, req: true },
  { key: 'technology_tags', type: 'multi', list: 'technology_tags', req: true },
  { key: 'technology_text', type: 'text', max: 300, req: false, group: 'technology_tags' },
  { key: 'business_models', type: 'multi', list: 'business_models', req: true },
  { key: 'business_model_text', type: 'text', max: 300, req: false, group: 'business_models' },
  { key: 'traction', type: 'text', max: 400, req: true },
  { key: 'revenue', type: 'revenue', allowPre: true, req: false },
  { key: 'competitive_edge', type: 'text', max: 600, req: true },
  { key: 'rounds', type: 'rounds', req: false },
  { key: 'use_of_funds', type: 'text', max: 300, req: false },
  { key: 'raised', type: 'raised', req: false },
];

const C = [
  { key: 'services', type: 'multi', list: 'c_services', req: true },
  { key: 'services_text', type: 'text', max: 300, req: false, group: 'services' },
  { key: 'molecule_types', type: 'multi', list: 'molecule_types', req: true },
  { key: 'capacity_scales', type: 'multi', list: 'capacity_scale', req: true },
  { key: 'utilization_pct', type: 'percent', req: false, group: 'capacity_scales' },
  { key: 'capacity_text', type: 'text', max: 300, req: false, group: 'capacity_scales' },
  { key: 'certifications', type: 'multi', list: 'certifications', options: ['gmp', 'iso', 'bpl', 'anvisa', 'fda', 'ema', 'dmf', 'other'], req: true },
  { key: 'clients', type: 'clients', req: false },
  { key: 'revenue', type: 'revenue', req: false },
  { key: 'exports', type: 'exports_c', req: false },
  { key: 'expansion_plan', type: 'text', max: 300, req: false },
  { key: 'investment_types', type: 'multi', list: 'c_investment_types', req: true },
  { key: 'investment_range', type: 'usd_range', req: false },
  { key: 'target_markets', type: 'multi', list: MARKETS, req: true },
];

const D = [
  { key: 'services', type: 'multi', list: 'd_services', req: true },
  { key: 'services_text', type: 'text', max: 400, req: false, group: 'services' },
  { key: 'therapeutic_areas', type: 'multi', list: 'therapeutic_areas', req: true },
  { key: 'scope_text', type: 'text', max: 200, req: false, group: 'therapeutic_areas' },
  { key: 'models', type: 'text', max: 200, req: false },
  { key: 'certifications', type: 'multi', list: 'certifications', options: ['bpl', 'bpc', 'gmp', 'iso', 'anvisa', 'reblas', 'fda', 'other'], req: true },
  { key: 'certificate_numbers', type: 'plain', max: 200, req: false, group: 'certifications' },
  { key: 'partner_sites', type: 'plain_list', req: false },
  { key: 'clients', type: 'clients', req: false },
  { key: 'revenue', type: 'revenue', req: false },
  { key: 'exports', type: 'exports_pct', req: false },
  { key: 'investment_types', type: 'multi', list: 'd_investment_types', req: true },
  { key: 'investment_range', type: 'usd_range', req: false },
  { key: 'target_markets', type: 'multi', list: MARKETS, req: true },
];

const E = [
  { key: 'institution_type', type: 'text', max: 150, req: true },
  { key: 'product_portfolio', type: 'portfolio', req: true, min: 1 },
  { key: 'production_capacity', type: 'text', max: 400, req: true },
  { key: 'export_markets', type: 'multi', list: MARKETS, req: false },
  { key: 'export_markets_text', type: 'text', max: 200, req: false, group: 'export_markets' },
  { key: 'certifications', type: 'multi', list: 'certifications', options: ['anvisa', 'who', 'who_pq', 'fda', 'ema', 'other'], req: true },
  { key: 'partnership_interests', type: 'interests', req: true, min: 1 },
  { key: 'partnership_models', type: 'multi', list: 'e_partnership_models', req: true },
  { key: 'expansion_projects', type: 'text', max: 400, req: false },
  { key: 'investment_range', type: 'usd_range', req: false },
  { key: 'investment_description', type: 'text', max: 200, req: false, group: 'investment_range' },
];

const F = [
  { key: 'products', type: 'text_list', req: true, min: 1 },
  { key: 'products_text', type: 'text', max: 400, req: false, group: 'products' },
  { key: 'markets_served', type: 'multi', list: MARKETS, req: true },
  { key: 'markets_text', type: 'text', max: 200, req: false, group: 'markets_served' },
  { key: 'certifications', type: 'multi', list: 'certifications', options: ['iso', 'gmp', 'dmf', 'other'], req: true },
  { key: 'market_share', type: 'market_share', req: false },
  { key: 'revenue', type: 'revenue', req: false },
  { key: 'exports', type: 'exports_pct', req: false },
  { key: 'expansion_strategy', type: 'text', max: 300, req: false },
  { key: 'partnership_models', type: 'multi', list: 'f_partnership_models', req: true },
  { key: 'investment_range', type: 'usd_range', req: false },
];

export const PROJECT_FIELDS = { A, B, C, D, E, F };

/** "Resumo do projeto": first field of each project step when the organization has more than one project. */
export const SUMMARY_FIELD = { key: 'summary', type: 'text', max: 300, req: true };

export const LEADERSHIP_FIELD = { key: 'leadership', type: 'leaders', req: false, max: 4 };
export const IMAGE_FIELDS = [
  { key: 'cover_url', type: 'image', kind: 'cover', req: false },
  { key: 'gallery', type: 'gallery', req: false, max: 6 },
];

/** Fields of a project step, with the summary first when needed. */
export function projectFields(project, projectCount) {
  const list = PROJECT_FIELDS[project.profile_type] || [];
  return projectCount > 1 ? [SUMMARY_FIELD].concat(list) : list;
}

/** Steps of the form (spec 1, 5.1): organization, one per project, leadership, images, preview. */
export function formSteps(content) {
  const steps = [{ id: 'organization', kind: 'organization' }];
  content.projects.forEach((p) => steps.push({ id: 'project:' + p.id, kind: 'project', projectId: p.id }));
  steps.push({ id: 'leadership', kind: 'leadership' }, { id: 'images', kind: 'images' }, { id: 'preview', kind: 'preview' });
  return steps;
}

/**
 * Where a field's value lives inside the draft content. Most project fields are stored as-is in
 * project.fields; a few form fields are composed of several stored keys.
 */
export function readField(container, field) {
  if (field.key === 'place') return { city: container.city || '', state: container.state || '' };
  if (field.key === 'clients') return { count: container.client_count, profiles: container.client_profiles || [] };
  if (field.type === 'raised') return { items: container.raised || [], none: !!container.raised_none };
  return container[field.key];
}

export function writeField(container, field, value) {
  const next = { ...container };
  if (field.key === 'place') { next.city = value.city; next.state = value.state; return next; }
  if (field.key === 'clients') { next.client_count = value.count; next.client_profiles = value.profiles; return next; }
  if (field.type === 'raised') { next.raised = value.items; next.raised_none = value.none; return next; }
  next[field.key] = value;
  return next;
}

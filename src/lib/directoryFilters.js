// Directory filters (spec 1, 6.1 item 4): profile, size, segment, partnership type, target markets,
// regulatory phase, TRL and maturity. Organization-level filters look at the organization; project-level
// filters must all match the SAME project.

export const EMPTY_FILTERS = {
  profile: '', size: '', segment: '', partnership: '', market: '', phase: '', trl: '', maturity: '',
};

/** Options of each filter: [filter key, enum list used for labels, values]. */
export const FILTER_DEFS = [
  ['size', 'size', ['startup', 'medium', 'large']],
  ['segment', 'segments', ['pharmaceutical', 'biotechnology', 'human_health', 'animal_health', 'devices_diagnostics', 'apis', 'biodiversity_bioeconomy', 'cro', 'other']],
  ['partnership', 'partnership_types', ['vc', 'joint_venture', 'co_development', 'market_distribution', 'out_licensing', 'infrastructure_investment']],
  ['market', 'markets', ['brazil', 'north_america', 'latin_america', 'europe', 'asia', 'oceania', 'africa']],
  ['phase', 'regulatory_phase', ['preclinical', 'phase_1', 'phase_2', 'phase_3', 'registered']],
  ['trl', null, ['1', '2', '3', '4', '5', '6', '7', '8', '9']],
  ['maturity', 'maturity', ['pre_operational', 'partially_operational', 'fully_operational']],
];

function projectMarkets(f) {
  return [].concat(f.target_markets || [], f.markets_served || [], f.export_markets || []);
}

function projectMatches(p, flt) {
  const f = p.fields;
  if (flt.profile && p.profile_type !== flt.profile) return false;
  if (flt.market && !projectMarkets(f).includes(flt.market)) return false;
  if (flt.phase && f.regulatory_phase !== flt.phase) return false;
  if (flt.trl && !(f.trl >= Number(flt.trl))) return false; // "TRL n or higher"
  if (flt.maturity && f.maturity !== flt.maturity) return false;
  return true;
}

/** First project of the organization that matches the project-level filters (shown on its card). */
export function matchingProject(org, flt) {
  return org.projects.find((p) => projectMatches(p, flt)) || org.projects[0];
}

export function matchesFilters(org, flt) {
  if (flt.size && org.size !== flt.size) return false;
  if (flt.segment && !(org.segments || []).includes(flt.segment)) return false;
  if (flt.partnership && !(org.partnership_types || []).includes(flt.partnership)) return false;
  return org.projects.some((p) => projectMatches(p, flt));
}

export function activeFilterCount(flt) {
  return Object.keys(flt).filter((k) => flt[k]).length;
}

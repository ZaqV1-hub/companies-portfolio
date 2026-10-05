// Contacts registry rules shared by the company area and the team panel (spec 2).

/** Business days between two ISO dates (exclusive of the start day), skipping weekends and the national holidays list. */
export function businessDaysBetween(startISO, endISO, holidays = []) {
  if (!startISO || !endISO) return 0;
  const hol = new Set(holidays);
  const d = new Date(startISO.slice(0, 10) + 'T12:00:00');
  const end = new Date(endISO.slice(0, 10) + 'T12:00:00');
  let n = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6 && !hol.has(iso)) n += 1;
  }
  return n;
}

/** Apex product suggested from the interaction type (spec 2, 6.3); the user can change it. */
export const APEX_PRODUCT_FOR_TYPE = {
  in_person_meeting: 'investment_matchmaking',
  virtual_meeting: 'investment_matchmaking',
  material_sent: 'investment_portfolio',
  email: 'basic_investor_info',
  nda: 'investment_matchmaking',
  proposal_term_sheet: 'investment_matchmaking',
  other: null,
};

/**
 * Recommended fields ("usado no relatório Apex"), used for the completeness indicator (spec 2, 7.2 and 8).
 * level: where the field lives; anchor: id of the input in the contact record, for the "go to field" link.
 */
export const RECOMMENDED = [
  { key: 'role', level: 'contact' },
  { key: 'linkedin', level: 'contact' },
  { key: 'investor_type', level: 'institution' },
  { key: 'niche', level: 'institution' },
  { key: 'ticket', level: 'institution' },
  { key: 'interest_type', level: 'institution' },
  { key: 'sectors', level: 'institution' },
  { key: 'description', level: 'institution' },
  { key: 'website', level: 'institution' },
  { key: 'origin', level: 'relationship' },
  { key: 'status', level: 'relationship' },
];

function filled(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== '';
}

/** @returns {{filled: number, total: number, missing: string[], pct: number}} */
export function completeness(contact, institution, relationship) {
  const values = {
    role: contact.role, linkedin: contact.linkedin,
    investor_type: institution.investor_type, niche: institution.niche,
    ticket: institution.ticket_min_musd != null || institution.ticket_max_musd != null ? 'x' : null,
    interest_type: institution.interest_type, sectors: institution.sectors,
    description: institution.description_original || institution.description_pt, website: institution.website,
    origin: relationship.origin, status: relationship.status,
  };
  const missing = RECOMMENDED.filter((r) => !filled(values[r.key])).map((r) => r.key);
  const total = RECOMMENDED.length;
  return { filled: total - missing.length, total, missing, pct: Math.round(((total - missing.length) / total) * 100) };
}

/**
 * Classification shown in lists: the validated one, plus a pending suggestion / announcement if any.
 * rel.suggested = {value: 'nia'|'br', justification, at, by, state: 'pending'|'validated'|'adjusted'}
 * rel.npia = {type, date, amount_usd, description, confidential, state: 'pending'|'validated'|'rejected', ...}
 * @returns {{value: string, state: 'validated'|'suggested', suggested?: string}}
 */
export function classificationView(rel) {
  if (rel.npia && rel.npia.state === 'pending') return { value: rel.classification, state: 'suggested', suggested: 'npia' };
  if (rel.suggested && rel.suggested.state === 'pending') return { value: rel.classification, state: 'suggested', suggested: rel.suggested.value };
  return { value: rel.classification, state: 'validated' };
}

/** Continuity per year for the Apex control (spec 2, 6.5): yes / left / unknown. */
export function continuityForYear(rel, interactions, year) {
  if (rel.status === 'closed') return 'left';
  return interactions.some((i) => i.relationship_id === rel.id && i.date.startsWith(String(year))) ? 'yes' : 'unknown';
}

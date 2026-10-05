// Company area · Contacts (spec 2, 7.1) and the team's full base (spec 2, 7.3 item 4).
// Company users only receive their own relationships from api.listContactRows().
import { html, useEffect, useMemo, useState } from '../../lib/html.js';
import * as api from '../../services/api.js';
import { useI18n } from '../../lib/i18n.js';
import { formatDate } from '../../lib/format.js';
import { countryName } from '../../lib/countries.js';
import { href } from '../../lib/router.js';
import { ClassificationBadge, CompletenessBar, HelpBlock, HelpIcon } from '../../components/crm/common.js';

const CLASSES = ['lead', 'nia', 'npia', 'br', 'incomplete'];
const STATUSES = ['in_progress', 'closed', 'deal'];

export function useContactRows() {
  const [data, setData] = useState(null);
  const reload = () => api.listContactRows().then(setData);
  useEffect(() => { reload(); }, []);
  return [data, reload];
}

/** Filters shared by the company list and the team base. */
export function ContactFilters({ rows, f, setF, origins, team }) {
  const { t, label, lang } = useI18n();
  const countries = Array.from(new Set(rows.map((r) => r.contact.country).filter(Boolean))).sort();
  const companies = Array.from(new Map(rows.map((r) => [r.relationship.organization_id, r.organization_name])).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const events = Array.from(new Set(rows.flatMap((r) => r.events))).sort();
  const sel = (key, options, render) => html`<label class="filter"><span>${t('crm.f_' + key)}</span>
    <select class=${f[key] ? 'on' : ''} value=${f[key] || ''} onChange=${(e) => setF({ ...f, [key]: e.target.value })}>
      <option value="">${t('crm.all')}</option>${options.map((o) => html`<option key=${o} value=${o}>${render(o)}</option>`)}
    </select></label>`;
  return html`<div class="table-tools">
    <input class="input input-sm" type="search" placeholder=${t('crm.search')} value=${f.q || ''} onInput=${(e) => setF({ ...f, q: e.target.value })} />
    <div class="filters" style=${{ borderTop: 'none', paddingTop: 0 }}>
      ${team && html`<label class="filter"><span>${t('crm.f_company')}</span><select class=${f.company ? 'on' : ''} value=${f.company || ''} onChange=${(e) => setF({ ...f, company: e.target.value })}>
        <option value="">${t('crm.all')}</option>${companies.map(([id, name]) => html`<option key=${id} value=${id}>${name}</option>`)}</select></label>`}
      ${sel('classification', CLASSES, (o) => label('classification', o))}
      ${!team && sel('status', STATUSES, (o) => label('rel_status', o))}
      ${sel('origin', origins, (o) => o)}
      ${sel('country', countries, (o) => countryName(o, lang))}
      ${team && sel('event', events, (o) => o)}
      <label class="filter"><span>${t('crm.f_from')}</span><input type="date" value=${f.from || ''} onInput=${(e) => setF({ ...f, from: e.target.value })} /></label>
      <label class="filter"><span>${t('crm.f_to')}</span><input type="date" value=${f.to || ''} onInput=${(e) => setF({ ...f, to: e.target.value })} /></label>
    </div>
  </div>`;
}

export function applyContactFilters(rows, f) {
  const q = (f.q || '').trim().toLowerCase();
  return rows.filter((r) => (!q || [r.contact.name, r.contact.email, r.institution.name].join(' ').toLowerCase().includes(q))
    && (!f.company || r.relationship.organization_id === f.company)
    && (!f.classification || r.relationship.classification === f.classification)
    && (!f.status || r.relationship.status === f.status)
    && (!f.origin || r.relationship.origin === f.origin)
    && (!f.country || r.contact.country === f.country)
    && (!f.event || r.events.includes(f.event))
    // period: at least one interaction in the range (the export uses the interaction date too)
    && (!f.from && !f.to ? true : r.interaction_dates.some((d) => (!f.from || d >= f.from) && (!f.to || d <= f.to))));
}

export function ContactTable({ rows, base, team }) {
  const { t, label, lang } = useI18n();
  const cols = { gridTemplateColumns: team ? '1.6fr 1.3fr 1.2fr 0.9fr 1.6fr 1fr 0.9fr 1fr' : '1.6fr 1.4fr 1fr 1.7fr 1fr 0.9fr 1fr' };
  return html`<div>
    <div class="trow thead" style=${cols}>
      <div>${t('crm.col_name')}</div><div>${t('crm.col_institution')}</div>${team && html`<div>${t('crm.col_company')}</div>`}<div>${t('crm.col_country')}</div>
      <div>${t('crm.col_classification')}</div><div>${t('crm.col_last')}</div><div>${t('crm.col_status')}</div><div>${t('crm.col_completeness')}</div>
    </div>
    ${rows.length === 0 && html`<div class="empty-row">${t('crm.empty')}</div>`}
    ${rows.map((r) => html`<a class="trow link-row" key=${r.relationship.id} style=${cols} href=${href(base + '/' + r.relationship.id)}>
      <div><strong>${r.contact.name}</strong><div class="cell-sub">${r.contact.role || ''}</div></div>
      <div>${r.institution.name}</div>
      ${team && html`<div>${r.organization_name}</div>`}
      <div>${countryName(r.contact.country, lang)}</div>
      <div><${ClassificationBadge} rel=${r.relationship} /></div>
      <div>${r.last_interaction ? formatDate(r.last_interaction, lang) : '—'}</div>
      <div>${label('rel_status', r.relationship.status)}</div>
      <div><${CompletenessBar} c=${r.completeness} /></div>
    </a>`)}
  </div>`;
}

export function ContactsListPage() {
  const { t, lang } = useI18n();
  const [data] = useContactRows();
  const [f, setF] = useState({});
  const rows = data ? data.rows : [];
  const filtered = useMemo(() => applyContactFilters(rows, f)
    // incomplete records first (spec 2, 7.1 item 6), then most recent interaction
    .sort((a, b) => (a.completeness.pct === 100) - (b.completeness.pct === 100) || (b.last_interaction || '').localeCompare(a.last_interaction || '')), [rows, f]);
  if (!data) return html`<div>${t('common.loading')}</div>`;
  const d = data.deadlines;
  const requests = rows.filter((r) => r.pending_request);
  const incomplete = rows.filter((r) => r.completeness.pct < 100);
  const count = (c) => rows.filter((r) => r.relationship.classification === c && r.relationship.classification_state === 'validated').length;
  const pendingSuggestions = rows.filter((r) => (r.relationship.suggested && r.relationship.suggested.state === 'pending') || (r.relationship.npia && r.relationship.npia.state === 'pending')).length;

  return html`<div class="crm-page">
    <div class="crm-sticky">
      <div><h1 class="page-title">${t('crm.title')}</h1><div class="page-subtitle">${t('crm.subtitle')}</div></div>
      <a class="btn btn-lime btn-lg" href=${href('/company/contacts/new')}>${t('crm.new_contact')}</a>
    </div>

    <section class="crm-section">
      <h2 class="section-label">${t('crm.pending_title')}</h2>
      <div class="pending-grid">
        <div class="side-card">
          <div class="side-label">${t('crm.pending_requests')} (${requests.length})</div>
          ${requests.length === 0 ? html`<p>${t('crm.no_pending')}</p>` : html`<ul class="pending-list">${requests.map((r) => {
            const n = r.pending_request.business_days;
            const level = n > d.contact_overdue_business_days ? 'overdue' : n >= d.contact_warning_business_days ? 'warning' : '';
            return html`<li key=${r.relationship.id}><a href=${href('/company/contacts/' + r.relationship.id)}><strong>${r.contact.name}</strong> · ${r.institution.name}</a>
              <span class=${'days ' + level}>${t('crm.business_days', { n, max: d.contact_overdue_business_days })}${level && ' · ' + t('crm.' + level)}</span>
              <span class="cell-sub">${formatDate(r.pending_request.requested_at, lang)}</span></li>`;
          })}</ul>`}
        </div>
        <div class="side-card">
          <div class="side-label">${t('crm.pending_incomplete')} (${incomplete.length})</div>
          ${incomplete.length === 0 ? html`<p>${t('crm.no_pending')}</p>` : html`<ul class="pending-list">${incomplete.slice(0, 6).map((r) => html`<li key=${r.relationship.id}>
            <a href=${href('/company/contacts/' + r.relationship.id)}><strong>${r.contact.name}</strong> · ${r.institution.name}</a><${CompletenessBar} c=${r.completeness} /></li>`)}</ul>`}
        </div>
      </div>
    </section>

    <section class="crm-section">
      <h2 class="section-label">${t('crm.summary_title')}</h2>
      <div class="stat-grid">
        ${['lead', 'nia', 'npia'].map((c) => html`<div class="stat-card static" key=${c}><div class="stat-value">${count(c)}</div>
          <div class="stat-label">${t('crm.summary_' + c)} <${HelpIcon} value=${c} /></div></div>`)}
        <div class="stat-card static"><div class="stat-value">${pendingSuggestions}</div><div class="stat-label">${t('crm.summary_pending')}</div></div>
      </div>
    </section>

    <${HelpBlock} />

    <section class="table-card" style=${{ marginTop: '18px' }}>
      <${ContactFilters} rows=${rows} f=${f} setF=${setF} origins=${data.origins} />
      <${ContactTable} rows=${filtered} base="/company/contacts" />
    </section>
  </div>`;
}

// Team panel · contacts registry (spec 2, 7.3): indicators vs. goals, validation queue, pending items per
// company, the full base with filters, and the ApexBrasil export (filters only until the database exists).
import { cx, html, useEffect, useMemo, useState } from '../../lib/html.js';
import * as api from '../../services/api.js';
import { useI18n } from '../../lib/i18n.js';
import { formatDate, formatUSD } from '../../lib/format.js';
import { href } from '../../lib/router.js';
import { ContactFilters, ContactTable, applyContactFilters, useContactRows } from '../crm/ContactsListPage.js';

function Indicator({ label, value, goal }) {
  const pct = goal ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return html`<div class="stat-card static indicator">
    <div class="stat-value">${value}${goal ? html`<small> / ${goal}</small>` : null}</div>
    <div class="stat-label">${label}</div>
    ${goal ? html`<div class="goal-bar"><span style=${{ width: pct + '%' }}></span></div><div class="cell-sub">${pct}%</div>` : null}
  </div>`;
}

function ExportDialog({ rows, onClose }) {
  const { t, label } = useI18n();
  const companies = Array.from(new Map(rows.map((r) => [r.relationship.organization_id, r.organization_name])).entries());
  const events = Array.from(new Set(rows.flatMap((r) => r.events)));
  return html`<div class="modal-backdrop" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="modal" role="dialog" aria-modal="true">
      <button type="button" class="modal-close" onClick=${onClose}>×</button>
      <div class="kicker">ApexBrasil</div>
      <h2 class="form-title">${t('crmteam.export_title')}</h2>
      <p class="form-subtitle">${t('crmteam.export_text')}</p>
      <div class="auth-grid">
        <label class="auth-field"><span class="field-label">${t('crm.f_from')}</span><input class="input input-sm" type="date" /></label>
        <label class="auth-field"><span class="field-label">${t('crm.f_to')}</span><input class="input input-sm" type="date" /></label>
        <label class="auth-field"><span class="field-label">${t('crm.f_company')}</span><select class="input input-sm"><option>${t('crm.all')}</option>${companies.map(([id, n]) => html`<option key=${id}>${n}</option>`)}</select></label>
        <label class="auth-field"><span class="field-label">${t('crm.f_classification')}</span><select class="input input-sm"><option>${t('crm.all')}</option>${['lead', 'nia', 'npia', 'br', 'incomplete'].map((c) => html`<option key=${c}>${label('classification', c)}</option>`)}</select></label>
        <label class="auth-field"><span class="field-label">${t('crm.f_event')}</span><select class="input input-sm"><option>${t('crm.all')}</option>${events.map((e) => html`<option key=${e}>${e}</option>`)}</select></label>
      </div>
      <div class="notice" style=${{ marginTop: '16px' }}>${t('crmteam.export_unavailable')}</div>
      <button type="button" class="btn btn-lime btn-lg" disabled>${t('crmteam.export_button')} (XLSX)</button>
    </div>
  </div>`;
}

export function CrmDashboardPage() {
  const { t, label, lang } = useI18n();
  const [year, setYear] = useState(new Date().getFullYear());
  const [dash, setDash] = useState(null);
  const [dups, setDups] = useState([]);
  const [data, reloadRows] = useContactRows();
  const [f, setF] = useState({});
  const [exporting, setExporting] = useState(false);
  const load = () => { api.getCrmDashboard(year).then(setDash); api.listDuplicateCandidates().then(setDups); reloadRows(); };
  useEffect(() => { load(); }, [year]);
  const rows = data ? data.rows : [];
  const filtered = useMemo(() => applyContactFilters(rows, f), [rows, f]);
  if (!dash || !data) return html`<div>${t('common.loading')}</div>`;

  const merge = async (d) => {
    if (d.kind === 'contact') await api.mergeContacts(d.a.id, d.b.id); else await api.mergeInstitutions(d.a.id, d.b.id);
    load();
  };
  const years = Array.from(new Set(dash.years.map(Number).concat([new Date().getFullYear()]))).sort();

  return html`<div class="crm-page">
    <div class="crm-sticky">
      <div><h1 class="page-title">${t('crmteam.title')}</h1><div class="page-subtitle">${t('crmteam.subtitle')}</div></div>
      <div class="review-actions">
        <button type="button" class="btn btn-outline btn-lg" onClick=${() => setExporting(true)}>${t('crmteam.export_button')}</button>
        <a class="btn btn-lime btn-lg" href=${href('/team/crm/new')}>${t('crm.new_contact')}</a>
      </div>
    </div>

    <section class="crm-section">
      <div class="section-head" style=${{ marginBottom: '12px' }}><h2 class="section-label">${t('crmteam.indicators')}</h2>
        <label class="filter"><span>${t('crmteam.year')}</span><select value=${year} onChange=${(e) => setYear(Number(e.target.value))}>${years.map((y) => html`<option key=${y} value=${y}>${y}</option>`)}</select></label></div>
      <div class="stat-grid">
        <${Indicator} label=${t('crmteam.ind_lead')} value=${dash.indicators.lead} goal=${dash.goals.lead} />
        <${Indicator} label=${t('crmteam.ind_nia')} value=${dash.indicators.nia} goal=${dash.goals.nia} />
        <${Indicator} label=${t('crmteam.ind_npia')} value=${dash.indicators.npia} goal=${dash.goals.npia} />
        <${Indicator} label=${t('crmteam.ind_meetings')} value=${dash.indicators.meetings} />
        <${Indicator} label=${t('crmteam.ind_events')} value=${dash.indicators.event_companies} />
      </div>
    </section>

    <section class="crm-section">
      <h2 class="section-label">${t('crmteam.queue')} (${dash.queue.length + dups.length})</h2>
      <div class="table-card">
        ${dash.queue.length + dups.length === 0 && html`<div class="empty-row">${t('crm.no_pending')}</div>`}
        ${dash.queue.map((q) => html`<div class="trow" key=${q.kind + q.relationship_id} style=${{ gridTemplateColumns: '150px 1.4fr 2fr 120px' }}>
          <div><span class="pill">${q.kind === 'npia' ? t('crmteam.q_npia') : t('crmteam.q_classification')}</span></div>
          <div><strong>${q.contact_name}</strong><div class="cell-sub">${q.organization_name}</div></div>
          <div>${q.kind === 'npia'
            ? html`${t('enum.npia_types.' + q.npia.type)} · ${formatUSD(q.npia.amount_usd, lang)}${q.npia.confidential ? ' · ' + t('crm.confidential') : ''}`
            : html`${label('classification', q.current)} → <strong>${label('classification', q.suggested.value)}</strong>${q.suggested.justification ? ' — ' + q.suggested.justification : ''}`}
            <div class="cell-sub">${formatDate((q.npia || q.suggested).at, lang)}</div></div>
          <div><a class="btn btn-lime" href=${href('/team/crm/' + q.relationship_id)}>${t('review.open')}</a></div>
        </div>`)}
        ${dups.map((d, i) => html`<div class="trow" key=${'d' + i} style=${{ gridTemplateColumns: '150px 1.4fr 2fr 120px' }}>
          <div><span class="pill">${t('crmteam.q_duplicate')}</span></div>
          <div><strong>${d.a.name}</strong><div class="cell-sub">${d.kind === 'contact' ? d.a.email : t('crm.block_institution')}</div></div>
          <div>≈ <strong>${d.b.name}</strong><div class="cell-sub">${d.kind === 'contact' ? d.b.email : ''}</div></div>
          <div><button type="button" class="btn btn-outline" title=${t('crmteam.merge_hint', { keep: d.a.name })} onClick=${() => merge(d)}>${t('crmteam.merge')}</button></div>
        </div>`)}
      </div>
    </section>

    <section class="crm-section">
      <h2 class="section-label">${t('crmteam.by_company')}</h2>
      <div class="table-card">
        <div class="trow thead" style=${{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}><div>${t('crm.col_company')}</div><div>${t('crmteam.records')}</div>
          <div>${t('crmteam.overdue')}</div><div>${t('crmteam.warning')}</div><div>${t('crmteam.avg_completeness')}</div></div>
        ${dash.by_company.map((c) => html`<div class="trow" key=${c.organization_id} style=${{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
          <div><strong>${c.organization_name}</strong></div><div>${c.records}</div>
          <div class=${cx(c.overdue && 'cell-alert')}>${c.overdue}</div><div>${c.warning}</div><div>${c.avg_completeness}%</div></div>`)}
      </div>
    </section>

    <section class="crm-section">
      <h2 class="section-label">${t('crmteam.base')} (${filtered.length})</h2>
      <div class="table-card">
        <${ContactFilters} rows=${rows} f=${f} setF=${setF} origins=${data.origins} team=${true} />
        <${ContactTable} rows=${filtered} base="/team/crm" team=${true} />
      </div>
    </section>
    ${exporting && html`<${ExportDialog} rows=${rows} onClose=${() => setExporting(false)} />`}
  </div>`;
}

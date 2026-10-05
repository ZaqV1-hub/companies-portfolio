// Contact record (spec 2, 7.2): header, actions, completeness, interaction timeline, relationship, editable data.
// Team only: validation of suggestions / announcements and the "Controle Apex" block (spec 2, 6.5).
import { cx, html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js';
import { useI18n } from '../../lib/i18n.js';
import { formatDate, formatUSD, todayISO } from '../../lib/format.js';
import { countryName, countryOptions } from '../../lib/countries.js';
import { continuityForYear } from '../../lib/crm.js';
import { href } from '../../lib/router.js';
import { UsdInput } from '../../components/form/inputs.js';
import { ClassificationBadge, HelpBlock } from '../../components/crm/common.js';
import { F, InteractionFields, MultiList, SelectList, interactionErrors } from './NewContactPage.js';

const ANCHOR = { role: 'fld-role', linkedin: 'fld-linkedin', investor_type: 'fld-investor_type', niche: 'fld-niche', ticket: 'fld-ticket',
  interest_type: 'fld-interest_type', sectors: 'fld-sectors', description: 'fld-description', website: 'fld-website', origin: 'fld-origin', status: 'fld-status' };

function goTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const input = el.querySelector('input, select, textarea');
  if (input) setTimeout(() => input.focus(), 300);
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1600);
}

function NewInteraction({ relId, origins, onDone }) {
  const { t } = useI18n();
  const [it, setIt] = useState({ date: todayISO(), description: '', type: null, apex_product: null, event: null });
  const [errors, setErrors] = useState({});
  const save = async () => {
    const res = await api.addInteraction(relId, it);
    if (res.ok) onDone(); else setErrors(interactionErrors(res.fields, t));
  };
  return html`<div class="action-panel"><${InteractionFields} it=${it} setIt=${setIt} origins=${origins} errors=${errors} />
    <button type="button" class="btn btn-lime" onClick=${save}>${t('crm.add_interaction')}</button></div>`;
}

function Suggest({ relId, onDone }) {
  const { t, label } = useI18n();
  const [value, setValue] = useState('nia');
  const [just, setJust] = useState('');
  const send = async () => { const res = await api.suggestClassification(relId, value, just); if (res.ok) onDone(); };
  return html`<div class="action-panel">
    <${F} label=${t('crm.suggest_value')} level="req"><div class="check-chips">${['nia', 'br'].map((v) => html`<label key=${v} class=${cx('check-chip', value === v && 'on')}>
      <input type="radio" name="sug" checked=${value === v} onChange=${() => setValue(v)} />${label('classification', v)}</label>`)}</div><//>
    <${F} label=${t('crm.justification')} wide=${true}><textarea class="input input-sm" rows="2" maxLength="300" value=${just} onInput=${(e) => setJust(e.target.value)}></textarea>
      <span class="counter">${just.length}/300</span><//>
    <button type="button" class="btn btn-lime" onClick=${send}>${t('crm.send_suggestion')}</button>
  </div>`;
}

function Announce({ relId, onDone }) {
  const { t, lang } = useI18n();
  const [a, setA] = useState({ type: '', date: '', amount_usd: null, description: '', confidential: null });
  const [errors, setErrors] = useState([]);
  const send = async () => { const res = await api.reportAnnouncement(relId, a); if (res.ok) onDone(); else setErrors(res.fields || []); };
  const err = (k) => (errors.includes(k) ? t('crm.errors.required') : null);
  return html`<div class="action-panel crm-grid">
    <${F} label=${t('crm.announce_type')} level="req" wide=${true} error=${err('type')}><select class="input input-sm" value=${a.type} onChange=${(e) => setA({ ...a, type: e.target.value })}>
      <option value="">${t('form.choose')}</option>${'abcdefgh'.split('').map((k) => html`<option key=${k} value=${k}>${t('enum.npia_types.' + k)}</option>`)}</select><//>
    <${F} label=${t('crm.announce_date')} level="req" error=${err('date')}><input class="input input-sm" type="date" value=${a.date} onInput=${(e) => setA({ ...a, date: e.target.value })} /><//>
    <${F} label=${t('crm.announce_amount')} level="req" error=${err('amount_usd')}><${UsdInput} value=${a.amount_usd} i18n=${{ t, lang }} onChange=${(n) => setA({ ...a, amount_usd: n })} /><//>
    <${F} label=${t('crm.announce_description')} level="req" wide=${true} error=${err('description')}><textarea class="input input-sm" rows="3" maxLength="500" value=${a.description} onInput=${(e) => setA({ ...a, description: e.target.value })}></textarea>
      <span class="counter">${a.description.length}/500</span><//>
    <${F} label=${t('crm.announce_confidential')} level="req" error=${err('confidential')}><div class="check-chips">
      ${[true, false].map((v) => html`<label key=${String(v)} class=${cx('check-chip', a.confidential === v && 'on')}><input type="radio" name="conf" checked=${a.confidential === v} onChange=${() => setA({ ...a, confidential: v })} />${v ? t('enum.fto.yes') : t('enum.fto.no')}</label>`)}</div><//>
    <div><button type="button" class="btn btn-lime" onClick=${send}>${t('crm.send_announcement')}</button></div>
  </div>`;
}

function TeamValidation({ rec, onDone }) {
  const { t, label, lang } = useI18n();
  const rel = rec.relationship;
  const [value, setValue] = useState(rel.suggested ? rel.suggested.value : rel.classification);
  const [comment, setComment] = useState('');
  const s = rel.suggested && rel.suggested.state === 'pending';
  const n = rel.npia && rel.npia.state === 'pending';
  if (!s && !n) return null;
  return html`<section class="form-card crm-block team-only">
    <h2 class="block-title">${t('crmteam.validation')}</h2>
    ${s && html`<div class="action-panel">
      <p>${t('crm.pending_suggestion', { value: label('classification', rel.suggested.value) })}${rel.suggested.justification ? ' — “' + rel.suggested.justification + '”' : ''}</p>
      <div class="row-fields wrap">
        <${SelectList} list="classification_values" labelList="classification" value=${value} onChange=${setValue} />
        <input class="input input-sm" placeholder=${t('crm.team_comment')} value=${comment} onInput=${(e) => setComment(e.target.value)} />
        <button type="button" class="btn btn-lime" onClick=${async () => { await api.validateClassification(rel.id, value, comment); onDone(); }}>${t('crmteam.validate')}</button>
      </div></div>`}
    ${n && html`<div class="action-panel">
      <p><strong>${t('crm.pending_npia')}:</strong> ${t('enum.npia_types.' + rel.npia.type)} · ${formatDate(rel.npia.date, lang)} · ${formatUSD(rel.npia.amount_usd, lang)}
        ${rel.npia.confidential && html` · <span class="pill">${t('crm.confidential')}</span>`}</p>
      <p class="form-help">${rel.npia.description}</p>
      <div class="row-fields wrap">
        <input class="input input-sm" placeholder=${t('crm.team_comment')} value=${comment} onInput=${(e) => setComment(e.target.value)} />
        <button type="button" class="btn btn-outline" onClick=${async () => { await api.validateAnnouncement(rel.id, false, comment); onDone(); }}>${t('crmteam.reject')}</button>
        <button type="button" class="btn btn-lime" onClick=${async () => { await api.validateAnnouncement(rel.id, true, comment); onDone(); }}>${t('crmteam.validate_npia')}</button>
      </div></div>`}
  </section>`;
}

function ApexControl({ rec, onDone }) {
  const { t, label } = useI18n();
  const [ac, setAc] = useState(rec.relationship.apex_control || {});
  const years = [2026, 2027, 2028];
  const yn = (k) => html`<${F} label=${t('crmteam.apex_' + k)}><div class="check-chips">${[true, false].map((v) => html`<label key=${String(v)} class=${cx('check-chip', ac[k] === v && 'on')}>
    <input type="radio" name=${k} checked=${ac[k] === v} onChange=${() => setAc({ ...ac, [k]: v })} />${v ? t('enum.fto.yes') : t('enum.fto.no')}</label>`)}</div><//>`;
  return html`<section class="form-card crm-block team-only">
    <h2 class="block-title">${t('crmteam.apex_title')} <span class="pill">${t('crmteam.team_only')}</span></h2>
    <div class="crm-grid">
      ${yn('dynamics_account')}${yn('contact_registered')}${yn('opportunity_inserted')}${yn('opportunity_word')}
      <${F} label=${t('crmteam.apex_strategic_category')}><select class="input input-sm" value=${ac.strategic_category || ''} onChange=${(e) => setAc({ ...ac, strategic_category: e.target.value })}>
        ${(rec.apex_categories || []).map((c) => html`<option key=${c} value=${c}>${c}</option>`)}</select><//>
      <${F} label=${t('crmteam.apex_notes')} wide=${true}><textarea class="input input-sm" rows="2" value=${ac.notes || ''} onInput=${(e) => setAc({ ...ac, notes: e.target.value })}></textarea><//>
      <${F} label=${t('crmteam.apex_continuity')} wide=${true}><div class="tags">${years.map((y) => html`<span key=${y} class="tag">${y}: ${label('continuity', continuityForYear(rec.relationship, rec.interactions, y))}</span>`)}</div><//>
    </div>
    <button type="button" class="btn btn-lime" onClick=${async () => { await api.updateApexControl(rec.relationship.id, ac); onDone(); }}>${t('crm.edit_save')}</button>
  </section>`;
}

export function ContactRecordPage({ relId, base, team }) {
  const { t, label, lang } = useI18n();
  const [rec, setRec] = useState(undefined);
  const [panel, setPanel] = useState(null);
  const [edit, setEdit] = useState(null);
  const [saved, setSaved] = useState(false);
  const load = () => api.getContactRecord(relId).then((r) => {
    setRec(r);
    if (r) setEdit({ contact: { ...r.contact }, institution: { ...r.institution }, relationship: { origin: r.relationship.origin, status: r.relationship.status, deal_expectation: r.relationship.deal_expectation } });
  });
  useEffect(() => { load(); }, [relId]);
  if (rec === undefined) return html`<div>${t('common.loading')}</div>`;
  if (rec === null) return html`<div class="empty-state"><strong>${t('common.not_found')}</strong><a href=${href(base)}>${t('crm.back')}</a></div>`;

  const rel = rec.relationship;
  const done = () => { setPanel(null); load(); };
  const c = edit.contact; const ins = edit.institution; const r = edit.relationship;
  const setC = (k, v) => setEdit({ ...edit, contact: { ...c, [k]: v } });
  const setI = (k, v) => setEdit({ ...edit, institution: { ...ins, [k]: v } });
  const setR = (k, v) => setEdit({ ...edit, relationship: { ...r, [k]: v } });
  const saveData = async () => { await api.updateContactRecord(rel.id, edit); setSaved(true); setTimeout(() => setSaved(false), 2000); load(); };
  const days = rec.pending_request;

  return html`<div class="crm-page">
    <a class="btn-link" href=${href(base)}>${t('crm.back')}</a>
    <header class="record-head">
      <div>
        <h1 class="page-title">${rec.contact.name}</h1>
        <div class="page-subtitle">${[rec.contact.role, rec.institution.name, [rec.contact.city, countryName(rec.contact.country, lang)].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div>
        ${team && html`<div class="page-subtitle">${t('crm.col_company')}: <strong>${rec.organization_name}</strong></div>`}
      </div>
      <${ClassificationBadge} rel=${rel} />
    </header>
    ${days && html`<div class="notice warn">${t('crm.request_line', { date: formatDate(days.requested_at, lang) })} — ${t('crm.next_interaction_due', { n: days.business_days, max: 15 })}</div>`}
    ${rel.npia && rel.npia.state !== 'pending' && html`<div class="notice">${t('crm.announcement')}: ${t('enum.npia_types.' + rel.npia.type)} · ${formatUSD(rel.npia.amount_usd, lang)} · ${label('classification', 'npia')} ${rel.npia.state === 'validated' ? '✓' : '✗'}${rel.npia.confidential ? ' · ' + t('crm.confidential') : ''}</div>`}

    <div class="record-actions">
      ${['new_interaction', 'suggest', 'announce'].map((k) => html`<button key=${k} type="button" class=${cx('btn', panel === k ? 'btn-lime' : 'btn-outline', 'btn-lg')} onClick=${() => setPanel(panel === k ? null : k)}>${t('crm.actions_' + k)}</button>`)}
    </div>
    ${panel === 'new_interaction' && html`<${NewInteraction} relId=${rel.id} origins=${rec.origins} onDone=${done} />`}
    ${panel === 'suggest' && html`<${Suggest} relId=${rel.id} onDone=${done} />`}
    ${panel === 'announce' && html`<${Announce} relId=${rel.id} onDone=${done} />`}

    ${team && html`<${TeamValidation} rec=${rec} onDone=${done} />`}

    <section class="form-card crm-block">
      <h2 class="block-title">${t('crm.completeness', { filled: rec.completeness.filled, total: rec.completeness.total })}</h2>
      <div class="completeness big"><span class="completeness-bar"><span style=${{ width: rec.completeness.pct + '%' }} class=${rec.completeness.pct < 50 ? 'low' : rec.completeness.pct < 100 ? 'mid' : 'full'}></span></span></div>
      ${rec.completeness.missing.length > 0 && html`<p class="missing">${t('crm.missing')} ${rec.completeness.missing.map((k, i) => html`<span key=${k}>${i ? ', ' : ''}<a href="#" onClick=${(e) => { e.preventDefault(); goTo(ANCHOR[k]); }}>${t('crm.rec.' + k)}</a></span>`)}</p>`}
    </section>

    <section class="form-card crm-block">
      <h2 class="block-title">${t('crm.timeline')}</h2>
      <div>${rec.interactions.map((it) => html`<div class="timeline-row" key=${it.id}>
        <div class="timeline-rail"><div class=${'timeline-dot ' + (it.auto ? 'in_progress' : 'completed')}></div><div class="timeline-line"></div></div>
        <div class="timeline-content">
          <div class="timeline-head"><span class="timeline-date">${formatDate(it.date, lang)}</span>
            ${it.type && html`<span class="status-chip">${label('interaction_types', it.type)}</span>`}
            ${it.apex_product && html`<span class="status-chip">${label('apex_products', it.apex_product)}</span>`}
            ${it.event && html`<span class="status-chip">${it.event}</span>`}
            ${it.auto && html`<span class="cell-sub">${t('crm.auto_interaction')}</span>`}</div>
          <div class="timeline-text">${it.description}</div>
          ${it.created_by_name && html`<div class="cell-sub">${it.created_by_name}</div>`}
        </div></div>`)}</div>
    </section>

    <section class="form-card crm-block">
      <h2 class="block-title">${t('crm.relationship')}</h2>
      <div class="crm-grid">
        <${F} label=${t('crm.f_origin_full')} level="rec" id="fld-origin"><select class="input input-sm" value=${r.origin || ''} onChange=${(e) => setR('origin', e.target.value || null)}>
          <option value="">${t('form.choose')}</option>${rec.origins.map((o) => html`<option key=${o} value=${o}>${o}</option>`)}</select><//>
        <${F} label=${t('crm.f_rel_status')} level="rec" id="fld-status"><${SelectList} list="rel_status" value=${r.status} onChange=${(v) => setR('status', v)} /><//>
        <${F} label=${t('crm.f_deal')} level="opt" wide=${true}><div class="row-fields wrap">
          <${UsdInput} value=${r.deal_expectation && r.deal_expectation.min_usd} i18n=${{ t, lang }} placeholder=${t('form.min_usd')} onChange=${(n) => setR('deal_expectation', { ...(r.deal_expectation || {}), min_usd: n })} />
          <${UsdInput} value=${r.deal_expectation && r.deal_expectation.max_usd} i18n=${{ t, lang }} placeholder=${t('form.max_usd')} onChange=${(n) => setR('deal_expectation', { ...(r.deal_expectation || {}), max_usd: n })} />
          <${SelectList} list="deal_types" value=${r.deal_expectation && r.deal_expectation.type} onChange=${(v) => setR('deal_expectation', { ...(r.deal_expectation || {}), type: v })} /></div><//>
        <${F} label=${t('crm.f_responsible')}><input class="input input-sm" disabled value=${rec.owner_name || '—'} /><//>
      </div>
    </section>

    <section class="form-card crm-block">
      <h2 class="block-title">${t('crm.data')}</h2>
      <h3 class="section-label">${t('crm.block_contact')}</h3>
      <div class="crm-grid">
        <${F} label=${t('crm.f_name')} level="req"><input class="input input-sm" value=${c.name || ''} onInput=${(e) => setC('name', e.target.value)} /><//>
        <${F} label=${t('crm.f_email')} level="req"><input class="input input-sm" disabled value=${c.email} /><//>
        <${F} label=${t('crm.f_country')} level="req"><select class="input input-sm" value=${c.country || ''} onChange=${(e) => setC('country', e.target.value)}>
          ${countryOptions(lang).map((o) => html`<option key=${o.code} value=${o.code}>${o.name}</option>`)}</select><//>
        <${F} label=${t('crm.f_city')} level="req"><input class="input input-sm" value=${c.city || ''} onInput=${(e) => setC('city', e.target.value)} /><//>
        <${F} label=${t('crm.f_role')} level="rec" id="fld-role"><input class="input input-sm" value=${c.role || ''} onInput=${(e) => setC('role', e.target.value)} /><//>
        <${F} label=${t('crm.f_linkedin')} level="rec" id="fld-linkedin"><input class="input input-sm" value=${c.linkedin || ''} onInput=${(e) => setC('linkedin', e.target.value)} /><//>
        <${F} label=${t('crm.f_phone')} level="opt"><input class="input input-sm" value=${c.phone || ''} onInput=${(e) => setC('phone', e.target.value)} /><//>
      </div>
      <h3 class="section-label">${t('crm.block_institution')}</h3>
      <div class="crm-grid">
        <${F} label=${t('crm.f_inst_name')} level="req"><input class="input input-sm" value=${ins.name || ''} onInput=${(e) => setI('name', e.target.value)} /><//>
        <${F} label=${t('crm.f_investor_type')} level="rec" id="fld-investor_type"><${SelectList} list="investor_types" value=${ins.investor_type} onChange=${(v) => setI('investor_type', v)} /><//>
        <${F} label=${t('crm.f_niche')} level="rec" id="fld-niche"><${SelectList} list="niche" value=${ins.niche} onChange=${(v) => setI('niche', v)} /><//>
        <${F} label=${t('crm.f_ticket')} level="rec" id="fld-ticket"><div class="row-fields">
          <input class="input input-sm short" type="number" min="0" step="0.1" placeholder=${t('crm.f_ticket_min')} value=${ins.ticket_min_musd ?? ''} onInput=${(e) => setI('ticket_min_musd', e.target.value === '' ? null : Number(e.target.value))} />
          <input class="input input-sm short" type="number" min="0" step="0.1" placeholder=${t('crm.f_ticket_max')} value=${ins.ticket_max_musd ?? ''} onInput=${(e) => setI('ticket_max_musd', e.target.value === '' ? null : Number(e.target.value))} /></div><//>
        <${F} label=${t('crm.f_interest_type')} level="rec" id="fld-interest_type"><${SelectList} list="interest_types" value=${ins.interest_type} onChange=${(v) => setI('interest_type', v)} /><//>
        <${F} label=${t('crm.f_website')} level="rec" id="fld-website"><input class="input input-sm" value=${ins.website || ''} onInput=${(e) => setI('website', e.target.value)} /><//>
        <${F} label=${t('crm.f_sectors')} level="rec" id="fld-sectors" wide=${true}><${MultiList} list="sectors" value=${ins.sectors} onChange=${(v) => setI('sectors', v)} /><//>
        <${F} label=${t('crm.f_description_original')} level="rec" id="fld-description" wide=${true}><textarea class="input input-sm" rows="2" value=${ins.description_original || ''} onInput=${(e) => setI('description_original', e.target.value)}></textarea><//>
        <${F} label=${t('crm.f_description_pt')} level="rec" wide=${true}><textarea class="input input-sm" rows="2" value=${ins.description_pt || ''} onInput=${(e) => setI('description_pt', e.target.value)}></textarea><//>
      </div>
      <button type="button" class="btn btn-lime btn-lg" onClick=${saveData}>${t('crm.edit_save')}</button>
      ${saved && html` <span class="section-note">✓</span>`}
    </section>

    ${team && html`<${ApexControl} rec=${rec} onDone=${done} />`}
    <${HelpBlock} />
  </div>`;
}

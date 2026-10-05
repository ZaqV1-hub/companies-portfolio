// "Novo contato" (spec 2, 5.2 and 6.2): one screen, four blocks — Contact, Institution, Relationship, First interaction.
// Typing an e-mail that already exists fills contact and institution; an existing institution is reused.
import { cx, html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js';
import { useI18n } from '../../lib/i18n.js';
import { todayISO } from '../../lib/format.js';
import { countryOptions } from '../../lib/countries.js';
import { APEX_PRODUCT_FOR_TYPE } from '../../lib/crm.js';
import { href, navigate } from '../../lib/router.js';
import { UsdInput } from '../../components/form/inputs.js';

export const LISTS = {
  investor_types: ['accelerator', 'angel', 'angel_network', 'asset_wealth_management', 'cvc', 'dfi', 'endowment', 'family_office', 'foundation',
    'fund_of_funds', 'hnwi', 'non_profit', 'organization', 'pe_firm', 'pension_fund', 'service_provider', 'vc'],
  niche: ['pe', 'vc', 'pevc', 'impact', 'pevc_impact', 'vc_impact'],
  interest_types: ['direct', 'direct_and_coinvestment', 'fund_indirect', 'coinvestment', 'new_fund_expansion', 'licensing', 'tech_transfer', 'rd_agreement'],
  sectors: ['health', 'biotechnology', 'pharmaceutical', 'animal_health', 'multisector'],
  rel_status: ['in_progress', 'closed', 'deal'],
  classification_values: ['lead', 'nia', 'npia', 'br', 'incomplete'],
  deal_types: ['investment', 'licensing', 'co_development', 'other'],
  interaction_types: ['in_person_meeting', 'virtual_meeting', 'email', 'material_sent', 'nda', 'proposal_term_sheet', 'other'],
  apex_products: ['promotion_event', 'promotion_webinar', 'facilitation_webinar', 'basic_investor_info', 'custom_intelligence', 'custom_business_agenda',
    'investment_portfolio', 'investment_matchmaking', 'pitch_training'],
};

/** One field with its level: req (*), rec ("usado no relatório Apex") or opt. */
export function F({ label, level, error, id, children, wide }) {
  const { t } = useI18n();
  return html`<label class=${cx('crm-field', wide && 'wide', error && 'has-error')} id=${id}>
    <span class="field-label">${label}${level === 'req' && html`<span class="req"> *</span>`}
      ${level === 'rec' && html` <span class="apex-mark">${t('crm.apex_mark')}</span>`}</span>
    ${children}
    ${error && html`<span class="field-error">${error}</span>`}
  </label>`;
}

export function SelectList({ list, value, onChange, labelList }) {
  const { t, label } = useI18n();
  return html`<select class="input input-sm" value=${value || ''} onChange=${(e) => onChange(e.target.value || null)}>
    <option value="">${t('form.choose')}</option>
    ${LISTS[list].map((v) => html`<option key=${v} value=${v}>${label(labelList || list, v)}</option>`)}
  </select>`;
}

export function MultiList({ list, value, onChange }) {
  const { label } = useI18n();
  const sel = value || [];
  return html`<div class="check-chips">${LISTS[list].map((v) => html`<label key=${v} class=${cx('check-chip', sel.includes(v) && 'on')}>
    <input type="checkbox" checked=${sel.includes(v)} onChange=${() => onChange(sel.includes(v) ? sel.filter((x) => x !== v) : sel.concat([v]))} />${label(list, v)}</label>`)}</div>`;
}

/** Interaction fields (block 4 here; also "Nova interação" in the contact record). */
export function InteractionFields({ it, setIt, origins, errors = {} }) {
  const { t } = useI18n();
  const setType = (type) => setIt({ ...it, type, apex_product: it.apexTouched ? it.apex_product : (APEX_PRODUCT_FOR_TYPE[type] || null) });
  return html`<div class="crm-grid">
    <${F} label=${t('crm.f_date')} level="req" error=${errors.date}><input class="input input-sm" type="date" max=${todayISO()} value=${it.date || ''} onInput=${(e) => setIt({ ...it, date: e.target.value })} /><//>
    <${F} label=${t('crm.f_type')} level="rec"><${SelectList} list="interaction_types" value=${it.type} onChange=${setType} /><//>
    <${F} label=${t('crm.f_description')} level="req" error=${errors.description} wide=${true}>
      <textarea class="input input-sm" rows="3" maxLength="500" value=${it.description || ''} onInput=${(e) => setIt({ ...it, description: e.target.value })}></textarea>
      <span class="counter">${(it.description || '').length}/500</span><//>
    <${F} label=${t('crm.f_apex_product')} level="rec">
      <${SelectList} list="apex_products" value=${it.apex_product} onChange=${(v) => setIt({ ...it, apex_product: v, apexTouched: true })} />
      ${it.type && !it.apexTouched && it.apex_product && html`<span class="form-help">${t('crm.apex_suggested')}</span>`}<//>
    <${F} label=${t('crm.f_event')} level="opt">
      <select class="input input-sm" value=${it.event || ''} onChange=${(e) => setIt({ ...it, event: e.target.value || null })}>
        <option value="">${t('form.choose')}</option>${origins.map((o) => html`<option key=${o} value=${o}>${o}</option>`)}</select><//>
  </div>`;
}

export function interactionErrors(fields, t) {
  const map = {};
  (fields || []).forEach((f) => {
    if (f === 'interaction.date') map.date = t('crm.errors.required');
    if (f === 'interaction.date_future') map.date = t('crm.errors.date_future');
    if (f === 'interaction.description') map.description = t('crm.errors.required');
    if (f === 'interaction.description_long') map.description = t('crm.errors.description_long');
  });
  return map;
}

export function NewContactPage({ team, base }) {
  const { t, lang } = useI18n();
  const [owners, setOwners] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [contact, setContact] = useState({ name: '', email: '', country: '', city: '', role: '', linkedin: '', phone: '' });
  const [inst, setInst] = useState({ name: '', investor_type: null, niche: null, ticket_min_musd: null, ticket_max_musd: null, interest_type: null, sectors: [], description_original: '', description_pt: '', website: '' });
  const [rel, setRel] = useState({ origin: null, status: 'in_progress', deal_expectation: null });
  const [it, setIt] = useState({ date: todayISO(), description: '', type: null, apex_product: null, event: null });
  const [origins, setOrigins] = useState([]);
  const [found, setFound] = useState(null);
  const [instFound, setInstFound] = useState(false);
  const [instOptions, setInstOptions] = useState([]);
  const [errors, setErrors] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.getCurrentUser().then(setUser);
    api.listContactRows().then((d) => setOrigins(d.origins));
    if (team) api.listContactOwners().then(setOwners);
  }, [team]);

  const lookupEmail = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return;
    const res = await api.lookupContactByEmail(contact.email, orgId);
    setFound(res);
    if (res) {
      setContact({ ...contact, ...Object.fromEntries(Object.entries(res.contact).filter(([k, v]) => ['name', 'country', 'city', 'role', 'linkedin', 'phone'].includes(k) && v)) });
      if (res.institution) { setInst({ ...inst, ...res.institution }); setInstFound(true); }
    }
  };
  const onInstName = async (name) => {
    setInst({ ...inst, name });
    const opts = await api.searchInstitutions(name);
    setInstOptions(opts);
    const exact = opts.find((o) => o.name.toLowerCase() === name.trim().toLowerCase());
    if (exact) {
      setInst({ ...inst, ...exact });
      setInstFound(true);
      // existing institution suggests the contact's country and city (spec 2, 8)
      setContact((c) => ({ ...c, country: c.country || exact.hq_country || '', city: c.city || exact.hq_city || '' }));
    } else setInstFound(false);
  };

  const save = async () => {
    const res = await api.createContactRecord({ organization_id: orgId, contact, institution: inst, relationship: rel, interaction: it });
    if (res.ok) { navigate(base + '/' + res.relationship_id); return; }
    if (res.error === 'already_exists') { setFound({ ...(found || {}), existing_relationship_id: res.relationship_id }); return; }
    const map = interactionErrors(res.fields, t);
    (res.fields || []).forEach((f) => {
      if (f === 'contact.email_invalid') map.email = t('crm.errors.email_invalid');
      else if (f.startsWith('contact.')) map[f.slice(8)] = t('crm.errors.required');
      if (f === 'institution.name') map.inst_name = t('crm.errors.required');
      if (f === 'organization') map.org = t('crm.errors.organization');
    });
    setErrors(map);
    window.scrollTo(0, 0);
  };

  const sc = (k) => (e) => setContact({ ...contact, [k]: e.target.value });
  const si = (k) => (e) => setInst({ ...inst, [k]: e.target.value });
  return html`<div class="crm-page">
    <a class="btn-link" href=${href(base)}>${t('crm.back')}</a>
    <h1 class="page-title" style=${{ marginTop: '10px' }}>${t('crm.new_contact').replace('+ ', '')}</h1>
    <p class="page-subtitle">${t('crm.required_note')}</p>
    ${found && html`<div class="notice">${t('crm.email_found')}
      ${found.existing_relationship_id && html`<div><strong>${t('crm.email_has_rel')}</strong> <a href=${href(base + '/' + found.existing_relationship_id)}>${t('crm.open_record')} →</a></div>`}</div>`}

    <section class="form-card crm-block">
      <h2 class="block-title">1 · ${t('crm.block_contact')}</h2>
      <div class="crm-grid">
        <${F} label=${t('crm.f_email')} level="req" error=${errors.email}><input class="input input-sm" type="email" value=${contact.email} onInput=${sc('email')} onBlur=${lookupEmail} /><//>
        <${F} label=${t('crm.f_name')} level="req" error=${errors.name}><input class="input input-sm" value=${contact.name} onInput=${sc('name')} /><//>
        <${F} label=${t('crm.f_country')} level="req" error=${errors.country}>
          <select class="input input-sm" value=${contact.country} onChange=${sc('country')}><option value="">${t('form.choose')}</option>
            ${countryOptions(lang).map((c) => html`<option key=${c.code} value=${c.code}>${c.name}</option>`)}</select><//>
        <${F} label=${t('crm.f_city')} level="req" error=${errors.city}><input class="input input-sm" value=${contact.city} onInput=${sc('city')} /><//>
        <${F} label=${t('crm.f_role')} level="rec"><input class="input input-sm" value=${contact.role || ''} onInput=${sc('role')} /><//>
        <${F} label=${t('crm.f_linkedin')} level="rec"><input class="input input-sm" type="url" value=${contact.linkedin || ''} onInput=${sc('linkedin')} /><//>
        <${F} label=${t('crm.f_phone')} level="opt"><input class="input input-sm" type="tel" value=${contact.phone || ''} onInput=${sc('phone')} /><//>
      </div>
    </section>

    <section class="form-card crm-block">
      <h2 class="block-title">2 · ${t('crm.block_institution')}</h2>
      ${instFound && html`<p class="form-help">${t('crm.institution_found')}</p>`}
      <div class="crm-grid">
        <${F} label=${t('crm.f_inst_name')} level="req" error=${errors.inst_name}>
          <input class="input input-sm" list="inst-options" value=${inst.name} onInput=${(e) => onInstName(e.target.value)} />
          <datalist id="inst-options">${instOptions.map((o) => html`<option key=${o.id} value=${o.name} />`)}</datalist><//>
        <${F} label=${t('crm.f_investor_type')} level="rec"><${SelectList} list="investor_types" value=${inst.investor_type} onChange=${(v) => setInst({ ...inst, investor_type: v })} /><//>
        <${F} label=${t('crm.f_niche')} level="rec"><${SelectList} list="niche" value=${inst.niche} onChange=${(v) => setInst({ ...inst, niche: v })} /><//>
        <${F} label=${t('crm.f_ticket')} level="rec"><div class="row-fields">
          <input class="input input-sm short" type="number" min="0" step="0.1" placeholder=${t('crm.f_ticket_min')} value=${inst.ticket_min_musd ?? ''} onInput=${(e) => setInst({ ...inst, ticket_min_musd: e.target.value === '' ? null : Number(e.target.value) })} />
          <input class="input input-sm short" type="number" min="0" step="0.1" placeholder=${t('crm.f_ticket_max')} value=${inst.ticket_max_musd ?? ''} onInput=${(e) => setInst({ ...inst, ticket_max_musd: e.target.value === '' ? null : Number(e.target.value) })} /></div><//>
        <${F} label=${t('crm.f_interest_type')} level="rec"><${SelectList} list="interest_types" value=${inst.interest_type} onChange=${(v) => setInst({ ...inst, interest_type: v })} /><//>
        <${F} label=${t('crm.f_website')} level="rec"><input class="input input-sm" type="url" value=${inst.website || ''} onInput=${si('website')} /><//>
        <${F} label=${t('crm.f_sectors')} level="rec" wide=${true}><${MultiList} list="sectors" value=${inst.sectors} onChange=${(v) => setInst({ ...inst, sectors: v })} /><//>
        <${F} label=${t('crm.f_description_original')} level="rec" wide=${true}><textarea class="input input-sm" rows="2" value=${inst.description_original || ''} onInput=${si('description_original')}></textarea><//>
        <${F} label=${t('crm.f_description_pt')} level="rec" wide=${true}><textarea class="input input-sm" rows="2" value=${inst.description_pt || ''} onInput=${si('description_pt')}></textarea><//>
      </div>
    </section>

    <section class="form-card crm-block">
      <h2 class="block-title">3 · ${t('crm.block_relationship')}</h2>
      <div class="crm-grid">
        <${F} label=${t('crm.f_owner_company')} level=${team ? 'req' : null} error=${errors.org}>
          ${team ? html`<select class="input input-sm" value=${orgId} onChange=${(e) => setOrgId(e.target.value)}><option value="">${t('form.choose')}</option>
            ${owners.map((o) => html`<option key=${o.id} value=${o.id}>${o.name}</option>`)}</select>`
          : html`<input class="input input-sm" disabled value=${user ? user.organization_name || '' : ''} />`}<//>
        <${F} label=${t('crm.f_responsible')}><input class="input input-sm" disabled value=${user ? user.name : ''} /><//>
        <${F} label=${t('crm.f_origin_full')} level="rec"><select class="input input-sm" value=${rel.origin || ''} onChange=${(e) => setRel({ ...rel, origin: e.target.value || null })}>
          <option value="">${t('form.choose')}</option>${origins.map((o) => html`<option key=${o} value=${o}>${o}</option>`)}</select><//>
        <${F} label=${t('crm.f_rel_status')} level="rec"><${SelectList} list="rel_status" value=${rel.status} onChange=${(v) => setRel({ ...rel, status: v })} /><//>
        <${F} label=${t('crm.f_deal')} level="opt" wide=${true}><div class="row-fields wrap">
          <${UsdInput} value=${rel.deal_expectation && rel.deal_expectation.min_usd} i18n=${{ t, lang }} placeholder=${t('form.min_usd')}
            onChange=${(n) => setRel({ ...rel, deal_expectation: { ...(rel.deal_expectation || {}), min_usd: n } })} />
          <${UsdInput} value=${rel.deal_expectation && rel.deal_expectation.max_usd} i18n=${{ t, lang }} placeholder=${t('form.max_usd')}
            onChange=${(n) => setRel({ ...rel, deal_expectation: { ...(rel.deal_expectation || {}), max_usd: n } })} />
          <${SelectList} list="deal_types" value=${rel.deal_expectation && rel.deal_expectation.type} onChange=${(v) => setRel({ ...rel, deal_expectation: { ...(rel.deal_expectation || {}), type: v } })} /></div><//>
        <${F} label=${t('crm.f_classification')} wide=${true}><span class="form-help">Lead · ${t('crm.f_classification_note')}</span><//>
      </div>
    </section>

    <section class="form-card crm-block">
      <h2 class="block-title">4 · ${t('crm.block_interaction')}</h2>
      <${InteractionFields} it=${it} setIt=${setIt} origins=${origins} errors=${errors} />
    </section>

    <div class="form-nav">
      <a class="btn btn-outline" href=${href(base)}>${t('crm.cancel')}</a>
      <button type="button" class="btn btn-lime btn-xl" onClick=${save}>${t('crm.save')}</button>
    </div>
  </div>`;
}

import { cx, html, useEffect, useRef, useState } from '../../lib/html.js';
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

/** One field with its required marker and inline error. */
export function F({ label, level, error, id, children, wide }) {
  return html`<label class=${cx('crm-field', wide && 'wide', error && 'has-error')} id=${id}>
    <span class="field-label">${label}${level === 'req' && html`<span class="req"> *</span>`}</span>
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
    <${F} label=${t('crm.f_date')} level="req" error=${errors.date}><input class="input input-sm" type="date" max=${todayISO()} value=${it.date || ''} onInput=${(e) => setIt({ ...it, date: e.target.value })} />
      <span class="form-help">${t('crm.entry_date_hint')}</span><//>
    <${F} label=${t('crm.f_type')} level="rec" error=${errors.type}><${SelectList} list="interaction_types" value=${it.type} onChange=${setType} /><//>
    <${F} label=${t('crm.f_description')} level="req" error=${errors.description} wide=${true}>
      <textarea class="input input-sm" rows="3" maxLength="500" value=${it.description || ''} onInput=${(e) => setIt({ ...it, description: e.target.value })}></textarea>
      <span class="counter">${(it.description || '').length}/500</span><//>
    <${F} label=${t('crm.f_apex_product')} level="rec" error=${errors.apex_product}>
      <${SelectList} list="apex_products" value=${it.apex_product} onChange=${(v) => setIt({ ...it, apex_product: v, apexTouched: true })} />
      ${it.type && !it.apexTouched && it.apex_product && html`<span class="form-help">${t('crm.apex_suggested')}</span>`}<//>
    <${F} label=${t('crm.f_event')} level="opt" error=${errors.event}>
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

const ENTRY_STEPS = [
  { key:'contact', fields:['email','name','country','city'] },
  { key:'institution', fields:['inst_name'] },
  { key:'relationship', fields:['org','origin','status','deal'] },
  { key:'interaction', fields:['date','description','type','apex_product','event'] },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInteractionEntry(it, t) {
  const errors = {};
  if (!it.date) errors.date = t('crm.errors.required');
  else if (it.date > todayISO()) errors.date = t('crm.errors.date_future');
  if (!it.description.trim()) errors.description = t('crm.errors.required');
  else if (it.description.length > 500) errors.description = t('crm.errors.description_long');
  return errors;
}

function entryErrors(fields, t) {
  const errors = interactionErrors(fields,t);
  for (const field of fields || []) {
    if (field === 'contact.email_invalid') errors.email = t('crm.errors.email_invalid');
    else if (field.startsWith('contact.')) errors[field.slice(8)] ||= t('crm.errors.required');
    else if (field === 'institution.name') errors.inst_name = t('crm.errors.required');
    else if (['organization','organization_id'].includes(field)) errors.org = t('crm.errors.organization');
    else if (field.startsWith('relationship.')) errors[field === 'relationship.deal_expectation' ? 'deal' : field.slice(13)] = t('crm.entry_invalid');
    else if (field.startsWith('interaction.') && !['interaction.date','interaction.description'].includes(field)) errors[field.slice(12)] ||= t('crm.entry_invalid');
  }
  return errors;
}

export function NewContactPage({ team, base }) {
  const { t, lang } = useI18n();
  const [owners, setOwners] = useState([]);
  const [orgId, setOrgId] = useState(team ? 'program' : '');
  const [contact, setContact] = useState({ name: '', email: '', country: '', city: '', role: '', phone: '' });
  const [inst, setInst] = useState({ name: '', investor_type: null, niche: null, ticket_min_musd: null, ticket_max_musd: null, interest_type: null, sectors: [], description_original: '', description_pt: '', website: '' });
  const [rel, setRel] = useState({ origin: team ? 'Contato direto' : null, status: 'in_progress', deal_expectation: null });
  const [it, setIt] = useState({ date: todayISO(), description: '', type: null, apex_product: null, event: null });
  const [origins, setOrigins] = useState([]);
  const [found, setFound] = useState(null);
  const [instFound, setInstFound] = useState(false);
  const [instOptions, setInstOptions] = useState([]);
  const [errors, setErrors] = useState({});
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingError, setSavingError] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const emailRequest = useRef(0);
  const institutionRequest = useRef(0);
  const saveLock = useRef(false);
  const heading = useRef(null);
  const panel = useRef(null);
  const focusError = useRef(false);
  const moveFocus = useRef(false);

  useEffect(() => {
    api.getCurrentUser().then(setUser).catch(() => {});
    api.listContactRows().then((d) => setOrigins(d.origins || [])).catch(() => {});
    if (team) api.listContactOwners().then(setOwners).catch(() => setSavingError(t('crm.entry_company_load_error')));
  }, [team]);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    const controls = panel.current?.querySelectorAll('.has-error input, .has-error select, .has-error textarea');
    const field = focusError.current && Array.from(controls || []).find((control) => control.getClientRects().length);
    focusError.current = false;
    (field || heading.current)?.focus({preventScroll:true});
    (field || heading.current)?.scrollIntoView({block:field ? 'center' : 'start'});
  }, [step,errors]);

  const lookupEmail = async (email = contact.email, organization = orgId) => {
    if (!EMAIL_PATTERN.test(email.trim())) return;
    const request = ++emailRequest.current;
    setLookupBusy(true);
    try {
      const result = await api.lookupContactByEmail(email.trim(),organization);
      if (request !== emailRequest.current) return;
      setFound(result);
      if (result?.contact) {
        setContact((current) => ({ ...current, ...Object.fromEntries(
          ['name','country','city','role','phone'].filter((key) => result.contact[key]).map((key) => [key,result.contact[key]])
        ) }));
      }
      if (result?.institution) {
        institutionRequest.current++;
        setInst((current) => ({ ...current,...result.institution })); setInstFound(true);
      }
    } catch { /* The contact can still be entered manually. */ }
    finally { if (request === emailRequest.current) setLookupBusy(false); }
  };
  const onInstName = async (name) => {
    setInst((current) => ({...current,name}));
    const request = ++institutionRequest.current;
    setInstFound(false);
    if (!name.trim()) { setInstOptions([]); return; }
    try {
      const options = await api.searchInstitutions(name);
      if (request !== institutionRequest.current) return;
      setInstOptions(options);
      const exact = options.find((o) => o.name.toLowerCase() === name.trim().toLowerCase());
      if (exact) {
        setInst((current) => ({ ...current,...exact })); setInstFound(true);
        setContact((current) => ({ ...current,country:current.country || exact.hq_country || '',city:current.city || exact.hq_city || '' }));
      }
    } catch { if (request === institutionRequest.current) setInstOptions([]); }
  };

  const validate = () => {
    const problems = validateInteractionEntry(it,t);
    for (const field of ['email','name','country','city']) if (!contact[field].trim()) problems[field] = t('crm.errors.required');
    if (contact.email.trim() && !EMAIL_PATTERN.test(contact.email.trim())) problems.email = t('crm.errors.email_invalid');
    if (!inst.name.trim()) problems.inst_name = t('crm.errors.required');
    if (team && !orgId) problems.org = t('crm.errors.organization');
    return problems;
  };
  const showErrors = (problems, target) => {
    focusError.current = true; moveFocus.current = true;
    setErrors(problems); setStep(target);
  };
  const switchStep = (target) => {
    if (target === step || saving) return;
    moveFocus.current = true; setStep(target);
  };
  const next = () => {
    const problems = validate();
    const current = Object.fromEntries(ENTRY_STEPS[step].fields.filter((key) => problems[key]).map((key) => [key,problems[key]]));
    if (Object.keys(current).length) showErrors(current,step);
    else { setErrors({}); switchStep(step+1); }
  };
  const save = async () => {
    if (saveLock.current || lookupBusy) return;
    const problems = validate();
    const invalidStep = ENTRY_STEPS.findIndex(({fields}) => fields.some((field) => problems[field]));
    if (invalidStep >= 0) { showErrors(problems,invalidStep); return; }
    saveLock.current = true; setSaving(true); setSavingError(''); setErrors({});
    try {
      const res = await api.createContactRecord({ organization_id:orgId,contact:{ ...contact,email:contact.email.trim() },institution:inst,relationship:rel,interaction:it });
      if (res.ok) { navigate(base+'/'+res.relationship_id); return; }
      if (res.error === 'already_exists' && res.relationship_id) {
        setFound((current) => ({ ...current,existing_relationship_id:res.relationship_id })); return;
      }
      const mapped = entryErrors(res.fields,t);
      const target = ENTRY_STEPS.findIndex(({fields}) => fields.some((field) => mapped[field]));
      if (target >= 0) showErrors(mapped,target);
      else setSavingError(t('crm.entry_save_error'));
    } catch { setSavingError(t('crm.entry_save_error')); }
    finally { saveLock.current = false; setSaving(false); }
  };

  const sc = (key) => (event) => {
    const value = event.target.value;
    if (key === 'email') {
      emailRequest.current++;
      setFound(null); setLookupBusy(false);
    }
    setContact((current) => ({...current,[key]:value}));
  };
  const si = (key) => (event) => {
    const value = event.target.value;
    setInst((current) => ({...current,[key]:value}));
  };
  const active = ENTRY_STEPS[step];
  const originsForEntry = [...new Set([...(team ? ['Contato direto'] : []),...origins])];
  return html`<div class="crm-page crm-contact-entry">
    <a class="btn-link" href=${href(base)}>${t('crm.back')}</a>
    <h1 class="page-title">${t('crm.entry_title')}</h1>
    <nav aria-label=${t('crm.entry_steps')} class="crm-entry-steps"><ol>
      ${ENTRY_STEPS.map(({key}, index) => html`<li key=${key}><button type="button" disabled=${saving || lookupBusy} aria-current=${index === step ? 'step' : undefined} onClick=${() => switchStep(index)}>
        <span aria-hidden="true">${index+1}</span>${t('crm.block_'+key)}
      </button></li>`)}
    </ol></nav>

    <form class="form-card crm-entry-card" noValidate onSubmit=${(event) => { event.preventDefault(); if (saving || lookupBusy) return; if (step < ENTRY_STEPS.length-1) next(); else save(); }}>
    <header class="crm-entry-card-head">
      <h2 class="block-title" ref=${heading} tabIndex="-1">${t('crm.block_'+active.key)}</h2>
      <p>${t('crm.entry_'+active.key+'_hint')}</p>
    </header>
    <fieldset class="crm-entry-fields" ref=${panel} disabled=${saving}>
    ${savingError && html`<p class="notice warn" role="alert">${savingError}</p>`}
    ${lookupBusy && html`<p class="form-help" role="status">${t('crm.entry_lookup')}</p>`}
    ${found && html`<div class=${cx('notice',found.existing_relationship_id && 'warn')} role="status">
      ${found.existing_relationship_id ? html`<strong>${t('crm.email_has_rel')}</strong> <a href=${href(base+'/'+found.existing_relationship_id)}>${t('crm.open_record')} →</a>` : t('crm.email_found')}
    </div>`}

    <section hidden=${step !== 0}>
      <div class="crm-grid">
        <${F} label=${t('crm.f_email')} level="req" error=${errors.email}><input class="input input-sm" type="email" value=${contact.email} onInput=${sc('email')} onBlur=${() => lookupEmail()} /><//>
        <${F} label=${t('crm.f_name')} level="req" error=${errors.name}><input class="input input-sm" value=${contact.name} onInput=${sc('name')} /><//>
        <${F} label=${t('crm.f_country')} level="req" error=${errors.country}>
          <select class="input input-sm" value=${contact.country} onChange=${sc('country')}><option value="">${t('form.choose')}</option>
            ${countryOptions(lang).map((c) => html`<option key=${c.code} value=${c.code}>${c.name}</option>`)}</select><//>
        <${F} label=${t('crm.f_city')} level="req" error=${errors.city}><input class="input input-sm" value=${contact.city} onInput=${sc('city')} /><//>
        <${F} label=${t('crm.f_role')} level="rec"><input class="input input-sm" value=${contact.role || ''} onInput=${sc('role')} /><//>
        <${F} label=${t('crm.f_phone')} level="opt"><input class="input input-sm" type="tel" value=${contact.phone || ''} onInput=${sc('phone')} /><//>
      </div>
    </section>

    <section hidden=${step !== 1}>
      ${instFound && html`<p class="form-help" role="status">${t('crm.institution_found')}</p>`}
      <div class="crm-grid">
        <${F} label=${t('crm.f_inst_name')} level="req" error=${errors.inst_name} wide=${true}>
          <input class="input input-sm" list="inst-options" value=${inst.name} onInput=${(e) => onInstName(e.target.value)} />
          <datalist id="inst-options">${instOptions.map((o) => html`<option key=${o.id} value=${o.name} />`)}</datalist><//>
      </div>
      <details class="crm-entry-optional"><summary>${t('crm.entry_institution_optional')}</summary><div class="crm-grid">
        <${F} label=${t('crm.f_investor_type')} level="rec"><${SelectList} list="investor_types" value=${inst.investor_type} onChange=${(v) => setInst({ ...inst, investor_type: v })} /><//>
        <${F} label=${t('crm.f_niche')} level="rec"><${SelectList} list="niche" value=${inst.niche} onChange=${(v) => setInst({ ...inst, niche: v })} /><//>
        <div class="crm-field wide"><span class="field-label">${t('crm.f_ticket')}</span><div class="crm-entry-pair">
          <${F} label=${t('crm.f_ticket_min')}><input class="input input-sm" type="number" min="0" step="0.1" value=${inst.ticket_min_musd ?? ''} onInput=${(e) => setInst({ ...inst, ticket_min_musd: e.target.value === '' ? null : Number(e.target.value) })} /><//>
          <${F} label=${t('crm.f_ticket_max')}><input class="input input-sm" type="number" min="0" step="0.1" value=${inst.ticket_max_musd ?? ''} onInput=${(e) => setInst({ ...inst, ticket_max_musd: e.target.value === '' ? null : Number(e.target.value) })} /><//></div></div>
        <${F} label=${t('crm.f_interest_type')} level="rec"><${SelectList} list="interest_types" value=${inst.interest_type} onChange=${(v) => setInst({ ...inst, interest_type: v })} /><//>
        <${F} label=${t('crm.f_website')} level="rec"><input class="input input-sm" type="url" value=${inst.website || ''} onInput=${si('website')} /><//>
        <div class="crm-field wide"><span class="field-label">${t('crm.f_sectors')}</span><${MultiList} list="sectors" value=${inst.sectors} onChange=${(v) => setInst({ ...inst, sectors: v })} /></div>
        <${F} label=${t('crm.f_description_original')} level="rec" wide=${true}><textarea class="input input-sm" rows="2" value=${inst.description_original || ''} onInput=${si('description_original')}></textarea><//>
        <${F} label=${t('crm.f_description_pt')} level="rec" wide=${true}><textarea class="input input-sm" rows="2" value=${inst.description_pt || ''} onInput=${si('description_pt')}></textarea><//>
      </div></details>
    </section>

    <section hidden=${step !== 2}>
      <div class="crm-grid">
        <${F} label=${t('crm.f_owner_company')} level=${team ? 'req' : null} error=${errors.org}>
          ${team ? html`<select class="input input-sm" value=${orgId} onChange=${(e) => { const id=e.target.value; setOrgId(id); setFound((previous) => previous?.contact ? {...previous,existing_relationship_id:null} : null); lookupEmail(contact.email,id); }}><option value="">${t('form.choose')}</option>
            ${owners.map((o) => html`<option key=${o.id} value=${o.id}>${o.name}</option>`)}</select>`
          : html`<input class="input input-sm" disabled value=${user ? user.organization_name || '' : ''} />`}<//>
        <${F} label=${t('crm.f_responsible')}><input class="input input-sm" disabled value=${user ? user.name : ''} /><//>
        <${F} label=${t('crm.f_origin_full')} level="rec" error=${errors.origin}><select class="input input-sm" value=${rel.origin || ''} onChange=${(e) => setRel({ ...rel, origin: e.target.value || null })}>
          <option value="">${t('form.choose')}</option>${originsForEntry.map((o) => html`<option key=${o} value=${o}>${o}</option>`)}</select><//>
        <${F} label=${t('crm.f_rel_status')} level="rec" error=${errors.status}><${SelectList} list="rel_status" value=${rel.status} onChange=${(v) => setRel({ ...rel, status: v })} /><//>
      </div>
      <details class="crm-entry-optional" open=${errors.deal ? true : undefined}><summary>${t('crm.entry_deal_optional')}</summary><div class="crm-grid">
        <${F} label=${t('form.min_usd')} error=${errors.deal}><${UsdInput} value=${rel.deal_expectation?.min_usd} i18n=${{ t, lang }}
          onChange=${(n) => setRel({ ...rel, deal_expectation: { ...(rel.deal_expectation || {}), min_usd: n } })} /><//>
        <${F} label=${t('form.max_usd')}><${UsdInput} value=${rel.deal_expectation?.max_usd} i18n=${{ t, lang }}
          onChange=${(n) => setRel({ ...rel, deal_expectation: { ...(rel.deal_expectation || {}), max_usd: n } })} /><//>
        <${F} label=${t('crm.f_deal_type')}><${SelectList} list="deal_types" value=${rel.deal_expectation?.type} onChange=${(v) => setRel({ ...rel, deal_expectation: { ...(rel.deal_expectation || {}), type: v } })} /><//>
      </div></details>
      <p class="form-help">${t('crm.f_classification_note')}</p>
    </section>

    <section hidden=${step !== 3}>
      <${InteractionFields} it=${it} setIt=${setIt} origins=${origins} errors=${errors} />
    </section>

    </fieldset>
    <div class="crm-entry-footer">
      <a class="btn btn-outline" href=${href(base)}>${t('crm.cancel')}</a>
      <div>
        ${step > 0 && html`<button type="button" class="btn btn-outline" disabled=${saving || lookupBusy} onClick=${() => switchStep(step-1)}>${t('form.prev')}</button>`}
        <button type="submit" class="btn btn-lime" disabled=${saving || lookupBusy || (step === ENTRY_STEPS.length-1 && !!found?.existing_relationship_id)}>
          ${t(saving ? 'crm.entry_saving' : step < ENTRY_STEPS.length-1 ? 'form.next' : 'crm.save')}
        </button>
      </div>
    </div></form>
  </div>`;
}

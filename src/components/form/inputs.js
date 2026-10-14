// Input widgets of the company form, one per field type of src/lib/formSchema.js.
// Every widget receives {field, value, onChange, i18n, disabled} and calls onChange(newValue).
import { cx, html, useEffect, useRef, useState } from '../../lib/html.js';
import { formatUSD } from '../../lib/format.js';
import { UFS } from '../../lib/formSchema.js';
import { uploadImage } from '../../services/api.js';

// ---------------------------------------------------------------- USD (spec 1, 5.2)
const USD_ALLOWED = { pt: /^[\d.]*$/, en: /^[\d,]*$/ }; // digits + the language's thousands separator

function groupDigits(n, lang) {
  return n == null || n === '' ? '' : Number(n).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');
}

/**
 * Whole number in USD with automatic thousands separator. Letters, "R$", "US$" and the decimal comma
 * are refused with the message "Informe o valor em dólares americanos, apenas números".
 */
export function UsdInput({ value, onChange, i18n, disabled, placeholder, label }) {
  const [text, setText] = useState(groupDigits(value, i18n.lang));
  const [error, setError] = useState(false);
  const errorTimer = useRef(null);
  useEffect(() => { setText(groupDigits(value, i18n.lang)); }, [value, i18n.lang]);
  useEffect(() => () => clearTimeout(errorTimer.current), []);
  const onInput = (e) => {
    const raw = e.target.value.trim();
    if (!USD_ALLOWED[i18n.lang].test(raw)) {
      setError(true);
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setError(false), 5000);
      e.target.value = text; // refuse the keystroke
      return;
    }
    const digits = raw.replace(/\D/g, '');
    const n = digits ? parseInt(digits, 10) : null;
    setText(groupDigits(n, i18n.lang));
    onChange(n);
  };
  return html`<span class="usd-wrap">
    <span class="usd-prefix">USD</span>
    <input class=${cx('input input-sm usd', error && 'invalid')} inputmode="numeric" value=${text} placeholder=${placeholder || '0'}
      aria-label=${label} disabled=${disabled} onInput=${onInput} />
    ${error && html`<span class="field-error" role="alert">${i18n.t('form.usd_error')}</span>`}
  </span>`;
}

function IntInput({ value, onChange, disabled, min, max, label, placeholder }) {
  return html`<input class="input input-sm short" type="number" min=${min} max=${max} step="1" value=${value ?? ''} aria-label=${label} placeholder=${placeholder}
    disabled=${disabled} onInput=${(e) => onChange(e.target.value === '' ? null : Math.trunc(Number(e.target.value)))} />`;
}

// ---------------------------------------------------------------- text
function Counter({ n, max }) {
  if (!max) return null;
  return html`<span class=${cx('counter', n > max && 'over')}>${n}/${max}</span>`;
}

/** Translatable text: edits the Portuguese version (the English one is reviewed by the team). */
export function TextInput({ field, value, onChange, disabled, editLang = 'pt', id }) {
  const v = value && typeof value === 'object' ? value : { pt: value || '', en: '' };
  const text = v[editLang] || '';
  const multiline = !field.max || field.max > 100;
  const props = { id, class: 'input input-sm', value: text, disabled, maxLength: field.max ? field.max + 50 : undefined,
    onInput: (e) => onChange({ ...v, [editLang]: e.target.value }) };
  return html`<div class="text-wrap">
    ${multiline ? html`<textarea rows=${Math.min(6, Math.max(2, Math.ceil((field.max || 200) / 120)))} ...${props}></textarea>` : html`<input ...${props} />`}
    <${Counter} n=${text.length} max=${field.max} />
  </div>`;
}

function PlainInput({ field, value, onChange, disabled, type, id }) {
  return html`<div class="text-wrap">
    <input id=${id} class="input input-sm" type=${type || 'text'} value=${value || ''} disabled=${disabled} onInput=${(e) => onChange(e.target.value)} />
    <${Counter} n=${(value || '').length} max=${field.max} />
  </div>`;
}

// ---------------------------------------------------------------- closed lists
function Select({ list, value, onChange, i18n, disabled, options, id, allowEmpty = true }) {
  return html`<select id=${id} class="input input-sm" value=${value || ''} disabled=${disabled} onChange=${(e) => onChange(e.target.value || null)}>
    ${allowEmpty && html`<option value="">${i18n.t('form.choose')}</option>`}
    ${options.map((o) => html`<option key=${o} value=${o}>${list ? i18n.label(list, o) : o}</option>`)}
  </select>`;
}

function Multi({ list, value, onChange, i18n, disabled, options }) {
  const sel = value || [];
  const toggle = (o) => onChange(sel.includes(o) ? sel.filter((x) => x !== o) : sel.concat([o]));
  return html`<div class="check-chips">${options.map((o) => html`<label key=${o} class=${cx('check-chip', sel.includes(o) && 'on')}>
    <input type="checkbox" checked=${sel.includes(o)} disabled=${disabled} onChange=${() => toggle(o)} />${i18n.label(list, o)}
  </label>`)}</div>`;
}

// options of each enum list (same order as the specs)
export const LIST_OPTIONS = {
  size: ['startup', 'medium', 'large'],
  segments: ['pharmaceutical', 'biotechnology', 'human_health', 'animal_health', 'devices_diagnostics', 'apis', 'biodiversity_bioeconomy', 'cro', 'other'],
  partnership_types: ['vc', 'joint_venture', 'co_development', 'market_distribution', 'out_licensing', 'infrastructure_investment'],
  markets: ['brazil', 'north_america', 'latin_america', 'europe', 'asia', 'oceania', 'africa'],
  regulatory_phase: ['preclinical', 'phase_1', 'phase_2', 'phase_3', 'registered'],
  fto: ['yes', 'no', 'in_progress'],
  round_stage: ['pre_seed', 'seed', 'series_a', 'series_b', 'series_c_plus', 'other'],
  raised_source: ['fapesp', 'finep', 'bndes', 'cnpq', 'embrapii', 'angel', 'vc', 'cvc', 'award', 'donation', 'own_resources', 'other'],
  gtm_models: ['out_licensing', 'co_development', 'direct_sales', 'partnership_distribution'],
  maturity: ['pre_operational', 'partially_operational', 'fully_operational'],
  technology_tags: ['ai_ml', 'genomics', 'electrochemistry', 'biosensors', 'microfluidics', 'fermentation', 'other'],
  business_models: ['equipment', 'consumables', 'saas', 'licensing', 'service'],
  c_services: ['process_development', 'formulation', 'manufacturing', 'analytical'],
  molecule_types: ['small_molecules', 'biologics', 'antibodies', 'vaccines', 'apis', 'other'],
  capacity_scale: ['laboratory', 'pilot', 'commercial'],
  client_profiles: ['startups', 'national_pharma', 'multinational'],
  c_investment_types: ['jv', 'pe', 'infrastructure_expansion', 'strategic_partner'],
  d_services: ['preclinical', 'clinical_phase_1_4', 'analytical', 'quality_control', 'bpl'],
  therapeutic_areas: ['oncology', 'infectious_diseases', 'immunology', 'cns', 'cardiovascular', 'dermatology', 'metabolic', 'animal_health', 'consumer_goods', 'other'],
  d_investment_types: ['expansion', 'strategic_partner', 'jv'],
  e_partnership_models: ['co_development', 'technology_transfer', 'jv', 'licensing'],
  f_partnership_models: ['jv', 'pe', 'expansion', 'distribution'],
};

// ---------------------------------------------------------------- period (month/year or semester/year)
const YEARS = Array.from({ length: 16 }, (_, i) => 2020 + i);

function PeriodInput({ value, onChange, i18n, disabled }) {
  const v = value || {};
  const sub = v.month ? 'm' + v.month : v.semester ? 's' + v.semester : '';
  const setSub = (s) => {
    const next = { year: v.year || null };
    if (s.startsWith('m')) next.month = Number(s.slice(1));
    if (s.startsWith('s')) next.semester = Number(s.slice(1));
    onChange(next);
  };
  const months = i18n.lang === 'pt' ? ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return html`<span class="period">
    <select class="input input-sm" value=${sub} disabled=${disabled} aria-label=${i18n.t('form.period')} onChange=${(e) => setSub(e.target.value)}>
      <option value="">${i18n.t('form.select_period')}</option>
      <option value="s1">${i18n.t('form.semester_1')}</option><option value="s2">${i18n.t('form.semester_2')}</option>
      ${months.map((m, i) => html`<option key=${m} value=${'m' + (i + 1)}>${m}</option>`)}
    </select>
    <select class="input input-sm" value=${v.year || ''} disabled=${disabled} aria-label=${i18n.t('form.year')} onChange=${(e) => onChange({ ...v, year: e.target.value ? Number(e.target.value) : null })}>
      <option value="">${i18n.t('form.year')}</option>
      ${YEARS.map((y) => html`<option key=${y} value=${y}>${y}</option>`)}
    </select>
  </span>`;
}

// ---------------------------------------------------------------- repeatable rows
function Rows({ items, onChange, disabled, i18n, max, blank, render }) {
  const list = items || [];
  const set = (i, item) => onChange(list.map((x, j) => (j === i ? item : x)));
  return html`<div class="rows">
    ${list.map((item, i) => html`<div class="row-item" key=${i}>
      <div class="row-fields">${render(item, (next) => set(i, next), i)}</div>
      ${!disabled && html`<button type="button" class="btn-link row-remove" onClick=${() => onChange(list.filter((_, j) => j !== i))}>${i18n.t('form.remove')}</button>`}
    </div>`)}
    ${!disabled && (!max || list.length < max) && html`<button type="button" class="btn btn-outline add-row" onClick=${() => onChange(list.concat([blank()]))}>${i18n.t('form.add')}</button>`}
  </div>`;
}

const tPt = (v) => (v && typeof v === 'object' ? v : { pt: v || '', en: '' });

function Mini({ label, children, grow }) {
  return html`<label class=${cx('mini', grow && 'grow')}><span>${label}</span>${children}</label>`;
}

function TextMini({ value, onChange, max, disabled }) {
  const v = tPt(value);
  return html`<div class="text-wrap"><input class="input input-sm" value=${v.pt} disabled=${disabled} onInput=${(e) => onChange({ ...v, pt: e.target.value })} />
    ${max && html`<${Counter} n=${v.pt.length} max=${max} />`}</div>`;
}

// ---------------------------------------------------------------- images (validated locally and saved on the API server)
function readImage(file, { minSide, maxMB, types }, kind) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('none')); return; }
    if (types && !types.includes(file.type)) { reject(new Error('image_type')); return; }
    if (maxMB && file.size > maxMB * 1024 * 1024) { reject(new Error('image_too_big')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (file.type === 'image/svg+xml') { uploadImage(file, kind).then(resolve, reject); return; }
      const img = new Image();
      img.onload = () => {
        if (minSide && Math.max(img.naturalWidth, img.naturalHeight) < minSide) { reject(new Error('image_too_small')); return; }
        uploadImage(file, kind).then(resolve, reject);
      };
      img.onerror = () => reject(new Error('image_type'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const IMAGE_RULES = {
  logo: { minSide: 512, types: ['image/png', 'image/svg+xml'] },
  cover: { minSide: 1600, maxMB: 8, types: ['image/jpeg', 'image/png'] },
  gallery: { minSide: 1600, types: ['image/jpeg', 'image/png'] },
};

function ImageInput({ field, value, onChange, i18n, disabled }) {
  const [err, setErr] = useState(null);
  const rules = IMAGE_RULES[field.kind];
  const pick = async (e) => {
    try { onChange(await readImage(e.target.files[0], rules, field.kind)); setErr(null); } catch (x) { setErr(x.message); }
    e.target.value = '';
  };
  return html`<div class=${cx('image-input', field.kind)}>
    ${value && html`<div class="image-preview" style=${{ backgroundImage: "url('" + value + "')" }}></div>`}
    ${!disabled && html`<label class="btn btn-outline"><input type="file" hidden accept=${rules.types.join(',')} onChange=${pick} />${value ? i18n.t('form.replace') : i18n.t('form.upload')}</label>`}
    ${value && !disabled && !field.req && html`<button type="button" class="btn-link" onClick=${() => onChange(null)}>${i18n.t('form.remove')}</button>`}
    ${err && err !== 'none' && html`<span class="field-error">${i18n.t('form.' + err, { min: rules.minSide })}</span>`}
  </div>`;
}

function GalleryInput({ value, onChange, i18n, disabled }) {
  const [err, setErr] = useState(null);
  const list = value || [];
  const add = async (e) => {
    try { const url = await readImage(e.target.files[0], IMAGE_RULES.gallery, 'gallery'); onChange(list.concat([{ url, caption: { pt: '', en: '' } }])); setErr(null); } catch (x) { setErr(x.message); }
    e.target.value = '';
  };
  return html`<div class="rows">
    ${list.map((g, i) => html`<div class="row-item" key=${i}>
      <div class="gallery-thumb" style=${{ backgroundImage: "url('" + g.url + "')" }}></div>
      <div class="row-fields"><${Mini} label=${i18n.t('form.caption') + ' *'} grow=${true}>
        <${TextMini} value=${g.caption} disabled=${disabled} max=${120} onChange=${(c) => onChange(list.map((x, j) => (j === i ? { ...x, caption: c } : x)))} /><//></div>
      ${!disabled && html`<button type="button" class="btn-link row-remove" onClick=${() => onChange(list.filter((_, j) => j !== i))}>${i18n.t('form.remove')}</button>`}
    </div>`)}
    ${!disabled && list.length < 6 && html`<label class="btn btn-outline add-row"><input type="file" hidden accept="image/jpeg,image/png" onChange=${add} />${i18n.t('form.upload')}</label>`}
    ${err && err !== 'none' && html`<span class="field-error">${i18n.t('form.' + err, { min: 1600 })}</span>`}
  </div>`;
}

// ---------------------------------------------------------------- dispatcher
export function FieldInput(props) {
  const { field, value, onChange, i18n, disabled, id } = props;
  const t = (k) => i18n.t('form.' + k);
  const opts = field.options || LIST_OPTIONS[field.list];
  switch (field.type) {
    case 'text': return html`<${TextInput} ...${props} />`;
    case 'plain': return html`<${PlainInput} ...${props} />`;
    case 'url': return html`<${PlainInput} ...${props} type="url" />`;
    case 'select': return html`<${Select} id=${id} list=${field.list} options=${opts} value=${value} onChange=${onChange} i18n=${i18n} disabled=${disabled} />`;
    case 'multi': return html`<${Multi} list=${field.list} options=${opts} value=${value} onChange=${onChange} i18n=${i18n} disabled=${disabled} />`;
    case 'trl': return html`<${Select} id=${id} options=${[1, 2, 3, 4, 5, 6, 7, 8, 9]} value=${value} onChange=${(v) => onChange(v ? Number(v) : null)} i18n=${i18n} disabled=${disabled} />`;
    case 'percent': return html`<${IntInput} value=${value} onChange=${onChange} disabled=${disabled} min=${0} max=${100} label=${t('pct')} />`;
    case 'image': return html`<${ImageInput} ...${props} />`;
    case 'gallery': return html`<${GalleryInput} ...${props} />`;
    case 'place': {
      const v = value || {};
      return html`<div class="row-fields">
        <${Mini} label=${t('city')} grow=${true}><input id=${id} class="input input-sm" value=${v.city || ''} disabled=${disabled} onInput=${(e) => onChange({ ...v, city: e.target.value })} /><//>
        <${Mini} label=${t('state')}><${Select} options=${UFS} value=${v.state} onChange=${(s) => onChange({ ...v, state: s })} i18n=${i18n} disabled=${disabled} /><//>
      </div>`;
    }
    case 'focal': {
      const v = value || {};
      const set = (k) => (e) => onChange({ ...v, [k]: e.target.value });
      return html`<div class="row-fields wrap">
        <${Mini} label=${t('name')} grow=${true}><input id=${id} class="input input-sm" value=${v.name || ''} disabled=${disabled} onInput=${set('name')} /><//>
        <${Mini} label=${t('role')} grow=${true}><input class="input input-sm" value=${v.role || ''} disabled=${disabled} onInput=${set('role')} /><//>
        <${Mini} label=${t('email')} grow=${true}><input class="input input-sm" type="email" value=${v.email || ''} disabled=${disabled} onInput=${set('email')} /><//>
        <${Mini} label=${t('phone')} grow=${true}><input class="input input-sm" type="tel" placeholder="+55 11 91234-5678" value=${v.phone || ''} disabled=${disabled} onInput=${set('phone')} /><//>
      </div>`;
    }
    case 'usd_range': {
      const v = value || {};
      return html`<div class="row-fields">
        <${Mini} label=${t('min_usd')}><${UsdInput} value=${v.min} i18n=${i18n} disabled=${disabled} onChange=${(n) => onChange({ ...v, min: n })} /><//>
        <${Mini} label=${t('max_usd')}><${UsdInput} value=${v.max} i18n=${i18n} disabled=${disabled} onChange=${(n) => onChange({ ...v, max: n })} /><//>
      </div>`;
    }
    case 'pipeline': return html`<${Rows} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ name: '', indication: { pt: '', en: '' } })}
      render=${(it, set) => html`<${Mini} label=${t('name')}><input class="input input-sm" value=${it.name} disabled=${disabled} onInput=${(e) => set({ ...it, name: e.target.value })} /><//>
        <${Mini} label=${t('indication')} grow=${true}><${TextMini} value=${it.indication} disabled=${disabled} onChange=${(x) => set({ ...it, indication: x })} /><//>`} />`;
    case 'milestones': return html`<${Rows} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ period: {}, description: { pt: '', en: '' } })}
      render=${(it, set) => html`<${Mini} label=${t('period')}><${PeriodInput} value=${it.period} i18n=${i18n} disabled=${disabled} onChange=${(p) => set({ ...it, period: p })} /><//>
        <${Mini} label=${t('description')} grow=${true}><${TextMini} value=${it.description} max=${150} disabled=${disabled} onChange=${(x) => set({ ...it, description: x })} /><//>`} />`;
    case 'rounds': return html`<${Rows} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ stage: '', period: {}, amount_usd: null, purpose: { pt: '', en: '' } })}
      render=${(it, set) => html`<${Mini} label=${t('stage')}><${Select} list="round_stage" options=${LIST_OPTIONS.round_stage} value=${it.stage} i18n=${i18n} disabled=${disabled} onChange=${(s) => set({ ...it, stage: s })} /><//>
        <${Mini} label=${t('period')}><${PeriodInput} value=${it.period} i18n=${i18n} disabled=${disabled} onChange=${(p) => set({ ...it, period: p })} /><//>
        <${Mini} label=${t('amount_usd')}><${UsdInput} value=${it.amount_usd} i18n=${i18n} disabled=${disabled} onChange=${(n) => set({ ...it, amount_usd: n })} /><//>
        <${Mini} label=${t('purpose')} grow=${true}><${TextMini} value=${it.purpose} max=${100} disabled=${disabled} onChange=${(x) => set({ ...it, purpose: x })} /><//>`} />`;
    case 'raised': {
      const v = value || { items: [], none: false };
      const total = v.items.reduce((s, r) => s + (r.amount_usd || 0), 0);
      return html`<div>
        <label class="check-line"><input type="checkbox" checked=${v.none} disabled=${disabled} onChange=${(e) => onChange({ items: e.target.checked ? [] : v.items, none: e.target.checked })} /> ${t('none_raised')}</label>
        ${!v.none && html`<${Rows} items=${v.items} onChange=${(items) => onChange({ ...v, items })} disabled=${disabled} i18n=${i18n} blank=${() => ({ source: '', amount_usd: null })}
          render=${(it, set) => html`<${Mini} label=${t('source')}><${Select} list="raised_source" options=${LIST_OPTIONS.raised_source} value=${it.source} i18n=${i18n} disabled=${disabled} onChange=${(s) => set({ ...it, source: s })} /><//>
            <${Mini} label=${t('amount_usd')}><${UsdInput} value=${it.amount_usd} i18n=${i18n} disabled=${disabled} onChange=${(n) => set({ ...it, amount_usd: n })} /><//>`} />
          <div class="total-line">${t('total')}: <strong>${formatUSD(total, i18n.lang)}</strong></div>`}
      </div>`;
    }
    case 'revenue': {
      const v = value || {};
      return html`<div>
        ${field.allowPre && html`<label class="check-line"><input type="checkbox" checked=${!!v.pre_revenue} disabled=${disabled} onChange=${(e) => onChange(e.target.checked ? { pre_revenue: true } : {})} /> ${t('pre_revenue')}</label>`}
        ${!v.pre_revenue && html`<div class="row-fields">
          <${Mini} label=${t('amount_usd')}><${UsdInput} value=${v.amount_usd} i18n=${i18n} disabled=${disabled} onChange=${(n) => onChange({ ...v, amount_usd: n })} /><//>
          <${Mini} label=${t('year')}><${IntInput} value=${v.year} min=${2000} max=${2100} disabled=${disabled} onChange=${(y) => onChange({ ...v, year: y })} /><//>
        </div>`}
      </div>`;
    }
    case 'exports_c': {
      const v = value || {};
      return html`<div>
        <label class="check-line"><input type="checkbox" checked=${!!v.none} disabled=${disabled} onChange=${(e) => onChange(e.target.checked ? { none: true } : {})} /> ${t('no_exports')}</label>
        ${!v.none && html`<div class="row-fields">
          <${Mini} label=${t('amount_usd')}><${UsdInput} value=${v.amount_usd} i18n=${i18n} disabled=${disabled} onChange=${(n) => onChange({ ...v, amount_usd: n })} /><//>
          <${Mini} label=${t('year')}><${IntInput} value=${v.year} min=${2000} max=${2100} disabled=${disabled} onChange=${(y) => onChange({ ...v, year: y })} /><//>
        </div>`}
      </div>`;
    }
    case 'exports_pct': {
      const v = value || {};
      return html`<div class="row-fields wrap">
        <${Mini} label=${t('pct_revenue')}><${IntInput} value=${v.pct} min=${0} max=${100} disabled=${disabled} onChange=${(n) => onChange({ ...v, pct: n })} /><//>
        <${Mini} label=${t('destinations')} grow=${true}><${Multi} list="markets" options=${LIST_OPTIONS.markets} value=${v.destinations} i18n=${i18n} disabled=${disabled} onChange=${(d) => onChange({ ...v, destinations: d })} /><//>
      </div>`;
    }
    case 'clients': {
      const v = value || {};
      return html`<div class="row-fields wrap">
        <${Mini} label=${t('client_count')}><${IntInput} value=${v.count} min=${0} disabled=${disabled} onChange=${(n) => onChange({ ...v, count: n })} /><//>
        <${Mini} label=${i18n.t('fields.clients.label')} grow=${true}><${Multi} list="client_profiles" options=${LIST_OPTIONS.client_profiles} value=${v.profiles} i18n=${i18n} disabled=${disabled} onChange=${(p) => onChange({ ...v, profiles: p })} /><//>
      </div>`;
    }
    case 'market_share': {
      const v = value || {};
      return html`<div class="row-fields">
        <${Mini} label=${t('pct')}><${IntInput} value=${v.pct} min=${0} max=${100} disabled=${disabled} onChange=${(n) => onChange({ ...v, pct: n })} /><//>
        <${Mini} label=${t('segment')} grow=${true}><${TextMini} value=${v.segment} disabled=${disabled} onChange=${(s) => onChange({ ...v, segment: s })} /><//>
      </div>`;
    }
    case 'portfolio':
    case 'interests': {
      const a = field.type === 'portfolio' ? 'category' : 'area';
      return html`<${Rows} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ [a]: { pt: '', en: '' }, description: { pt: '', en: '' } })}
        render=${(it, set) => html`<${Mini} label=${t(a)}><${TextMini} value=${it[a]} disabled=${disabled} onChange=${(x) => set({ ...it, [a]: x })} /><//>
          <${Mini} label=${t('description')} grow=${true}><${TextMini} value=${it.description} max=${200} disabled=${disabled} onChange=${(x) => set({ ...it, description: x })} /><//>`} />`;
    }
    case 'text_list': return html`<${Rows} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ pt: '', en: '' })}
      render=${(it, set) => html`<${Mini} label=${t('name')} grow=${true}><${TextMini} value=${it} disabled=${disabled} onChange=${set} /><//>`} />`;
    case 'plain_list': return html`<${Rows} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ''}
      render=${(it, set) => html`<${Mini} label=${t('name')} grow=${true}><input class="input input-sm" value=${it} disabled=${disabled} onInput=${(e) => set(e.target.value)} /><//>`} />`;
    case 'leaders': return html`<${Rows} items=${value} max=${4} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ name: '', role: { pt: '', en: '' }, experience: { pt: '', en: '' } })}
      render=${(it, set) => html`<${Mini} label=${t('name') + ' *'}><input class="input input-sm" value=${it.name} disabled=${disabled} onInput=${(e) => set({ ...it, name: e.target.value })} /><//>
        <${Mini} label=${t('role') + ' *'}><${TextMini} value=${it.role} disabled=${disabled} onChange=${(x) => set({ ...it, role: x })} /><//>
        <${Mini} label=${t('experience')} grow=${true}><${TextMini} value=${it.experience} max=${150} disabled=${disabled} onChange=${(x) => set({ ...it, experience: x })} /><//>`} />`;
    default: return html`<em>${field.type}</em>`;
  }
}

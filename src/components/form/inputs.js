// Input widgets of the company form, one per field type of src/lib/formSchema.js.
// Every widget receives {field, value, onChange, i18n, disabled} and calls onChange(newValue).
import { createContext, cx, html, useContext, useEffect, useRef, useState } from '../../lib/html.js';
import { formatUSD } from '../../lib/format.js';
import { MILESTONE_STATES, PIPELINE_PHASES, UFS } from '../../lib/formSchema.js?v=202611-profile-modals1';
import { BRAZIL_CITIES } from '../../lib/brazilCities.js';
import { fieldProblems } from '../../lib/profileValidation.js?v=202611-profile-modals1';
import { uploadImage } from '../../services/api.js';
import { EditorDialog } from './EditorDialog.js?v=202611-profile-modals1';
import { useI18n } from '../../lib/i18n.js';

export const ProfileEditorFields = createContext(null);

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

/** Both language versions are edited together and kept in the same draft. */
export function TextInput({ field, value, onChange, disabled, id, label, multiline:forceMultiline, placeholder }) {
  const { t, lang } = useI18n();
  const editor = useContext(ProfileEditorFields);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const activeLanguage = selectedLanguage || lang;
  const v = value && typeof value === 'object' ? value : { pt: value || '', en: '' };
  const multiline = forceMultiline ?? (!field.max || field.max > 100);
  const chooseLanguage = (language) => setSelectedLanguage(language);
  return html`<div class=${cx('editor-language-field', editor && 'editor-language-field-themed')}
    onFocus=${(event) => { if (event.target.dataset.language) chooseLanguage(event.target.dataset.language); }}>
    ${editor && !editor.sideBySide && html`<div class="editor-language-tabs" role="group" aria-label=${t('form.editor_text_language')}>
      ${['pt','en'].map((language) => html`<button type="button" key=${language} aria-pressed=${activeLanguage === language}
        onClick=${() => chooseLanguage(language)}><span class=${cx('editor-language-dot', v[language]?.trim() && 'filled')} aria-hidden="true"></span>${language.toUpperCase()}</button>`)}
      <${Counter} n=${(v[activeLanguage] || '').length} max=${field.max} />
    </div>`}
    <div class=${cx('bilingual-input', editor && !editor.sideBySide && 'one-language')}>${['pt', 'en'].map((language) => {
    const text = v[language] || '';
    const props = { id: language === 'pt' ? id : id && id + '-en', class: 'input input-sm', value: text, disabled,
      'aria-label': (label || t('fields.'+field.key+'.label'))+' ('+language.toUpperCase()+')',
      placeholder: placeholder ? t('form.editor_placeholder_'+language) : undefined,
      'data-language': language,
      maxLength: field.hardLimit ? field.max : field.max ? field.max + 50 : undefined, onInput: (e) => onChange({ ...v, [language]: e.target.value }) };
    return html`<div class="text-wrap" key=${language} hidden=${!!editor && !editor.sideBySide && activeLanguage !== language}><span class="language-label">${language.toUpperCase()}</span>
      ${multiline ? html`<textarea rows=${Math.min(6, Math.max(2, Math.ceil((field.max || 200) / 120)))} ...${props}></textarea>` : html`<input ...${props} />`}
      <${Counter} n=${text.length} max=${field.max} /></div>`;
  })}</div></div>`;
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
function Rows({ items, field, onChange, disabled, i18n, max, blank, render }) {
  const editor = useContext(ProfileEditorFields);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const t = i18n.t;
  const list = items || [];
  const set = (i, item) => onChange(list.map((x, j) => (j === i ? item : x)));
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  const canAdd = !disabled && (!max || list.length < max);
  if (editor) {
    const label = t('fields.'+field.key+'.label');
    const namedDialog = ['pipeline','milestones','rounds','raised','leaders'].includes(field.type);
    const open = (index, removing = false) => {
      setError(null);
      setEditing({ index, value:index === list.length ? blank() : list[index], removing });
    };
    const confirm = () => {
      if (editing.removing) remove(editing.index);
      else {
        const item = editing.value;
        const entry = field.type === 'raised' ? {items:[item]} : [item];
        const problems = fieldProblems({ ...field, req:false }, entry);
        if (problems.length || (['text_list','plain_list'].includes(field.type) && !i18n.tx(item).trim())) {
          setError(problems[0] ? t('form.errors.'+problems[0].code, problems[0]) : t('form.errors.required'));
          return;
        }
        if (editing.index === list.length) onChange(list.concat([item]));
        else set(editing.index, item);
      }
      setEditing(null);
    };
    return html`<div class="profile-editor-list">
      ${!list.length && html`<p class="form-help">${t('form.editor_no_items')}</p>`}
      ${list.map((item,i) => {
        const title = typeof item === 'string' ? item : item.name || i18n.tx(item.category || item.area || item.description || item.indication || item);
        const detail = item.amount_usd == null ? i18n.tx(item.role) : formatUSD(item.amount_usd,i18n.lang);
        const fallback = item.stage ? i18n.label('round_stage',item.stage) : item.source ? i18n.label('raised_source',item.source) : t('form.editor_item',{n:i+1});
        const phase = item.phase && i18n.label('pipeline_phase',item.phase);
        return html`<div class="profile-editor-list-row" key=${i}>
          <div><strong>${title || fallback}</strong>${(phase || detail) && html`<small>${[phase,detail].filter(Boolean).join(' · ')}</small>`}</div>
          ${!disabled && html`<div class="profile-editor-item-actions">
            <button type="button" class="btn btn-outline" onClick=${() => open(i)}>${t('form.editor_edit')}</button>
            <button type="button" class="btn-link" onClick=${() => open(i,true)}>${t('form.remove')}</button>
          </div>`}
        </div>`;
      })}
      ${canAdd && html`<button type="button" class="btn btn-outline profile-editor-add" onClick=${() => open(list.length)}>${t('form.add')}</button>`}
      ${editing && html`<${EditorDialog}
        title=${editing.removing ? t('form.editor_remove_item') : namedDialog ? t('form.editor_'+(editing.index === list.length ? 'add_' : 'edit_')+field.type) : label}
        description=${editing.removing ? t('form.editor_remove_prompt') : t('fields.'+field.key+'.help')}
        action=${editing.removing ? t('form.remove') : t(editing.index === list.length ? 'form.editor_add_item' : 'form.editor_save_item')}
        compact=${editing.removing} danger=${editing.removing}
        onConfirm=${confirm} onClose=${() => setEditing(null)}>
        ${!editing.removing && html`<div class="row-fields">${render(editing.value, (value) => { setError(null); setEditing({...editing,value}); })}</div>`}
        ${error && html`<div class="field-error" role="alert">${error}</div>`}
      <//>`}
    </div>`;
  }
  return html`<div class="rows">
    ${list.map((item, i) => html`<div class="row-item" key=${i}>
      <div class="row-fields">${render(item, (next) => set(i, next), i)}</div>
      ${!disabled && html`<button type="button" class="btn-link row-remove" onClick=${() => remove(i)}>${i18n.t('form.remove')}</button>`}
    </div>`)}
    ${canAdd && html`<button type="button" class="btn btn-outline add-row" onClick=${() => onChange(list.concat([blank()]))}>${i18n.t('form.add')}</button>`}
  </div>`;
}

function Mini({ label, children, grow, group }) {
  const tag = group ? 'div' : 'label';
  return html`<${tag} class=${cx('mini', grow && 'grow')}><span>${label}</span>${children}<//>`;
}

function TextMini({ value, onChange, max, disabled, label, multiline }) {
  const { t } = useI18n();
  return html`<${TextInput} field=${{max,hardLimit:true}} value=${value} onChange=${onChange} disabled=${disabled}
    label=${label || t('form.description')} multiline=${!!multiline} placeholder=${true} />`;
}

// Image sizes shown in the form are recommendations; the API validates and optimizes uploads.
const IMAGE_RULES = {
  logo: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] },
  cover: { types: ['image/jpeg', 'image/png', 'image/webp'] },
  product: { types: ['image/jpeg', 'image/png', 'image/webp'] },
  gallery: { types: ['image/jpeg', 'image/png', 'image/webp'] },
};
async function readImage(file, { types }, kind) {
  if (!file) throw new Error('none');
  const ext = file.name.split('.').pop()?.toLowerCase();
  const acceptedExt = kind === 'logo' ? ['jpg','jpeg','png','webp','svg'] : ['jpg','jpeg','png','webp'];
  if (!types.includes(file.type) && !(['','application/octet-stream'].includes(file.type) && acceptedExt.includes(ext))) throw new Error('image_type');
  if (!file.size) throw new Error('image_type');
  if (file.size > 20 * 1024 * 1024) throw new Error('image_too_big');
  return uploadImage(file, kind);
}

function ImagePreview({ url, i18n }) {
  const [size, setSize] = useState(null);
  const [failed, setFailed] = useState(false);
  return html`<div class="image-preview-card">
    <a class="image-preview" href=${url} target="_blank" rel="noopener noreferrer" aria-label=${i18n.t('form.open_image')}>
      <img src=${url} alt="" onLoad=${({currentTarget:img}) => setSize(`${img.naturalWidth} × ${img.naturalHeight} px`)} onError=${() => setFailed(true)} />
    </a>
    ${size && html`<small>${size}</small>`}
    ${failed && html`<small class="field-error">${i18n.t('form.image_preview_failed')}</small>`}
  </div>`;
}

function ImagePicker({ types, busy, label, onFile, dropZone = false }) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);
  return html`<label class=${cx('btn btn-outline image-picker', busy && 'uploading', dropZone && 'editor-drop-zone', dragging && 'dragging')}
    onDragOver=${(event) => { event.preventDefault(); if (!busy && dropZone) setDragging(true); }}
    onDragLeave=${() => setDragging(false)}
    onDrop=${(event) => { event.preventDefault(); setDragging(false); if (!busy && dropZone) onFile(event.dataTransfer.files[0]); }}>
    <input type="file" class="image-file-input" aria-label=${label} disabled=${busy} accept=${types.join(',')}
      onChange=${(event) => { onFile(event.currentTarget.files[0]); event.currentTarget.value = ''; }} />
    <span>${label}</span>${dropZone && !busy && html`<small>${t('form.editor_drop_image')}</small>`}
  </label>`;
}

function ImageInput({ field, value, onChange, i18n, disabled }) {
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const rules = IMAGE_RULES[field.kind];
  const pick = async (file) => {
    if (!file) return;
    setBusy(true); setErr(null);
    try { onChange(await readImage(file, rules, field.kind)); } catch (x) { setErr(x.message === 'invalid_svg' ? 'image_type' : ['image_type','image_too_big'].includes(x.message) ? x.message : 'image_upload_failed'); }
    finally { setBusy(false); }
  };
  return html`<div class=${cx('image-input', field.kind)}>
    ${value && html`<${ImagePreview} key=${value} url=${value} i18n=${i18n} />`}
    ${!disabled && html`<${ImagePicker} types=${rules.types} busy=${busy} onFile=${pick} dropZone=${true} label=${busy ? i18n.t('form.uploading') : value ? i18n.t('form.replace') : i18n.t('form.upload')} />`}
    ${value && !disabled && !field.req && html`<button type="button" class="btn-link" disabled=${busy} onClick=${() => onChange(null)}>${i18n.t('form.remove')}</button>`}
    ${err && err !== 'none' && html`<span class="field-error">${i18n.t('form.' + err)}</span>`}
  </div>`;
}

function GalleryPhotoDialog({ item, adding, i18n, onClose, onSave }) {
  const t = i18n.t;
  const [caption, setCaption] = useState(item.caption);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const save = async () => {
    if (!file && !item.url) { setErr('editor_gallery_needs_image'); return; }
    if (!(typeof caption === 'string' ? caption : caption?.pt)?.trim()) { setErr('editor_gallery_needs_caption'); return; }
    setBusy(true); setErr(null);
    try {
      const url = file ? await readImage(file, IMAGE_RULES.gallery, 'gallery') : item.url;
      onSave({ ...item,url,caption });
    } catch (x) {
      setErr(['image_type','image_too_big'].includes(x.message) ? x.message : 'image_upload_failed');
      setBusy(false);
    }
  };
  return html`<${EditorDialog} title=${t(adding ? 'form.editor_add_gallery' : 'form.editor_edit_gallery')} description=${t('fields.gallery.help')}
    action=${t(busy ? 'form.uploading' : adding ? 'form.editor_add_item' : 'form.editor_save_item')} onConfirm=${save} onClose=${onClose} busy=${busy}>
    <div class="row-fields">
      <div class="image-input gallery">
        ${(preview || item.url) && html`<${ImagePreview} key=${preview || item.url} url=${preview || item.url} i18n=${i18n} />`}
        <${ImagePicker} types=${IMAGE_RULES.gallery.types} busy=${busy} dropZone=${true} label=${t(preview || item.url ? 'form.replace' : 'form.upload')}
          onFile=${(selected) => { if (selected) { setFile(selected); setErr(null); } }} />
      </div>
      <${Mini} label=${t('form.caption')+' *'} group=${true}><${TextMini} label=${t('form.caption')} value=${caption} max=${120}
        disabled=${busy} onChange=${(value) => { setCaption(value); setErr(null); }} /><//>
    </div>
    ${err && html`<div class="field-error" role="alert">${t('form.'+err)}</div>`}
  <//>`;
}

function GalleryInput({ value, onChange, i18n, disabled }) {
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const t = i18n.t;
  const list = value || [];
  return html`<div class="profile-editor-list gallery-input">
    ${list.map((g, i) => html`<div class="row-item" key=${i}>
      <${ImagePreview} key=${g.url} url=${g.url} i18n=${i18n} />
      <div class="row-fields"><strong>${i18n.tx(g.caption) || t('form.editor_gallery_needs_caption')}</strong></div>
      ${!disabled && html`<div class="gallery-image-actions">
        <button type="button" class="btn btn-outline" onClick=${() => setEditing(i)}>${t('form.editor_edit')}</button>
        <button type="button" class="btn-link" onClick=${() => setRemoving(i)}>${t('form.remove')}</button>
      </div>`}
    </div>`)}
    ${!disabled && list.length < 6 && html`<button type="button" class="btn btn-outline profile-editor-add" onClick=${() => setEditing(list.length)}>+ ${t('form.editor_add_gallery')}</button>`}
    ${editing !== null && html`<${GalleryPhotoDialog} item=${list[editing] || {url:'',caption:{pt:'',en:''}}}
      adding=${editing === list.length} i18n=${i18n} onClose=${() => setEditing(null)} onSave=${(item) => {
        onChange(editing === list.length ? list.concat([item]) : list.map((g,i) => i === editing ? item : g));
        setEditing(null);
      }} />`}
    ${removing !== null && html`<${EditorDialog} compact=${true} danger=${true} title=${t('form.editor_remove_item')} description=${t('form.editor_remove_prompt')}
      action=${t('form.remove')} onClose=${() => setRemoving(null)} onConfirm=${() => { onChange(list.filter((_,i) => i !== removing)); setRemoving(null); }} />`}
  </div>`;
}

function RevenueInput({ field, value, onChange, i18n, disabled }) {
  const t = i18n.t;
  const v = value || {};
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(false);
  const hasRevenue = v.amount_usd != null || Boolean(v.year);
  const save = () => {
    const problem = fieldProblems(field, draft)[0];
    if (!draft.year && draft.amount_usd == null) { setError(t('form.errors.revenue_amount_required')); return; }
    if (problem) { setError(t('form.errors.'+problem.code,problem)); return; }
    onChange(draft); setDraft(null);
  };
  return html`<div>
    ${field.allowPre && html`<label class="check-line"><input type="checkbox" checked=${!!v.pre_revenue} disabled=${disabled} onChange=${(e) => onChange(e.target.checked ? { pre_revenue:true } : {})} /> ${t('form.pre_revenue')}</label>`}
    ${!v.pre_revenue && html`
      ${hasRevenue ? html`<div class="profile-editor-list-row"><div><strong>${v.amount_usd != null ? formatUSD(v.amount_usd,i18n.lang) : '—'}</strong>${v.year && html`<small>${v.year}</small>`}</div>
        ${!disabled && html`<div class="profile-editor-item-actions">
          <button type="button" class="btn btn-outline" onClick=${() => {setError(null);setDraft({...v});}}>${t('form.editor_edit')}</button>
          <button type="button" class="btn-link" onClick=${() => setRemoving(true)}>${t('form.remove')}</button>
        </div>`}</div>`
      : html`<p class="form-help">${t(field.allowPre ? 'form.revenue_pending_pre' : 'form.revenue_pending')}</p>
        ${!disabled && html`<button type="button" class="btn btn-outline profile-editor-add" onClick=${() => {setError(null);setDraft({});}}>+ ${t('form.editor_add_revenue')}</button>`}`}
    `}
    ${draft && html`<${EditorDialog} title=${t(hasRevenue ? 'form.editor_edit_revenue' : 'form.editor_add_revenue')} description=${t('fields.revenue.help')}
      action=${t(hasRevenue ? 'form.editor_save_item' : 'form.editor_add_item')} onConfirm=${save} onClose=${() => setDraft(null)}>
      <div class="row-fields">
        <${Mini} label=${t('form.year')+' *'}><${IntInput} value=${draft.year} min=${2000} max=${2100} onChange=${(year) => {setError(null);setDraft({...draft,year});}} /><//>
        <${Mini} label=${t('form.amount_usd')+' *'}><${UsdInput} value=${draft.amount_usd} i18n=${i18n} onChange=${(amount_usd) => {setError(null);setDraft({...draft,amount_usd});}} /><//>
      </div>
      ${error && html`<div class="field-error" role="alert">${error}</div>`}
    <//>`}
    ${removing && html`<${EditorDialog} compact=${true} danger=${true} title=${t('form.editor_remove_item')} description=${t('form.editor_remove_prompt')}
      action=${t('form.remove')} onClose=${() => setRemoving(false)} onConfirm=${() => {onChange({});setRemoving(false);}} />`}
  </div>`;
}

function FocalInput({ field, value, onChange, i18n, disabled, id, showErrors }) {
  const v = value || {};
  const [touched,setTouched] = useState({});
  const problems = fieldProblems(field,v);
  return html`<div class="row-fields wrap focal-fields">${['name','role','email','phone'].map((part)=>{
    const error = (showErrors || touched[part]) && problems.find((p)=>p.part===part);
    return html`<label class=${cx('mini','grow','focal-field',error && 'focal-invalid')}>
      <span>${i18n.t('form.'+part)}${field.req && html`<span class="req"> *</span>`}</span>
      <input id=${id+'-'+part} class="input input-sm" type=${part==='email' ? 'email' : part==='phone' ? 'tel' : 'text'}
        required=${!!field.req} aria-required=${!!field.req} aria-invalid=${!!error} aria-describedby=${error ? id+'-'+part+'-error' : undefined}
        placeholder=${part==='phone' ? '+55 11 91234-5678' : undefined} value=${v[part] || ''} disabled=${disabled}
        onBlur=${()=>setTouched((current)=>({...current,[part]:true}))} onInput=${(e)=>onChange({...v,[part]:e.target.value})} />
      ${error && html`<small class="field-error" id=${id+'-'+part+'-error'} role="status">${i18n.t('form.errors.'+error.code,error)}</small>`}
    </label>`;
  })}</div>`;
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
      const cities = BRAZIL_CITIES[v.state] || [];
      const options = v.city && !cities.includes(v.city) ? [v.city, ...cities] : cities;
      return html`<div class="row-fields">
        <${Mini} label=${t('state')}><${Select} options=${UFS} value=${v.state} onChange=${(s) => onChange({ ...v, state: s, city: s === v.state ? v.city : '' })} i18n=${i18n} disabled=${disabled} /><//>
        <${Mini} label=${t('city')} grow=${true}><select id=${id} class="input input-sm" value=${v.city || ''} disabled=${disabled || !v.state} onChange=${(e) => onChange({ ...v, city:e.target.value })}>
          <option value="">${v.state ? t('choose') : (i18n.lang === 'pt' ? 'Selecione o estado primeiro' : 'Select a state first')}</option>
          ${options.map((city)=>html`<option key=${city} value=${city}>${city}</option>`)}
        </select><//>
      </div>`;
    }
    case 'focal': return html`<${FocalInput} ...${props} />`;
    case 'usd_range': {
      const v = value || {};
      return html`<div class="row-fields">
        <${Mini} label=${t('min_usd')}><${UsdInput} value=${v.min} i18n=${i18n} disabled=${disabled} onChange=${(n) => onChange({ ...v, min: n })} /><//>
        <${Mini} label=${t('max_usd')}><${UsdInput} value=${v.max} i18n=${i18n} disabled=${disabled} onChange=${(n) => onChange({ ...v, max: n })} /><//>
      </div>`;
    }
    case 'pipeline': return html`<${Rows} field=${field} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ name: '', phase:null, indication: { pt: '', en: '' } })}
      render=${(it, set) => html`<${Mini} label=${t('editor_name_code')+' *'}>
          <input class="input input-sm" value=${it.name} maxLength="60" placeholder=${t('editor_code_example')} disabled=${disabled} onInput=${(e) => set({ ...it, name: e.target.value })} /><//>
        <${Mini} label=${t('editor_phase')+(Object.hasOwn(it,'phase')?' *':'')}>
          <${Select} list="pipeline_phase" options=${PIPELINE_PHASES} value=${it.phase} i18n=${i18n} disabled=${disabled} onChange=${(phase) => set({ ...it, phase })} /><//>
        <${Mini} label=${t('indication')+' *'} group=${true} grow=${true}><${TextMini} label=${t('indication')} value=${it.indication}
          multiline=${true} max=${100} disabled=${disabled} onChange=${(x) => set({ ...it, indication: x })} /><//>`} />`;
    case 'milestones': return html`<${Rows} field=${field} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ period: {}, status:null, description: { pt: '', en: '' } })}
      render=${(it, set) => html`<${Mini} label=${t('period')+' *'} group=${true}><${PeriodInput} value=${it.period} i18n=${i18n} disabled=${disabled} onChange=${(p) => set({ ...it, period: p })} /><//>
        <${Mini} label=${t('status')+(Object.hasOwn(it,'status')?' *':'')}><${Select} list="milestone_state" options=${MILESTONE_STATES} value=${it.status} i18n=${i18n} disabled=${disabled} onChange=${(status) => set({ ...it, status })} /><//>
        <${Mini} label=${t('description')+' *'} group=${true} grow=${true}><${TextMini} value=${it.description} max=${150} multiline=${true} disabled=${disabled} onChange=${(x) => set({ ...it, description: x })} /><//>`} />`;
    case 'rounds': return html`<${Rows} field=${field} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ stage: '', period: {}, amount_usd: null, purpose: { pt: '', en: '' } })}
      render=${(it, set) => html`<${Mini} label=${t('stage')}><${Select} list="round_stage" options=${LIST_OPTIONS.round_stage} value=${it.stage} i18n=${i18n} disabled=${disabled} onChange=${(s) => set({ ...it, stage: s })} /><//>
        <${Mini} label=${t('period')} group=${true}><${PeriodInput} value=${it.period} i18n=${i18n} disabled=${disabled} onChange=${(p) => set({ ...it, period: p })} /><//>
        <${Mini} label=${t('amount_usd')}><${UsdInput} value=${it.amount_usd} i18n=${i18n} disabled=${disabled} onChange=${(n) => set({ ...it, amount_usd: n })} /><//>
        <${Mini} label=${t('purpose')} group=${true} grow=${true}><${TextMini} label=${t('purpose')} value=${it.purpose} max=${100} multiline=${true} disabled=${disabled} onChange=${(x) => set({ ...it, purpose: x })} /><//>`} />`;
    case 'raised': {
      const v = value || { items: [], none: false };
      const total = v.items.reduce((s, r) => s + (r.amount_usd || 0), 0);
      return html`<div>
        <label class="check-line"><input type="checkbox" checked=${v.none} disabled=${disabled} onChange=${(e) => onChange({ items: e.target.checked ? [] : v.items, none: e.target.checked })} /> ${t('none_raised')}</label>
        ${!v.none && html`<${Rows} field=${field} items=${v.items} onChange=${(items) => onChange({ ...v, items })} disabled=${disabled} i18n=${i18n} blank=${() => ({ source: '', amount_usd: null })}
          render=${(it, set) => html`<${Mini} label=${t('source')+' *'}><${Select} list="raised_source" options=${LIST_OPTIONS.raised_source} value=${it.source} i18n=${i18n} disabled=${disabled} onChange=${(s) => set({ ...it, source: s })} /><//>
            <${Mini} label=${t('editor_investor_name')}><input class="input input-sm" maxLength="80" value=${it.note || ''} disabled=${disabled} onInput=${(e) => set({ ...it, note:e.target.value })} /><//>
            <${Mini} label=${t('year')}><${IntInput} value=${it.year} min=${1900} max=${2100} disabled=${disabled} onChange=${(year) => set({ ...it, year })} /><//>
            <${Mini} label=${t('amount_usd')}><${UsdInput} value=${it.amount_usd} i18n=${i18n} disabled=${disabled} onChange=${(n) => set({ ...it, amount_usd: n })} /><//>`} />
          <div class="total-line">${t('total')}: <strong>${formatUSD(total, i18n.lang)}</strong></div>`}
      </div>`;
    }
    case 'revenue': {
      return html`<${RevenueInput} ...${props} />`;
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
      return html`<${Rows} field=${field} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ [a]: { pt: '', en: '' }, description: { pt: '', en: '' } })}
        render=${(it, set) => html`<${Mini} label=${t(a)}><${TextMini} value=${it[a]} disabled=${disabled} onChange=${(x) => set({ ...it, [a]: x })} /><//>
          <${Mini} label=${t('description')} grow=${true}><${TextMini} value=${it.description} max=${200} disabled=${disabled} onChange=${(x) => set({ ...it, description: x })} /><//>`} />`;
    }
    case 'text_list': return html`<${Rows} field=${field} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ pt: '', en: '' })}
      render=${(it, set) => html`<${Mini} label=${t('name')} grow=${true}><${TextMini} value=${it} disabled=${disabled} onChange=${set} /><//>`} />`;
    case 'plain_list': return html`<${Rows} field=${field} items=${value} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ''}
      render=${(it, set) => html`<${Mini} label=${t('name')} grow=${true}><input class="input input-sm" value=${it} disabled=${disabled} onInput=${(e) => set(e.target.value)} /><//>`} />`;
    case 'leaders': return html`<${Rows} field=${field} items=${value} max=${4} onChange=${onChange} disabled=${disabled} i18n=${i18n} blank=${() => ({ name: '', role: { pt: '', en: '' }, experience: { pt: '', en: '' } })}
      render=${(it, set) => html`<${Mini} label=${t('name') + ' *'}><input class="input input-sm" maxLength="80" value=${it.name} disabled=${disabled} onInput=${(e) => set({ ...it, name: e.target.value })} /><//>
        <${Mini} label=${t('role') + ' *'} group=${true}><${TextMini} label=${t('role')} value=${it.role} max=${60} disabled=${disabled} onChange=${(x) => set({ ...it, role: x })} /><//>
        <${Mini} label=${t('experience')} group=${true} grow=${true}><${TextMini} label=${t('experience')} value=${it.experience} max=${150} disabled=${disabled} onChange=${(x) => set({ ...it, experience: x })} /><//>`} />`;
    default: return html`<em>${field.type}</em>`;
  }
}

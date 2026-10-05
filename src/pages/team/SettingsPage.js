// Team panel · settings (spec 1, section 8 and spec 2, section 9): editable deadlines and the yearly
// Lead/NIA/NPIA goals. Only the values are saved here; the automation is done by the server later.
import { cx, html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js';
import { useI18n } from '../../lib/i18n.js';

const DEADLINES = [
  ['provisional_profile_days', 'days'],
  ['provisional_warning_days', 'days_list'],
  ['validation_reminder_days', 'days_list'],
  ['validation_reminder_repeat_days', 'days'],
  ['quarterly_update_reminder_days', 'days'],
  ['outdated_profile_alert_days', 'days'],
  ['contact_warning_business_days', 'business'],
  ['contact_overdue_business_days', 'business'],
];

const toList = (s) => String(s).split(/[,;\s]+/).filter(Boolean).map(Number);

export function SettingsPage() {
  const { t } = useI18n();
  const [s, setS] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);
  const [saved, setSaved] = useState(false);
  const [newYear, setNewYear] = useState('');

  useEffect(() => {
    api.getSettings().then((x) => {
      setS(x);
      setForm({
        launch_date: x.launch_date,
        deadlines: Object.fromEntries(DEADLINES.map(([k]) => [k, Array.isArray(x.deadlines[k]) ? x.deadlines[k].join(', ') : String(x.deadlines[k])])),
        goals: JSON.parse(JSON.stringify(x.goals)),
        origins: x.origins.join('\n'),
        apex: x.apex_strategic_categories.join('\n'),
      });
    });
  }, []);
  if (!s || !form) return html`<div>${t('common.loading')}</div>`;

  const save = async () => {
    const deadlines = Object.fromEntries(DEADLINES.map(([k, kind]) => [k, kind === 'days_list' ? toList(form.deadlines[k]) : Number(form.deadlines[k])]));
    const res = await api.updateSettings({
      launch_date: form.launch_date, deadlines, goals: form.goals,
      origins: form.origins.split('\n').map((x) => x.trim()).filter(Boolean),
      apex_strategic_categories: form.apex.split('\n').map((x) => x.trim()).filter(Boolean),
    });
    setErrors(res.ok ? [] : res.fields);
    setSaved(res.ok);
    if (res.ok) setTimeout(() => setSaved(false), 2500);
  };
  const setGoal = (y, k, v) => setForm({ ...form, goals: { ...form.goals, [y]: { ...form.goals[y], [k]: v === '' ? '' : Number(v) } } });
  const addYear = () => {
    if (!/^\d{4}$/.test(newYear) || form.goals[newYear]) return;
    setForm({ ...form, goals: { ...form.goals, [newYear]: { lead: 0, nia: 0, npia: 0 } } });
    setNewYear('');
  };

  return html`<div class="crm-page settings">
    <div class="crm-sticky">
      <div><h1 class="page-title">${t('settings.title')}</h1><div class="page-subtitle">${t('settings.subtitle')}</div></div>
      <div class="review-actions">${saved && html`<span class="section-note">✓ ${t('settings.saved')}</span>`}
        <button type="button" class="btn btn-lime btn-lg" onClick=${save}>${t('settings.save')}</button></div>
    </div>
    ${errors.length > 0 && html`<div class="notice warn">${t('settings.invalid')}</div>`}

    <section class="form-card crm-block">
      <h2 class="block-title">${t('settings.profiles')}</h2>
      <div class="crm-grid">
        <label class="crm-field"><span class="field-label">${t('settings.launch_date')}</span>
          <input class="input input-sm" type="date" value=${form.launch_date} onInput=${(e) => setForm({ ...form, launch_date: e.target.value })} /></label>
        ${DEADLINES.slice(0, 6).map(([k, kind]) => html`<label key=${k} class=${cx('crm-field', errors.includes('deadlines.' + k) && 'has-error')}>
          <span class="field-label">${t('settings.' + k)}</span>
          <span class="with-unit"><input class="input input-sm" inputmode="numeric" value=${form.deadlines[k]} onInput=${(e) => setForm({ ...form, deadlines: { ...form.deadlines, [k]: e.target.value } })} />
            <span>${t('settings.unit_' + kind)}</span></span>
          <span class="form-help">${t('settings.' + k + '_help')}</span></label>`)}
      </div>
    </section>

    <section class="form-card crm-block">
      <h2 class="block-title">${t('settings.contacts')}</h2>
      <div class="crm-grid">
        ${DEADLINES.slice(6).map(([k, kind]) => html`<label key=${k} class=${cx('crm-field', errors.includes('deadlines.' + k) && 'has-error')}>
          <span class="field-label">${t('settings.' + k)}</span>
          <span class="with-unit"><input class="input input-sm" inputmode="numeric" value=${form.deadlines[k]} onInput=${(e) => setForm({ ...form, deadlines: { ...form.deadlines, [k]: e.target.value } })} />
            <span>${t('settings.unit_' + kind)}</span></span>
          <span class="form-help">${t('settings.' + k + '_help')}</span></label>`)}
      </div>
    </section>

    <section class="form-card crm-block">
      <h2 class="block-title">${t('settings.goals')}</h2>
      <p class="form-help">${t('settings.goals_help')}</p>
      <div class="table-card" style=${{ boxShadow: 'none', border: '1px solid var(--line)' }}>
        <div class="trow thead" style=${{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}><div>${t('crmteam.year')}</div><div>Lead</div><div>NIA</div><div>NPIA</div></div>
        ${Object.keys(form.goals).sort().map((y) => html`<div class="trow" key=${y} style=${{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
          <div><strong>${y}</strong></div>
          ${['lead', 'nia', 'npia'].map((k) => html`<div key=${k}><input class=${cx('input input-sm short', errors.includes('goals.' + y + '.' + k) && 'invalid')} type="number" min="0" step="1"
            value=${form.goals[y][k]} onInput=${(e) => setGoal(y, k, e.target.value)} /></div>`)}
        </div>`)}
        <div class="trow" style=${{ gridTemplateColumns: '1fr 3fr' }}>
          <input class="input input-sm short" placeholder="2028" value=${newYear} onInput=${(e) => setNewYear(e.target.value)} />
          <div><button type="button" class="btn btn-outline" onClick=${addYear}>${t('settings.add_year')}</button></div>
        </div>
      </div>
    </section>

    <section class="form-card crm-block">
      <h2 class="block-title">${t('settings.lists')}</h2>
      <div class="crm-grid">
        <label class="crm-field"><span class="field-label">${t('settings.origins')}</span>
          <textarea class="input input-sm" rows="10" value=${form.origins} onInput=${(e) => setForm({ ...form, origins: e.target.value })}></textarea>
          <span class="form-help">${t('settings.one_per_line')}</span></label>
        <label class="crm-field"><span class="field-label">${t('settings.apex_categories')}</span>
          <textarea class="input input-sm" rows="10" value=${form.apex} onInput=${(e) => setForm({ ...form, apex: e.target.value })}></textarea>
          <span class="form-help">${t('settings.one_per_line')}</span></label>
      </div>
    </section>
  </div>`;
}

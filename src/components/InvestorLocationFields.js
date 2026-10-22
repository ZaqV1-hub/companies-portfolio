import { html } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';
import { countryOptions } from '../lib/countries.js';
import { stateOptions } from '../lib/subdivisions.js';

export function CountryControl({ value, onChange, onBlur, invalid = false, required = false }) {
  const { lang, t } = useI18n();
  return html`<span class="country-control">
    ${value && html`<img src=${`assets/flags/${value.toLowerCase()}.svg`} alt="" aria-hidden="true" onError=${(event) => { event.currentTarget.hidden = true; }} />`}
    <select class="input input-sm" aria-invalid=${invalid} required=${required} value=${value || ''} onChange=${onChange} onBlur=${onBlur}>
      <option value="">${t('form.choose')}</option>
      ${countryOptions(lang).map((country) => html`<option key=${country.code} value=${country.code}>${country.name}</option>`)}
    </select>
  </span>`;
}

export function StateControl({ country, value, onChange, onBlur, invalid = false, required = false }) {
  const { t } = useI18n();
  const options = stateOptions(country);
  if (!options) return html`<input class="input input-sm" aria-invalid=${invalid} required=${required} disabled=${!country}
    autocomplete="address-level1" placeholder=${country ? t('investor.state_placeholder') : t('investor.choose_country_first')}
    value=${value || ''} onInput=${onChange} onBlur=${onBlur} />`;
  return html`<select class="input input-sm" aria-invalid=${invalid} required=${required} value=${value || ''} onChange=${onChange} onBlur=${onBlur}>
    <option value="">${t('form.choose')}</option>
    ${options.map((state) => html`<option key=${state.code} value=${state.code}>${state.name}</option>`)}
  </select>`;
}

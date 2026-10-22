import { html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js?v=20261021-investor1';
import { useI18n } from '../../lib/i18n.js';
import { countryOptions } from '../../lib/countries.js';
import { formatDate } from '../../lib/format.js';
import { href } from '../../lib/router.js';

const investorTypes = ['accelerator','angel','angel_network','asset_wealth_management','cvc','dfi','endowment','family_office','foundation','fund_of_funds','hnwi','non_profit','organization','pe_firm','pension_fund','service_provider','vc'];

export function InvestorAccountPage({ onUserUpdated, onFavoritesChanged }) {
  const { t, lang, label } = useI18n();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api.getInvestorAccount().then((result) => {
      if (!active) return;
      setData(result);
      const parts = result.user.name.trim().split(/\s+/);
      setForm({ ...result.profile,first_name:result.profile.first_name || parts[0] || '',
        last_name:result.profile.last_name || parts.slice(1).join(' ') });
    }).catch(() => { if (active) setMessage(t('investor.account_load_error')); });
    return () => { active = false; };
  }, []);
  const update = (key) => (event) => setForm({ ...form, [key]:event.target.value });
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await api.updateInvestorAccount({ ...form, lang });
      setData({ ...data, user:result.user, profile:result.profile });
      onUserUpdated(result.user);
      setMessage(t('investor.account_saved'));
    } catch { setMessage(t('investor.try_again')); }
    finally { setBusy(false); }
  };
  const removeFavorite = async (id) => {
    try {
      await api.removeInvestorFavorite(id);
      setData((current) => ({ ...current, favorites:current.favorites.filter((item) => item.id !== id) }));
      onFavoritesChanged((current) => current.filter((item) => item !== id));
    } catch { setMessage(t('investor.try_again')); }
  };
  return html`<div class="investor-account section">
    <div class="section-head"><div><div class="kicker">${t('investor.kicker')}</div><h1 class="h2">${t('investor.account_title')}</h1><p class="page-subtitle">${t('investor.account_intro')}</p></div></div>
    ${message && html`<p class="investor-account-message" role="status">${message}</p>`}
    ${!data || !form ? !message && html`<p>${t('common.loading')}</p>` : html`
      <section class="investor-account-card"><h2>${t('investor.favorites_title')} (${data.favorites.length})</h2>
        ${data.favorites.length ? html`<div class="investor-account-list">${data.favorites.map((item) => html`<div class="investor-account-row" key=${item.id}>
          <a href=${href('/org/' + item.id)}><strong>${item.name}</strong><small>${t('investor.saved_on')} ${formatDate(item.created_at, lang)}</small></a>
          <button type="button" class="btn btn-outline" onClick=${() => removeFavorite(item.id)}>${t('investor.remove_favorite')}</button>
        </div>`)}</div>` : html`<p>${t('investor.no_favorites')}</p>`}
      </section>
      <section class="investor-account-card"><h2>${t('investor.contacts_title')} (${data.contacts.length})</h2>
        ${data.contacts.length ? html`<div class="investor-account-list">${data.contacts.map((item) => html`<div class="investor-account-row" key=${item.relationship_id}>
          <a href=${href('/org/' + item.organization_id)}><strong>${item.organization_name}</strong><small>${t('investor.requested_on')} ${formatDate(item.contact_request_at, lang)}</small></a>
          <div class="investor-account-progress"><span>${label('rel_status', item.status || 'in_progress')}</span><small>${t('investor.contact_stage')}: ${label('classification', item.classification || 'lead')}</small></div>
        </div>`)}</div>` : html`<p>${t('investor.no_contacts')}</p>`}
      </section>
      <section class="investor-account-card"><h2>${t('investor.account_details')}</h2><p>${data.user.email}</p>
        <form class="investor-account-form" onSubmit=${save}>
          <label>${t('investor.first_name')}<input class="input" required value=${form.first_name || ''} onInput=${update('first_name')} /></label>
          <label>${t('investor.last_name')}<input class="input" required value=${form.last_name || ''} onInput=${update('last_name')} /></label>
          <label>${t('investor.institution')}<input class="input" required value=${form.institution || ''} onInput=${update('institution')} /></label>
          <label>${t('investor.country')}<select class="input" required value=${form.country || ''} onChange=${update('country')}><option value="">${t('form.choose')}</option>${countryOptions(lang).map((country) => html`<option key=${country.code} value=${country.code}>${country.name}</option>`)}</select></label>
          <label>${t('investor.city')}<input class="input" required value=${form.city || ''} onInput=${update('city')} /></label>
          <label>${t('investor.role')}<input class="input" value=${form.role || ''} onInput=${update('role')} /></label>
          <label>${t('investor.investor_type')}<select class="input" value=${form.investor_type || ''} onChange=${update('investor_type')}><option value="">${t('form.choose')}</option>${investorTypes.map((type) => html`<option key=${type} value=${type}>${t('enum.investor_types.' + type)}</option>`)}</select></label>
          <label>${t('investor.phone')}<input class="input" type="tel" value=${form.phone || ''} onInput=${update('phone')} /></label>
          <label>LinkedIn<input class="input" type="url" value=${form.linkedin || ''} onInput=${update('linkedin')} /></label>
          <button class="btn btn-lime" type="submit" disabled=${busy}>${t('investor.save_account')}</button>
        </form>
      </section>`}
  </div>`;
}

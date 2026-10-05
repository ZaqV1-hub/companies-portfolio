// Public top bar (spec 1, 6.1 item 1): program brand, language selector, investor access, company access.
import { html } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';
import { href } from '../lib/router.js';
import { LangSwitch } from './LangSwitch.js';

export function TopBar({ investor, onInvestorAccess, onLogout }) {
  const { t } = useI18n();
  return html`
    <header class="topbar">
      <a class="topbar-brand" href=${href('/')}>
        <img src="assets/img/bph-logo.png" alt="Brazilian Pharma & Health" />
        <div class="topbar-divider"></div>
        <span class="topbar-tagline">${t('topbar.tagline')}</span>
      </a>
      <nav class="topbar-actions">
        <${LangSwitch} />
        <a class="btn btn-outline" href=${href('/company/login')}>${t('topbar.company_access')}</a>
        ${investor
          ? html`<span class="investor-chip">${investor.name}</span><button class="btn btn-outline" onClick=${onLogout}>${t('common.log_out')}</button>`
          : html`<button class="btn btn-lime" onClick=${onInvestorAccess}>${t('topbar.investor_access')}</button>`}
      </nav>
    </header>`;
}

// Public top bar (spec 1, 6.1 item 1): program brand, language selector, investor access, company access.
import { html } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';
import { href } from '../lib/router.js';
import { LangSwitch } from './LangSwitch.js?v=20261014-flags1';

export function TopBar({ investor, onInvestorAccess, onLogout }) {
  const { t } = useI18n();
  return html`
    <header class="topbar">
      <a class="topbar-brand" href=${href('/')}>
        <img class="topbar-partner-logos" src="assets/img/brand-logos.png" alt="Brazilian Pharma & Health, ApexBrasil e Abiquifi" />
      </a>
      <nav class="topbar-actions">
        <${LangSwitch} />
        ${investor
          ? html`<a class="investor-chip" href=${href('/investidor')}>${t('investor.hello', { name:investor.name.split(' ')[0] })}</a><button class="btn btn-outline" onClick=${onLogout}>${t('common.log_out')}</button>`
          : html`<button class="btn btn-lime" onClick=${onInvestorAccess}>${t('topbar.investor_access')}</button>`}
      </nav>
    </header>`;
}

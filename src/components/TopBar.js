// Public top bar (spec 1, 6.1 item 1): program brand, language selector, investor access, company access.
import { html } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';
import { href } from '../lib/router.js';
import { LangSwitch } from './LangSwitch.js?v=20261014-flags1';

export function TopBar({ investor, onInvestorAccess, onLogout }) {
  const { t, lang } = useI18n();
  return html`
    <header class="topbar">
      <a class="topbar-program" href=${href('/')} aria-label="Brazilian Pharma & Health">
        <img src="assets/img/bph-program.png" alt="BP&H Brazilian Pharma & Health" />
      </a>
      <div class="topbar-partners" aria-label="Realização: ApexBrasil e Abiquifi">
        <span>${lang === 'en' ? 'Partners' : 'Realização'}</span>
        <img class="topbar-apex" src="assets/img/apexbrasil.png" alt="ApexBrasil" />
        <img class="topbar-abiquifi" src="assets/img/abiquifi.png" alt="Abiquifi" />
      </div>
      <nav class="topbar-actions">
        <${LangSwitch} />
        ${investor
          ? html`<a class="investor-chip" href=${href('/investidor')}>${t('investor.hello', { name:investor.name.split(' ')[0] })}</a><button class="btn btn-outline" onClick=${onLogout}>${t('common.log_out')}</button>`
          : html`<button class="btn btn-lime" onClick=${onInvestorAccess}>${t('topbar.investor_access')}</button>`}
      </nav>
    </header>`;
}

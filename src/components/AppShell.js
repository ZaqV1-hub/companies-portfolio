// Logged-in layout (company area and team panel): navy sidebar + content.
import { html } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';
import { navigate } from '../lib/router.js';
import { LangSwitch } from './LangSwitch.js?v=20261014-flags1';

/**
 * @param {{roleLabel: string, userLabel: string, nav: {key: string, label: string, href: string, current?: boolean}[], onLogout: Function}} props
 */
export function AppShell({ roleLabel, userLabel, nav, onLogout, children }) {
  const { t, lang } = useI18n();
  const initials = userLabel.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
  return html`<div class="shell">
    <aside class="sidebar">
      <div class="sidebar-top"><img class="sidebar-program-logo" src="assets/img/bph-program-negative.png" alt="Brazilian Pharma & Health" />
        <div class="sidebar-workspace"><span class="sidebar-avatar" aria-hidden="true">${initials}</span><div>
          <div class="sidebar-role">${roleLabel}</div><div class="sidebar-user">${userLabel}</div>
        </div></div></div>
      <nav class="nav">${nav.map((n) => n.onClick ? html`<button key=${n.key} type="button" onClick=${n.onClick}>${n.label}</button>` : html`
        <a key=${n.key} href=${n.href} aria-current=${n.current ? 'page' : null}
          onClick=${(event) => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(n.href); } }}>${n.label}${n.badge ? html` <span class="nav-badge">${n.badge}</span>` : null}</a>`)}
      </nav>
      <div class="sidebar-foot">
        <div class="sidebar-partners"><span>${lang === 'en' ? 'Partners' : 'Realização'}</span><div>
          <img src="assets/img/apexbrasil-negative.png" alt="ApexBrasil" />
          <img src="assets/img/abiquifi-negative.png" alt="Abiquifi" />
        </div></div>
        <${LangSwitch} dark=${true} />
        <button type="button" class="sidebar-logout" style=${{ marginTop: 0 }} onClick=${onLogout}>${t('common.log_out')}</button>
      </div>
    </aside>
    <main class="shell-main">${children}</main>
  </div>`;
}

// Logged-in layout (company area and team panel): navy sidebar + content.
import { html } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';
import { LangSwitch } from './LangSwitch.js';

/**
 * @param {{roleLabel: string, userLabel: string, nav: {key: string, label: string, onClick: Function, current?: boolean}[], onLogout: Function}} props
 */
export function AppShell({ roleLabel, userLabel, nav, onLogout, children }) {
  const { t } = useI18n();
  return html`<div class="shell">
    <aside class="sidebar">
      <img src="assets/img/bph-logo.png" alt="Brazilian Pharma & Health" />
      <div>
        <div class="sidebar-role">${roleLabel}</div>
        <div class="sidebar-user">${userLabel}</div>
      </div>
      <nav class="nav">${nav.map((n) => html`
        <button key=${n.key} type="button" aria-current=${n.current ? 'page' : null} onClick=${n.onClick}>${n.label}${n.badge ? html` <span class="nav-badge">${n.badge}</span>` : null}</button>`)}
      </nav>
      <div style=${{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <${LangSwitch} dark=${true} />
        <button type="button" class="sidebar-logout" style=${{ marginTop: 0 }} onClick=${onLogout}>${t('common.log_out')}</button>
      </div>
    </aside>
    <main class="shell-main">${children}</main>
  </div>`;
}

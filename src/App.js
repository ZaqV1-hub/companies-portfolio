// Root component: language provider, session and hash routes.
import { html, useEffect, useState } from './lib/html.js';
import * as api from './services/api.js';
import { LangProvider, useI18n } from './lib/i18n.js';
import { href, navigate, useRoute } from './lib/router.js';
import { TopBar } from './components/TopBar.js';
import { AppShell } from './components/AppShell.js';
import { DirectoryPage } from './pages/public/DirectoryPage.js';
import { ProfilePage } from './pages/public/ProfilePage.js';
import { LoginPage } from './pages/LoginPage.js';

function PublicFooter() {
  const { t } = useI18n();
  return html`<footer class="public-footer">
    <span>${t('profile.footer')}</span>
    <a href=${href('/team/login')}>${t('topbar.team_access')}</a>
  </footer>`;
}

function Placeholder({ title }) {
  const { t } = useI18n();
  return html`<div><h1 class="page-title">${title}</h1><p class="page-subtitle">${t('common.coming_soon')}</p></div>`;
}

function CompanyArea({ user, route, onLogout }) {
  const { t } = useI18n();
  const section = route.parts[1] || 'profile';
  const nav = [
    { key: 'profile', label: t('app.nav_profile'), onClick: () => navigate('/company/profile') },
    { key: 'contacts', label: t('app.nav_contacts'), onClick: () => navigate('/company/contacts') },
    { key: 'public', label: t('app.nav_view_public'), onClick: () => navigate('/org/' + user.organization_id) },
  ].map((n) => ({ ...n, current: n.key === section }));
  return html`<${AppShell} roleLabel=${t('app.company_role')} userLabel=${user.name} nav=${nav} onLogout=${onLogout}>
    <${Placeholder} title=${nav.find((n) => n.current)?.label || ''} />
  <//>`;
}

function TeamArea({ user, route, onLogout }) {
  const { t } = useI18n();
  const section = route.parts[1] || 'review';
  const nav = [
    { key: 'review', label: t('app.nav_review'), onClick: () => navigate('/team/review') },
    { key: 'orgs', label: t('app.nav_orgs'), onClick: () => navigate('/team/orgs') },
    { key: 'crm', label: t('app.nav_crm'), onClick: () => navigate('/team/crm') },
    { key: 'settings', label: t('app.nav_settings'), onClick: () => navigate('/team/settings') },
  ].map((n) => ({ ...n, current: n.key === section }));
  return html`<${AppShell} roleLabel=${t('app.team_role')} userLabel=${user.name} nav=${nav} onLogout=${onLogout}>
    <${Placeholder} title=${nav.find((n) => n.current)?.label || ''} />
  <//>`;
}

function Routes() {
  const route = useRoute();
  const [user, setUser] = useState(undefined);
  useEffect(() => { api.getCurrentUser().then(setUser); }, []);
  if (user === undefined) return null;

  const logout = async () => { await api.logout(); setUser(null); navigate('/'); };
  const [first, second] = route.parts;

  if (first === 'company' || first === 'team') {
    const role = first === 'company' ? 'company_user' : 'team';
    if (second === 'login' || !user || user.role !== role) {
      return html`<${LoginPage} key=${first} role=${role === 'team' ? 'team' : 'company'} onLoggedIn=${setUser} />`;
    }
    return first === 'company'
      ? html`<${CompanyArea} user=${user} route=${route} onLogout=${logout} />`
      : html`<${TeamArea} user=${user} route=${route} onLogout=${logout} />`;
  }

  // Public site. "Request contact" and investor access are completed in blocks 7 and 8.
  const requestContact = async () => 'sent';
  let page;
  if (first === 'org' && second) page = html`<${ProfilePage} orgId=${second} projectId=${route.query.project} onRequestContact=${requestContact} />`;
  else page = html`<${DirectoryPage} />`;
  return html`<div class="page">
    <${TopBar} onInvestorAccess=${() => {}} />
    ${page}
    <${PublicFooter} />
  </div>`;
}

export function App() {
  return html`<${LangProvider}><${Routes} /><//>`;
}

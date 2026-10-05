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
import { ProfileFormPage } from './pages/company/ProfileFormPage.js';
import { OrganizationsPage, ReviewPage, ReviewQueuePage } from './pages/team/ReviewPages.js';

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
  let content;
  if (section === 'profile') {
    content = html`<${ProfileFormPage} stepParam=${route.query.step} onNavigateStep=${(id) => navigate('/company/profile?step=' + encodeURIComponent(id))} />`;
  } else {
    content = html`<${Placeholder} title=${nav.find((n) => n.current)?.label || ''} />`;
  }
  return html`<${AppShell} roleLabel=${t('app.company_role')} userLabel=${user.name} nav=${nav} onLogout=${onLogout}>${content}<//>`;
}

function TeamArea({ user, route, onLogout }) {
  const { t } = useI18n();
  const section = route.parts[1] || 'review';
  const [queue, setQueue] = useState(0);
  useEffect(() => { api.listReviewQueue().then((q) => setQueue(q.length)); }, [route.path]);
  const nav = [
    { key: 'review', label: t('app.nav_review'), badge: queue || null, onClick: () => navigate('/team/review') },
    { key: 'orgs', label: t('app.nav_orgs'), onClick: () => navigate('/team/orgs') },
    { key: 'crm', label: t('app.nav_crm'), onClick: () => navigate('/team/crm') },
    { key: 'settings', label: t('app.nav_settings'), onClick: () => navigate('/team/settings') },
  ].map((n) => ({ ...n, current: n.key === section }));
  let content;
  if (section === 'review' && route.parts[2]) content = html`<${ReviewPage} key=${route.parts[2]} versionId=${route.parts[2]} />`;
  else if (section === 'review') content = html`<${ReviewQueuePage} key=${route.path} />`;
  else if (section === 'orgs') content = html`<${OrganizationsPage} />`;
  else content = html`<${Placeholder} title=${nav.find((n) => n.current)?.label || ''} />`;
  return html`<${AppShell} roleLabel=${t('app.team_role')} userLabel=${user.name} nav=${nav} onLogout=${onLogout}>${content}<//>`;
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

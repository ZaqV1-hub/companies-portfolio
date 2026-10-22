// Root component: language provider, session and hash routes.
import { html, useEffect, useState } from './lib/html.js';
import * as api from './services/api.js?v=20261021-investor1';
import { LangProvider, useI18n } from './lib/i18n.js';
import { href, navigate, useRoute } from './lib/router.js';
import { TopBar } from './components/TopBar.js?v=20261021-investor1';
import { InvestorAuthModal, ResetPasswordPage } from './components/InvestorAuth.js?v=20261021-investor4';
import { AppShell } from './components/AppShell.js?v=20261014-flags1';
import { DirectoryPage } from './pages/public/DirectoryPage.js?v=20261014-api-recovery3';
import { ProfilePage } from './pages/public/ProfilePage.js?v=20261021-investor1';
import { LoginPage } from './pages/LoginPage.js?v=20261014-flags1';
import { ProfileFormPage } from './pages/company/ProfileFormPage.js?v=20261014-api-recovery3';
import { OrganizationsPage, ReviewPage, ReviewQueuePage } from './pages/team/ReviewPages.js';
import { NewContactPage } from './pages/crm/NewContactPage.js?v=20261014-crm1';
import { ContactRecordPage } from './pages/crm/ContactRecordPage.js?v=20261014-api-recovery3';
import { CrmOverviewPage } from './pages/team/CrmOverviewPage.js?v=20261014-api-recovery3';
import { SettingsPage } from './pages/team/SettingsPage.js';
import { DocumentsPage } from './pages/team/DocumentsPage.js?v=20261014-api-recovery3';
import { InvestorAccountPage } from './pages/investor/InvestorAccountPage.js?v=20261021-investor3';

function PublicFooter() {
  const { t } = useI18n();
  return html`<footer class="public-footer">
    <span>${t('profile.footer')}</span>
  </footer>`;
}

function NotFound() {
  const { t } = useI18n();
  return html`<div class="empty-state"><strong>${t('common.not_found')}</strong></div>`;
}

function CompanyArea({ user, route, onLogout }) {
  const { t } = useI18n();
  const section = route.parts[1] || 'contacts';
  const nav = [
    { key: 'contacts', label: 'CRM', href: href('/company/contacts') },
    { key: 'profile', label: t('app.nav_profile'), href: href('/company/profile') },
    { key: 'public', label: t('app.nav_view_public'), href: href('/org/' + user.organization_id) },
  ].map((n) => ({ ...n, current: n.key === section }));
  let content;
  if (section === 'profile') {
    content = html`<${ProfileFormPage} stepParam=${route.query.step} onNavigateStep=${(id) => navigate('/company/profile?step=' + encodeURIComponent(id))} />`;
  } else if (section === 'contacts' && route.parts[2] === 'new') {
    content = html`<${NewContactPage} base="/company/contacts" />`;
  } else if (section === 'contacts' && route.parts[2]) {
    content = html`<${ContactRecordPage} key=${route.parts[2]} relId=${route.parts[2]} base="/company/contacts" />`;
  } else if (section === 'contacts') {
    content = html`<${CrmOverviewPage} team=${false} />`;
  } else {
    content = html`<${NotFound} />`;
  }
  return html`<${AppShell} roleLabel=${t('app.company_role')} userLabel=${user.name} nav=${nav} onLogout=${onLogout}>${content}<//>`;
}

function TeamArea({ user, route, onLogout }) {
  const { t } = useI18n();
  const section = route.parts[1] || 'crm';
  const [queue, setQueue] = useState(0);
  useEffect(() => { api.listReviewQueue().then((q) => setQueue(q.length)); }, [route.path]);
  const nav = [
    { key: 'crm', label: 'CRM', href: href('/team/crm') },
    { key: 'review', label: t('app.nav_review'), badge: queue || null, href: href('/team/review') },
    { key: 'orgs', label: t('app.nav_orgs'), href: href('/team/orgs') },
    { key: 'settings', label: t('app.nav_settings'), href: href('/team/settings') },
    { key: 'documents', label: t('app.nav_documents'), href: href('/team/documents') },
  ].map((n) => ({ ...n, current: n.key === section }));
  let content;
  if (section === 'review' && route.parts[2]) content = html`<${ReviewPage} key=${route.parts[2]} versionId=${route.parts[2]} />`;
  else if (section === 'review') content = html`<${ReviewQueuePage} key=${route.path} />`;
  else if (section === 'orgs') content = html`<${OrganizationsPage} />`;
  else if (section === 'crm' && route.parts[2] === 'new') content = html`<${NewContactPage} base="/team/crm" team=${true} />`;
  else if (section === 'crm' && route.parts[2]) content = html`<${ContactRecordPage} key=${route.parts[2]} relId=${route.parts[2]} base="/team/crm" team=${true} />`;
  else if (section === 'crm') content = html`<${CrmOverviewPage} />`;
  else if (section === 'settings') content = html`<${SettingsPage} />`;
  else if (section === 'documents') content = html`<${DocumentsPage} />`;
  else content = html`<${NotFound} />`;
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

  return html`<${PublicSite} route=${route} user=${user} setUser=${setUser} />`;
}

function LegalPage({ kind }) {
  const { t } = useI18n();
  return html`<div class="section" style=${{ maxWidth: '760px' }}><h1 class="h2">${t('legal.' + kind + '_title')}</h1><div class="legal-copy">${t('legal.' + kind + '_body').split('\n\n').map((paragraph) => html`<p>${paragraph}</p>`)}</div></div>`;
}

/** Public site: directory, profiles and the investor account (spec 2, 6.1). */
function PublicSite({ route, user, setUser }) {
  const { t } = useI18n();
  const [first, second] = route.parts;
  const [auth, setAuth] = useState(null); // {mode, reason, pending: {org, projectId, resolve}}
  const [browse, setBrowse] = useState(undefined);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const investor = user && user.role === 'investor' ? user : null;
  useEffect(() => { api.getInvestorBrowseStatus().then(setBrowse).catch(() => setBrowse({ valid:false })); }, []);
  useEffect(() => {
    if (!investor) { setFavoriteIds([]); return; }
    api.getInvestorAccount().then((account) => setFavoriteIds(account.favorites.map((item) => item.id))).catch(() => {});
  }, [investor?.id]);
  useEffect(() => {
    if (!browse?.valid) return;
    const remaining = browse.expires_at - Date.now();
    if (remaining <= 0) { setBrowse({ valid:false }); return; }
    const timer = setTimeout(() => setBrowse({ valid:false }), remaining);
    return () => clearTimeout(timer);
  }, [browse?.expires_at]);
  const canBrowse = Boolean(user || (browse?.valid && browse.expires_at > Date.now()));
  const needsWelcome = browse !== undefined && !canBrowse && (!first || first === 'org');
  const needsAccountLogin = first === 'investidor' && !investor;

  // "Solicitar contato" only works for a logged-in investor; otherwise opens sign-up / login first.
  const requestContact = (org, projectId) => new Promise((resolve) => {
    const run = async () => { try { resolve((await api.requestContact(org.id, projectId)).ok ? 'sent' : null); } catch { resolve(null); } };
    if (investor && investor.email_verified) run();
    else setAuth({ mode: 'login', reason: t('investor.login_to_request', { org: org.name }), pending: run, cancel: () => resolve(null) });
  });
  const toggleFavorite = (org) => {
    const run = async () => {
      try {
        if (favoriteIds.includes(org.id)) {
          await api.removeInvestorFavorite(org.id);
          setFavoriteIds((current) => current.filter((id) => id !== org.id));
        } else {
          await api.addInvestorFavorite(org.id);
          setFavoriteIds((current) => current.includes(org.id) ? current : [...current, org.id]);
        }
      } catch { /* Keep the previous state if the request fails. */ }
    };
    if (investor && investor.email_verified) run();
    else setAuth({ mode:'login', reason:t('investor.login_to_favorite', { org:org.name }), pending:run });
  };
  const done = (u) => {
    setUser(u);
    const pending = auth && auth.pending;
    setAuth(null);
    if (pending) pending();
  };
  const close = () => { if (auth && auth.cancel) auth.cancel(); setAuth(null); if (needsAccountLogin) navigate('/'); };
  const browseDone = async (data) => { const access = await api.startInvestorBrowse(data); setBrowse(access); setAuth(null); };
  const logout = async () => { await api.logout(); setUser(null); setBrowse({ valid:false }); navigate('/'); };
  const [verifyError,setVerifyError] = useState(false);
  useEffect(() => {
    if (first !== 'verify-email') return;
    api.verifyInvestorEmail(route.query.token).then((result) => {
      setUser(result.user);
      setAuth(null);
      navigate('/investidor');
    }).catch(() => setVerifyError(true));
  }, [first,route.query.token]);

  let page;
  if (first === 'org' && second) page = browse === undefined && !user
    ? html`<div class="section">${t('common.loading')}</div>`
    : html`<${ProfilePage} orgId=${second} projectId=${route.query.project} onRequestContact=${requestContact}
        onToggleFavorite=${toggleFavorite} isFavorite=${favoriteIds.includes(second)} />`;
  else if (first === 'investidor') page = investor
    ? html`<${InvestorAccountPage} onUserUpdated=${setUser} onFavoritesChanged=${setFavoriteIds} />`
    : html`<div class="section">${t('common.loading')}</div>`;
  else if (first === 'verify-email') page = html`<div class="section"><h1 class="form-title">${t('investor.verify_title')}</h1><p>${verifyError ? t('investor.reset_invalid') : t('common.loading')}</p></div>`;
  else if (first === 'reset-password') page = html`<${ResetPasswordPage} token=${route.query.token} />`;
  else if (first === 'legal') page = html`<${LegalPage} kind=${second === 'privacy' ? 'privacy' : 'terms'} />`;
  else page = html`<${DirectoryPage} />`;
  return html`<div class="page">
    <${TopBar} investor=${investor} onInvestorAccess=${() => setAuth({ mode: 'login' })} onLogout=${logout} />
    ${page}
    <${PublicFooter} />
    ${(auth || needsWelcome || needsAccountLogin) && html`<${InvestorAuthModal} key=${`${auth?.mode || (needsAccountLogin ? 'login' : 'welcome')}:${auth?.prefill?.email || ''}`}
      initialMode=${auth?.mode || (needsAccountLogin ? 'login' : 'welcome')} reason=${auth?.reason} prefill=${auth?.prefill}
      onDone=${done} onGuest=${browseDone} onClose=${close} required=${needsWelcome} />`}
  </div>`;
}

export function App() {
  return html`<${LangProvider}><${Routes} /><//>`;
}

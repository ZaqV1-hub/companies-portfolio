// Root component: language provider, session and hash routes.
import { html, useEffect, useState } from './lib/html.js';
import * as api from './services/api.js?v=20261030-intake1';
import { LangProvider, useI18n } from './lib/i18n.js';
import { href, navigate, useRoute } from './lib/router.js';
import { TopBar } from './components/TopBar.js?v=20261030-company-cta1';
import { InvestorAuthModal, ResetPasswordPage } from './components/InvestorAuth.js?v=20261030-company-cta1';
import { AppShell } from './components/AppShell.js?v=20261027-company-help1';
import { CompanyFeedbackModal } from './components/CompanyFeedbackModal.js?v=20261027-company-help1';
import { DirectoryPage } from './pages/public/DirectoryPage.js?v=20261030-intake1';
import { ProfilePage } from './pages/public/ProfilePage.js?v=20261026-profile-layout3';
import { LoginPage } from './pages/LoginPage.js?v=20261026-layout2';
import { ProfileFormPage } from './pages/company/ProfileFormPage.js?v=20261030-intake1';
import { InvitationPage } from './pages/company/InvitationPage.js?v=20261030-intake1';
import { CompanySignupPage, CompanyEmailVerificationPage } from './pages/company/CompanySignupPage.js?v=20261030-intake1';
import { CompanyPreviewPage } from './pages/company/CompanyPreviewPage.js?v=20261026-profile-layout3';
import { OrganizationsPage, ReviewPage, ReviewQueuePage } from './pages/team/ReviewPages.js?v=20261030-intake1';
import { NewContactPage } from './pages/crm/NewContactPage.js?v=20261022-company-crm1';
import { ContactRecordPage } from './pages/crm/ContactRecordPage.js?v=20261023-owner1';
import { CrmOverviewPage } from './pages/team/CrmOverviewPage.js?v=20261023-workbook1';
import { DocumentsPage } from './pages/team/DocumentsPage.js?v=20261030-intake1';
import { InvestorAccountPage } from './pages/investor/InvestorAccountPage.js?v=20261022-phone1';

const investorIntentKey = 'portfolio:investor-intent';
const investorVerifiedKey = 'portfolio:investor-verified';
function saveInvestorIntent(intent) {
  try { localStorage.setItem(investorIntentKey, JSON.stringify({ ...intent, createdAt: Date.now() })); } catch {}
}
function takeInvestorIntent() {
  try {
    const value = JSON.parse(localStorage.getItem(investorIntentKey) || 'null');
    localStorage.removeItem(investorIntentKey);
    return value && Date.now() - value.createdAt < 24 * 60 * 60 * 1000 ? value : null;
  } catch { return null; }
}

function PublicFooter() {
  return html`<footer class="public-footer"><div class="public-footer-inner">
    <img src="assets/img/brand-signature.png" alt="Realização: Brazilian Pharma & Health. Promovido por: ApexBrasil e Abiquifi." />
  </div></footer>`;
}

function NotFound() {
  const { t } = useI18n();
  return html`<div class="empty-state"><strong>${t('common.not_found')}</strong></div>`;
}

function CompanyArea({ user, route, onLogout }) {
  const { t } = useI18n();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const section = route.parts[1] || 'contacts';
  const nav = [
    { key: 'contacts', label: 'CRM', href: href('/company/contacts') },
    { key: 'profile', label: t('app.nav_profile'), href: href('/company/profile') },
    { key: 'public', label: t('app.nav_view_public'), href: href('/company/preview') },
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
  return html`<${AppShell} roleLabel=${t('app.company_role')} userLabel=${user.name} nav=${nav} onLogout=${onLogout} onFeedback=${() => setFeedbackOpen(true)}>${content}${feedbackOpen && html`<${CompanyFeedbackModal} user=${user} onClose=${() => setFeedbackOpen(false)} />`}<//>`;
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
    { key: 'documents', label: t('app.nav_documents'), href: href('/team/documents') },
  ].map((n) => ({ ...n, current: n.key === section }));
  let content;
  if (section === 'review' && route.parts[2]) content = html`<${ReviewPage} key=${route.parts[2]} versionId=${route.parts[2]} />`;
  else if (section === 'review') content = html`<${ReviewQueuePage} key=${route.path} />`;
  else if (section === 'orgs' && route.parts[2]) content = html`<${ProfileFormPage} key=${route.parts[2]} teamOrgId=${route.parts[2]} stepParam=${route.query.step} onNavigateStep=${(id) => navigate('/team/orgs/' + route.parts[2] + '?step=' + encodeURIComponent(id))} />`;
  else if (section === 'orgs') content = html`<${OrganizationsPage} />`;
  else if (section === 'crm' && route.parts[2] === 'new') content = html`<${NewContactPage} base="/team/crm" team=${true} />`;
  else if (section === 'crm' && route.parts[2]) content = html`<${ContactRecordPage} key=${route.parts[2]} relId=${route.parts[2]} base="/team/crm" team=${true} />`;
  else if (section === 'crm') content = html`<${CrmOverviewPage} />`;
  else if (section === 'documents') content = html`<${DocumentsPage} />`;
  else content = html`<${NotFound} />`;
  return html`<${AppShell} roleLabel=${t('app.team_role')} userLabel=${user.name} nav=${nav} onLogout=${onLogout}>${content}<//>`;
}

function Routes() {
  const route = useRoute();
  const { setLang } = useI18n();
  useEffect(() => { if (route.areaLang) setLang(route.areaLang); }, [route.areaLang]);
  const [user, setUser] = useState(undefined);
  useEffect(() => { api.getCurrentUser().then(setUser).catch(() => setUser(null)); }, []);
  if (user === undefined) return html`<div class="section">Carregando...</div>`;

  const logout = async () => { await api.logout(); setUser(null); navigate('/'); };
  const [first, second] = route.parts;

  if (first === 'company' || first === 'team') {
    const role = first === 'company' ? 'company_user' : 'team';
    if (first === 'company' && route.query.invite) return html`<${InvitationPage} token=${route.query.invite} onLoggedIn=${setUser} />`;
    if (first === 'company' && second === 'signup') return html`<${CompanySignupPage} />`;
    if (first === 'company' && ['verify-email','confirmar-email'].includes(second)) return html`<${CompanyEmailVerificationPage} token=${route.query.token} onLoggedIn=${setUser} />`;
    if (second === 'login' || !user || user.role !== role) {
      return html`<${LoginPage} key=${first} role=${role === 'team' ? 'team' : 'company'} next=${second && second !== 'login' ? route.path : null} onLoggedIn=${setUser} />`;
    }
    if (first === 'company' && second === 'preview') return html`<${CompanyPreviewPage} />`;
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
  const [contactRequestedIds, setContactRequestedIds] = useState([]);
  const [verificationNotice, setVerificationNotice] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(0);
  const [verifyResult, setVerifyResult] = useState(null);
  const investor = user && user.role === 'investor' ? user : null;
  useEffect(() => { api.getInvestorBrowseStatus().then(setBrowse).catch(() => setBrowse({ valid:false })); }, []);
  useEffect(() => {
    if (!investor) { setFavoriteIds([]); setContactRequestedIds([]); return; }
    api.getInvestorAccount().then((account) => {
      setFavoriteIds(account.favorites.map((item) => item.id));
      setContactRequestedIds(account.contacts.map((item) => item.organization_id));
    }).catch(() => {});
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
    const run = async () => {
      try {
        const result = await api.requestContact(org.id, projectId);
        if (result.ok) setContactRequestedIds((current) => current.includes(org.id) ? current : [...current, org.id]);
        resolve(result.ok ? 'sent' : null);
      } catch { resolve(null); }
    };
    if (investor && investor.email_verified) run();
    else {
      saveInvestorIntent({ type: 'contact', orgId: org.id, projectId });
      setAuth({ mode: 'login', reason: t('investor.login_to_request', { org: org.name }), pending: run,
        verified: (completed) => resolve(completed ? 'sent' : null), cancel: () => resolve(null) });
    }
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
    else {
      saveInvestorIntent({ type: 'favorite', orgId: org.id });
      setAuth({ mode:'login', reason:t('investor.login_to_favorite', { org:org.name }), pending:run });
    }
  };
  const done = (u) => {
    setUser(u);
    takeInvestorIntent();
    setAwaitingVerification(0);
    const pending = auth && auth.pending;
    setAuth(null);
    if (pending) pending();
  };
  const close = () => { if (auth && auth.cancel) auth.cancel(); takeInvestorIntent(); setAwaitingVerification(0); setAuth(null); if (needsAccountLogin) navigate('/'); };
  const browseDone = async (data) => { const access = await api.startInvestorBrowse(data); setBrowse(access); setAuth(null); };
  const logout = async () => { await api.logout(); setUser(null); setBrowse({ valid:false }); navigate('/'); };
  const [verifyError,setVerifyError] = useState(false);
  const finishInOriginalTab = async (eventData) => {
    const current = await api.getCurrentUser();
    if (!current || current.role !== 'investor') return;
    setUser(current);
    setVerificationNotice(eventData?.actionCompleted ? eventData.type || 'account' : 'account');
    setAwaitingVerification(0);
    if (eventData?.actionCompleted && eventData.type === 'contact' && eventData.orgId) {
      setContactRequestedIds((currentIds) => currentIds.includes(eventData.orgId) ? currentIds : [...currentIds, eventData.orgId]);
    }
    if (auth?.verified) auth.verified(Boolean(eventData?.actionCompleted));
    setAuth(null);
    api.getInvestorAccount().then((account) => {
      setFavoriteIds(account.favorites.map((item) => item.id));
      setContactRequestedIds(account.contacts.map((item) => item.organization_id));
    }).catch(() => {});
  };
  useEffect(() => {
    const onVerified = (event) => {
      if (event.key !== investorVerifiedKey || !event.newValue) return;
      try { finishInOriginalTab(JSON.parse(event.newValue)).catch(() => {}); } catch {}
    };
    window.addEventListener('storage', onVerified);
    return () => window.removeEventListener('storage', onVerified);
  }, [auth]);
  useEffect(() => {
    if (!awaitingVerification || first === 'verify-email') return;
    const check = () => {
      try {
        const eventData = JSON.parse(localStorage.getItem(investorVerifiedKey) || 'null');
        if (eventData?.verifiedAt >= awaitingVerification) {
          finishInOriginalTab(eventData).catch(() => {});
        }
      } catch {}
    };
    const timer = setInterval(check, 3000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [awaitingVerification, first, auth]);
  useEffect(() => {
    if (first !== 'verify-email') return;
    api.verifyInvestorEmail(route.query.token).then(async (result) => {
      setUser(result.user);
      setAuth(null);
      const intent = takeInvestorIntent();
      let actionCompleted = !intent;
      try {
        let action;
        if (intent?.type === 'favorite') action = await api.addInvestorFavorite(intent.orgId);
        if (intent?.type === 'contact') action = await api.requestContact(intent.orgId, intent.projectId);
        if (intent) actionCompleted = action?.ok === true;
      } catch { actionCompleted = false; }
      const destination = intent?.orgId ? '/org/' + encodeURIComponent(intent.orgId) : '/';
      const eventData = { verifiedAt: Date.now(), type: intent?.type || null, orgId: intent?.orgId || null, actionCompleted };
      try { localStorage.setItem(investorVerifiedKey, JSON.stringify(eventData)); } catch {}
      setVerifyResult({ destination, ...eventData });
    }).catch(() => setVerifyError(true));
  }, [first,route.query.token]);

  let page;
  if (first === 'org' && second) page = browse === undefined && !user
    ? html`<div class="section">${t('common.loading')}</div>`
    : html`<${ProfilePage} orgId=${second} projectId=${route.query.project} onRequestContact=${requestContact}
        onToggleFavorite=${toggleFavorite} isFavorite=${favoriteIds.includes(second)} hasRequestedContact=${contactRequestedIds.includes(second)} />`;
  else if (first === 'investidor') page = investor
    ? html`<${InvestorAccountPage} onUserUpdated=${setUser} onFavoritesChanged=${setFavoriteIds} />`
    : html`<div class="section">${t('common.loading')}</div>`;
  else if (first === 'verify-email') page = html`<div class="section" style=${{ maxWidth:'680px' }}>
    <h1 class="form-title">${verifyResult ? t('investor.verify_complete_title') : t('investor.verify_title')}</h1>
    ${verifyResult ? html`<p>${t(verifyResult.actionCompleted ? 'investor.verify_complete' : 'investor.verify_action_retry')}</p>
      <p class="section-note">${t('investor.verify_close_tab')}</p>
      <button type="button" class="btn btn-lime" onClick=${() => navigate(verifyResult.destination)}>${t(verifyResult.type === 'favorite' ? 'investor.verify_view_favorite' : 'investor.verify_continue')}</button>`
      : html`<p>${verifyError ? t('investor.reset_invalid') : t('common.loading')}</p>`}
  </div>`;
  else if (first === 'reset-password') page = html`<${ResetPasswordPage} token=${route.query.token} />`;
  else if (first === 'legal') page = html`<${LegalPage} kind=${second === 'privacy' ? 'privacy' : 'terms'} />`;
  else page = html`<${DirectoryPage} />`;
  return html`<div class="page">
    <${TopBar} investor=${investor} onInvestorAccess=${() => setAuth({ mode: 'login' })} onLogout=${logout} />
    ${verificationNotice && first !== 'verify-email' && html`<div class="notice" role="status" style=${{ maxWidth:'1200px', margin:'16px auto' }}>${t('investor.' + (verificationNotice === 'favorite' ? 'account_verified_favorite' : verificationNotice === 'contact' ? 'account_verified_contact' : 'account_verified'))}</div>`}
    ${page}
    <${PublicFooter} />
    ${(auth || needsWelcome || needsAccountLogin) && html`<${InvestorAuthModal} key=${`${auth?.mode || (needsAccountLogin ? 'login' : 'welcome')}:${auth?.prefill?.email || ''}`}
      initialMode=${auth?.mode || (needsAccountLogin ? 'login' : 'welcome')} reason=${auth?.reason} prefill=${auth?.prefill}
      onDone=${done} onGuest=${browseDone} onClose=${close} onVerificationStarted=${() => setAwaitingVerification(Date.now())} required=${needsWelcome} />`}
  </div>`;
}

export function App() {
  return html`<${LangProvider}><${Routes} /><//>`;
}

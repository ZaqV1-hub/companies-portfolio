// Login for company users and the program team (MOCK: any seed user, password "demo").
import { html, useEffect, useState } from '../lib/html.js';
import * as api from '../services/api.js';
import { useI18n } from '../lib/i18n.js';
import { href, navigate } from '../lib/router.js';
import { LangSwitch } from '../components/LangSwitch.js';

export function LoginPage({ role, onLoggedIn }) {
  const { t } = useI18n();
  const isTeam = role === 'team';
  const [email, setEmail] = useState(isTeam ? 'team@abiquifi.org.br' : '');
  const [password, setPassword] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [demoUser, setDemoUser] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isTeam) api.listDemoCompanyAccounts().then((list) => { setAccounts(list); setDemoUser(list.length ? list[0].user_id : ''); });
  }, [isTeam]);

  const submit = async (e) => {
    e.preventDefault();
    const res = !isTeam && !email && demoUser ? await api.loginAs(demoUser) : await api.login(email, password, isTeam ? 'team' : 'company_user');
    if (!res.ok) { setError(t('login.invalid')); return; }
    onLoggedIn(res.user);
    navigate(isTeam ? '/team' : '/company');
  };

  const k = isTeam ? 'team' : 'company';
  return html`<div class="split">
    <div class="split-brand">
      <div class="deco-ring" style=${{ top: '-100px', right: '-60px', width: '340px', height: '340px', border: '1px solid rgba(203,232,43,0.25)' }}></div>
      <div class="deco-ring" style=${{ bottom: '-120px', left: '-40px', width: '280px', height: '280px', borderRadius: '70px', transform: 'rotate(18deg)', border: '1px solid rgba(255,255,255,0.09)' }}></div>
      <div style=${{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <img src="assets/img/bph-logo.png" alt="Brazilian Pharma & Health" />
        <${LangSwitch} dark=${true} />
      </div>
      <div style=${{ position: 'relative' }}>
        <h2>${t('login.brand_title')}</h2>
        <p>${t('login.brand_text')}</p>
      </div>
      <div class="fine">${t('login.brand_fine')}</div>
    </div>
    <div class="split-form">
      <form class="split-form-inner" onSubmit=${submit}>
        <div class="kicker">${t('login.' + k + '_kicker')}</div>
        <h1 class="form-title">${t('login.' + k + '_title')}</h1>
        <p class="form-subtitle">${t('login.' + k + '_subtitle')}</p>
        <div class="stack">
          <label><span class="field-label">${t('common.email')}</span>
            <input class="input input-sm" type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} placeholder="name@company.com" /></label>
          <label><span class="field-label">${t('common.password')}</span>
            <input class="input input-sm" type="password" value=${password} onInput=${(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
          ${!isTeam && html`<label><span class="field-label">${t('login.demo_as')}</span>
            <select class="input input-sm" value=${demoUser} onChange=${(e) => { setDemoUser(e.target.value); setEmail(''); }}>
              ${accounts.map((a) => html`<option key=${a.user_id} value=${a.user_id}>${a.organization_name}</option>`)}
            </select></label>`}
          ${error && html`<div class="form-error" role="alert">${error}</div>`}
          <button type="submit" class="btn btn-lime btn-xl" style=${{ marginTop: '8px' }}>${t('common.log_in')}</button>
          <div class="section-note">${t('login.demo_hint')}</div>
          <a class="btn-link" href=${href('/')} style=${{ marginTop: '10px' }}>${t('common.back_public')}</a>
        </div>
      </form>
    </div>
  </div>`;
}

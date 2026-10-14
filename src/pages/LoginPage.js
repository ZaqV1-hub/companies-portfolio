// Login for company users and the program team.
import { html, useState } from '../lib/html.js';
import * as api from '../services/api.js?v=20261014-legal1';
import { useI18n } from '../lib/i18n.js';
import { href, navigate } from '../lib/router.js';
import { LangSwitch } from '../components/LangSwitch.js?v=20261014-documents1';

export function LoginPage({ role, onLoggedIn }) {
  const { t } = useI18n();
  const isTeam = role === 'team';
  const [email, setEmail] = useState(isTeam ? 'teste@abiquifi' : 'teste@imunotera');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (forgot) {
        await api.requestPasswordReset(email);
        setSent(true);
        return;
      }
      const res = await api.login(email, password, isTeam ? 'team' : 'company_user');
      if (!res.ok) { setError(t('login.invalid')); return; }
      onLoggedIn(res.user);
      navigate(isTeam ? '/team' : '/company');
    } catch (err) {
      setError(forgot && err.data?.error === 'email_unavailable' ? t('investor.email_unavailable') : forgot ? t('investor.try_again') : t('login.invalid'));
    } finally {
      setBusy(false);
    }
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
        <h1 class="form-title">${forgot ? t('investor.forgot_password') : t('login.' + k + '_title')}</h1>
        <p class="form-subtitle">${forgot ? t('investor.reset_intro') : t('login.' + k + '_subtitle')}</p>
        <div class="stack">
          <label><span class="field-label">${t('common.email')}</span>
            <input class="input input-sm" type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} placeholder="name@company.com" /></label>
          ${!forgot && html`<label><span class="field-label">${t('common.password')}</span>
            <input class="input input-sm" type="password" value=${password} onInput=${(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
          `}
          ${error && html`<div class="form-error" role="alert">${error}</div>`}
          ${sent && html`<p class="section-note" role="status">${t('investor.reset_sent')}</p>`}
          <button type="submit" class="btn btn-lime btn-xl" disabled=${busy} style=${{ marginTop: '8px' }}>${forgot ? t('investor.send_reset') : t('common.log_in')}</button>
          <button type="button" class="btn-link" onClick=${() => { setForgot(!forgot); setError(null); setSent(false); }}>${forgot ? t('investor.back_login') : t('investor.forgot_password')}</button>
          <a class="btn-link" href=${href('/')} style=${{ marginTop: '10px' }}>${t('common.back_public')}</a>
        </div>
      </form>
    </div>
  </div>`;
}

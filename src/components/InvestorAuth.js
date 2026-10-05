// Investor sign-up / login / e-mail verification (spec 2, 6.1). Opens as a modal from the top bar
// and from "Request contact" when nobody is logged in.
import { cx, html, useState } from '../lib/html.js';
import * as api from '../services/api.js';
import { useI18n } from '../lib/i18n.js';
import { countryOptions } from '../lib/countries.js';
import { href } from '../lib/router.js';

const INVESTOR_TYPES = ['accelerator', 'angel', 'angel_network', 'asset_wealth_management', 'cvc', 'dfi', 'endowment', 'family_office',
  'foundation', 'fund_of_funds', 'hnwi', 'non_profit', 'organization', 'pe_firm', 'pension_fund', 'service_provider', 'vc'];

function Input({ label, level, error, children }) {
  const { t } = useI18n();
  return html`<label class=${cx('auth-field', error && 'has-error')}>
    <span class="field-label">${label}${level === 'req' && html`<span class="req"> *</span>`}
      ${level === 'rec' && html` <span class="level-tag">${t('investor.recommended')}</span>`}
      ${level === 'opt' && html` <span class="level-tag muted">${t('investor.optional')}</span>`}</span>
    ${children}
    ${error && html`<span class="field-error">${error}</span>`}
  </label>`;
}

function SignUp({ onRegistered, switchTo }) {
  const { t, lang } = useI18n();
  const [f, setF] = useState({ name: '', institution: '', email: '', country: '', city: '', password: '', role: '', investor_type: '',
    phone: '', linkedin: '', accept_terms: false, accept_privacy: false });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const res = await api.registerInvestor({ ...f, lang });
    if (!res.ok) {
      const msg = res.error === 'email_taken' ? t('investor.email_taken') : res.error === 'email' ? t('form.errors.email') : t('form.errors.required');
      setErrors(Object.fromEntries((res.fields || []).map((k) => [k, msg])));
      return;
    }
    onRegistered(res.user_id, res.verification_token, f.email);
  };
  const err = (k) => errors[k];
  return html`<form class="auth-form" onSubmit=${submit} noValidate>
    <div class="auth-grid">
      <${Input} label=${t('investor.name')} level="req" error=${err('name')}><input class="input input-sm" value=${f.name} onInput=${set('name')} autocomplete="name" /><//>
      <${Input} label=${t('investor.institution')} level="req" error=${err('institution')}><input class="input input-sm" value=${f.institution} onInput=${set('institution')} autocomplete="organization" /><//>
      <${Input} label=${t('investor.email')} level="req" error=${err('email')}><input class="input input-sm" type="email" value=${f.email} onInput=${set('email')} autocomplete="email" /><//>
      <${Input} label=${t('common.password')} level="req" error=${err('password')}><input class="input input-sm" type="password" value=${f.password} onInput=${set('password')} autocomplete="new-password" /><//>
      <${Input} label=${t('investor.country')} level="req" error=${err('country')}>
        <select class="input input-sm" value=${f.country} onChange=${set('country')}>
          <option value="">${t('form.choose')}</option>
          ${countryOptions(lang).map((c) => html`<option key=${c.code} value=${c.code}>${c.name}</option>`)}
        </select><//>
      <${Input} label=${t('investor.city')} level="req" error=${err('city')}><input class="input input-sm" value=${f.city} onInput=${set('city')} /><//>
      <${Input} label=${t('investor.role')} level="rec"><input class="input input-sm" value=${f.role} onInput=${set('role')} autocomplete="organization-title" /><//>
      <${Input} label=${t('investor.investor_type')} level="rec">
        <select class="input input-sm" value=${f.investor_type} onChange=${set('investor_type')}>
          <option value="">${t('form.choose')}</option>
          ${INVESTOR_TYPES.map((v) => html`<option key=${v} value=${v}>${t('enum.investor_types.' + v)}</option>`)}
        </select><//>
      <${Input} label=${t('investor.phone')} level="opt"><input class="input input-sm" type="tel" value=${f.phone} onInput=${set('phone')} autocomplete="tel" /><//>
      <${Input} label="LinkedIn" level="opt"><input class="input input-sm" type="url" value=${f.linkedin} onInput=${set('linkedin')} placeholder="https://www.linkedin.com/in/…" /><//>
    </div>
    <label class=${cx('check-line', err('accept_terms') && 'has-error')}><input type="checkbox" checked=${f.accept_terms} onChange=${set('accept_terms')} />
      <span>${t('investor.accept_terms_pre')} <a href=${href('/legal/terms')} target="_blank">${t('investor.terms')}</a> *</span></label>
    <label class=${cx('check-line', err('accept_privacy') && 'has-error')}><input type="checkbox" checked=${f.accept_privacy} onChange=${set('accept_privacy')} />
      <span>${t('investor.accept_privacy_pre')} <a href=${href('/legal/privacy')} target="_blank">${t('investor.privacy')}</a> *</span></label>
    ${Object.keys(errors).length > 0 && html`<div class="form-error" role="alert">${t('investor.fix_errors')}</div>`}
    <button type="submit" class="btn btn-lime btn-xl">${t('investor.create_account')}</button>
    <p class="auth-switch">${t('investor.have_account')} <button type="button" class="btn-link link-accent" onClick=${() => switchTo('login')}>${t('investor.log_in')}</button></p>
  </form>`;
}

function Login({ onLoggedIn, onNeedsVerification, switchTo }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const res = await api.loginInvestor(email, password);
    if (res.ok) onLoggedIn(res.user);
    else if (res.error === 'not_verified') onNeedsVerification(res.user_id, email);
    else setError(t('login.invalid'));
  };
  return html`<form class="auth-form" onSubmit=${submit}>
    <label class="auth-field"><span class="field-label">${t('investor.email')}</span><input class="input input-sm" type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} autocomplete="email" /></label>
    <label class="auth-field"><span class="field-label">${t('common.password')}</span><input class="input input-sm" type="password" value=${password} onInput=${(e) => setPassword(e.target.value)} autocomplete="current-password" /></label>
    ${error && html`<div class="form-error" role="alert">${error}</div>`}
    <button type="submit" class="btn btn-lime btn-xl">${t('investor.log_in')}</button>
    <p class="section-note">${t('investor.demo_hint')}</p>
    <p class="auth-switch">${t('investor.no_account')} <button type="button" class="btn-link link-accent" onClick=${() => switchTo('signup')}>${t('investor.create_account')}</button></p>
  </form>`;
}

function Verify({ userId, token, email, onVerified }) {
  const { t } = useI18n();
  const [currentToken, setToken] = useState(token);
  const [sent, setSent] = useState(false);
  const open = async () => {
    const res = await api.verifyInvestorEmail(currentToken);
    if (res.ok) onVerified(res.user);
  };
  const resend = async () => {
    const res = await api.resendVerification(userId);
    if (res.ok) { setToken(res.verification_token); setSent(true); }
  };
  return html`<div class="auth-form verify">
    <div class="verify-icon">✉</div>
    <h3 class="form-title" style=${{ fontSize: '22px' }}>${t('investor.verify_title')}</h3>
    <p class="form-subtitle">${t('investor.verify_text', { email })}</p>
    <div class="simulated-mail">
      <div class="sim-label">${t('investor.simulated_inbox')}</div>
      <p>${t('investor.verify_mail_body')}</p>
      ${currentToken
        ? html`<button type="button" class="btn btn-lime btn-lg" onClick=${open}>${t('investor.confirm_link')}</button>`
        : html`<p class="form-help">${t('investor.no_token')}</p>`}
    </div>
    <button type="button" class="btn-link" onClick=${resend}>${t('investor.resend')}</button>
    ${sent && html`<span class="section-note">${t('investor.resent')}</span>`}
  </div>`;
}

/**
 * @param {{initialMode?: 'signup'|'login', reason?: string, onDone: (user) => void, onClose: () => void}} props
 */
export function InvestorAuthModal({ initialMode = 'signup', reason, onDone, onClose }) {
  const { t } = useI18n();
  const [mode, setMode] = useState(initialMode);
  const [pending, setPending] = useState(null); // {userId, token, email}
  return html`<div class="modal-backdrop" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="modal" role="dialog" aria-modal="true" aria-label=${t('investor.title')}>
      <button type="button" class="modal-close" aria-label="Close" onClick=${onClose}>×</button>
      <div class="kicker">${t('investor.kicker')}</div>
      ${mode !== 'verify' && html`<h2 class="form-title">${mode === 'signup' ? t('investor.signup_title') : t('investor.login_title')}</h2>
        <p class="form-subtitle">${reason || t('investor.subtitle')}</p>
        <div class="tabs"><button type="button" class=${cx('tab', mode === 'signup' && 'on')} onClick=${() => setMode('signup')}>${t('investor.create_account')}</button>
          <button type="button" class=${cx('tab', mode === 'login' && 'on')} onClick=${() => setMode('login')}>${t('investor.log_in')}</button></div>`}
      ${mode === 'signup' && html`<${SignUp} switchTo=${setMode} onRegistered=${(userId, token, email) => { setPending({ userId, token, email }); setMode('verify'); }} />`}
      ${mode === 'login' && html`<${Login} switchTo=${setMode} onLoggedIn=${onDone} onNeedsVerification=${(userId, email) => { setPending({ userId, token: null, email }); setMode('verify'); }} />`}
      ${mode === 'verify' && pending && html`<${Verify} userId=${pending.userId} token=${pending.token} email=${pending.email} onVerified=${onDone} />`}
    </div>
  </div>`;
}

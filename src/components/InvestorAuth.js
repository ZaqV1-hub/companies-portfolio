// Investor welcome, verified sign-up, login and password recovery.
import { html, useState } from '../lib/html.js';
import * as api from '../services/api.js?v=20261021-investor1';
import { useI18n } from '../lib/i18n.js';
import { CountryControl, StateControl } from './InvestorLocationFields.js?v=20261022-investor-form1';
import { formatPhoneInput } from '../lib/phone.js?v=20261022-phone1';

const INVESTOR_TYPES = ['accelerator','angel','angel_network','asset_wealth_management','cvc','dfi','endowment','family_office','foundation','fund_of_funds','hnwi','non_profit','organization','pe_firm','pension_fund','service_provider','vc'];

function Input({ label, required, children, error, valid }) {
  return html`<label class=${`auth-field${error ? ' has-error' : ''}${valid ? ' is-valid' : ''}`}>
    <span class="field-label">${label}${required && html`<span class="req"> *</span>`}</span>
    ${children}${error && html`<small class="field-error" role="status">${error}</small>`}
  </label>`;
}

function TermsChecks({ terms, privacy, onTerms, onPrivacy, openLegal, termsError, privacyError }) {
  const { t } = useI18n();
  return html`<div class="auth-consents">
    <label class=${`check-line${termsError ? ' has-error' : ''}`}><input type="checkbox" checked=${terms} onChange=${onTerms} />
      <span>${t('investor.accept_terms_pre')} <button type="button" class="btn-link link-accent" onClick=${() => openLegal('terms')}>${t('investor.terms')}</button> *</span></label>
    ${termsError && html`<small class="field-error">${termsError}</small>`}
    <label class=${`check-line${privacyError ? ' has-error' : ''}`}><input type="checkbox" checked=${privacy} onChange=${onPrivacy} />
      <span>${t('investor.accept_privacy_pre')} <button type="button" class="btn-link link-accent" onClick=${() => openLegal('privacy')}>${t('investor.privacy')}</button> *</span></label>
    ${privacyError && html`<small class="field-error">${privacyError}</small>`}
  </div>`;
}

function AccountStart({ switchTo, onStarted, openLegal }) {
  const { t, lang } = useI18n();
  const [data, setData] = useState({ first_name:'',last_name:'',institution:'',email:'',password:'',confirm_password:'',country:'',state:'',city:'',role:'',investor_type:'',phone:'',accept_terms:false,accept_privacy:false });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setData((current) => ({ ...current, [key]:key === 'phone' ? formatPhoneInput(value, current.country) : value,
      ...(key === 'country' ? { state:'',city:'',phone:formatPhoneInput(current.phone, value) } : {}) }));
    setError('');
    if (key === 'email') setEmailTaken(false);
    if (key === 'confirm_password') setTouched((current) => ({ ...current, confirm_password:true }));
    if (key === 'country') setTouched((current) => ({ ...current, state:false,city:false }));
  };
  const blur = (key) => () => setTouched((current) => ({ ...current, [key]:true }));
  const passwordRules = [
    ['password_rule_length', data.password.length >= 10 && data.password.length <= 128],
    ['password_rule_upper', /\p{Lu}/u.test(data.password)],
    ['password_rule_lower', /\p{Ll}/u.test(data.password)],
    ['password_rule_number', /\d/.test(data.password)],
  ];
  const required = t('investor.field_required');
  const errors = {
    first_name: data.first_name.trim() ? '' : required,
    last_name: data.last_name.trim() ? '' : required,
    institution: data.institution.trim() ? '' : required,
    email: emailTaken ? t('investor.email_taken') : !data.email.trim() ? t('investor.email_invalid')
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) ? '' : t('investor.email_invalid'),
    password: passwordRules.every(([,met]) => met) ? '' : t('investor.password_requirements'),
    confirm_password: !data.confirm_password ? required
      : data.confirm_password === data.password ? '' : t('investor.password_mismatch'),
    country: data.country ? '' : required,
    state: data.state.trim() ? '' : required,
    city: data.city.trim() ? '' : required,
    phone: /^\+?[\d\s().-]{10,24}$/.test(data.phone.trim()) && (data.phone.match(/\d/g) || []).length >= 10
      && (data.phone.match(/\d/g) || []).length <= 15 ? '' : t('investor.phone_invalid'),
    accept_terms: data.accept_terms ? '' : t('investor.terms_required'),
    accept_privacy: data.accept_privacy ? '' : t('investor.privacy_required'),
  };
  const fieldError = (key) => (touched[key] || submitted) ? errors[key] : '';
  const fieldValid = (key) => Boolean((touched[key] || submitted) && !errors[key] && data[key]);
  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true); setError('');
    try { await api.startInvestorEmail({ ...data,lang }); onStarted({ email:data.email }); }
    catch (err) {
      if (err.data?.error === 'email_taken') { setEmailTaken(true); setTouched((current) => ({ ...current,email:true })); }
      else setError(err.data?.error === 'email_unavailable' || err.data?.error === 'email_delivery_failed'
        ? t('investor.email_unavailable') : t('investor.try_again'));
    }
    finally { setBusy(false); }
  };
  return html`<form class="auth-form" noValidate=${true} onSubmit=${submit}>
    <div class="auth-grid">
      <${Input} label=${t('investor.first_name')} required=${true} error=${fieldError('first_name')} valid=${fieldValid('first_name')}><input class="input input-sm" aria-invalid=${Boolean(fieldError('first_name'))} autocomplete="given-name" value=${data.first_name} onInput=${set('first_name')} onBlur=${blur('first_name')} /><//>
      <${Input} label=${t('investor.last_name')} required=${true} error=${fieldError('last_name')} valid=${fieldValid('last_name')}><input class="input input-sm" aria-invalid=${Boolean(fieldError('last_name'))} autocomplete="family-name" value=${data.last_name} onInput=${set('last_name')} onBlur=${blur('last_name')} /><//>
      <${Input} label=${t('investor.institution')} required=${true} error=${fieldError('institution')} valid=${fieldValid('institution')}><input class="input input-sm" aria-invalid=${Boolean(fieldError('institution'))} autocomplete="organization" value=${data.institution} onInput=${set('institution')} onBlur=${blur('institution')} /><//>
      <${Input} label=${t('investor.email')} required=${true} error=${fieldError('email')} valid=${fieldValid('email')}><input class="input input-sm" type="email" aria-invalid=${Boolean(fieldError('email'))} autocomplete="email" value=${data.email} onInput=${set('email')} onBlur=${blur('email')} /><//>
      <${Input} label=${t('common.password')} required=${true} error=${fieldError('password')} valid=${fieldValid('password')}><input class="input input-sm" type="password" aria-invalid=${Boolean(fieldError('password'))} autocomplete="new-password" value=${data.password} onInput=${set('password')} onFocus=${blur('password')} />
        <ul class="auth-password-rules">${passwordRules.map(([key,met]) => html`<li key=${key} class=${met ? 'met' : touched.password || submitted ? 'unmet' : ''}>${t('investor.' + key)}</li>`)}</ul><//>
      <${Input} label=${t('investor.confirm_password')} required=${true} error=${fieldError('confirm_password')} valid=${fieldValid('confirm_password')}><input class="input input-sm" type="password" aria-invalid=${Boolean(fieldError('confirm_password'))} autocomplete="new-password" value=${data.confirm_password} onInput=${set('confirm_password')} onBlur=${blur('confirm_password')} /><//>
      <${Input} label=${t('investor.country')} required=${true} error=${fieldError('country')} valid=${fieldValid('country')}><${CountryControl} value=${data.country} invalid=${Boolean(fieldError('country'))} onChange=${set('country')} onBlur=${blur('country')} /><//>
      <${Input} label=${t('investor.state')} required=${true} error=${fieldError('state')} valid=${fieldValid('state')}><${StateControl} country=${data.country} value=${data.state} invalid=${Boolean(fieldError('state'))} onChange=${set('state')} onBlur=${blur('state')} /><//>
      <${Input} label=${t('investor.city')} required=${true} error=${fieldError('city')} valid=${fieldValid('city')}><input class="input input-sm" aria-invalid=${Boolean(fieldError('city'))} autocomplete="address-level2" value=${data.city} onInput=${set('city')} onBlur=${blur('city')} /><//>
      <${Input} label=${t('investor.role')}><input class="input input-sm" autocomplete="organization-title" value=${data.role} onInput=${set('role')} /><//>
      <${Input} label=${t('investor.investor_type')}><select class="input input-sm" value=${data.investor_type} onChange=${set('investor_type')}><option value="">${t('form.choose')}</option>${INVESTOR_TYPES.map((type) => html`<option key=${type} value=${type}>${t('enum.investor_types.' + type)}</option>`)}</select><//>
      <${Input} label=${t('investor.phone')} required=${true} error=${fieldError('phone')} valid=${fieldValid('phone')}><input class="input input-sm" type="tel" inputmode="tel" autocomplete="tel" placeholder=${data.country === 'BR' ? '(11) 91234-5678' : '+1 415 555 2671'} aria-invalid=${Boolean(fieldError('phone'))} value=${data.phone} onInput=${set('phone')} onBlur=${blur('phone')} /><//>
    </div>
    <${TermsChecks} terms=${data.accept_terms} privacy=${data.accept_privacy} onTerms=${set('accept_terms')} onPrivacy=${set('accept_privacy')} openLegal=${openLegal}
      termsError=${submitted && errors.accept_terms} privacyError=${submitted && errors.accept_privacy} />
    ${error && html`<div class="form-error" role="alert">${error}</div>`}
    <button class="btn btn-lime btn-xl" type="submit" disabled=${busy}>${t('investor.create_account')}</button>
    <p class="auth-switch">${t('investor.have_account')} <button type="button" class="btn-link link-accent" onClick=${() => switchTo('login')}>${t('investor.log_in')}</button></p>
  </form>`;
}

function Welcome({ switchTo, onGuest }) {
  const { t } = useI18n();
  const [data, setData] = useState({ name:'',company:'',email:'' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setData({ ...data, [key]:event.target.type === 'checkbox' ? event.target.checked : event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try { await onGuest(data); }
    catch { setError(t('investor.try_again')); setBusy(false); }
  };
  return html`<form class="auth-form" onSubmit=${submit}>
    <p class="section-note">${t('investor.welcome_intro')}</p>
    <${Input} label=${t('investor.first_name')} required=${true}><input class="input input-sm" required minlength="2" autocomplete="given-name" value=${data.name} onInput=${set('name')} /><//>
    <${Input} label=${t('investor.welcome_company')} required=${true}><input class="input input-sm" required autocomplete="organization" value=${data.company} onInput=${set('company')} /><//>
    <${Input} label=${t('investor.email')} required=${true}><input class="input input-sm" type="email" required autocomplete="email" value=${data.email} onInput=${set('email')} /><//>
    ${error && html`<div class="form-error" role="alert">${error}</div>`}
    <button class="btn btn-lime btn-xl" type="submit" disabled=${busy}>${t('investor.browse_24h')}</button>
    <p class="auth-switch">${t('investor.have_account')} <button type="button" class="btn-link link-accent" onClick=${() => switchTo('login')}>${t('investor.log_in')}</button></p>
    <p class="auth-switch">${t('investor.want_account')} <button type="button" class="btn-link link-accent" onClick=${() => switchTo('account')}>${t('investor.create_account')}</button></p>
  </form>`;
}

function Login({ onLoggedIn, switchTo }) {
  const { t } = useI18n();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [error,setError] = useState('');
  const [unverified,setUnverified] = useState(false);
  const [resent,setResent] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try { const result = await api.loginInvestor(email,password); if (result.ok) onLoggedIn(result.user); else { setUnverified(result.error === 'not_verified'); setError(result.error === 'not_verified' ? t('investor.verify_title') : t('login.invalid')); } }
    catch { setError(t('login.invalid')); }
  };
  return html`<form class="auth-form" onSubmit=${submit}>
    <${Input} label=${t('investor.email')}><input class="input input-sm" type="email" required autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} /><//>
    <${Input} label=${t('common.password')}><input class="input input-sm" type="password" required autocomplete="current-password" value=${password} onInput=${(e) => setPassword(e.target.value)} /><//>
    ${error && html`<div class="form-error" role="alert">${error}</div>`}
    ${unverified && html`<button class="btn-link link-accent" type="button" onClick=${async () => { try { await api.resendVerification(email); setResent(true); } catch { setError(t('investor.email_unavailable')); } }}>${t('investor.resend')}</button>`}
    ${resent && html`<p role="status">${t('investor.resent')}</p>`}
    <button class="btn btn-lime btn-xl" type="submit">${t('investor.log_in')}</button>
    <button class="btn-link link-accent" type="button" onClick=${() => switchTo('forgot')}>${t('investor.forgot_password')}</button>
    <p class="auth-switch">${t('investor.no_account')} <button type="button" class="btn-link link-accent" onClick=${() => switchTo('account')}>${t('investor.create_account')}</button></p>
  </form>`;
}

function Forgot({ switchTo }) {
  const { t } = useI18n();
  const [email,setEmail] = useState('');
  const [sent,setSent] = useState(false);
  const [error,setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try { await api.requestPasswordReset(email); setSent(true); }
    catch (err) { setError(err.data?.error === 'email_unavailable' ? t('investor.email_unavailable') : t('investor.try_again')); }
  };
  return html`<form class="auth-form" onSubmit=${submit}>
    <p class="form-subtitle">${t('investor.reset_intro')}</p>
    <${Input} label=${t('investor.email')}><input class="input input-sm" type="email" required autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} /><//>
    ${sent && html`<p class="section-note" role="status">${t('investor.reset_sent')}</p>`}
    ${error && html`<div class="form-error" role="alert">${error}</div>`}
    <button class="btn btn-lime btn-xl" type="submit">${t('investor.send_reset')}</button>
    <button class="btn-link link-accent" type="button" onClick=${() => switchTo('login')}>${t('investor.back_login')}</button>
  </form>`;
}

export function InvestorAuthModal({ initialMode = 'welcome', reason, prefill, onDone, onGuest, onClose, onVerificationStarted, required = false }) {
  const { t } = useI18n();
  const [mode,setMode] = useState(initialMode);
  const [waitingData,setWaitingData] = useState(null);
  const [resent,setResent] = useState(false);
  const [resendError,setResendError] = useState(false);
  const [legal,setLegal] = useState(null);
  const dismiss = () => { if (required) setMode('welcome'); else onClose(); };
  return html`<div class="modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-label=${t('investor.title')}>
      ${(!required || mode !== 'welcome') && html`<button type="button" class="modal-close" aria-label=${t('common.close')} onClick=${dismiss}>×</button>`}
      <div class="kicker">${t('investor.kicker')}</div>
      <h2 class="form-title">${t('investor.' + (mode === 'account' ? 'signup_title' : mode === 'waiting' ? 'verify_title' : mode === 'login' ? 'login_title' : mode === 'forgot' ? 'forgot_password' : 'welcome_title'))}</h2>
      ${reason && html`<p class="form-subtitle">${reason}</p>`}
      ${mode === 'welcome' && html`<${Welcome} switchTo=${setMode} onGuest=${onGuest} />`}
      ${mode === 'account' && html`<${AccountStart} switchTo=${setMode} onStarted=${(data) => { setWaitingData(data); setMode('waiting'); onVerificationStarted?.(); }} openLegal=${setLegal} />`}
      ${mode === 'waiting' && html`<div class="auth-form"><p class="form-subtitle">${t('investor.verify_text',{email:waitingData?.email})}</p><p class="section-note">${t('investor.verify_wait')}</p><button class="btn-link link-accent" type="button" onClick=${async () => { try { await api.resendVerification(waitingData.email); setResent(true); setResendError(false); } catch { setResendError(true); } }}>${t('investor.resend')}</button>${resent && html`<p role="status">${t('investor.resent')}</p>`}${resendError && html`<p role="alert">${t('investor.try_again')}</p>`}<button class="btn-link link-accent" type="button" onClick=${() => setMode('account')}>${t('investor.change_email')}</button></div>`}
      ${mode === 'login' && html`<${Login} onLoggedIn=${onDone} switchTo=${setMode} />`}
      ${mode === 'forgot' && html`<${Forgot} switchTo=${setMode} />`}
    </div>
    ${legal && html`<div class="modal-backdrop legal-backdrop" onClick=${(e) => { if (e.target === e.currentTarget) setLegal(null); }}><div class="modal legal-modal" role="dialog" aria-modal="true" aria-label=${t('legal.' + legal + '_title')}><button type="button" class="modal-close" aria-label=${t('common.close')} onClick=${() => setLegal(null)}>×</button><h2 class="form-title">${t('legal.' + legal + '_title')}</h2><div class="legal-copy">${t('legal.' + legal + '_body').split('\n\n').map((paragraph) => html`<p>${paragraph}</p>`)}</div></div></div>`}
  </div>`;
}

export function ResetPasswordPage({ token }) {
  const { t } = useI18n();
  const [password,setPassword] = useState('');
  const [error,setError] = useState('');
  const [done,setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try { await api.confirmPasswordReset(token,password); setDone(true); }
    catch { setError(t('investor.reset_invalid')); }
  };
  return html`<div class="section" style=${{maxWidth:'520px'}}><h1 class="form-title">${t('investor.reset_title')}</h1>
    ${done ? html`<p role="status">${t('investor.reset_done')}</p><a class="btn btn-lime" href="/">${t('common.back_public')}</a>` : html`<form class="auth-form" onSubmit=${submit}><${Input} label=${t('common.password')}><input class="input input-sm" type="password" required minlength="10" autocomplete="new-password" value=${password} onInput=${(e) => setPassword(e.target.value)} /><//>${error && html`<div class="form-error" role="alert">${error}</div>`}<button class="btn btn-lime btn-xl" type="submit">${t('investor.reset_button')}</button></form>`}
  </div>`;
}

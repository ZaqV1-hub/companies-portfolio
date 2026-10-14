// Investor welcome, verified sign-up, login and password recovery.
import { html, useEffect, useState } from '../lib/html.js';
import * as api from '../services/api.js?v=20261014-legal1';
import { useI18n } from '../lib/i18n.js';
import { countryOptions } from '../lib/countries.js';

const INVESTOR_TYPES = ['accelerator','angel','angel_network','asset_wealth_management','cvc','dfi','endowment','family_office','foundation','fund_of_funds','hnwi','non_profit','organization','pe_firm','pension_fund','service_provider','vc'];

function Input({ label, required, children }) {
  return html`<label class="auth-field"><span class="field-label">${label}${required && html`<span class="req"> *</span>`}</span>${children}</label>`;
}

function TermsChecks({ terms, privacy, onTerms, onPrivacy, openLegal }) {
  const { t } = useI18n();
  return html`<div class="auth-consents">
    <label class="check-line"><input type="checkbox" checked=${terms} onChange=${onTerms} />
      <span>${t('investor.accept_terms_pre')} <button type="button" class="btn-link link-accent" onClick=${() => openLegal('terms')}>${t('investor.terms')}</button> *</span></label>
    <label class="check-line"><input type="checkbox" checked=${privacy} onChange=${onPrivacy} />
      <span>${t('investor.accept_privacy_pre')} <button type="button" class="btn-link link-accent" onClick=${() => openLegal('privacy')}>${t('investor.privacy')}</button> *</span></label>
  </div>`;
}

function Welcome({ switchTo, onStarted, openLegal }) {
  const { t } = useI18n();
  const [data, setData] = useState({ name:'',institution:'',email:'',accept_terms:false,accept_privacy:false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setData({ ...data,[key]:e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!data.accept_terms || !data.accept_privacy) { setError(t('investor.accept_required')); return; }
    setBusy(true); setError('');
    try { await api.startInvestorEmail(data); onStarted(data); }
    catch (err) { setError(err.data?.error === 'email_taken' ? t('investor.email_taken') : err.data?.error === 'email_unavailable' || err.data?.error === 'email_delivery_failed' ? t('investor.email_unavailable') : t('investor.fix_errors')); }
    finally { setBusy(false); }
  };
  return html`<form class="auth-form" onSubmit=${submit}>
    <${Input} label=${t('investor.name')} required=${true}><input class="input input-sm" required minlength="2" autocomplete="name" value=${data.name} onInput=${set('name')} /><//>
    <${Input} label=${t('investor.institution')} required=${true}><input class="input input-sm" required autocomplete="organization" value=${data.institution} onInput=${set('institution')} /><//>
    <${Input} label=${t('investor.email')} required=${true}><input class="input input-sm" type="email" required autocomplete="email" value=${data.email} onInput=${set('email')} /><//>
    <${TermsChecks} terms=${data.accept_terms} privacy=${data.accept_privacy} onTerms=${set('accept_terms')} onPrivacy=${set('accept_privacy')} openLegal=${openLegal} />
    ${error && html`<div class="form-error" role="alert">${error}</div>`}
    <button class="btn btn-lime btn-xl" type="submit" disabled=${busy}>${t('investor.continue')}</button>
    <p class="auth-switch">${t('investor.have_account')} <button type="button" class="btn-link link-accent" onClick=${() => switchTo('login')}>${t('investor.log_in')}</button></p>
  </form>`;
}

function SignUp({ prefill, onDone, openLegal }) {
  const { t,lang } = useI18n();
  const [f,setF] = useState({ email:prefill.email,name:prefill.name,institution:prefill.institution,country:'',city:'',password:'',role:'',investor_type:'',phone:'',linkedin:'',accept_terms:false,accept_privacy:false });
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const set = (key) => (e) => setF({ ...f,[key]:e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!f.accept_terms || !f.accept_privacy) { setError(t('investor.accept_required')); return; }
    if (f.password.length < 10) { setError(t('investor.password_length')); return; }
    setBusy(true); setError('');
    try { const result = await api.registerInvestor({ ...f,lang }); onDone(result.user); }
    catch (err) { setError(err.data?.error === 'email_taken' ? t('investor.email_taken') : t('investor.fix_errors')); }
    finally { setBusy(false); }
  };
  return html`<form class="auth-form" onSubmit=${submit}>
    <p class="section-note">${t('investor.email_confirmed')}: <strong>${f.email}</strong></p>
    <div class="auth-grid">
      <${Input} label=${t('common.password')} required=${true}><input class="input input-sm" type="password" required minlength="10" autocomplete="new-password" value=${f.password} onInput=${set('password')} /><//>
      <${Input} label=${t('investor.country')} required=${true}><select class="input input-sm" required value=${f.country} onChange=${set('country')}><option value="">${t('form.choose')}</option>${countryOptions(lang).map((c) => html`<option key=${c.code} value=${c.code}>${c.name}</option>`)}</select><//>
      <${Input} label=${t('investor.city')} required=${true}><input class="input input-sm" required value=${f.city} onInput=${set('city')} /><//>
      <${Input} label=${t('investor.role')}><input class="input input-sm" value=${f.role} onInput=${set('role')} autocomplete="organization-title" /><//>
      <${Input} label=${t('investor.investor_type')}><select class="input input-sm" value=${f.investor_type} onChange=${set('investor_type')}><option value="">${t('form.choose')}</option>${INVESTOR_TYPES.map((v) => html`<option key=${v} value=${v}>${t('enum.investor_types.' + v)}</option>`)}</select><//>
      <${Input} label=${t('investor.phone')}><input class="input input-sm" type="tel" value=${f.phone} onInput=${set('phone')} autocomplete="tel" /><//>
      <${Input} label="LinkedIn"><input class="input input-sm" type="url" value=${f.linkedin} onInput=${set('linkedin')} /><//>
    </div>
    <${TermsChecks} terms=${f.accept_terms} privacy=${f.accept_privacy} onTerms=${set('accept_terms')} onPrivacy=${set('accept_privacy')} openLegal=${openLegal} />
    ${error && html`<div class="form-error" role="alert">${error}</div>`}
    <button class="btn btn-lime btn-xl" type="submit" disabled=${busy}>${t('investor.create_account')}</button>
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
    <p class="auth-switch">${t('investor.no_account')} <button type="button" class="btn-link link-accent" onClick=${() => switchTo('welcome')}>${t('investor.create_account')}</button></p>
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

export function InvestorAuthModal({ initialMode = 'welcome', reason, prefill, onDone, onClose }) {
  const { t } = useI18n();
  const [mode,setMode] = useState(initialMode);
  const [verified,setVerified] = useState(prefill || null);
  const [waitingData,setWaitingData] = useState(null);
  const [resent,setResent] = useState(false);
  const [resendError,setResendError] = useState(false);
  const [legal,setLegal] = useState(null);
  useEffect(() => { if (!prefill) api.investorEmailStatus().then((result) => { if (result.verified) { setVerified(result.data); setMode('signup'); } }).catch(() => {}); }, []);
  return html`<div class="modal-backdrop" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="modal" role="dialog" aria-modal="true" aria-label=${t('investor.title')}>
      <button type="button" class="modal-close" aria-label=${t('common.close')} onClick=${onClose}>×</button>
      <div class="kicker">${t('investor.kicker')}</div>
      <h2 class="form-title">${t('investor.' + (mode === 'signup' ? 'signup_title' : mode === 'login' ? 'login_title' : mode === 'forgot' ? 'forgot_password' : 'welcome_title'))}</h2>
      ${reason && html`<p class="form-subtitle">${reason}</p>`}
      ${mode === 'welcome' && html`<${Welcome} switchTo=${setMode} onStarted=${(data) => { setWaitingData(data); setMode('waiting'); }} openLegal=${setLegal} />`}
      ${mode === 'waiting' && html`<div class="auth-form"><p class="form-subtitle">${t('investor.verify_text',{email:waitingData?.email})}</p><p class="section-note">${t('investor.verify_wait')}</p><button class="btn-link link-accent" type="button" onClick=${async () => { try { await api.startInvestorEmail(waitingData); setResent(true); setResendError(false); } catch { setResendError(true); } }}>${t('investor.resend')}</button>${resent && html`<p role="status">${t('investor.resent')}</p>`}${resendError && html`<p role="alert">${t('investor.try_again')}</p>`}<button class="btn-link link-accent" type="button" onClick=${() => setMode('welcome')}>${t('investor.change_email')}</button></div>`}
      ${mode === 'signup' && verified && html`<${SignUp} prefill=${verified} onDone=${onDone} openLegal=${setLegal} />`}
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

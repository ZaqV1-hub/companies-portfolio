import { html, useEffect, useState } from '../../lib/html.js';
import * as api from '../../services/api.js?v=20261030-intake1';
import { useI18n } from '../../lib/i18n.js';
import { href, navigate } from '../../lib/router.js';

export function CompanySignupPage() {
  const { lang } = useI18n();
  const pt = lang === 'pt';
  const [company,setCompany] = useState('');
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [confirm,setConfirm] = useState('');
  const [terms,setTerms] = useState(false);
  const [privacy,setPrivacy] = useState(false);
  const [busy,setBusy] = useState(false);
  const [sent,setSent] = useState(false);
  const [error,setError] = useState('');
  const rules = [
    [pt ? 'Entre 10 e 128 caracteres' : 'Between 10 and 128 characters',password.length >= 10 && password.length <= 128],
    [pt ? 'Uma letra maiúscula' : 'One uppercase letter',/\p{Lu}/u.test(password)],
    [pt ? 'Uma letra minúscula' : 'One lowercase letter',/\p{Ll}/u.test(password)],
    [pt ? 'Um número' : 'One number',/\d/.test(password)],
  ];
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const freeEmail = /@(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|aol|proton)\./i.test(email);
  const submit = async (event) => {
    event.preventDefault();setError('');
    if (company.trim().length < 2 || name.trim().length < 2 || !emailValid || freeEmail || !rules.every(([,ok])=>ok) || confirm !== password || !terms || !privacy) {
      setError(pt ? 'Confira os campos, use um e-mail empresarial e aceite os termos antes de continuar.' : 'Check the fields, use a business email and accept the terms before continuing.');
      return;
    }
    setBusy(true);
    try { await api.registerCompany({organization_name:company.trim(),name:name.trim(),email:email.trim(),password,confirm_password:confirm,accept_terms:terms,accept_privacy:privacy,lang});setSent(true); }
    catch (err) { setError(err.message === 'email_taken' ? (pt ? 'Este e-mail já possui uma conta.' : 'This email already has an account.') : err.message === 'organization_exists' ? (pt ? 'Esta empresa já está cadastrada. Fale com a Abiquifi para obter acesso.' : 'This company is already registered. Contact Abiquifi for access.') : (pt ? 'Não foi possível criar a inscrição. Tente novamente.' : 'Could not create the application. Please try again.')); }
    finally { setBusy(false); }
  };
  return html`<div class="split"><div class="split-brand invitation-brand"><div class="split-brand-top"><img class="split-program-logo" src="assets/img/bph-program-negative.png" alt="Brazilian Pharma & Health" /></div><div class="split-brand-message"><h2>${pt ? 'Sua empresa no portfólio' : 'Your company in the portfolio'}</h2><p>${pt ? 'Preencha seu perfil para análise da Abiquifi. O cadastro não publica a empresa automaticamente.' : 'Complete your profile for Abiquifi review. Registration does not publish your company automatically.'}</p><div class="split-partners"><span>${pt ? 'Realização' : 'Partners'}</span><div><img src="assets/img/apexbrasil-negative.png" alt="ApexBrasil" /><img src="assets/img/abiquifi-negative.png" alt="Abiquifi" /></div></div></div></div>
    <div class="split-form"><div class="split-form-inner"><div class="kicker">${pt ? 'INSCRIÇÃO DE EMPRESA' : 'COMPANY APPLICATION'}</div><h1 class="form-title">${pt ? 'Cadastre sua empresa' : 'Add your company'}</h1>
      ${sent ? html`<div class="notice" role="status"><strong>${pt ? 'Confira seu e-mail' : 'Check your email'}</strong><p>${pt ? 'Enviamos um link para confirmar o e-mail empresarial. Depois, preencha o perfil e envie a inscrição para análise da Abiquifi.' : 'We sent a link to confirm your business email. Then complete your profile and submit the application for Abiquifi review.'}</p></div>` : html`<form class="stack company-signup-form" noValidate=${true} onSubmit=${submit}>
        <p class="form-subtitle">${pt ? 'A inscrição depende de aprovação da Abiquifi. Sua empresa só aparecerá no portfólio após essa análise.' : 'Your application requires Abiquifi approval. Your company will only appear in the portfolio after review.'}</p>
        <label><span class="field-label">${pt ? 'Nome da empresa' : 'Company name'} *</span><input class="input input-sm" value=${company} maxLength="80" onInput=${(e)=>setCompany(e.target.value)} /></label>
        <label><span class="field-label">${pt ? 'Seu nome' : 'Your name'} *</span><input class="input input-sm" value=${name} maxLength="200" autocomplete="name" onInput=${(e)=>setName(e.target.value)} /></label>
        <label><span class="field-label">${pt ? 'E-mail empresarial' : 'Business email'} *</span><input class=${`input input-sm${email && (!emailValid || freeEmail) ? ' invalid' : ''}`} type="email" value=${email} autocomplete="email" onInput=${(e)=>setEmail(e.target.value)} /></label>
        <label><span class="field-label">${pt ? 'Criar senha' : 'Create password'} *</span><input class="input input-sm" type="password" value=${password} autocomplete="new-password" onInput=${(e)=>setPassword(e.target.value)} /></label>
        <ul class="auth-password-rules">${rules.map(([label,ok])=>html`<li class=${ok ? 'met' : password ? 'unmet' : ''}>${label}</li>`)}</ul>
        <label><span class="field-label">${pt ? 'Confirmar senha' : 'Confirm password'} *</span><input class=${`input input-sm${confirm && confirm !== password ? ' invalid' : ''}${confirm && confirm === password ? ' valid' : ''}`} type="password" value=${confirm} autocomplete="new-password" onInput=${(e)=>setConfirm(e.target.value)} /></label>
        <label class="check-line"><input type="checkbox" checked=${terms} onChange=${(e)=>setTerms(e.target.checked)} />${pt ? 'Aceito os' : 'I accept the'} <a href=${href('/legal/terms')} target="_blank">${pt ? 'Termos de uso' : 'Terms of use'}</a></label>
        <label class="check-line"><input type="checkbox" checked=${privacy} onChange=${(e)=>setPrivacy(e.target.checked)} />${pt ? 'Aceito a' : 'I accept the'} <a href=${href('/legal/privacy')} target="_blank">${pt ? 'Política de privacidade' : 'Privacy policy'}</a></label>
        ${error && html`<div class="form-error" role="alert">${error}</div>`}
        <button class="btn btn-lime btn-xl" type="submit" disabled=${busy}>${busy ? (pt ? 'Enviando...' : 'Sending...') : (pt ? 'Criar conta para análise' : 'Create account for review')}</button>
        <a class="btn-link" href=${href('/company/login')}>${pt ? 'Já tem acesso? Entrar' : 'Already have access? Sign in'}</a>
      </form>`}
    </div></div></div>`;
}

export function CompanyEmailVerificationPage({ token, onLoggedIn }) {
  const {lang} = useI18n();
  const pt = lang === 'pt';
  const [state,setState] = useState('pending');
  useEffect(() => { api.verifyCompanyEmail(token).then((result)=>{onLoggedIn(result.user);setState('verified');}).catch(()=>setState('error')); },[token]);
  return html`<div class="section" style=${{maxWidth:'720px'}}><h1 class="form-title">${state === 'pending' ? (pt ? 'Confirmando e-mail...' : 'Confirming email...') : state === 'verified' ? (pt ? 'E-mail confirmado' : 'Email confirmed') : (pt ? 'Link inválido ou expirado' : 'Invalid or expired link')}</h1>
    ${state === 'verified' && html`<p>${pt ? 'Sua conta está pronta. Preencha o perfil e envie a inscrição para análise da Abiquifi. A publicação não é automática.' : 'Your account is ready. Complete your profile and submit it for Abiquifi approval. Publication is not automatic.'}</p><button type="button" class="btn btn-lime btn-xl" onClick=${()=>navigate('/company/profile')}>${pt ? 'Preencher perfil' : 'Complete profile'}</button>`}
    ${state === 'error' && html`<p>${pt ? 'Peça um novo link de confirmação à Abiquifi.' : 'Ask Abiquifi for a new confirmation link.'}</p>`}
  </div>`;
}
